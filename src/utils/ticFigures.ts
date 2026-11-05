import { ticGrandTotal } from '../components/Funding/TIC/utils/ticBudget'
import type { LineItem } from '../components/Funding/TIC/utils/ticFormatters'

/**
 * Portfolio figures from the TIC: each project's planned budget, the portfolio value, and the
 * General report's plan summary (REGRESSION_PREVENTION Step 7). Built on `ticGrandTotal`, which
 * stays with the TIC module (`Funding/TIC/utils/ticBudget.ts`) beside the rest of the plan maths.
 */

/** A `tic_cost_structures` row, narrowed to what the portfolio figures read. */
export interface TicRow {
  project_id?: string | null
  line_items?: LineItem[] | null
}

/**
 * Each project's planned budget: its TIC grand total, for every project whose TIC totals more
 * than 0. A project missing from the map has no plan; `projects.budget` is never read, because it
 * still holds whatever was typed before the TIC took over (GEN-5 — Precko Zapad's leftover
 * €1.000.000.000 once made up 89% of a "portfolio value"). A TIC row with no project is skipped.
 */
export function ticTotalsByProject(tics: readonly TicRow[]): Map<string, number> {
  const totals = new Map<string, number>()
  for (const tic of tics) {
    if (!tic.project_id) continue
    const total = ticGrandTotal(tic.line_items || [])
    if (total > 0) totals.set(tic.project_id, total)
  }
  return totals
}

/** Σ planned budget over the given projects; one without a plan adds nothing. */
export const portfolioValue = (projectIds: readonly string[], totals: ReadonlyMap<string, number>): number =>
  projectIds.reduce((sum, id) => sum + (totals.get(id) ?? 0), 0)

/**
 * The General report's TIC summary, as it counts today: every TIC row's total, how many rows have
 * one, and the project count minus that. A row with no project counts as a plan, so "without a
 * plan" undercounts and can go negative (GEN-30).
 */
export function ticPlanSummary(tics: readonly TicRow[], projectCount: number) {
  const totals = tics.map(tic => ticGrandTotal(tic.line_items || []))
  const projectsWithPlan = totals.filter(total => total > 0).length
  return {
    totalPlanned: totals.reduce((sum, total) => sum + total, 0),
    projectsWithPlan,
    projectsWithoutPlan: projectCount - projectsWithPlan,
  }
}
