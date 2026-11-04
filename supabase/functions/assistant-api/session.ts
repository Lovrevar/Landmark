// Which Landmark user an assertion speaks for, and a real session for them
// (docs/ASSISTANT_API.md, "Which Landmark user").
//
// The handlers read through the user's own RLS client, exactly as in chat, so
// the request needs that user's access token. There is no browser to hand one
// over: the service role mints a magic link and verifies it at once, which
// yields an ordinary session. It is signed out after the request. Neither the
// link, its hash nor the token is ever logged.

import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2'
import type { Database } from '../_shared/database.ts'

type Service = SupabaseClient<Database>

export interface MappedUser {
  id: string            // public.users.id
  authUserId: string    // auth.users.id
  username: string | null
}

/** `%`, `_` and `\` match literally in an ilike pattern only when escaped. */
function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (ch) => `\\${ch}`)
}

/** The one public.users row with this email (any case) and a login; null if
 * there is none, or more than one. */
export async function mapUser(service: Service, email: string): Promise<MappedUser | null> {
  const { data, error } = await service
    .from('users')
    .select('id, auth_user_id, username')
    .ilike('email', escapeLike(email))
    .not('auth_user_id', 'is', null)
    .limit(2)
  if (error) throw new Error(`users lookup failed: ${error.code}`)
  if (!data || data.length === 0) return null
  if (data.length > 1) {
    console.warn('[assistant-api] not_mapped', { reason: 'ambiguous', rows: data.length })
    return null
  }
  return { id: data[0].id, authUserId: data[0].auth_user_id!, username: data[0].username }
}

/** An access token for this user. The link is minted for the email on the
 * auth account the row points at, not the one on the row, so a drifted
 * public.users.email cannot sign in someone else. */
export async function openSession(service: Service, user: MappedUser): Promise<string> {
  const { data: found, error: getError } = await service.auth.admin.getUserById(user.authUserId)
  if (getError || !found.user?.email) throw new Error(`auth user lookup failed: ${getError?.code ?? 'no_email'}`)

  const { data: link, error: linkError } = await service.auth.admin.generateLink({
    type: 'magiclink',
    email: found.user.email,
  })
  if (linkError || !link.properties?.hashed_token) throw new Error(`generateLink failed: ${linkError?.code ?? 'no_hash'}`)

  const anon = createClient<Database>(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { data: verified, error: verifyError } = await anon.auth.verifyOtp({
    token_hash: link.properties.hashed_token,
    type: 'magiclink',
  })
  if (verifyError || !verified.session?.access_token) throw new Error(`verifyOtp failed: ${verifyError?.code ?? 'no_session'}`)
  return verified.session.access_token
}

/** Revoke the session opened for this request. Best effort: a failure is
 * logged, and the token still expires on its own. */
export async function closeSession(service: Service, accessToken: string, userId: string): Promise<void> {
  const { error } = await service.auth.admin.signOut(accessToken, 'local')
  if (error) console.error('[assistant-api] session sign-out failed', { userId, code: error.code ?? error.status })
}
