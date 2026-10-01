import type { TFunction } from 'i18next'
import { supabase } from '../../../../lib/supabase'
import { logActivity } from '../../../../lib/activityLog'
import { downloadWorkbook, toDateCell, textCell, type SheetRows } from '../../../../lib/xlsxExport'
import { exportT } from '../../../../utils/exportLanguage'
import { getInvoiceStatusLabel, getInvoiceTypeLabelKey } from '../../../Cashflow/services/invoiceHelpers'

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

const SHEET_NAME = 'Računi'
const COLUMN_WIDTHS = [18, 18, 12, 12, 24, 28, 24, 16, 16, 12]
const MONEY_COLUMNS = [7]

/**
 * The retail invoice register as a spreadsheet.
 *
 * This is the CSV whose headers were *already* Croatian and which nobody could read: no BOM, so
 * Excel decoded `Broj računa` as `Broj raÄuna`. It also quoted nothing and wrote `invoice_type`
 * and `status` raw. A real `.xlsx` carries its own encoding, so the headers simply arrive.
 */
export function buildRetailInvoicesSheet(invoices: RetailInvoiceWithDetails[], t: TFunction): SheetRows {
  const header = [
    t('retail_invoices.table.invoice_number'),
    t('retail_invoices.table.type'),
    t('common.date'),
    t('retail_invoices.table.due_date'),
    t('common.project'),
    t('retail_invoices.table.supplier_customer'),
    t('common.company'),
    t('common.amount'),
    t('common.status'),
    t('invoices.table.approved'),
  ]

  const typeLabel = (type: string): string => {
    const key = getInvoiceTypeLabelKey(type)
    return key ? t(key) : textCell(type)
  }

  return [
    header,
    ...invoices.map(i => [
      textCell(i.invoice_number),
      typeLabel(i.invoice_type),
      toDateCell(i.issue_date),
      toDateCell(i.due_date),
      textCell(i.project_name),
      textCell(i.supplier_name) || textCell(i.customer_name),
      textCell(i.company_name),
      Number(i.total_amount),
      getInvoiceStatusLabel(i.status, t),
      i.approved ? t('common.yes') : t('common.no'),
    ]),
  ]
}

export async function exportRetailInvoicesExcel(invoices: RetailInvoiceWithDetails[]): Promise<void> {
  const t = exportT()
  await downloadWorkbook(
    [{
      name: SHEET_NAME,
      rows: buildRetailInvoicesSheet(invoices, t),
      columnWidths: COLUMN_WIDTHS,
      moneyColumns: MONEY_COLUMNS,
    }],
    'racuni-retail'
  )

  logActivity({
    action: 'export.retail_invoices_excel',
    entity: 'report',
    metadata: { severity: 'low', format: 'excel', row_count: invoices.length },
  })
}
