import { supabase } from '../../../lib/supabase'
import { daysFromToday } from '../../../utils/dateOnly'
import { computeRetailTotals } from '../utils/retailTotals'
import type { DashboardStats, OverdueInvoice } from '../types/retailDashboardTypes'

const num = (v: unknown): number => Number(v) || 0

export async function fetchRetailDashboardData(): Promise<{ stats: DashboardStats; overdueInvoices: OverdueInvoice[] }> {
  const responses = await Promise.all([
    supabase.from('retail_projects').select('id, status'),
    supabase.from('retail_customers').select('id'),
    supabase.from('retail_project_phases').select('id, phase_type'),
    supabase.from('retail_contracts').select('id, phase_id, contract_amount, budget_realized'),
    supabase.from('retail_land_plots').select('total_price'),
    supabase
      .from('accounting_invoices')
      .select(`
        id,
        invoice_number,
        invoice_type,
        total_amount,
        paid_amount,
        remaining_amount,
        status,
        due_date,
        retail_contract_id,
        retail_customer_id,
        retail_contracts (contract_number, retail_customers (name)),
        retail_customers (name)
      `)
      .or('retail_contract_id.not.is.null,retail_customer_id.not.is.null')
  ])

  // supabase-js resolves a failed query as `{ data: null, error }` rather than rejecting, and
  // every read below falls back to `[]`. Unchecked — as this service was — a dropped request
  // rendered a retail portfolio of zeros that `useCachedData` had no way to tell from a real
  // one. Same guard as `Reports/services/retailReportService.ts:43-44`.
  const failed = responses.find(response => response.error !== null)
  if (failed?.error) throw new Error(failed.error.message)

  const [
    { data: projects },
    { data: customers },
    { data: phases },
    { data: contracts },
    { data: plots },
    { data: invoices }
  ] = responses

  const allInvoices = invoices || []

  const totals = computeRetailTotals({
    phases: phases || [],
    contracts: contracts || [],
    landPlots: plots || [],
    invoices: allInvoices
  })

  // Receivables only. The list is headed "Kašnjenja u plaćanju" and each row ends in "za
  // naplatu", so a late *supplier* invoice had no business appearing in it under the
  // supplier's name — the money there is owed by us, not to us.
  const overdueInvoices: OverdueInvoice[] = allInvoices
    .filter(inv => {
      if (inv.invoice_type !== 'OUTGOING_SALES') return false
      if (inv.status !== 'UNPAID' && inv.status !== 'PARTIALLY_PAID') return false
      if (!inv.due_date) return false
      return daysFromToday(inv.due_date) < 0
    })
    .map(inv => {
      const contract = inv.retail_contracts as unknown as { retail_customers?: { name: string } | null; contract_number?: string } | null
      return {
        id: inv.id,
        invoice_number: inv.invoice_number,
        customer_name: (inv.retail_customers as unknown as { name: string } | null)?.name
          || contract?.retail_customers?.name
          || inv.invoice_number,
        contract_number: contract?.contract_number || '',
        remaining_amount: num(inv.remaining_amount),
        due_date: inv.due_date || '',
        days_overdue: -daysFromToday(inv.due_date)
      }
    })
    .sort((a, b) => b.days_overdue - a.days_overdue)

  const allProjects = projects || []

  const stats: DashboardStats = {
    ...totals,
    total_projects: allProjects.length,
    // The report's rule for an active project (`retailReportService.ts:119`). The subtitle
    // said "Aktivnih projekata" while the figure counted every row, completed and cancelled
    // alike.
    active_projects: allProjects.filter(p => p.status === 'In Progress').length,
    total_customers: (customers || []).length
  }

  return { stats, overdueInvoices }
}
