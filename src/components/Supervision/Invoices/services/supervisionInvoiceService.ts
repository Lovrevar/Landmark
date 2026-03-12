import { supabase } from '../../../../lib/supabase'
import { format } from 'date-fns'

export interface InvoiceWithDetails {
  id: string
  invoice_number: string
  invoice_type: string
  invoice_category: string
  issue_date: string
  due_date: string
  total_amount: number
  base_amount: number
  vat_amount: number
  status: string
  created_at: string
  approved: boolean
  supplier_name: string
  company_name: string
  project_name: string
  phase_name: string
  contract_number: string
}

export interface InvoiceStats {
  totalInvoices: number
  totalAmount: number
  invoicesThisMonth: number
  amountThisMonth: number
}

type RawInvoice = Record<string, unknown> & {
  id: string
  invoice_number: string
  invoice_type: string
  invoice_category: string
  issue_date: string
  due_date: string
  total_amount: string
  base_amount: string
  vat_amount: string
  status: string
  created_at: string
  approved?: boolean
  supplier?: { name?: string } | null
  company?: { name?: string } | null
  project?: { name?: string } | null
  contract?: { phase_id?: string; contract_number?: string } | null
}

export async function fetchSupervisionInvoices(): Promise<InvoiceWithDetails[]> {
  const { data: invoicesData, error: invoicesError } = await supabase
    .from('accounting_invoices')
    .select(`
      *,
      supplier:subcontractors!accounting_invoices_supplier_id_fkey(id, name),
      company:accounting_companies!accounting_invoices_company_id_fkey(id, name),
      project:projects!accounting_invoices_project_id_fkey(id, name),
      contract:contracts!accounting_invoices_contract_id_fkey(id, contract_number, phase_id)
    `)
    .in('invoice_category', ['SUBCONTRACTOR', 'SUPERVISION'])
    .not('project_id', 'is', null)
    .order('issue_date', { ascending: false })

  if (invoicesError) throw invoicesError

  const { data: phasesData } = await supabase.from('project_phases').select('id, phase_name')

  return (invoicesData || []).map((invoice: RawInvoice) => {
    const phase = phasesData?.find(p => p.id === invoice.contract?.phase_id)
    return {
      id: invoice.id,
      invoice_number: invoice.invoice_number,
      invoice_type: invoice.invoice_type,
      invoice_category: invoice.invoice_category,
      issue_date: invoice.issue_date,
      due_date: invoice.due_date,
      total_amount: parseFloat(invoice.total_amount),
      base_amount: parseFloat(invoice.base_amount),
      vat_amount: parseFloat(invoice.vat_amount),
      status: invoice.status,
      created_at: invoice.created_at,
      approved: invoice.approved || false,
      supplier_name: invoice.supplier?.name || '-',
      company_name: invoice.company?.name || '-',
      project_name: invoice.project?.name || '-',
      phase_name: phase?.phase_name || '-',
      contract_number: invoice.contract?.contract_number || '-',
    }
  })
}

export function calculateInvoiceStats(invoices: InvoiceWithDetails[]): InvoiceStats {
  const now = new Date()
  const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
  const totalAmount = invoices.reduce((sum, i) => sum + i.total_amount, 0)
  const invoicesThisMonth = invoices.filter(i => new Date(i.created_at) >= firstDayOfMonth)
  return {
    totalInvoices: invoices.length,
    totalAmount,
    invoicesThisMonth: invoicesThisMonth.length,
    amountThisMonth: invoicesThisMonth.reduce((sum, i) => sum + i.total_amount, 0),
  }
}

export async function toggleInvoiceApproval(invoiceId: string, currentApproved: boolean): Promise<void> {
  const { error } = await supabase
    .from('accounting_invoices')
    .update({ approved: !currentApproved })
    .eq('id', invoiceId)

  if (error) throw error
}

export function exportInvoicesCSV(invoices: InvoiceWithDetails[]): void {
  const headers = ['Invoice #', 'Date', 'Supplier', 'Project', 'Phase', 'Company', 'Amount', 'Status']
  const rows = invoices.map(i => [
    i.invoice_number,
    format(new Date(i.issue_date), 'yyyy-MM-dd'),
    i.supplier_name,
    i.project_name,
    i.phase_name,
    i.company_name,
    i.total_amount.toString(),
    i.status,
  ])
  const csv = [headers, ...rows].map(row => row.join(',')).join('\n')
  const blob = new Blob([csv], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `invoices-${format(new Date(), 'yyyy-MM-dd')}.csv`
  a.click()
}
