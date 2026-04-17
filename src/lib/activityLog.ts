import { supabase } from './supabase'

interface LogActivityParams {
  userId?: string
  userRole?: string
  action: string
  entity: string
  entityId?: string | null
  projectId?: string | null
  metadata?: Record<string, unknown>
  severity?: 'low' | 'medium' | 'high'
}

/**
 * Fire-and-forget activity logger.
 * Inserts a row into activity_logs asynchronously.
 * Never throws — a logging failure must not block the user's action.
 */
export function logActivity(params: LogActivityParams): void {
  const { action, entity, entityId, projectId, metadata = {}, severity } = params

  const record: Record<string, unknown> = {
    action,
    entity,
    entity_id: entityId ?? null,
    project_id: projectId ?? null,
    metadata: severity ? { ...metadata, severity } : metadata,
  }

  if (params.userId && params.userRole) {
    record.user_id = params.userId
    record.user_role = params.userRole
    insertLog(record)
  } else {
    resolveUserThenInsert(record)
  }
}

async function insertLog(record: Record<string, unknown>): Promise<void> {
  try {
    const { error } = await supabase.from('activity_logs').insert([record])
    if (error) console.warn('[activityLog] insert failed:', error.message)
  } catch (err) {
    console.warn('[activityLog] unexpected error:', err)
  }
}

async function resolveUserThenInsert(record: Record<string, unknown>): Promise<void> {
  try {
    const { data: authData, error: authError } = await supabase.auth.getUser()
    if (authError || !authData.user) {
      console.warn('[activityLog] could not resolve auth user:', authError?.message)
      return
    }

    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('id, role')
      .eq('auth_user_id', authData.user.id)
      .maybeSingle()

    if (userError || !userData) {
      console.warn('[activityLog] could not resolve public user:', userError?.message)
      return
    }

    record.user_id = userData.id
    record.user_role = userData.role
    insertLog(record)
  } catch (err) {
    console.warn('[activityLog] unexpected error resolving user:', err)
  }
}
