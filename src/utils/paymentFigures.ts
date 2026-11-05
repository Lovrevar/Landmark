import { isCostInvoiceType } from './invoiceCashDirection'

/**
 * Figures over `accounting_payments` and `company_bank_accounts`: what was paid on cost invoices,
 * cesija, and bank-account totals. For the General report (REGRESSION_PREVENTION Step 7). The
 * month-by-month cash flow is in `cashFlowFigures.ts`.
 *
 * "Expenses" here is **cash**: what has been paid on cost invoices, whenever it was paid. Which
 * invoices are a cost is `isCostInvoiceType` (`invoiceCashDirection.ts`) and nothing else. That is
 * every operating invoice the company pays, credit fees and ULAZNI (INV) included; repaying
 * principal is not a cost. The Director dashboard counts invoices' `paid_amount` for the
 * portfolio and invoiced totals per project instead (GEN-39).
 */

const num = (value: unknown): number => Number(value || 0)

/** An `accounting_payments` row, narrowed to what these figures read. */
export interface PaymentRow {
  invoice_id?: string | null
  amount?: number | string | null
  cesija_credit_id?: string | null
}

/** An `accounting_invoices` row, narrowed to what tells a cost apart. */
export interface CostInvoiceRow {
  id: string
  invoice_type?: string | null
}

/**
 * Σ payments on cost invoices. `includeInvoice` narrows the invoices further, to one project for
 * instance. A payment whose invoice is not in `invoices` counts nowhere: without its invoice
 * there is no telling what it paid for.
 */
export function costPaid<I extends CostInvoiceRow>(
  payments: readonly PaymentRow[],
  invoices: readonly I[],
  includeInvoice: (invoice: I) => boolean = () => true,
): number {
  const costInvoiceIds = new Set(
    invoices.filter(invoice => isCostInvoiceType(invoice.invoice_type) && includeInvoice(invoice)).map(invoice => invoice.id),
  )
  return payments
    .filter(payment => payment.invoice_id != null && costInvoiceIds.has(payment.invoice_id))
    .reduce((sum, payment) => sum + num(payment.amount), 0)
}

/**
 * Payments made as a cesija **from a credit** (`cesija_credit_id` set): how many, and Σ amount.
 * A cesija paid from a bank account is not counted (GEN-29).
 */
export function cesijaFromCredit(payments: readonly PaymentRow[]): { count: number; value: number } {
  const cesija = payments.filter(payment => payment.cesija_credit_id)
  return { count: cesija.length, value: cesija.reduce((sum, payment) => sum + num(payment.amount), 0) }
}

/** A `company_bank_accounts` row. */
export interface BankAccountRow {
  current_balance?: number | string | null
}

/** Σ balance over the accounts, and how many are in credit and how many overdrawn. */
export function bankAccountTotals(accounts: readonly BankAccountRow[]) {
  return {
    count: accounts.length,
    balance: accounts.reduce((sum, account) => sum + num(account.current_balance), 0),
    positive: accounts.filter(account => num(account.current_balance) > 0).length,
    negative: accounts.filter(account => num(account.current_balance) < 0).length,
  }
}
