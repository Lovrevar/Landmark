/**
 * Retail portfolio totals, on the Retail **report's** definitions so the dashboard and the
 * PDF report agree (`Reports/services/retailReportService.ts:103-111,176-180`, mirrored per
 * project by `Retail/Projects/ProjectStatistics.tsx:30-38`):
 *
 *   Costs     = land + development-phase paid + construction-phase paid
 *   Collected = sales-phase paid
 *   Profit    = collected − costs          (cash basis on both sides)
 *
 * Why the split has to come from the phase: `retail_contracts` holds **both** supplier and
 * customer contracts — the DB CHECK allows exactly one of `supplier_id` / `customer_id`
 * (`baseline_schema.sql:3715`) — so summing `budget_realized` over every contract, as the
 * dashboard used to, folded money *collected from buyers* into "costs" and left Profit
 * subtracting revenue from itself.
 *
 * Basis note: `retail_contracts.budget_realized` is maintained by the
 * `update_retail_contract_budget_realized_from_payments` trigger as the **net** paid share
 * `(total_paid / total_amount) * base_amount` (`baseline_schema.sql:2132-2186`) — it is not a
 * gross, VAT-inclusive figure, whatever the old "(s PDV)" subtitle claimed.
 *
 * Land comes from `retail_land_plots.total_price`, the source the report uses for its
 * **portfolio** totals (`retailReportService.ts:103`). The report's per-project figure uses
 * `retail_projects.purchase_price` instead; this dashboard is portfolio-level, so it uses the
 * portfolio source, consistently, for every land figure below.
 */

const num = (value: unknown): number => Number(value) || 0

/** `retail_project_phases` row — only the phase type matters here. */
export interface RetailPhaseRow {
  id: string
  phase_type: string | null
}

/** `retail_contracts` row. `phase_id` is what tells a cost contract from a sale. */
export interface RetailContractRow {
  id: string
  phase_id: string | null
  contract_amount?: unknown
  budget_realized?: unknown
}

/** `retail_land_plots` row. */
export interface RetailLandPlotRow {
  total_price?: unknown
}

/** `accounting_invoices` row, narrowed to what the collection figures need. */
export interface RetailInvoiceRow {
  retail_contract_id?: string | null
  status?: string | null
  total_amount?: unknown
  remaining_amount?: unknown
}

export interface RetailTotals {
  /** Σ `retail_land_plots.total_price` across the portfolio. */
  land_cost: number
  /** Development-phase contracts, paid. */
  development_cost: number
  /** Construction-phase contracts, paid. */
  construction_cost: number
  /**
   * Development + construction paid. Deliberately **excludes** land, so "Investirano" is not a
   * second name for Costs — the two tiles differ by exactly the land cost.
   */
  total_invested: number
  /** land + development + construction paid. */
  total_costs: number
  /** Contracted sales value: Σ `contract_amount` over sales-phase contracts. */
  total_revenue: number
  /** Cash collected from buyers: Σ `budget_realized` over sales-phase contracts. */
  total_collected: number
  /** Still to collect: Σ `remaining_amount` over unsettled sales-contract invoices. */
  total_remaining: number
  /** Gross invoiced to buyers: Σ `total_amount` over sales-contract invoices. */
  total_invoiced: number
  /** collected − costs. */
  profit: number
}

export const EMPTY_RETAIL_TOTALS: RetailTotals = {
  land_cost: 0,
  development_cost: 0,
  construction_cost: 0,
  total_invested: 0,
  total_costs: 0,
  total_revenue: 0,
  total_collected: 0,
  total_remaining: 0,
  total_invoiced: 0,
  profit: 0
}

export interface RetailTotalsInput {
  phases: RetailPhaseRow[]
  contracts: RetailContractRow[]
  landPlots: RetailLandPlotRow[]
  invoices: RetailInvoiceRow[]
}

export function computeRetailTotals({
  phases,
  contracts,
  landPlots,
  invoices
}: RetailTotalsInput): RetailTotals {
  const phaseType = new Map<string, string | null>()
  for (const phase of phases) phaseType.set(phase.id, phase.phase_type)

  let development_cost = 0
  let construction_cost = 0
  let total_collected = 0
  let total_revenue = 0
  const salesContractIds = new Set<string>()

  for (const contract of contracts) {
    const type = contract.phase_id ? phaseType.get(contract.phase_id) : undefined
    const paid = num(contract.budget_realized)
    if (type === 'development') {
      development_cost += paid
    } else if (type === 'construction') {
      construction_cost += paid
    } else if (type === 'sales') {
      // Money in, never a cost.
      total_collected += paid
      total_revenue += num(contract.contract_amount)
      salesContractIds.add(contract.id)
    }
    // A contract on a phase we do not recognise (or with no phase) is left out of every
    // total rather than guessed at — guessing is how sales landed in costs.
  }

  let total_remaining = 0
  let total_invoiced = 0
  for (const invoice of invoices) {
    if (!invoice.retail_contract_id || !salesContractIds.has(invoice.retail_contract_id)) continue
    total_invoiced += num(invoice.total_amount)
    if (invoice.status !== 'PAID') total_remaining += num(invoice.remaining_amount)
  }

  const land_cost = landPlots.reduce((sum, plot) => sum + num(plot.total_price), 0)
  const total_invested = development_cost + construction_cost
  const total_costs = land_cost + total_invested

  return {
    land_cost,
    development_cost,
    construction_cost,
    total_invested,
    total_costs,
    total_revenue,
    total_collected,
    total_remaining,
    total_invoiced,
    profit: total_collected - total_costs
  }
}
