import { eachMonthOfInterval, format } from 'date-fns'
import { monthKey, parseLocalDate } from './dateOnly'
import { paymentTotalsByCategory, type PaymentTotals } from './paymentTotals'

/**
 * The General report's cash-flow table: every payment, month by month, on the side the shared
 * direction map puts it and in its activity — operating or financing (REGRESSION_PREVENTION
 * Step 7). The sums are `paymentTotalsByCategory`, the same ones the Cashflow payments cards show.
 *
 * Drawdowns and repayments of principal are financing, apart from operations, so a drawdown does
 * not read as a good month's trading; credit fees are an operating cost (CASH-7, CASH-29). A
 * payment whose invoice is unknown has no direction and sits on neither side.
 *
 * Every payment counts, whatever it was paid with, kompenzacija included. So the table does not
 * reconcile with the bank balance, which counts only payments through a bank account (GEN-33).
 */

/** One side of a month: money in, money out, and in − out. */
export interface CashFlowAmounts {
  inflow: number
  outflow: number
  net: number
}

export interface CashFlowMonth extends CashFlowAmounts {
  /** The month's first day, `'YYYY-MM-DD'`. A key, not a label: readers format it. */
  month_key: string
  operating: CashFlowAmounts
  financing: CashFlowAmounts
}

/** A payment with its invoice's type, which decides the side and the activity. */
export interface CashFlowPaymentRow {
  amount: number | string | null | undefined
  payment_date?: string | null
  invoiceType: string | null | undefined
}

const amountsOf = ({ inflow, outflow, net }: PaymentTotals): CashFlowAmounts => ({ inflow, outflow, net })

/**
 * One row per calendar month from `range.start` to `range.end` (date-only strings, local months),
 * each payment in the month of its `payment_date`.
 */
export function monthlyCashFlow(
  payments: readonly CashFlowPaymentRow[],
  range: { start: string; end: string },
): CashFlowMonth[] {
  const byMonth = new Map<string, CashFlowPaymentRow[]>()
  for (const payment of payments) {
    const key = monthKey(payment.payment_date)
    byMonth.set(key, [...(byMonth.get(key) ?? []), payment])
  }

  return eachMonthOfInterval({ start: parseLocalDate(range.start), end: parseLocalDate(range.end) }).map(month => {
    const { operating, financing } = paymentTotalsByCategory(byMonth.get(format(month, 'yyyy-MM')) ?? [])
    return {
      month_key: format(month, 'yyyy-MM-dd'),
      inflow: operating.inflow + financing.inflow,
      outflow: operating.outflow + financing.outflow,
      net: operating.net + financing.net,
      operating: amountsOf(operating),
      financing: amountsOf(financing),
    }
  })
}

/** Σ over months, side by side: the "six-month totals" lines on the screen and in the PDF. */
export const cashFlowTotals = (rows: readonly CashFlowAmounts[]): CashFlowAmounts => rows.reduce(
  (total, row) => ({ inflow: total.inflow + row.inflow, outflow: total.outflow + row.outflow, net: total.net + row.net }),
  { inflow: 0, outflow: 0, net: 0 },
)
