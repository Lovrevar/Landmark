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
 * Each type also has a category, operating or financing (below). The database states the same
 * rules in SQL: `recalc_company_bank_account_balance` by direction, the `company_statistics`
 * view by direction and category. `invoiceCashDirection.test.ts` reads those migrations and fails if
 * either side moves without the other.
 */

export type CashDirection = 'IN' | 'OUT'

/**
 * Whether a payment belongs to running the business or to financing it.
 *
 * Financing is principal only: a credit drawn down (OUTGOING_BANK, money in) and repaid
 * (INCOMING_BANK, money out). Direction alone is not enough to report on: a €600k drawdown is
 * money in, but it is not turnover, and a cash-flow table that mixes it with operations shows it
 * as a good month. Left out altogether, the table cannot be reconciled with the bank balance. So
 * financing is counted — on its own lines, never inside income or expense.
 *
 * What a credit *costs* is not financing. Credit fees and interest (INCOMING_BANK_EXPENSES) are an
 * operating cost, like ULAZNI (INV) — decided with accounting, October 2026.
 */
export type CashCategory = 'operating' | 'financing'

export interface InvoiceCashRule {
  direction: CashDirection
  category: CashCategory
}

/**
 * The nine values `accounting_invoices_invoice_type_check` allows. Two questions per type:
 * which way the money moves, and whether it is operations or financing.
 */
export const INVOICE_CASH_MAP: Readonly<Record<string, InvoiceCashRule>> = {
  INCOMING_SUPPLIER: { direction: 'OUT', category: 'operating' },
  INCOMING_OFFICE: { direction: 'OUT', category: 'operating' },
  INCOMING_INVESTMENT: { direction: 'OUT', category: 'operating' },
  INCOMING_BANK: { direction: 'OUT', category: 'financing' },
  INCOMING_BANK_EXPENSES: { direction: 'OUT', category: 'operating' },
  OUTGOING_SUPPLIER: { direction: 'IN', category: 'operating' },
  OUTGOING_OFFICE: { direction: 'IN', category: 'operating' },
  OUTGOING_SALES: { direction: 'IN', category: 'operating' },
  OUTGOING_BANK: { direction: 'IN', category: 'financing' },
}

/** Direction only, for callers that never ask about category. */
export const INVOICE_CASH_DIRECTION: Readonly<Record<string, CashDirection>> = Object.fromEntries(
  Object.entries(INVOICE_CASH_MAP).map(([type, rule]) => [type, rule.direction]),
)

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
 * Invoices that are a *cost* of doing business, for profit and expense figures: every operating
 * invoice the company pays — suppliers, the office, financiers' bills (ULAZNI (INV)) and what
 * credit costs (fees and interest).
 *
 * Derived from the map, not listed: "cost" and "operating money out" are the same set by
 * decision, and a second list is how the screens came to disagree in the first place. The one
 * money-out type that is not a cost is the repayment of principal (INCOMING_BANK): it moves cash
 * but only returns what was borrowed.
 */
export const COST_INVOICE_TYPES: ReadonlySet<string> = new Set(
  Object.entries(INVOICE_CASH_MAP)
    .filter(([, rule]) => rule.direction === 'OUT' && rule.category === 'operating')
    .map(([type]) => type),
)

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

/**
 * The category for an invoice type. Anything not listed as financing is operating — including an
 * unknown type, which should show up in the ordinary totals rather than vanish from them.
 */
export const invoiceCashCategory = (invoiceType: string | null | undefined): CashCategory =>
  (invoiceType && INVOICE_CASH_MAP[invoiceType]?.category) || 'operating'

/** The types filed under financing: credit drawdown and repayment of principal. */
export const FINANCING_INVOICE_TYPES: ReadonlySet<string> = new Set(
  Object.entries(INVOICE_CASH_MAP).filter(([, rule]) => rule.category === 'financing').map(([type]) => type),
)

/** The invoice types on one side of one category, e.g. operating money in — in map order. */
export const invoiceTypesFor = (direction: CashDirection, category: CashCategory): string[] =>
  Object.entries(INVOICE_CASH_MAP)
    .filter(([, rule]) => rule.direction === direction && rule.category === category)
    .map(([type]) => type)
