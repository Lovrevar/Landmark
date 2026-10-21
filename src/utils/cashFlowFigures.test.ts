import { describe, expect, it } from 'vitest'
import { cashFlowTotals, monthlyCashFlow } from './cashFlowFigures'

const TYPES = new Map<string, string>([
  ['sale', 'OUTGOING_SALES'],
  ['supplier', 'INCOMING_SUPPLIER'],
  ['fees', 'INCOMING_BANK_EXPENSES'],
  ['inv', 'INCOMING_INVESTMENT'],
  ['drawdown', 'OUTGOING_BANK'],
  ['repayment', 'INCOMING_BANK'],
])

const pay = (invoice: string | null, amount: number | string, payment_date: string | null) =>
  ({ amount, payment_date, invoiceType: invoice ? TYPES.get(invoice) : null })
const flow = (inflow: number, outflow: number) => ({ inflow, outflow, net: inflow - outflow })
const zero = flow(0, 0)

describe('monthlyCashFlow', () => {
  it('has one row per month of the range, first of the month as the key', () => {
    expect(monthlyCashFlow([], { start: '2026-05-01', end: '2026-10-20' }).map(m => m.month_key))
      .toEqual(['2026-05-01', '2026-06-01', '2026-07-01', '2026-08-01', '2026-09-01', '2026-10-01'])
  })

  // CASH-7: ULAZNI (INV) and credit fees are operating money out; principal is financing, so a
  // drawdown does not read as a good month's trading.
  it('puts each payment on its side and in its activity', () => {
    const [may] = monthlyCashFlow([
      pay('sale', 50_000, '2026-05-15'),
      pay('supplier', 8_500, '2026-05-10'),
      pay('inv', 8_000, '2026-05-20'),
      pay('fees', 900.4, '2026-05-03'),
      pay('drawdown', 600_000, '2026-05-08'),
      pay('repayment', 20_000, '2026-05-30'),
    ], { start: '2026-05-01', end: '2026-05-31' })

    expect(may.operating).toEqual(flow(50_000, 17_400.4))
    expect(may.financing).toEqual(flow(600_000, 20_000))
    expect(may).toMatchObject({ inflow: 650_000, outflow: 37_400.4, net: 612_599.6 })
  })

  it('buckets by the date as written, on the first and the last day of a month alike', () => {
    const months = monthlyCashFlow([
      pay('sale', 1, '2026-05-31'),
      pay('sale', 2, '2026-06-01'),
      pay('sale', 4, '2026-06-30'),
    ], { start: '2026-05-01', end: '2026-06-30' })
    expect(months.map(m => m.operating.inflow)).toEqual([1, 6])
  })

  it('leaves out payments outside the range, with no date, or whose invoice is unknown', () => {
    const months = monthlyCashFlow([
      pay('sale', 10_000, '2026-04-30'),
      pay('sale', 5, null),
      pay('not-loaded', 777, '2026-05-02'),
      pay(null, 1, '2026-05-02'),
    ], { start: '2026-05-01', end: '2026-05-31' })
    expect(months).toEqual([{ month_key: '2026-05-01', ...zero, operating: zero, financing: zero }])
  })

  it('sums in cents, so equal flows net to exactly 0', () => {
    const [month] = monthlyCashFlow([pay('sale', 0.1, '2026-05-02'), pay('sale', 0.2, '2026-05-03'), pay('supplier', '0.3', '2026-05-04')], { start: '2026-05-01', end: '2026-05-31' })
    expect(month.operating).toEqual(flow(0.3, 0.3))
    expect(month.net).toBe(0)
  })
})

describe('cashFlowTotals', () => {
  it('sums each side over the months', () => {
    expect(cashFlowTotals([flow(10, 4), flow(0, 6), flow(5, 0)])).toEqual({ inflow: 15, outflow: 10, net: 5 })
    expect(cashFlowTotals([])).toEqual(zero)
  })
})
