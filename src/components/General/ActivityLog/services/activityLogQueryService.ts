import { supabase } from '../../../../lib/supabase'
import type { ActivityLogEntry } from '../types'

/** Result of one page read. */
export interface ActivityLogPage {
  logs: ActivityLogEntry[]
  /**
   * False when the database's `get_activity_logs` predates the exclude filter (migration
   * 20261005100000 not applied yet): the rows then include everything, as they always did.
   */
  excludeSupported: boolean
}

// PostgREST's "no function matches these arguments" — what an older get_activity_logs answers
// when sent a parameter it does not have.
const UNKNOWN_FUNCTION_SIGNATURE = 'PGRST202'

export async function fetchActivityLogs(
  filters: {
    userId?: string | null
    actionPrefix?: string | null
    /** Leave out every action under this prefix (`'help'` hides `help.*`). */
    excludeActionPrefix?: string | null
    severity?: string | null
    searchTerm?: string | null
    dateFrom?: string | null
    dateTo?: string | null
    projectId?: string | null
  },
  offset: number,
  limit: number
): Promise<ActivityLogPage> {
  const args = {
    p_user_id: filters.userId || null,
    p_action_prefix: filters.actionPrefix || null,
    p_severity: filters.severity || null,
    p_search_term: filters.searchTerm || null,
    p_date_from: filters.dateFrom ? new Date(filters.dateFrom).toISOString() : null,
    p_date_to: filters.dateTo ? new Date(filters.dateTo + 'T23:59:59').toISOString() : null,
    p_project_id: filters.projectId || null,
    p_offset: offset,
    p_limit: limit,
  }

  if (filters.excludeActionPrefix) {
    const { data, error } = await supabase.rpc('get_activity_logs', {
      ...args,
      p_exclude_action_prefix: filters.excludeActionPrefix,
    })
    if (!error) return { logs: (data || []) as ActivityLogEntry[], excludeSupported: true }
    // Any other failure is a real one. This one means "ask the old way": the page still works,
    // it just cannot hide anything yet.
    if (error.code !== UNKNOWN_FUNCTION_SIGNATURE) throw error
  }

  const { data, error } = await supabase.rpc('get_activity_logs', args)
  if (error) throw error
  return { logs: (data || []) as ActivityLogEntry[], excludeSupported: !filters.excludeActionPrefix }
}

export async function fetchLogUsers(): Promise<{ id: string; username: string }[]> {
  const { data, error } = await supabase
    .from('users')
    .select('id, username')
    .order('username')

  if (error) throw error
  return data || []
}

export async function fetchProjects(): Promise<{ id: string; name: string }[]> {
  const { data, error } = await supabase
    .from('projects')
    .select('id, name')
    .order('name')

  if (error) throw error
  return data || []
}
