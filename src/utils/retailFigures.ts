/**
 * The General report's retail portfolio section, as it counts today (REGRESSION_PREVENTION
 * Step 7). Moved here unchanged so the section is tested before it is fixed, and **it is wrong in
 * three ways (GEN-28)**:
 *
 * - "Active" projects test `status = 'active'`, and `retail_projects` allows
 *   `Planning | In Progress | Completed | On Hold`, so the count is always 0.
 * - "Completed" phases test `'completed'`, and `retail_project_phases` allows
 *   `Pending | In Progress | Completed`, so it is always 0.
 * - Contract value and realised sum every `retail_contracts` row, buyers' contracts with
 *   suppliers'.
 *
 * The right definitions are the Retail dashboard's: `computeRetailTotals` in
 * `components/dashboards/utils/retailTotals.ts` splits costs from sales by phase. Fixing GEN-28
 * means calling that, and changing the pinned expectations in `generalReportService.test.ts`.
 */

const num = (value: unknown): number => Number(value || 0)

export interface RetailPortfolioInput {
  projects: readonly { status?: string | null }[]
  contracts: readonly { contract_amount?: number | string | null; budget_realized?: number | string | null }[]
  phases: readonly { status?: string | null }[]
}

export function retailPortfolioCounts({ projects, contracts, phases }: RetailPortfolioInput) {
  return {
    projects: projects.length,
    activeProjects: projects.filter(project => project.status === 'active').length,
    contracts: contracts.length,
    contractValue: contracts.reduce((sum, contract) => sum + num(contract.contract_amount), 0),
    realized: contracts.reduce((sum, contract) => sum + num(contract.budget_realized), 0),
    phases: phases.length,
    completedPhases: phases.filter(phase => phase.status === 'completed').length,
  }
}
