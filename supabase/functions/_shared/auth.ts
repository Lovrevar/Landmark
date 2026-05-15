// Shared authentication for edge functions invoked from the browser.
//
// authenticate(req) verifies the caller's Supabase JWT, looks up the
// matching public.users row, and returns an AuthContext containing both
// a JWT-scoped (RLS-respecting) client and a service-role client.
//
// Returns a discriminated union: callers should check `'error' in result`.

import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2'
import type { Database } from './database.ts'

export type Role = 'Director' | 'Accounting' | 'Sales' | 'Supervision' | 'Investment'

export interface ProjectAssignment {
  id: string
  project_id: string
  project_name: string
  assigned_at: string
}

export interface AuthContext {
  userId: string                            // public.users.id
  authUserId: string                        // auth.users.id
  role: Role
  email: string | null
  assignedProjects: ProjectAssignment[]
  userClient: SupabaseClient<Database>      // RLS-respecting (anon key + JWT)
  serviceClient: SupabaseClient<Database>   // RLS-bypassing (service role)
}

export interface ErrorResponse {
  code: string
  message: string
}

export type AuthResult = AuthContext | { error: ErrorResponse; status: number }

export async function authenticate(req: Request): Promise<AuthResult> {
  const authHeader = req.headers.get('Authorization') ?? req.headers.get('authorization')
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    console.warn('[ai-chat:auth] unauthorized', { reason: 'missing or malformed Authorization header' })
    return {
      error: { code: 'unauthorized', message: 'Missing or invalid Authorization header' },
      status: 401,
    }
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

  if (!supabaseUrl || !anonKey || !serviceKey) {
    console.error('[ai-chat:auth] internal_error', { reason: 'missing Supabase env vars' })
    return {
      error: { code: 'internal_error', message: 'Server misconfigured' },
      status: 500,
    }
  }

  // RLS-respecting client carrying the user's JWT.
  const userClient = createClient<Database>(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: authHeader } },
  })

  const { data: { user: authUser }, error: getUserError } = await userClient.auth.getUser()
  if (getUserError || !authUser) {
    console.warn('[ai-chat:auth] unauthorized', {
      reason: 'getUser failed',
      code: getUserError?.code,
    })
    return {
      error: { code: 'unauthorized', message: 'Invalid or expired token' },
      status: 401,
    }
  }

  // Service-role client for the public.users / project_managers lookups.
  // We bypass RLS here because authorization decisions should be authoritative,
  // not subject to per-user policies that may not yet be in place.
  const serviceClient = createClient<Database>(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const { data: profile, error: profileError } = await serviceClient
    .from('users')
    .select('id, role, email')
    .eq('auth_user_id', authUser.id)
    .maybeSingle()

  if (profileError) {
    console.error('[ai-chat:auth] internal_error', {
      reason: 'public.users lookup failed',
      authUserId: authUser.id,
      code: profileError.code,
    })
    return {
      error: { code: 'internal_error', message: 'Failed to load user profile' },
      status: 500,
    }
  }

  if (!profile) {
    console.warn('[ai-chat:auth] no_profile', { authUserId: authUser.id })
    return {
      error: { code: 'no_profile', message: 'No user profile found for this account' },
      status: 403,
    }
  }

  // Mirror src/contexts/AuthContext.tsx: only Supervision users get a populated
  // assignedProjects array. Other roles get [] regardless of any
  // project_managers rows that might exist for them.
  let assignedProjects: ProjectAssignment[] = []
  if (profile.role === 'Supervision') {
    const { data: projectData, error: pmError } = await serviceClient
      .from('project_managers')
      .select('id, project_id, assigned_at, projects:project_id (name)')
      .eq('user_id', profile.id)

    if (pmError) {
      // Non-fatal — match the AuthContext.tsx behavior.
      console.warn('[ai-chat:auth] project_managers fetch failed', {
        userId: profile.id,
        code: pmError.code,
      })
    } else if (projectData) {
      assignedProjects = (projectData as unknown as Array<{
        id: string
        project_id: string
        assigned_at: string
        projects?: { name: string } | null
      }>).map((pm) => ({
        id: pm.id,
        project_id: pm.project_id,
        project_name: pm.projects?.name ?? 'Unknown Project',
        assigned_at: pm.assigned_at,
      }))
    }
  }

  return {
    userId: profile.id,
    authUserId: authUser.id,
    // The DB CHECK constraint on users.role enforces the Role union; the
    // generated types still surface it as `string`, so we narrow here.
    role: profile.role as Role,
    email: profile.email,
    assignedProjects,
    userClient,
    serviceClient,
  }
}
