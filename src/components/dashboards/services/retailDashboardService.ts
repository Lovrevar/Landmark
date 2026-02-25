import { supabase } from '../../../lib/supabase'
import type { DashboardStats, OverdueInvoice } from '../types/retailDashboardTypes'

export async function fetchRetailDashboardData(): Promise<{ stats: DashboardStats; overdueInvoices: OverdueInvoice[] }> {
  const [
    { data: projects },
    { data: customers },
    { data: contracts },
    { data: salesInvoices }
  ] = await Promise.all([
    supabase.from('retail_projects').select('id'),
    supabase.from('retail_customers').select('id'),
    supabase.from('retail_contracts').select('id, budget_realized, phase_id, retail_phases(phase_type)'),
    supabase
      .from('accounting_invoices')
      .select(`
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

  const today = new Date()

  const total_invested = (contracts || [])
    .filter(c => {
      const phaseType = (c.retail_phases as any)?.phase_type
      return phaseType === 'development' || phaseType === 'construction'
    })
    .reduce((sum, c) => sum + parseFloat(c.budget_realized || 0), 0)

  const total_costs = total_invested

  const { data: payments } = await supabase
    .from('accounting_payments')
    .select('amount, invoice_id, accounting_invoices!inner(retail_contract_id)')
    .not('accounting_invoices.retail_contract_id', 'is', null)

  const total_paid = (payments || []).reduce((sum, p) => sum + parseFloat(p.amount || 0), 0)

  const total_remaining = (salesInvoices || [])
    .filter(inv => inv.status === 'UNPAID' || inv.status === 'PARTIAL')
    .reduce((sum, inv) => sum + parseFloat(inv.remaining_amount || 0), 0)

  const total_revenue = (salesInvoices || []).reduce((sum, inv) => sum + parseFloat(inv.total_amount || 0), 0)

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
    total_projects: (projects || []).length,
    total_customers: (customers || []).length,
    total_invested,
    total_costs,
    total_revenue,
    total_paid,
    total_remaining,
    profit: total_paid - total_costs
  }

  return { stats, overdueInvoices }
}
