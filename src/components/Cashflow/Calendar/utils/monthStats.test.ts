import { describe, it, expect } from 'vitest'
import { monthStats } from './monthStats'

type Row = Parameters<typeof monthStats>[0][number]

const invoice = (over: Partial<Row> = {}): Row => ({
  invoice_type: 'INCOMING_SUPPLIER',
  due_date: '2026-10-15',
  status: 'UNPAID',
  total_amount: 1000,
  remaining_amount: 1000,
  ...over,
})

const NOW = new Date(2026, 9, 20)

describe('monthStats', () => {
  it('puts every invoice of the month in exactly one of Plaćeno and Neplaćeno', () => {
    const stats = monthStats([
      invoice({ status: 'PAID', remaining_amount: 0 }),
      invoice({ status: 'UNPAID' }),
      invoice({ status: 'PARTIALLY_PAID', remaining_amount: 400 }),
    ], 2026, 9, NOW)
    expect(stats.total).toBe(3)
    expect(stats.paid).toBe(1)
    // The partly paid invoice used to be in neither card.
    expect(stats.unpaid).toBe(2)
    expect(stats.paid + stats.unpaid).toBe(stats.total)
  })

  it('counts a partly paid invoice with its remaining amount on the unpaid side', () => {
    const stats = monthStats([invoice({ status: 'PARTIALLY_PAID', remaining_amount: 400 })], 2026, 9, NOW)
    expect(stats.incomingUnpaid).toBe(400)
    expect(stats.incomingUnpaidCount).toBe(1)
  })

  it('counts overdue by the local due date, and never a paid invoice', () => {
    const stats = monthStats([
      invoice({ due_date: '2026-10-19' }),
      invoice({ due_date: '2026-10-20' }),
      invoice({ due_date: '2026-10-01', status: 'PAID' }),
      invoice({ due_date: '2026-10-05', status: 'PARTIALLY_PAID' }),
    ], 2026, 9, NOW)
    expect(stats.overdue).toBe(2)
  })

  it('keeps to the month asked for', () => {
    const stats = monthStats([invoice({ due_date: '2026-09-30' }), invoice({ due_date: '2026-10-01T00:00:00' })], 2026, 9, NOW)
    expect(stats.total).toBe(1)
  })

  it('nets paid money in against paid money out', () => {
    const stats = monthStats([
      invoice({ invoice_type: 'OUTGOING_SALES', status: 'PAID', total_amount: 5000 }),
      invoice({ invoice_type: 'INCOMING_BANK_EXPENSES', status: 'PAID', total_amount: 200 }),
    ], 2026, 9, NOW)
    expect(stats.outgoingPaid).toBe(5000)
    expect(stats.incomingPaid).toBe(200)
    expect(stats.netAmount).toBe(4800)
  })
})
