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
 * Activity logger. Never throws — a logging failure must not block the user's action.
 * Returns a Promise so callers that need the insert to complete before the next
 * step (e.g. logout, which clears the session) can `await` it.
 * Fire-and-forget callers can ignore the return value.
 */
export function logActivity(params: LogActivityParams): Promise<void> {
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
    return insertLog(record)
  }
  return resolveUserThenInsert(record)
}

async function insertLog(record: Record<string, unknown>): Promise<void> {
  try {
    const { error } = await supabase.from('activity_logs').insert([record])
    if (!error) return

    const message = (error.message || '').toLowerCase()
    const isAuthError =
      error.code === 'PGRST301' ||
      message.includes('jwt') ||
      message.includes('unauthorized')

    if (isAuthError) {
      const { error: refreshError } = await supabase.auth.refreshSession()
      if (refreshError) {
        console.warn('[activityLog] refresh after 401 failed:', refreshError.message)
        return
      }
      const { error: retryError } = await supabase.from('activity_logs').insert([record])
      if (retryError) console.warn('[activityLog] insert retry failed:', retryError.message)
      return
    }

    console.warn('[activityLog] insert failed:', error.message)
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
    await insertLog(record)
  } catch (err) {
    console.warn('[activityLog] unexpected error resolving user:', err)
  }
}
