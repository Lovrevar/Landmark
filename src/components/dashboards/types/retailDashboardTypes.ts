import type { RetailTotals } from '../utils/retailTotals'

/**
 * Retail dashboard KPIs. The money figures come from `computeRetailTotals`, which follows the
 * Retail report's definitions — see `../utils/retailTotals.ts` for what each one means and on
 * what basis (cash, net of VAT).
 */
export interface DashboardStats extends RetailTotals {
  total_projects: number
  /** Projects with `status === 'In Progress'`, the report's rule. */
  active_projects: number
  total_customers: number
}

export interface OverdueInvoice {
  id: string
  invoice_number: string
  customer_name: string
  contract_number: string
  remaining_amount: number
  due_date: string
  days_overdue: number
}
