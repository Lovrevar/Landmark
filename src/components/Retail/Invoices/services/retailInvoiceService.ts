import { supabase } from '../../../../lib/supabase'
import { logActivity } from '../../../../lib/activityLog'
import { format } from 'date-fns'

export interface RetailInvoiceWithDetails {
  id: string
  invoice_number: string
  invoice_type: string
  issue_date: string
  due_date: string
  total_amount: number
  base_amount: number
  vat_amount: number
  status: string
  created_at: string
  approved: boolean
  supplier_name: string | null
  customer_name: string | null
  project_name: string
  company_name: string
}

export interface RetailInvoiceStats {
  totalInvoices: number
  totalAmount: number
  invoicesThisMonth: number
  amountThisMonth: number
}

export async function fetchRetailInvoices(): Promise<RetailInvoiceWithDetails[]> {
  const { data, error } = await supabase
    .from('accounting_invoices')
    .select(`
      *,
      retail_supplier:retail_suppliers!accounting_invoices_retail_supplier_id_fkey(id, name),
      retail_customer:retail_customers!accounting_invoices_retail_customer_id_fkey(id, name),
      retail_project:retail_projects!accounting_invoices_retail_project_id_fkey(id, name),
      company:accounting_companies!accounting_invoices_company_id_fkey(id, name)
    `)
    .eq('invoice_category', 'RETAIL')
    .order('issue_date', { ascending: false })

  if (error) throw error

  return (data || []).map(invoice => ({
    id: invoice.id,
    invoice_number: invoice.invoice_number,
    invoice_type: invoice.invoice_type,
    issue_date: invoice.issue_date,
    due_date: invoice.due_date,
    total_amount: parseFloat(invoice.total_amount || '0'),
    base_amount: parseFloat(invoice.base_amount || '0'),
    vat_amount: parseFloat(invoice.vat_amount || '0'),
    status: invoice.status,
    created_at: invoice.created_at,
    approved: invoice.approved || false,
    supplier_name: invoice.retail_supplier?.name || null,
    customer_name: invoice.retail_customer?.name || null,
    project_name: invoice.retail_project?.name || '-',
    company_name: invoice.company?.name || '-',
  }))
}

export function calculateRetailInvoiceStats(invoices: RetailInvoiceWithDetails[]): RetailInvoiceStats {
  const now = new Date()
  const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
  const totalAmount = invoices.reduce((sum, i) => sum + i.total_amount, 0)
  const thisMonth = invoices.filter(i => new Date(i.created_at) >= firstDayOfMonth)
  return {
    totalInvoices: invoices.length,
    totalAmount,
    invoicesThisMonth: thisMonth.length,
    amountThisMonth: thisMonth.reduce((sum, i) => sum + i.total_amount, 0),
  }
}

export async function toggleRetailInvoiceApproval(invoiceId: string, currentApproved: boolean): Promise<void> {
  const { error } = await supabase
    .from('accounting_invoices')
    .update({ approved: !currentApproved })
    .eq('id', invoiceId)
  if (error) throw error

  logActivity({ action: 'invoice.approve', entity: 'invoice', entityId: invoiceId, metadata: { severity: 'high', approved: !currentApproved } })
}

export function exportRetailInvoicesCSV(invoices: RetailInvoiceWithDetails[]): void {
  const headers = ['Broj računa', 'Tip', 'Datum', 'Dospijeće', 'Projekt', 'Dobavljač/Kupac', 'Firma', 'Iznos', 'Status', 'Odobreno']
  const rows = invoices.map(i => [
    i.invoice_number,
    i.invoice_type,
    format(new Date(i.issue_date), 'yyyy-MM-dd'),
    format(new Date(i.due_date), 'yyyy-MM-dd'),
    i.project_name || '',
    i.supplier_name || i.customer_name || '',
    i.company_name || '',
    i.total_amount.toString(),
    i.status,
    i.approved ? 'Da' : 'Ne',
  ])
  const csv = [headers, ...rows].map(row => row.join(',')).join('\n')
  const blob = new Blob([csv], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `retail-invoices-${format(new Date(), 'yyyy-MM-dd')}.csv`
  a.click()
}
