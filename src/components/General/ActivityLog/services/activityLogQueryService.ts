import { supabase } from '../../../../lib/supabase'
import type { ActivityLogEntry } from '../types'

export async function fetchActivityLogs(
  filters: {
    userId?: string | null
    actionPrefix?: string | null
    severity?: string | null
    searchTerm?: string | null
    dateFrom?: string | null
    dateTo?: string | null
    projectId?: string | null
  },
  offset: number,
  limit: number
): Promise<ActivityLogEntry[]> {
  const { data, error } = await supabase.rpc('get_activity_logs', {
    p_user_id: filters.userId || null,
    p_action_prefix: filters.actionPrefix || null,
    p_severity: filters.severity || null,
    p_search_term: filters.searchTerm || null,
    p_date_from: filters.dateFrom ? new Date(filters.dateFrom).toISOString() : null,
    p_date_to: filters.dateTo ? new Date(filters.dateTo + 'T23:59:59').toISOString() : null,
    p_project_id: filters.projectId || null,
    p_offset: offset,
    p_limit: limit,
  })

  if (error) throw error
  return (data || []) as ActivityLogEntry[]
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
