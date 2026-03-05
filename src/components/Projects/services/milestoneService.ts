import { supabase } from '../../../lib/supabase'

export async function addMilestone(
  projectId: string,
  data: { name: string; due_date: string | null; completed: boolean }
): Promise<void> {
  const { error } = await supabase
    .from('project_milestones')
    .insert({ project_id: projectId, name: data.name, due_date: data.due_date, completed: data.completed })
  if (error) throw error
}

export async function updateMilestone(
  id: string,
  data: { name: string; due_date: string | null; completed: boolean }
): Promise<void> {
  const { error } = await supabase
    .from('project_milestones')
    .update({ name: data.name, due_date: data.due_date, completed: data.completed })
    .eq('id', id)
  if (error) throw error
}

export async function deleteMilestone(id: string): Promise<void> {
  const { error } = await supabase
    .from('project_milestones')
    .delete()
    .eq('id', id)
  if (error) throw error
}

export async function toggleMilestoneCompletion(id: string, completed: boolean): Promise<void> {
  const { error } = await supabase
    .from('project_milestones')
    .update({ completed: !completed })
    .eq('id', id)
  if (error) throw error
}
