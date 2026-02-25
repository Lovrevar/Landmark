import { supabase } from '../../../lib/supabase'
import type { DashboardStats, OverdueInvoice } from '../types/retailDashboardTypes'

export async function fetchRetailDashboardData(): Promise<{ stats: DashboardStats; overdueInvoices: OverdueInvoice[] }> {
  const [
    { data: projects },
    { data: customers },
    contractsResult,
    invoicesResult
  ] = await Promise.all([
    supabase.from('retail_projects').select('id'),
    supabase.from('retail_customers').select('id'),
    supabase.from('retail_contracts').select('budget_realized'),
    supabase
      .from('accounting_invoices')
      .select(`
        id,
        invoice_number,
        invoice_type,
        total_amount,
        vat_amount,
        paid_amount,
        remaining_amount,
        status,
        due_date,
        retail_contract_id,
        retail_customer_id,
        retail_contracts (contract_number),
        retail_customers (name)
      `)
      .or('retail_contract_id.not.is.null,retail_customer_id.not.is.null')
  ])

  const contracts = contractsResult.data || []
  const invoices = invoicesResult.data || []
  const today = new Date()

  const total_invested = contracts.reduce((sum, c) => sum + parseFloat(c.budget_realized || 0), 0)
  const total_costs = total_invested

  const outgoingInvoices = invoices.filter(
    inv => inv.invoice_type === 'OUTGOING_SALES' || inv.invoice_type === 'OUTGOING'
  )
  const total_revenue = outgoingInvoices.reduce((sum, inv) => sum + parseFloat(inv.total_amount || 0), 0)

  const total_supplier_paid = invoices.reduce((sum, inv) => sum + parseFloat(inv.paid_amount || 0), 0)

  const total_remaining = invoices.reduce((sum, inv) => sum + parseFloat(inv.remaining_amount || 0), 0)

  const paymentsResult = await supabase
    .from('accounting_payments')
    .select('amount, accounting_invoices!inner(invoice_type, retail_contract_id, retail_customer_id)')
    .or('accounting_invoices.retail_contract_id.not.is.null,accounting_invoices.retail_customer_id.not.is.null')

  const total_paid = (paymentsResult.data || [])
    .filter(p => {
      const inv = p.accounting_invoices as any
      return inv?.invoice_type === 'OUTGOING_SALES' || inv?.invoice_type === 'OUTGOING'
    })
    .reduce((sum, p) => sum + parseFloat(p.amount || 0), 0)

  const overdueInvoices: OverdueInvoice[] = invoices
    .filter(inv => (inv.status === 'UNPAID' || inv.status === 'PARTIAL' || inv.status === 'PARTIALLY_PAID') && inv.due_date && new Date(inv.due_date) < today)
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
    total_supplier_paid,
    total_remaining,
    profit: total_paid - total_costs
  }

  return { stats, overdueInvoices }
}
