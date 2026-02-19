import { supabase } from '../../../lib/supabase'
import type { DashboardStats, OverdueInvoice } from '../types/retailDashboardTypes'

export async function fetchRetailDashboardData(): Promise<{ stats: DashboardStats; overdueInvoices: OverdueInvoice[] }> {
  const [
    { data: plots },
    { data: customers },
    { data: salesInvoices }
  ] = await Promise.all([
    supabase.from('retail_land_plots').select('id, purchased_area_m2, total_price'),
    supabase.from('retail_customers').select('id'),
    supabase.from('accounting_invoices').select(`
      id,
      invoice_number,
      total_amount,
      paid_amount,
      remaining_amount,
      status,
      due_date,
      retail_contract_id,
      retail_customer_id,
      retail_contracts (contract_number, customer_id),
      retail_customers (name)
    `)
    .eq('invoice_type', 'OUTGOING_SALES')
    .or('retail_contract_id.not.is.null,retail_customer_id.not.is.null')
  ])

  const total_invested = (plots || []).reduce((sum, p) => sum + parseFloat(p.total_price || 0), 0)
  const total_revenue = (salesInvoices || []).reduce((sum, inv) => sum + parseFloat(inv.total_amount || 0), 0)
  const total_paid = (salesInvoices || []).reduce((sum, inv) => sum + parseFloat(inv.paid_amount || 0), 0)
  const total_remaining = (salesInvoices || []).reduce((sum, inv) => sum + parseFloat(inv.remaining_amount || 0), 0)
  const today = new Date()

  const overdueInvoices: OverdueInvoice[] = (salesInvoices || [])
    .filter(inv => inv.status !== 'PAID' && inv.due_date && new Date(inv.due_date) < today)
    .map(inv => ({
      id: inv.id,
      invoice_number: inv.invoice_number,
      customer_name: (inv.retail_customers as any)?.name || 'N/A',
      contract_number: (inv.retail_contracts as any)?.contract_number || 'N/A',
      remaining_amount: parseFloat(inv.remaining_amount || 0),
      due_date: inv.due_date || '',
      days_overdue: Math.floor((today.getTime() - new Date(inv.due_date).getTime()) / (1000 * 60 * 60 * 24))
    }))
    .sort((a, b) => b.days_overdue - a.days_overdue)

  const stats: DashboardStats = {
    total_plots: (plots || []).length,
    total_area: (plots || []).reduce((sum, p) => sum + parseFloat(p.purchased_area_m2 || 0), 0),
    total_invested,
    total_customers: (customers || []).length,
    total_revenue,
    total_paid,
    total_remaining,
    profit: total_paid - total_invested
  }

  return { stats, overdueInvoices }
}
