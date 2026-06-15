import { supabase } from '../../../../lib/supabase'
import { logActivity } from '../../../../lib/activityLog'

export async function addMilestone(
  projectId: string,
  data: { name: string; due_date: string | null; completed: boolean; phase?: string | null }
): Promise<void> {
  const { data: inserted, error } = await supabase
    .from('project_milestones')
    .insert({
      project_id: projectId,
      name: data.name,
      due_date: data.due_date,
      completed: data.completed,
      phase: data.phase ?? null
    })
    .select('id')
    .maybeSingle()
  if (error) throw error

  logActivity({
    action: 'milestone.create',
    entity: 'milestone',
    entityId: inserted?.id ?? null,
    projectId,
    metadata: { severity: 'medium', entity_name: data.name }
  })
}

export async function updateMilestone(
  id: string,
  data: { name: string; due_date: string | null; completed: boolean; phase?: string | null }
): Promise<void> {
  const updates: Record<string, unknown> = {
    name: data.name,
    due_date: data.due_date,
    completed: data.completed
  }
  if (data.phase !== undefined) updates.phase = data.phase
  const { error } = await supabase
    .from('project_milestones')
    .update(updates)
    .eq('id', id)
  if (error) throw error

  logActivity({
    action: 'milestone.update',
    entity: 'milestone',
    entityId: id,
    metadata: { severity: 'medium', entity_name: data.name, changed_fields: Object.keys(updates) }
  })
}

export async function deleteMilestone(id: string): Promise<void> {
  const { error } = await supabase
    .from('project_milestones')
    .delete()
    .eq('id', id)
  if (error) throw error

  logActivity({
    action: 'milestone.delete',
    entity: 'milestone',
    entityId: id,
    metadata: { severity: 'high' }
  })
}

export async function toggleMilestoneCompletion(id: string, completed: boolean): Promise<void> {
  const { error } = await supabase
    .from('project_milestones')
    .update({ completed: !completed })
    .eq('id', id)
  if (error) throw error

  logActivity({
    action: 'milestone.update',
    entity: 'milestone',
    entityId: id,
    metadata: { severity: 'medium', changed_fields: ['completed'], completed: !completed }
  })
}

export async function bulkAddMilestones(
  projectId: string,
  rows: Array<{ name: string; due_date: string | null; phase: string | null }>
): Promise<void> {
  if (rows.length === 0) return
  const payload = rows.map(r => ({
    project_id: projectId,
    name: r.name,
    due_date: r.due_date,
    phase: r.phase,
    completed: false
  }))
  const { error } = await supabase.from('project_milestones').insert(payload)
  if (error) throw error

  logActivity({
    action: 'milestone.bulk_create',
    entity: 'milestone',
    projectId,
    metadata: { severity: 'medium', count: rows.length }
  })
}
