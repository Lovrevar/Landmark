import { supabase } from '../../../../lib/supabase'
import { logActivity } from '../../../../lib/activityLog'

export interface ProjectFormRecord {
  name: string
  location: string
  aliases: string[]
  start_date: string
  end_date: string | null
  budget: number
  status: string
}

export interface FetchedProject {
  name: string | null
  location: string | null
  aliases: string[] | null
  start_date: string | null
  end_date: string | null
  budget: number | null
  status: string | null
}

export async function fetchProjectById(projectId: string): Promise<FetchedProject | null> {
  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .eq('id', projectId)
    .single()

  if (error) throw error
  return data as FetchedProject | null
}

export async function updateProject(projectId: string, data: ProjectFormRecord): Promise<void> {
  const { error } = await supabase
    .from('projects')
    .update(data)
    .eq('id', projectId)
  if (error) throw error

  logActivity({
    action: 'project.update',
    entity: 'project',
    entityId: projectId,
    projectId,
    metadata: { severity: 'medium', entity_name: data.name, changed_fields: Object.keys(data) }
  })
}

export async function createProject(data: ProjectFormRecord): Promise<void> {
  const { data: inserted, error } = await supabase
    .from('projects')
    .insert([data])
    .select('id')
    .maybeSingle()
  if (error) throw error

  logActivity({
    action: 'project.create',
    entity: 'project',
    entityId: inserted?.id ?? null,
    projectId: inserted?.id ?? null,
    metadata: { severity: 'medium', entity_name: data.name }
  })
}

export async function deleteProject(projectId: string): Promise<void> {
  const { error } = await supabase
    .from('projects')
    .delete()
    .eq('id', projectId)
  if (error) throw error

  logActivity({
    action: 'project.delete',
    entity: 'project',
    entityId: projectId,
    metadata: { severity: 'high' }
  })
}
