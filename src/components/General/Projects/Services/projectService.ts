import { supabase } from '../../../../lib/supabase'
import type { ProjectWithStats } from '../types'

export async function fetchProjectsWithStats(): Promise<ProjectWithStats[]> {
  const { data, error } = await supabase
    .from('projects')
    .select(`
      *,
      contracts(budget_realized),
      project_milestones(id, completed)
    `)
    .order('created_at', { ascending: false })

  if (error) throw error

  return (data || []).map((project) => {
    const total_spent = (project.contracts as { budget_realized: number }[] | null)
      ?.reduce((sum, c) => sum + Number(c.budget_realized || 0), 0) || 0
    const milestones = (project.project_milestones as { id: string; completed: boolean }[] | null) || []
    const milestones_total = milestones.length
    const milestones_completed = milestones.filter(m => m.completed).length
    const completion_percentage = milestones_total > 0
      ? Math.round((milestones_completed / milestones_total) * 100)
      : 0

    const { contracts: _c, project_milestones: _m, ...projectFields } = project as typeof project & { contracts: unknown; project_milestones: unknown }
    return {
      ...projectFields,
      stats: { total_spent, completion_percentage, milestones_completed, milestones_total }
    }
  })
}
