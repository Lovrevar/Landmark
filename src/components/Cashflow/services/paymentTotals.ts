import { paymentDirection, type PaymentDirection } from './invoiceHelpers'
import { invoiceCashCategory } from '../../../utils/invoiceCashDirection'
import { formatEuro } from '../../../utils/formatters'

/**
 * Totals and rendering for a list of payments, split by direction.
 *
 * Lives beside `paymentDirection` in `invoiceHelpers.ts`, which decides the direction, because
 * both payment screens need the same answer: the Funding credit-payment history (drawdowns vs
 * repayments and fees) and the Cashflow payments register (income vs expense). It started as
 * `bankPaymentTotals` under `Funding/Payments/`; the maths was never bank-specific.
 */

export interface PaymentTotals {
  /** Money into the company — a sale collected, a credit drawn down. */
  inflow: number
  /** Money out of it — a supplier paid, a repayment, credit fees. */
  outflow: number
  /** inflow − outflow. */
  net: number
  count: number
}

export const EMPTY_PAYMENT_TOTALS: PaymentTotals = { inflow: 0, outflow: 0, net: 0, count: 0 }

interface TotalsRow {
  /** PostgREST returns numeric columns as numbers, but string amounts are accepted too. */
  amount: number | string | null | undefined
  direction: PaymentDirection | null
}

/**
 * Sums by direction, never across it. Adding the two together answers no question anyone asks:
 * it puts a €500k drawdown and its €500k repayment at €1.000.000, and a month's sales receipts
 * on top of that month's supplier payments.
 *
 * Sums run in whole cents so that equal flows net to exactly 0 rather than a float residue that
 * prints as "−€0,00". A row with no direction (an invoice type with neither prefix, which the
 * database CHECK does not allow) is counted but sits in neither sum, the way the balance
 * trigger ignores it.
 */
export function paymentTotalsByDirection(rows: readonly TotalsRow[]): PaymentTotals {
  let inflowCents = 0
  let outflowCents = 0

  for (const row of rows) {
    const amount = Number(row.amount)
    if (!Number.isFinite(amount)) continue
    const cents = Math.round(amount * 100)
    if (row.direction === 'IN') inflowCents += cents
    else if (row.direction === 'OUT') outflowCents += cents
  }

  return {
    inflow: inflowCents / 100,
    outflow: outflowCents / 100,
    net: (inflowCents - outflowCents) / 100,
    count: rows.length,
  }
}

interface TypedRow {
  amount: number | string | null | undefined
  invoiceType: string | null | undefined
}

/**
 * The same sums, kept apart by what the money is: `operating` is income and expense, `financing`
 * is credit principal drawn and repaid, which is neither (CASH-7).
 *
 * The Cashflow payments cards summed by direction alone, so a drawdown sat in "Ukupno Prihod" and
 * a principal repayment in "Ukupno Rashod" above rows the table labels as financing (CASH-29).
 * Credit fees are an operating cost and stay in `operating`.
 */
export function paymentTotalsByCategory(rows: readonly TypedRow[]): { operating: PaymentTotals; financing: PaymentTotals } {
  const split: Record<'operating' | 'financing', TotalsRow[]> = { operating: [], financing: [] }
  for (const row of rows) {
    split[invoiceCashCategory(row.invoiceType)].push({ amount: row.amount, direction: paymentDirection(row.invoiceType) })
  }
  return { operating: paymentTotalsByDirection(split.operating), financing: paymentTotalsByDirection(split.financing) }
}

/**
 * Amount colours, shared so both payment screens render a direction the same way: money in green,
 * money out red. The Cashflow table used to paint every amount green, including the rows its own
 * type column marked RASHOD in red.
 */
export const DIRECTION_AMOUNT_CLASS: Record<PaymentDirection, string> = {
  IN: 'text-green-600 dark:text-green-400',
  OUT: 'text-red-600 dark:text-red-400',
}

/** A net figure carries its own sign; the helper already prints the minus. */
export const formatSignedEuro = (value: number): string => `${value > 0 ? '+' : ''}${formatEuro(value)}`
