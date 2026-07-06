import { supabase } from '../../../lib/supabase'
import { daysFromToday } from '../../../utils/dateOnly'
import type { DashboardStats, OverdueInvoice } from '../types/retailDashboardTypes'

const num = (v: unknown): number => Number(v) || 0

export async function fetchRetailDashboardData(): Promise<{ stats: DashboardStats; overdueInvoices: OverdueInvoice[] }> {
  const [
    { data: projects },
    { data: customers },
    contractsResult,
    invoicesResult
  ] = await Promise.all([
    supabase.from('retail_projects').select('id'),
    supabase.from('retail_customers').select('id'),
    supabase.from('retail_contracts').select('budget_realized, status'),
    supabase
      .from('accounting_invoices')
      .select(`
        id,
        invoice_number,
        invoice_type,
        base_amount,
        total_amount,
        vat_amount,
        paid_amount,
        remaining_amount,
        status,
        due_date,
        retail_contract_id,
        retail_customer_id,
        retail_contracts (contract_number, retail_customers (name), retail_suppliers (name)),
        retail_customers (name)
      `)
      .or('retail_contract_id.not.is.null,retail_customer_id.not.is.null')
  ])

  const contracts = contractsResult.data || []
  const invoices = invoicesResult.data || []

  // Exclude cancelled contracts from invested/cost totals.
  const total_invested = contracts
    .filter(c => c.status !== 'Cancelled')
    .reduce((sum, c) => sum + num(c.budget_realized), 0)
  const total_costs = total_invested

  // Customer sales only. Revenue is net of VAT (base_amount); collection figures
  // come from the same OUTGOING_SALES set so the cards reconcile.
  const salesInvoices = invoices.filter(inv => inv.invoice_type === 'OUTGOING_SALES')
  const total_revenue = salesInvoices.reduce((sum, inv) => sum + num(inv.base_amount), 0)
  const total_collected = salesInvoices.reduce((sum, inv) => sum + num(inv.paid_amount), 0)
  const total_remaining = salesInvoices.reduce((sum, inv) => sum + num(inv.remaining_amount), 0)

  const overdueInvoices: OverdueInvoice[] = invoices
    .filter(inv => {
      if (inv.status !== 'UNPAID' && inv.status !== 'PARTIALLY_PAID') return false
      if (!inv.due_date) return false
      return daysFromToday(inv.due_date) < 0
    })
    .map(inv => {
      const contract = inv.retail_contracts as unknown as { retail_customers?: { name: string } | null; retail_suppliers?: { name: string } | null; contract_number?: string } | null
      return {
        id: inv.id,
        invoice_number: inv.invoice_number,
        customer_name: (inv.retail_customers as unknown as { name: string } | null)?.name
          || contract?.retail_customers?.name
          || contract?.retail_suppliers?.name
          || inv.invoice_number,
        contract_number: contract?.contract_number || '',
        remaining_amount: num(inv.remaining_amount),
        due_date: inv.due_date || '',
        days_overdue: -daysFromToday(inv.due_date)
      }
    })
    .sort((a, b) => b.days_overdue - a.days_overdue)

  const stats: DashboardStats = {
    total_projects: (projects || []).length,
    total_customers: (customers || []).length,
    total_invested,
    total_costs,
    total_revenue,
    total_collected,
    total_remaining,
    profit: total_revenue - total_costs
  }

  return { stats, overdueInvoices }
}
