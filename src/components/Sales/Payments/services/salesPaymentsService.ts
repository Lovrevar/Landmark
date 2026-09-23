import type { TFunction } from 'i18next'
import { supabase } from '../../../../lib/supabase'
import { logActivity } from '../../../../lib/activityLog'
import { downloadWorkbook, toDateCell, textCell, type SheetRows } from '../../../../lib/xlsxExport'
import { exportT } from '../../../../utils/exportLanguage'
import { getPaymentMethodLabel } from '../../../Cashflow/services/paymentHelpers'

export interface SalesPaymentWithDetails {
  id: string
  payment_date: string
  amount: number
  payment_method: string
  description?: string
  created_at: string
  invoice_number: string
  issue_date: string
  invoice_total_amount: number
  apartment_number?: string
  project_name?: string
  customer_name?: string
  bank_account_name?: string
}

export interface SalesPaymentStats {
  totalPayments: number
  totalAmount: number
  paymentsThisMonth: number
  amountThisMonth: number
}

export async function fetchSalesPayments(): Promise<SalesPaymentWithDetails[]> {
  const { data: invoicesData, error: invoicesError } = await supabase
    .from('accounting_invoices')
    .select(`
      id, invoice_number, issue_date, total_amount, customer_id, apartment_id,
      customers (name, surname),
      apartments (number, projects (name))
    `)
    .eq('invoice_type', 'OUTGOING_SALES')
    .not('apartment_id', 'is', null)
    .order('issue_date', { ascending: false })

  if (invoicesError) throw invoicesError

  const invoiceIds = (invoicesData || []).map(inv => inv.id)
  if (invoiceIds.length === 0) return []

  const { data: paymentsData, error: paymentsError } = await supabase
    .from('accounting_payments')
    .select('id, payment_date, amount, payment_method, description, created_at, invoice_id, company_bank_account_id')
    .in('invoice_id', invoiceIds)
    .order('payment_date', { ascending: false })

  if (paymentsError) throw paymentsError

  const bankAccountIds = [...new Set((paymentsData || []).map(p => p.company_bank_account_id).filter(Boolean))]
  let bankAccountsData: { id: string; bank_name: string }[] = []
  if (bankAccountIds.length > 0) {
    const { data: accounts } = await supabase
      .from('company_bank_accounts')
      .select('id, bank_name')
      .in('id', bankAccountIds)
    bankAccountsData = accounts || []
  }

  return (paymentsData || []).map(payment => {
    const invoice = invoicesData?.find(inv => inv.id === payment.invoice_id)
    const bankAccount = bankAccountsData.find(ba => ba.id === payment.company_bank_account_id)
    const apt = invoice?.apartments as { number?: string; projects?: { name?: string } } | null
    const customer = invoice?.customers as unknown as { name: string; surname: string } | null

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
      apartment_number: apt?.number || 'N/A',
      project_name: apt?.projects?.name || 'N/A',
      customer_name: customer ? `${customer.name} ${customer.surname}` : 'N/A',
      bank_account_name: bankAccount?.bank_name || 'N/A'
    }
  })
}

export function calculateSalesPaymentStats(payments: SalesPaymentWithDetails[]): SalesPaymentStats {
  const now = new Date()
  const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
  const totalAmount = payments.reduce((sum, p) => sum + Number(p.amount), 0)
  const thisMonth = payments.filter(p => new Date(p.payment_date) >= firstDayOfMonth)
  return {
    totalPayments: payments.length,
    totalAmount,
    paymentsThisMonth: thisMonth.length,
    amountThisMonth: thisMonth.reduce((sum, p) => sum + Number(p.amount), 0)
  }
}

const SHEET_NAME = 'Plaćanja'
const COLUMN_WIDTHS = [14, 18, 14, 12, 24, 26, 16, 16, 14, 20, 40]
const MONEY_COLUMNS = [6, 7]

/**
 * The apartment-sales payment register as a spreadsheet.
 *
 * This was the only one of the six CSVs that quoted its fields, and even it wrote every amount as
 * a dot decimal that Croatian Excel reads as text. Money is a number here and a date is a date;
 * the headers are the screen's own, in Croatian.
 */
export function buildSalesPaymentsSheet(payments: SalesPaymentWithDetails[], t: TFunction): SheetRows {
  const header = [
    t('customers.sales_payments.payment_date'),
    t('customers.sales_payments.invoice'),
    t('invoices.filters.invoice_date'),
    t('customers.sales_payments.apartment'),
    t('customers.sales_payments.project'),
    t('customers.sales_payments.customer'),
    t('customers.sales_payments.invoice_total'),
    t('customers.sales_payments.payment'),
    t('customers.sales_payments.method'),
    t('customers.sales_payments.bank'),
    t('common.description'),
  ]

  return [
    header,
    ...payments.map(p => [
      toDateCell(p.payment_date),
      textCell(p.invoice_number),
      toDateCell(p.issue_date),
      textCell(p.apartment_number),
      textCell(p.project_name),
      textCell(p.customer_name),
      Number(p.invoice_total_amount),
      Number(p.amount),
      // These payments have no source column, so no kompenzacija placeholder to suppress.
      getPaymentMethodLabel(p.payment_method, null, t),
      textCell(p.bank_account_name),
      textCell(p.description),
    ]),
  ]
}

export async function exportSalesPaymentsExcel(payments: SalesPaymentWithDetails[]): Promise<void> {
  const t = exportT()
  await downloadWorkbook(
    [{
      name: SHEET_NAME,
      rows: buildSalesPaymentsSheet(payments, t),
      columnWidths: COLUMN_WIDTHS,
      moneyColumns: MONEY_COLUMNS,
    }],
    'placanja-prodaja'
  )

  logActivity({
    action: 'export.sales_payments_excel',
    entity: 'report',
    metadata: { severity: 'low', format: 'excel', row_count: payments.length },
  })
}
