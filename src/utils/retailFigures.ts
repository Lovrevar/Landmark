import { computeRetailTotals, type RetailContractRow, type RetailPhaseRow } from '../components/dashboards/utils/retailTotals'

/**
 * The General report's retail portfolio section (GEN-28 fixed how it counts).
 *
 * - **Active projects** are `retail_projects` in `'In Progress'`, and **completed phases** are
 *   `retail_project_phases` in `'Completed'`: the statuses the tables' CHECKs allow
 *   (`Planning | In Progress | Completed | On Hold` and `Pending | In Progress | Completed`).
 * - `retail_contracts` holds suppliers' and buyers' contracts alike, so the money is split by the
 *   phase a contract sits on, the way the Retail dashboard does it (`computeRetailTotals`):
 *   - **cost contracts** (development and construction phases): their value and what was paid,
 *   - **sales** (sales phases): the contracted value and what was collected.
 *   A contract with no phase, or on a phase of no known type, is in the count and in no sum.
 */

type RetailPortfolioPhase = RetailPhaseRow & { status?: string | null }

export interface RetailPortfolioInput {
  projects: readonly { status?: string | null }[]
  phases: readonly RetailPortfolioPhase[]
  contracts: readonly RetailContractRow[]
}

export interface RetailPortfolioCounts {
  projects: number
  activeProjects: number
  contracts: number
  /** Σ `contract_amount` of the cost contracts. */
  costContractValue: number
  /** Paid on the cost contracts (`budget_realized`). */
  costRealized: number
  /** Σ `contract_amount` of the sales contracts. */
  salesContracted: number
  /** Collected on the sales contracts (`budget_realized`). */
  collected: number
  phases: number
  completedPhases: number
}

export function retailPortfolioCounts({ projects, phases, contracts }: RetailPortfolioInput): RetailPortfolioCounts {
  // Land and invoices feed figures this section does not show.
  const totals = computeRetailTotals({ phases: [...phases], contracts: [...contracts], landPlots: [], invoices: [] })
  return {
    projects: projects.length,
    activeProjects: projects.filter(project => project.status === 'In Progress').length,
    contracts: contracts.length,
    costContractValue: totals.cost_contracted,
    costRealized: totals.total_invested,
    salesContracted: totals.total_revenue,
    collected: totals.total_collected,
    phases: phases.length,
    completedPhases: phases.filter(phase => phase.status === 'Completed').length,
  }
}
