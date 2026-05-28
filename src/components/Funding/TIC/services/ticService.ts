import { supabase } from '../../../../lib/supabase'
import { logActivity } from '../../../../lib/activityLog'
import type { LineItem } from '../utils/ticFormatters'

export interface TICProject {
  id: string
  name: string
}

export interface TICRecord {
  id: string
  investor_name: string
  document_date: string
  line_items: LineItem[]
}

export interface TICUpsertPayload {
  project_id: string
  investor_name: string
  document_date: string
  line_items: LineItem[]
  created_by: string | undefined
}

export async function fetchTICProjects(): Promise<TICProject[]> {
  const { data, error } = await supabase
    .from('projects')
    .select('id, name')
    .order('name')

  if (error) throw error
  return data || []
}

export async function fetchTICForProject(projectId: string): Promise<TICRecord | null> {
  const { data, error } = await supabase
    .from('tic_cost_structures')
    .select('*')
    .eq('project_id', projectId)
    .maybeSingle()

  if (error) throw error
  if (!data) return null

  return {
    id: data.id,
    investor_name: data.investor_name,
    document_date: data.document_date,
    line_items: data.line_items as LineItem[],
  }
}

export async function updateTIC(ticId: string, payload: TICUpsertPayload, projectId: string): Promise<void> {
  const { error } = await supabase
    .from('tic_cost_structures')
    .update({ ...payload, updated_at: new Date().toISOString() })
    .eq('id', ticId)

  if (error) throw error

  logActivity({
    action: 'tic.update',
    entity: 'tic_line_item',
    entityId: ticId,
    projectId,
    metadata: { severity: 'medium' },
  })
}

export async function createTIC(payload: TICUpsertPayload): Promise<string> {
  const { data, error } = await supabase
    .from('tic_cost_structures')
    .insert([{ ...payload, updated_at: new Date().toISOString() }])
    .select()
    .single()

  if (error) throw error

  logActivity({
    action: 'tic.update',
    entity: 'tic_line_item',
    entityId: data.id,
    projectId: payload.project_id,
    metadata: { severity: 'medium' },
  })

  return data.id
}
