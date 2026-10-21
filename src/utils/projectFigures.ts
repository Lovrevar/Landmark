/**
 * Portfolio and project figures built from the others: profit, margin and ROI, a project's risk
 * level, the report's risks and recommendations, the top projects, and projects by status. For
 * the General report and the Director dashboard (REGRESSION_PREVENTION Step 7).
 *
 * Every ratio here is 0 when its base is 0 — a margin with no revenue, ROI with no equity. GEN-32
 * asks whether those should read "—" instead, and whether a project with no units should be
 * high risk, which it is today because its sales rate reads 0.
 */

/** Revenue minus expenses, and that as a percentage of revenue; 0 % with no revenue. */
export function profitAndMargin(revenue: number, expenses: number): { profit: number; margin: number } {
  const profit = revenue - expenses
  return { profit, margin: revenue > 0 ? (profit / revenue) * 100 : 0 }
}

/** Profit as a percentage of equity; 0 with no equity. */
export const returnOnEquity = (profit: number, equity: number): number => (equity > 0 ? (profit / equity) * 100 : 0)

export type RiskLevel = 'Low' | 'Medium' | 'High'

/**
 * High below 20 % sold or at a loss; Medium below 50 % sold or under a 15 % margin; Low otherwise.
 * The General PDF colours project bars at 20 / 10 % margin, which is not the same scale (GEN-32).
 */
export function projectRiskLevel(salesRate: number, profitMargin: number): RiskLevel {
  if (salesRate < 20 || profitMargin < 0) return 'High'
  if (salesRate < 50 || profitMargin < 15) return 'Medium'
  return 'Low'
}

/** What the risk list reads from a project. */
export interface ProjectSalesSnapshot {
  name: string
  revenue: number
  sales_rate: number
  total_units: number
}

/**
 * The report's risks as `{ kind, count }`, translated where they are rendered. `slow_sales`: projects
 * with units, below 40 % sold. The Director dashboard alerts below 30 % (GEN-41).
 */
export function reportRisks(projects: readonly ProjectSalesSnapshot[]): { kind: 'slow_sales'; count: number }[] {
  const slow = projects.filter(p => p.sales_rate < 40 && p.total_units > 0).length
  return slow > 0 ? [{ kind: 'slow_sales', count: slow }] : []
}

/** The `n` projects with the most revenue, highest first. The input is left as it was. */
export const topProjectsByRevenue = <T extends { revenue: number }>(projects: readonly T[], n = 3): T[] =>
  [...projects].sort((a, b) => b.revenue - a.revenue).slice(0, n)

/**
 * The strategic recommendations as i18n keys under `reports.general.recs.*`. Marketing below
 * 50 % sold, inventory when more units are available than sold, and two that always apply.
 * `pdf/pdfExportKeys.test.ts` reads the `push` calls below to check every key is translated.
 */
export function recommendationKeys({ salesRate, available, sold }: { salesRate: number; available: number; sold: number }): string[] {
  const recommendationKeys: string[] = []
  if (salesRate < 50) recommendationKeys.push('reports.general.recs.marketing')
  if (available > sold) recommendationKeys.push('reports.general.recs.inventory')
  recommendationKeys.push('reports.general.recs.budgets')
  recommendationKeys.push('reports.general.recs.partners')
  return recommendationKeys
}

/** Projects (or retail projects) by status: active is `In Progress`. */
export function projectStatusCounts(projects: readonly { status?: string | null }[]) {
  return {
    total: projects.length,
    active: projects.filter(p => p.status === 'In Progress').length,
    completed: projects.filter(p => p.status === 'Completed').length,
  }
}
