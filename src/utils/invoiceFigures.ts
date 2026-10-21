import { daysFromToday } from './dateOnly'

/**
 * Invoice status figures: how many invoices are paid, open and overdue, and for how much. One
 * definition each, for the General report, the Cashflow invoice list and Debt status
 * (REGRESSION_PREVENTION Step 7).
 *
 * - **Open** is `UNPAID` or `PARTIALLY_PAID`, and what is open on it is `remaining_amount`, not
 *   the total. `get_invoice_statistics` sums the same in SQL.
 * - **Overdue** is open with a due date before today, in whole local days. An invoice due today
 *   is not overdue yet. Overdue invoices are open too: the two figures overlap.
 *
 * The Cashflow calendar, the Retail report and the Director dashboard each count these a
 * different way (CASH-32).
 */

const num = (value: unknown): number => Number(value || 0)

/** An `accounting_invoices` row, narrowed to what these figures read. */
export interface InvoiceRow {
  status?: string | null
  due_date?: string | null
  total_amount?: number | string | null
  remaining_amount?: number | string | null
  invoice_category?: string | null
}

/** Not fully paid yet. */
export const isOpenInvoice = (status: string | null | undefined): boolean =>
  status === 'UNPAID' || status === 'PARTIALLY_PAID'

/**
 * Open, and due before today. `daysFrom` is `daysFromToday`, passed in only by tests that need a
 * different today.
 */
export const isOverdueInvoice = (
  invoice: Pick<InvoiceRow, 'status' | 'due_date'>,
  daysFrom: (date: string | null | undefined) => number = daysFromToday,
): boolean => isOpenInvoice(invoice.status) && !!invoice.due_date && daysFrom(invoice.due_date) < 0

export interface InvoiceStatusSummary {
  count: number
  /** Σ `total_amount` of every invoice. */
  totalValue: number
  paidCount: number
  /** Σ `total_amount` of the paid ones. */
  paidValue: number
  openCount: number
  /** Σ `remaining_amount` of the open ones. */
  openValue: number
  overdueCount: number
  /** Σ `remaining_amount` of the overdue ones. */
  overdueValue: number
  /** Paid invoices as a percentage of all of them, by count; 0 with none (GEN-32). */
  completionRate: number
}

/** Paid, open and overdue invoices, by count and amount. */
export function invoiceStatusSummary(
  invoices: readonly InvoiceRow[],
  daysFrom: (date: string | null | undefined) => number = daysFromToday,
): InvoiceStatusSummary {
  const paid = invoices.filter(inv => inv.status === 'PAID')
  const open = invoices.filter(inv => isOpenInvoice(inv.status))
  const overdue = invoices.filter(inv => isOverdueInvoice(inv, daysFrom))
  return {
    count: invoices.length,
    totalValue: invoices.reduce((sum, inv) => sum + num(inv.total_amount), 0),
    paidCount: paid.length,
    paidValue: paid.reduce((sum, inv) => sum + num(inv.total_amount), 0),
    openCount: open.length,
    openValue: open.reduce((sum, inv) => sum + num(inv.remaining_amount), 0),
    overdueCount: overdue.length,
    overdueValue: overdue.reduce((sum, inv) => sum + num(inv.remaining_amount), 0),
    completionRate: invoices.length > 0 ? (paid.length / invoices.length) * 100 : 0,
  }
}

/**
 * Office invoices as the General report counts them: every `invoice_category = 'OFFICE'` invoice
 * at its total, paid or not, received or issued (GEN-36).
 */
export function officeInvoiceTotals(invoices: readonly InvoiceRow[]): { count: number; spent: number; average: number } {
  const office = invoices.filter(inv => inv.invoice_category === 'OFFICE')
  const spent = office.reduce((sum, inv) => sum + num(inv.total_amount), 0)
  return { count: office.length, spent, average: office.length > 0 ? spent / office.length : 0 }
}
