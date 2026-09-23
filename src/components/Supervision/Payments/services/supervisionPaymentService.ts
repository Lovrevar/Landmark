import type { TFunction } from 'i18next'
import { supabase } from '../../../../lib/supabase'
import type { Contract } from '../../../../lib/supabase'
import { logActivity } from '../../../../lib/activityLog'
import { downloadWorkbook, toDateCell, textCell, type SheetRows } from '../../../../lib/xlsxExport'
import { exportT } from '../../../../utils/exportLanguage'
import { NO_VALUE } from '../../../../utils/formatters'

export interface PaymentWithDetails {
  id: string
  amount: number
  payment_date: string
  created_at: string
  notes?: string
  company_bank_account_id?: string
  cesija_company_id?: string
  is_cesija?: boolean
  contract?: Contract
  subcontractor_name?: string
  project_name?: string
  phase_name?: string
  phase_number?: number
  paid_by_company_name?: string
}

export interface PaymentStats {
  totalPayments: number
  totalAmount: number
  paymentsThisMonth: number
  amountThisMonth: number
}

type RawPayment = Record<string, unknown> & {
  id: string
  amount: string
  payment_date: string
  created_at: string
  description?: string
  company_bank_account_id?: string
  cesija_company_id?: string
  is_cesija?: boolean
  invoice?: { supplier_id?: string; project_id?: string; contract_id?: string } | null
  cesija_company?: { name: string } | null
  credit?: { company?: { name: string } } | null
  company_bank_account?: { company?: { name: string } } | null
}

type ContractWithPhase = {
  id: string
  contract_number: string
  subcontractor_id: string
  phase_id: string | null
  project_phases?: { id: string; phase_name: string; phase_number: number } | null
}

export async function fetchSupervisionPayments(): Promise<PaymentWithDetails[]> {
  const { data: paymentsData, error: paymentsError } = await supabase
    .from('accounting_payments')
    .select(`
      *,
      invoice:accounting_invoices(
        id, invoice_number, invoice_type, invoice_category,
        supplier_id, project_id, milestone_id, total_amount, status
      ),
      company_bank_account:company_bank_accounts!accounting_payments_company_bank_account_id_fkey(
        id, bank_name,
        company:accounting_companies(id, name)
      ),
      cesija_company:accounting_companies!accounting_payments_cesija_company_id_fkey(id, name),
      credit:bank_credits!accounting_payments_credit_id_fkey(
        id, credit_name,
        company:accounting_companies(id, name)
      )
    `)
    .eq('invoice.invoice_type', 'INCOMING_SUPPLIER')
    .eq('invoice.invoice_category', 'SUBCONTRACTOR')
    .not('invoice.project_id', 'is', null)
    .order('payment_date', { ascending: false })

  if (paymentsError) throw paymentsError

  const [subcontractorsRes, contractsRawRes, projectsRes] = await Promise.all([
    supabase.from('subcontractors').select('id, name'),
    supabase.from('contracts').select('id, contract_number, subcontractor_id, phase_id, project_phases(id, phase_name, phase_number)'),
    supabase.from('projects').select('id, name'),
  ])

  const subcontractorsData = subcontractorsRes.data || []
  const contractsData = contractsRawRes.data as unknown as ContractWithPhase[] | null
  const projectsData = projectsRes.data || []

  return (paymentsData || []).map((payment: RawPayment) => {
    const invoice = payment.invoice
    if (!invoice) return null

    const subcontractor = subcontractorsData.find(s => s.id === invoice.supplier_id)
    const project = projectsData.find(p => p.id === invoice.project_id)

    let contract = contractsData?.find(c => c.id === invoice.contract_id)
    if (!contract) {
      contract = contractsData?.find(c => c.subcontractor_id === invoice.supplier_id)
    }

    const phaseName = contract?.project_phases?.phase_name || null
    const phaseNumber = contract?.project_phases?.phase_number

    let paidByCompanyName = '-'
    if (payment.is_cesija && payment.cesija_company) {
      paidByCompanyName = payment.cesija_company.name
    } else if (payment.credit?.company) {
      paidByCompanyName = payment.credit.company.name
    } else if (payment.company_bank_account?.company) {
      paidByCompanyName = payment.company_bank_account.company.name
    }

    return {
      id: payment.id,
      amount: parseFloat(payment.amount),
      payment_date: payment.payment_date,
      created_at: payment.created_at,
      notes: payment.description,
      company_bank_account_id: payment.company_bank_account_id,
      cesija_company_id: payment.cesija_company_id,
      is_cesija: payment.is_cesija,
      subcontractor_name: subcontractor?.name || NO_VALUE,
      project_name: project?.name || NO_VALUE,
      phase_name: phaseName,
      phase_number: phaseNumber,
      contract: contract ? {
        id: contract.id,
        contract_number: contract.contract_number,
        subcontractor_id: contract.subcontractor_id,
        phase_id: contract.phase_id,
      } as Contract : undefined,
      paid_by_company_name: paidByCompanyName,
    }
  }).filter(Boolean) as PaymentWithDetails[]
}

export function calculatePaymentStats(payments: PaymentWithDetails[]): PaymentStats {
  const now = new Date()
  const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
  const totalAmount = payments.reduce((sum, p) => sum + p.amount, 0)
  const paymentsThisMonth = payments.filter(p => new Date(p.created_at) >= firstDayOfMonth)
  return {
    totalPayments: payments.length,
    totalAmount,
    paymentsThisMonth: paymentsThisMonth.length,
    amountThisMonth: paymentsThisMonth.reduce((sum, p) => sum + p.amount, 0),
  }
}

const SHEET_NAME = 'Plaćanja'
const COLUMN_WIDTHS = [12, 28, 24, 20, 26, 16, 40]
const MONEY_COLUMNS = [5]

/**
 * The subcontractor payment register as a spreadsheet.
 *
 * The CSV it replaces quoted nothing, so a subcontractor named `PANNONIA, d.o.o.` shifted every
 * column after it, and put the `payment_date` through `new Date()`, which east of UTC exported
 * the previous day. Both go away with a real `.xlsx` and `toDateCell`.
 */
export function buildSupervisionPaymentsSheet(payments: PaymentWithDetails[], t: TFunction): SheetRows {
  const header = [
    t('supervision.payments.col.date'),
    t('supervision.payments.col.subcontractor'),
    t('common.project'),
    t('supervision.payments.col.phase'),
    t('supervision.payments.col.paid_by'),
    t('supervision.payments.col.amount'),
    t('common.notes'),
  ]

  return [
    header,
    ...payments.map(p => [
      toDateCell(p.payment_date || p.created_at),
      textCell(p.subcontractor_name),
      textCell(p.project_name),
      textCell(p.phase_name),
      textCell(p.paid_by_company_name),
      Number(p.amount),
      textCell(p.notes),
    ]),
  ]
}

export async function exportSupervisionPaymentsExcel(payments: PaymentWithDetails[]): Promise<void> {
  const t = exportT()
  await downloadWorkbook(
    [{
      name: SHEET_NAME,
      rows: buildSupervisionPaymentsSheet(payments, t),
      columnWidths: COLUMN_WIDTHS,
      moneyColumns: MONEY_COLUMNS,
    }],
    'placanja-nadzor'
  )

  logActivity({
    action: 'export.supervision_payments_excel',
    entity: 'report',
    metadata: { severity: 'low', format: 'excel', row_count: payments.length },
  })
}
