import { supabase } from '../../../../lib/supabase'
import type { ProjectWithStats } from '../types'
import { fetchTICTotalsByProject } from '../../../Supervision/SiteManagement/services/siteService'
import { ticGrandTotal } from '../../../Funding/TIC/utils/ticBudget'

export async function fetchProjectsWithStats(): Promise<ProjectWithStats[]> {
  // The TIC totals come alongside, one query for the whole list: `projects.budget` means
  // nothing without a TIC, and the card must say so rather than print a stale typed figure.
  const [{ data, error }, ticLineItems] = await Promise.all([
    supabase
      .from('projects')
      .select(`
        *,
        contracts(budget_realized),
        project_milestones(id, completed)
      `)
      .order('created_at', { ascending: false }),
    fetchTICTotalsByProject(),
  ])

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

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { contracts: _c, project_milestones: _m, ...projectFields } = project as typeof project & { contracts: unknown; project_milestones: unknown }
    const tic = ticLineItems.get(project.id as string) ?? null
    return {
      ...projectFields,
      tic_total: tic ? ticGrandTotal(tic) : null,
      stats: { total_spent, completion_percentage, milestones_completed, milestones_total }
    }
  })
}
