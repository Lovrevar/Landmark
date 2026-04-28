import { supabase } from '../../../../lib/supabase'
import { logActivity } from '../../../../lib/activityLog'
import { format } from 'date-fns'
import type { RetailLandPlot, RetailCustomer, RetailSale } from '../../../../types/retail'

export interface SaleWithRelations extends RetailSale {
  land_plot?: RetailLandPlot
  customer?: RetailCustomer
}

export interface RetailSalePayload {
  land_plot_id: string
  customer_id: string
  sale_area_m2: number
  sale_price_per_m2: number
  payment_deadline: string
  contract_number: string | null
  notes: string | null
}

export async function fetchRetailSalesWithRelations(): Promise<SaleWithRelations[]> {
  const { data, error } = await supabase
    .from('retail_sales')
    .select('*, land_plot:retail_land_plots(*), customer:retail_customers(*)')
    .order('payment_deadline', { ascending: true })
  if (error) throw error
  return ((data || []) as SaleWithRelations[]).map(sale => ({
    ...sale,
    payment_status: new Date(sale.payment_deadline) < new Date() && sale.payment_status !== 'paid'
      ? 'overdue' as const
      : sale.payment_status
  }))
}

export async function fetchRetailLandPlotsForSale(): Promise<RetailLandPlot[]> {
  const { data, error } = await supabase
    .from('retail_land_plots')
    .select('*')
    .order('plot_number')
  if (error) throw error
  return data || []
}

export async function fetchRetailCustomersForSale(): Promise<RetailCustomer[]> {
  const { data, error } = await supabase
    .from('retail_customers')
    .select('*')
    .order('name')
  if (error) throw error
  return data || []
}

export async function upsertRetailSale(payload: RetailSalePayload, id?: string): Promise<void> {
  if (id) {
    const { error } = await supabase.from('retail_sales').update(payload).eq('id', id)
    if (error) throw error

    logActivity({ action: 'retail_sale.create', entity: 'retail_sale', entityId: id, metadata: { severity: 'high', sale_area_m2: payload.sale_area_m2 } })
  } else {
    const { data: inserted, error } = await supabase.from('retail_sales').insert([payload]).select('id').maybeSingle()
    if (error) throw error

    logActivity({ action: 'retail_sale.create', entity: 'retail_sale', entityId: inserted?.id ?? null, metadata: { severity: 'high', sale_area_m2: payload.sale_area_m2 } })
  }
}

export async function deleteRetailSale(id: string): Promise<void> {
  const { error } = await supabase.from('retail_sales').delete().eq('id', id)
  if (error) throw error

  logActivity({ action: 'retail_sale.delete', entity: 'retail_sale', entityId: id, metadata: { severity: 'high' } })
}

export async function recordRetailSalePayment(
  saleId: string,
  newPaidAmount: number,
  newStatus: 'paid' | 'pending' | 'partial' | 'overdue'
): Promise<void> {
  const { error } = await supabase
    .from('retail_sales')
    .update({ paid_amount: newPaidAmount, payment_status: newStatus })
    .eq('id', saleId)
  if (error) throw error
}

export interface RetailSalesPaymentWithDetails {
  id: string
  payment_date: string
  amount: number
  payment_method: string
  description?: string
  created_at: string
  invoice_number: string
  issue_date: string
  invoice_total_amount: number
  project_name: string
  customer_name: string
  contract_number: string
  bank_account_name: string
}

export interface SalesStats {
  totalPayments: number
  totalAmount: number
  paymentsThisMonth: number
  amountThisMonth: number
}

type InvoiceJoin = {
  id: string
  invoice_number: string
  issue_date: string
  total_amount: number
  retail_customers?: { name?: string } | null
  retail_contracts?: {
    contract_number?: string
    retail_project_phases?: { retail_projects?: { name?: string } } | null
  } | null
  retail_projects?: { name?: string } | null
}

export async function fetchRetailSalesPayments(): Promise<RetailSalesPaymentWithDetails[]> {
  const { data: invoicesData, error: invoicesError } = await supabase
    .from('accounting_invoices')
    .select(`
      id, invoice_number, issue_date, total_amount,
      retail_customer_id, retail_contract_id, retail_project_id,
      retail_customers(name),
      retail_contracts(
        contract_number,
        customer_id,
        retail_project_phases(retail_projects(name))
      ),
      retail_projects(name)
    `)
    .eq('invoice_type', 'OUTGOING_SALES')
    .or('retail_contract_id.not.is.null,retail_customer_id.not.is.null')
    .order('issue_date', { ascending: false })

  if (invoicesError) throw invoicesError

  const invoiceIds = invoicesData?.map(inv => inv.id) || []
  if (invoiceIds.length === 0) return []

  const { data: paymentsData, error: paymentsError } = await supabase
    .from('accounting_payments')
    .select('id, payment_date, amount, payment_method, description, created_at, invoice_id, company_bank_account_id')
    .in('invoice_id', invoiceIds)
    .order('payment_date', { ascending: false })

  if (paymentsError) throw paymentsError

  const bankAccountIds = [...new Set((paymentsData || []).map(p => p.company_bank_account_id).filter(Boolean))]
  let bankAccountsData: { id: string; bank_name: string | null }[] = []
  if (bankAccountIds.length > 0) {
    const { data: accounts } = await supabase
      .from('company_bank_accounts')
      .select('id, bank_name')
      .in('id', bankAccountIds)
    bankAccountsData = accounts || []
  }

  return (paymentsData || []).map(payment => {
    const invoice = invoicesData?.find(inv => inv.id === payment.invoice_id) as InvoiceJoin | undefined
    const bankAccount = bankAccountsData.find(ba => ba.id === payment.company_bank_account_id)

    let projectName = 'N/A'
    if (invoice?.retail_contracts?.retail_project_phases?.retail_projects?.name) {
      projectName = invoice.retail_contracts.retail_project_phases.retail_projects.name
    } else if (invoice?.retail_projects?.name) {
      projectName = invoice.retail_projects.name
    }

    return {
      id: payment.id,
      payment_date: payment.payment_date,
      amount: parseFloat(payment.amount),
      payment_method: payment.payment_method,
      description: payment.description,
      created_at: payment.created_at,
      invoice_number: invoice?.invoice_number || 'N/A',
      issue_date: invoice?.issue_date || '',
      invoice_total_amount: invoice?.total_amount || 0,
      contract_number: invoice?.retail_contracts?.contract_number || 'N/A',
      project_name: projectName,
      customer_name: invoice?.retail_customers?.name || 'N/A',
      bank_account_name: bankAccount?.bank_name || 'N/A',
    }
  })
}

export function calculateSalesStats(payments: RetailSalesPaymentWithDetails[]): SalesStats {
  const now = new Date()
  const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
  const totalAmount = payments.reduce((sum, p) => sum + p.amount, 0)
  const thisMonth = payments.filter(p => new Date(p.payment_date) >= firstDayOfMonth)
  return {
    totalPayments: payments.length,
    totalAmount,
    paymentsThisMonth: thisMonth.length,
    amountThisMonth: thisMonth.reduce((sum, p) => sum + p.amount, 0),
  }
}

export function exportRetailSalesCSV(payments: RetailSalesPaymentWithDetails[]): void {
  const headers = ['Payment Date', 'Invoice #', 'Invoice Date', 'Contract #', 'Project', 'Customer', 'Invoice Total', 'Payment Amount', 'Payment Method', 'Bank Account', 'Description']
  const rows = payments.map(p => [
    format(new Date(p.payment_date), 'yyyy-MM-dd'),
    p.invoice_number,
    p.issue_date ? format(new Date(p.issue_date), 'yyyy-MM-dd') : '',
    p.contract_number,
    p.project_name,
    p.customer_name,
    p.invoice_total_amount.toString(),
    p.amount.toString(),
    p.payment_method,
    p.bank_account_name,
    p.description || '',
  ])
  const csv = [headers, ...rows].map(row => row.join(',')).join('\n')
  const blob = new Blob([csv], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `retail-sales-payments-${format(new Date(), 'yyyy-MM-dd')}.csv`
  a.click()
}
