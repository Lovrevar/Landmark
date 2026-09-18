import type { PaymentDirection } from '../../Cashflow/services/invoiceHelpers'

export interface PaymentTotals {
  /** Money into the company — credit drawdowns. */
  inflow: number
  /** Money out of it — repayments and credit fees. */
  outflow: number
  /** inflow − outflow. */
  net: number
  count: number
}

interface TotalsRow {
  /** PostgREST returns numeric columns as numbers, but string amounts are accepted too. */
  amount: number | string | null | undefined
  direction: PaymentDirection | null
}

/**
 * Totals for a list of bank-credit payments, split by direction. Summing `amount` across the list
 * adds a drawdown to its own repayment: €500k in and €500k back out read as €1.000.000.
 *
 * Sums run in whole cents so that equal flows net to exactly 0 rather than a float residue that
 * prints as "−€0,00". A row with no direction (an invoice type with neither prefix, which the
 * database CHECK does not allow) is counted but sits in neither sum, the way the balance
 * trigger ignores it.
 */
export function bankPaymentTotals(rows: readonly TotalsRow[]): PaymentTotals {
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
