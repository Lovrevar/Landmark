/**
 * Which way money moves for each invoice type — the one definition every screen reads.
 *
 * The type's prefix names the *invoice*, not the cash. An INCOMING_* invoice is one the company
 * received — a supplier's bill, a financier's, a loan repayment, credit fees — and paying it is
 * money OUT. An OUTGOING_* invoice is one the company issued — a sale, a credit drawdown booked
 * as OUTGOING_BANK — and its payment is money IN.
 *
 * Until October 2026 four places each had their own list, and they disagreed about
 * INCOMING_INVESTMENT ("ULAZNI (INV)"): the bank-balance trigger, the payments register and the
 * calendar subtracted it, while the accounting dashboard, the company cards and the general
 * report added it as income — so one paid invoice lowered a company's bank balance and raised its
 * "income paid" on the same card (CASH-7). The decision: **ULAZNI (INV) is always money out.**
 * No exceptions remain to the prefix rule.
 *
 * The database states the same rule in SQL (`recalc_company_bank_account_balance`, the
 * `company_statistics` view). `invoiceCashDirection.test.ts` reads those migrations and fails if
 * either side moves without the other.
 */

export type CashDirection = 'IN' | 'OUT'

/** The nine values `accounting_invoices_invoice_type_check` allows, each with its direction. */
export const INVOICE_CASH_DIRECTION: Readonly<Record<string, CashDirection>> = {
  INCOMING_SUPPLIER: 'OUT',
  INCOMING_OFFICE: 'OUT',
  INCOMING_INVESTMENT: 'OUT',
  INCOMING_BANK: 'OUT',
  INCOMING_BANK_EXPENSES: 'OUT',
  OUTGOING_SUPPLIER: 'IN',
  OUTGOING_OFFICE: 'IN',
  OUTGOING_SALES: 'IN',
  OUTGOING_BANK: 'IN',
}

/**
 * The direction for an invoice type, or `null` for a value that is neither listed nor carries one
 * of the two prefixes. An unlisted type with a known prefix follows the prefix, as the balance
 * trigger's own rule would, rather than silently dropping out of every total.
 */
export function invoiceCashDirection(invoiceType: string | null | undefined): CashDirection | null {
  if (!invoiceType) return null
  const listed = INVOICE_CASH_DIRECTION[invoiceType]
  if (listed) return listed
  if (invoiceType.startsWith('OUTGOING_')) return 'IN'
  if (invoiceType.startsWith('INCOMING_')) return 'OUT'
  return null
}

export const isCashIn = (invoiceType: string | null | undefined): boolean => invoiceCashDirection(invoiceType) === 'IN'

export const isCashOut = (invoiceType: string | null | undefined): boolean => invoiceCashDirection(invoiceType) === 'OUT'

/**
 * Invoices that are a *cost* of doing business, for profit and expense figures: what suppliers,
 * the office and financiers bill the company.
 *
 * Narrower than "money out" on purpose. Repaying a loan (INCOMING_BANK) moves cash but is not an
 * expense, and credit fees (INCOMING_BANK_EXPENSES) are reported with the credit, not with
 * project costs — neither was counted before and neither is now. ULAZNI (INV) used to be left out
 * too, which meant it lowered the bank balance while appearing in no expense total anywhere.
 */
export const COST_INVOICE_TYPES: ReadonlySet<string> = new Set([
  'INCOMING_SUPPLIER',
  'INCOMING_OFFICE',
  'INCOMING_INVESTMENT',
])

export const isCostInvoiceType = (invoiceType: string | null | undefined): boolean =>
  !!invoiceType && COST_INVOICE_TYPES.has(invoiceType)

/**
 * Invoices whose VAT is input VAT (pretporez): every invoice the company receives. The same rule
 * the payments register's "PDV Ulaz" card always used; the dashboard's VAT card used to leave
 * ULAZNI (INV) out.
 */
export const carriesInputVat = isCashOut

/** Invoices whose VAT is output VAT: every invoice the company issues. */
export const carriesOutputVat = isCashIn
