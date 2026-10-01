import type { TFunction } from 'i18next'
import { logActivity } from '../../../../lib/activityLog'
import { downloadWorkbook, toDateCell, textCell, type SheetRows } from '../../../../lib/xlsxExport'
import { exportT } from '../../../../utils/exportLanguage'
import { getCreditTypeLabelKey } from '../../Investors/utils/creditCalculations'
import type { BankPaymentWithDetails } from './bankPaymentsService'

/**
 * The funding payments register as a spreadsheet.
 *
 * It used to be built inline in the screen component, as a CSV with English headers, no quoting at
 * all, `p.credit_type` written raw ("line_of_credit") and the date put through `new Date()`, which
 * east of UTC exported the previous day.
 */

const SHEET_NAME = 'Plaćanja'
const COLUMN_WIDTHS = [12, 10, 28, 24, 22, 16, 40]
const MONEY_COLUMNS = [5]

/** The direction column, in the same words as the screen's badge: PRIHOD / RASHOD. */
const directionLabel = (payment: BankPaymentWithDetails, t: TFunction): string => {
  if (payment.direction === 'IN') return t('payments.table.income')
  if (payment.direction === 'OUT') return t('payments.table.expense')
  return ''
}

/** The credit type, translated. An unknown one keeps its raw text with *every* underscore
 *  replaced — `replace('_', ' ')` only replaced the first, which is how "LINE OF_CREDIT" shipped. */
const creditTypeLabel = (payment: BankPaymentWithDetails, t: TFunction): string => {
  const key = getCreditTypeLabelKey(payment.credit_type, payment.credit_seniority)
  return key ? t(key) : (payment.credit_type ?? '').replace(/_/g, ' ')
}

export function buildFundingPaymentsSheet(payments: BankPaymentWithDetails[], t: TFunction): SheetRows {
  const header = [
    t('funding.payments.table.date_col'),
    t('funding.payments.table.type_col'),
    t('funding.payments.table.recipient_col'),
    t('funding.payments.table.project_col'),
    t('funding.payments.table.category_col'),
    t('funding.payments.table.amount_col'),
    t('funding.payments.table.notes_col'),
  ]

  return [
    header,
    ...payments.map(payment => [
      toDateCell(payment.payment_date || payment.created_at),
      directionLabel(payment, t),
      textCell(payment.bank_name),
      textCell(payment.project_name),
      creditTypeLabel(payment, t),
      Number(payment.amount),
      textCell(payment.notes),
    ]),
  ]
}

export async function exportFundingPaymentsExcel(payments: BankPaymentWithDetails[]): Promise<void> {
  const t = exportT()
  await downloadWorkbook(
    [{
      name: SHEET_NAME,
      rows: buildFundingPaymentsSheet(payments, t),
      columnWidths: COLUMN_WIDTHS,
      moneyColumns: MONEY_COLUMNS,
    }],
    'placanja-financiranje'
  )

  logActivity({
    action: 'export.funding_payments_excel',
    entity: 'report',
    metadata: { severity: 'low', format: 'excel', row_count: payments.length },
  })
}
