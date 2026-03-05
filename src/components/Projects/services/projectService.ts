import { supabase } from '../../../lib/supabase'
import type { ProjectWithStats } from '../types'

export async function fetchProjectsWithStats(): Promise<ProjectWithStats[]> {
  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) throw error

  return Promise.all(
    (data || []).map(async (project) => {
      const { data: contractsData } = await supabase
        .from('contracts')
        .select('budget_realized')
        .eq('project_id', project.id)

      const { data: milestonesData } = await supabase
        .from('project_milestones')
        .select('id, completed')
        .eq('project_id', project.id)

      const total_spent = contractsData?.reduce((sum, c) => sum + Number(c.budget_realized || 0), 0) || 0
      const milestones_total = milestonesData?.length || 0
      const milestones_completed = milestonesData?.filter(m => m.completed).length || 0
      const completion_percentage = milestones_total > 0
        ? Math.round((milestones_completed / milestones_total) * 100)
        : 0

      return {
        ...project,
        stats: { total_spent, completion_percentage, milestones_completed, milestones_total }
      }
    })
  )
}
