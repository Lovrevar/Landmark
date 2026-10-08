import { describe, it, expect } from 'vitest'
import { formatSignedEuro, paymentTotalsByCategory, paymentTotalsByDirection } from './paymentTotals'

describe('paymentTotalsByDirection', () => {
  it('nets a drawdown against its repayment instead of adding them', () => {
    // The screen used to sum every amount: this pair showed as €1.000.000.
    const totals = paymentTotalsByDirection([
      { amount: 500_000, direction: 'IN' },
      { amount: 500_000, direction: 'OUT' },
    ])
    expect(totals).toEqual({ inflow: 500_000, outflow: 500_000, net: 0, count: 2 })
  })

  it('puts repayments and credit fees together on the outflow side', () => {
    const totals = paymentTotalsByDirection([
      { amount: 1_000_000, direction: 'IN' },
      { amount: 250_000, direction: 'OUT' },
      { amount: 1_250.5, direction: 'OUT' },
    ])
    expect(totals.inflow).toBe(1_000_000)
    expect(totals.outflow).toBe(251_250.5)
    expect(totals.net).toBe(748_749.5)
    expect(totals.count).toBe(3)
  })

  it('goes negative when more has been paid back than drawn', () => {
    expect(paymentTotalsByDirection([
      { amount: 100, direction: 'IN' },
      { amount: 300, direction: 'OUT' },
    ]).net).toBe(-200)
  })

  it('accepts string amounts', () => {
    const totals = paymentTotalsByDirection([
      { amount: '1234.56', direction: 'IN' },
      { amount: '234.56', direction: 'OUT' },
    ])
    expect(totals).toEqual({ inflow: 1234.56, outflow: 234.56, net: 1000, count: 2 })
  })

  it('nets equal cent amounts to exactly zero, with no float residue', () => {
    const rows = Array.from({ length: 10 }, () => ({ amount: 0.1, direction: 'IN' as const }))
    const totals = paymentTotalsByDirection([...rows, { amount: 1, direction: 'OUT' }])
    expect(totals.inflow).toBe(1)
    expect(Object.is(totals.net, 0)).toBe(true)
  })

  it('counts a row with no direction or no usable amount but leaves it out of the sums', () => {
    const totals = paymentTotalsByDirection([
      { amount: 50, direction: null },
      { amount: null, direction: 'IN' },
      { amount: 'not a number', direction: 'OUT' },
      { amount: 10, direction: 'IN' },
    ])
    expect(totals).toEqual({ inflow: 10, outflow: 0, net: 10, count: 4 })
  })

  it('returns zeros for no rows', () => {
    expect(paymentTotalsByDirection([])).toEqual({ inflow: 0, outflow: 0, net: 0, count: 0 })
  })
})

describe('formatSignedEuro', () => {
  // The net figures on both payment screens. The plus is added here; the minus comes from the
  // shared formatter, which now puts it in the same place: before the euro sign.
  it('puts either sign before the euro sign', () => {
    expect(formatSignedEuro(1500)).toBe('+€1.500,00')
    expect(formatSignedEuro(-1500)).toBe('\u2212€1.500,00')
  })

  it('gives zero no sign', () => {
    expect(formatSignedEuro(0)).toBe('€0,00')
  })
})


describe('paymentTotalsByCategory', () => {
  // Credit principal is financing, neither income nor expense (CASH-7). The Cashflow payments
  // cards counted a drawdown as "Prihod" and a repayment as "Rashod" (CASH-29).
  it('keeps credit principal out of income and expense', () => {
    const { operating, financing } = paymentTotalsByCategory([
      { amount: 1_000, invoiceType: 'OUTGOING_SALES' },
      { amount: 400, invoiceType: 'INCOMING_SUPPLIER' },
      { amount: 500_000, invoiceType: 'OUTGOING_BANK' },
      { amount: 20_000, invoiceType: 'INCOMING_BANK' },
    ])
    expect(operating).toEqual({ inflow: 1_000, outflow: 400, net: 600, count: 2 })
    expect(financing).toEqual({ inflow: 500_000, outflow: 20_000, net: 480_000, count: 2 })
  })

  it('counts credit fees as an expense, not as financing', () => {
    const { operating, financing } = paymentTotalsByCategory([{ amount: 75.5, invoiceType: 'INCOMING_BANK_EXPENSES' }])
    expect(operating.outflow).toBe(75.5)
    expect(financing.count).toBe(0)
  })

  it('leaves a payment of unknown type out of every sum', () => {
    const { operating, financing } = paymentTotalsByCategory([{ amount: 10, invoiceType: null }])
    expect(operating.inflow + operating.outflow + financing.inflow + financing.outflow).toBe(0)
  })
})
