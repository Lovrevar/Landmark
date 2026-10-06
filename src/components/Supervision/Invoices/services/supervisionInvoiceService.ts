import type { TFunction } from 'i18next'
import { supabase } from '../../../../lib/supabase'
import { logActivity } from '../../../../lib/activityLog'
import { downloadWorkbook, toDateCell, textCell, type SheetRows } from '../../../../lib/xlsxExport'
import { exportT } from '../../../../utils/exportLanguage'
import { getInvoiceStatusLabel } from '../../../Cashflow/services/invoiceHelpers'

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
  contract?: {
    contract_number?: string
    phase?: { id: string; phase_name?: string } | null
  } | null
}

export async function fetchSupervisionInvoices(): Promise<InvoiceWithDetails[]> {
  const { data: invoicesData, error: invoicesError } = await supabase
    .from('accounting_invoices')
    .select(`
      *,
      supplier:subcontractors!accounting_invoices_supplier_id_fkey(id, name),
      company:accounting_companies!accounting_invoices_company_id_fkey(id, name),
      project:projects!accounting_invoices_project_id_fkey(id, name),
      contract:contracts!accounting_invoices_contract_id_fkey(
        id,
        contract_number,
        phase:project_phases(id, phase_name)
      )
    `)
    .in('invoice_category', ['SUBCONTRACTOR', 'SUPERVISION'])
    .not('project_id', 'is', null)
    .order('issue_date', { ascending: false })

  if (invoicesError) throw invoicesError

  return (invoicesData || []).map((invoice: RawInvoice) => {
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
      phase_name: invoice.contract?.phase?.phase_name || '-',
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

  logActivity({ action: 'invoice.approve', entity: 'invoice', entityId: invoiceId, metadata: { severity: 'high', approved: !currentApproved } })
}

const SHEET_NAME = 'Računi'
const COLUMN_WIDTHS = [18, 12, 28, 24, 20, 24, 16, 16]
const MONEY_COLUMNS = [6]

/**
 * The subcontractor invoice register as a spreadsheet.
 *
 * The CSV it replaces wrote `i.status` raw ("PARTIALLY_PAID"), quoted nothing, and put
 * `issue_date` through `new Date()`, which east of UTC exported the previous day.
 */
export function buildSupervisionInvoicesSheet(invoices: InvoiceWithDetails[], t: TFunction): SheetRows {
  const header = [
    t('supervision.invoices.col.invoice_num'),
    t('supervision.invoices.col.date'),
    t('supervision.invoices.col.supplier'),
    t('supervision.invoices.col.project'),
    t('supervision.invoices.col.phase'),
    t('supervision.invoices.col.company'),
    t('supervision.invoices.col.amount'),
    t('supervision.invoices.col.status'),
  ]

  return [
    header,
    ...invoices.map(i => [
      textCell(i.invoice_number),
      toDateCell(i.issue_date),
      textCell(i.supplier_name),
      textCell(i.project_name),
      textCell(i.phase_name),
      textCell(i.company_name),
      Number(i.total_amount),
      getInvoiceStatusLabel(i.status, t),
    ]),
  ]
}

export async function exportSupervisionInvoicesExcel(invoices: InvoiceWithDetails[]): Promise<void> {
  const t = exportT()
  await downloadWorkbook(
    [{
      name: SHEET_NAME,
      rows: buildSupervisionInvoicesSheet(invoices, t),
      columnWidths: COLUMN_WIDTHS,
      moneyColumns: MONEY_COLUMNS,
    }],
    'racuni-nadzor'
  )

  logActivity({
    action: 'export.supervision_invoices_excel',
    entity: 'report',
    metadata: { severity: 'low', format: 'excel', row_count: invoices.length },
  })
}
