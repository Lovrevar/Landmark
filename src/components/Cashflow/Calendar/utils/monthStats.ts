import type { Invoice } from '../types'
import { isCashIn, isCashOut } from '../../../../utils/invoiceCashDirection'

type StatsInvoice = Pick<Invoice, 'invoice_type' | 'due_date' | 'status' | 'total_amount' | 'remaining_amount'>

/** `yyyy-mm-dd…` as local year, month (0-based) and day — never through `new Date(string)`, which is UTC. */
const dueParts = (dueDate: string): [number, number, number] => {
  const [year, month, day] = dueDate.split('T')[0].split('-').map(part => parseInt(part))
  return [year, month - 1, day]
}

/**
 * The figures above the calendar for one month, by due date.
 *
 * An invoice is either paid or it is not: a partly paid one still has money owing, so it counts
 * as unpaid everywhere here. The "Neplaćeno" card used to count status `UNPAID` only, while the
 * amounts and the day dots beside it included partly paid invoices — which then sat in no card at
 * all (CASH-24).
 */
export function monthStats(invoices: readonly StatsInvoice[], year: number, month: number, now: Date = new Date()) {
  const monthInvoices = invoices.filter(inv => {
    const [invYear, invMonth] = dueParts(inv.due_date)
    return invYear === year && invMonth === month
  })

  const today = new Date(now)
  today.setHours(0, 0, 0, 0)

  const isPaid = (inv: StatsInvoice) => inv.status === 'PAID'
  const sum = (list: StatsInvoice[], pick: (inv: StatsInvoice) => number) => list.reduce((total, inv) => total + pick(inv), 0)

  // Sides come from the shared direction map. The two lists kept here before left credit
  // fees (INCOMING_BANK_EXPENSES) out of both, so a month's "Ulazni" total and its net
  // ignored them while the bank balance did not.
  const incomingInvoices = monthInvoices.filter(inv => isCashOut(inv.invoice_type))
  const outgoingInvoices = monthInvoices.filter(inv => isCashIn(inv.invoice_type))

  const incomingPaid = sum(incomingInvoices.filter(isPaid), inv => inv.total_amount)
  const incomingOpen = incomingInvoices.filter(inv => !isPaid(inv))
  const outgoingPaid = sum(outgoingInvoices.filter(isPaid), inv => inv.total_amount)

  return {
    total: monthInvoices.length,
    paid: monthInvoices.filter(isPaid).length,
    unpaid: monthInvoices.filter(inv => !isPaid(inv)).length,
    overdue: monthInvoices.filter(inv => {
      const [dueYear, dueMonth, dueDay] = dueParts(inv.due_date)
      return !isPaid(inv) && new Date(dueYear, dueMonth, dueDay) < today
    }).length,
    totalAmount: sum(monthInvoices, inv => inv.total_amount),
    paidAmount: sum(monthInvoices.filter(isPaid), inv => inv.total_amount),
    unpaidAmount: sum(monthInvoices.filter(inv => !isPaid(inv)), inv => inv.total_amount),
    incomingPaid,
    incomingUnpaid: sum(incomingOpen, inv => inv.remaining_amount),
    incomingUnpaidCount: incomingOpen.length,
    outgoingPaid,
    netAmount: outgoingPaid - incomingPaid,
  }
}
