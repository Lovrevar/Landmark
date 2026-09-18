import { describe, it, expect } from 'vitest'
import { bankPaymentTotals } from './paymentTotals'

describe('bankPaymentTotals', () => {
  it('nets a drawdown against its repayment instead of adding them', () => {
    // The screen used to sum every amount: this pair showed as €1.000.000.
    const totals = bankPaymentTotals([
      { amount: 500_000, direction: 'IN' },
      { amount: 500_000, direction: 'OUT' },
    ])
    expect(totals).toEqual({ inflow: 500_000, outflow: 500_000, net: 0, count: 2 })
  })

  it('puts repayments and credit fees together on the outflow side', () => {
    const totals = bankPaymentTotals([
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
    expect(bankPaymentTotals([
      { amount: 100, direction: 'IN' },
      { amount: 300, direction: 'OUT' },
    ]).net).toBe(-200)
  })

  it('accepts string amounts', () => {
    const totals = bankPaymentTotals([
      { amount: '1234.56', direction: 'IN' },
      { amount: '234.56', direction: 'OUT' },
    ])
    expect(totals).toEqual({ inflow: 1234.56, outflow: 234.56, net: 1000, count: 2 })
  })

  it('nets equal cent amounts to exactly zero, with no float residue', () => {
    const rows = Array.from({ length: 10 }, () => ({ amount: 0.1, direction: 'IN' as const }))
    const totals = bankPaymentTotals([...rows, { amount: 1, direction: 'OUT' }])
    expect(totals.inflow).toBe(1)
    expect(Object.is(totals.net, 0)).toBe(true)
  })

  it('counts a row with no direction or no usable amount but leaves it out of the sums', () => {
    const totals = bankPaymentTotals([
      { amount: 50, direction: null },
      { amount: null, direction: 'IN' },
      { amount: 'not a number', direction: 'OUT' },
      { amount: 10, direction: 'IN' },
    ])
    expect(totals).toEqual({ inflow: 10, outflow: 0, net: 10, count: 4 })
  })

  it('returns zeros for no rows', () => {
    expect(bankPaymentTotals([])).toEqual({ inflow: 0, outflow: 0, net: 0, count: 0 })
  })
})
