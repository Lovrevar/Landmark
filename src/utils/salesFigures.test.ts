import { describe, expect, it } from 'vitest'
import {
  averagePer,
  collectedByMonth,
  collectedByProject,
  collectedFromSales,
  collectedSince,
  conversionRate,
  customerFunnel,
  salesRate,
  soldRevenue,
  unitStatusCounts,
} from './salesFigures'

const unit = (status: string, price: number | string | null = 100_000) => ({ status, price })

describe('unitStatusCounts', () => {
  it('counts each status and every row in the total', () => {
    expect(unitStatusCounts([unit('Sold'), unit('Sold'), unit('Reserved'), unit('Available'), unit('Withdrawn')]))
      .toEqual({ total: 5, sold: 2, reserved: 1, available: 1 })
  })

  it('is all zeros for no units', () => {
    expect(unitStatusCounts([])).toEqual({ total: 0, sold: 0, reserved: 0, available: 0 })
  })
})

describe('salesRate', () => {
  it('is sold over total, as a percentage', () => {
    expect(salesRate(2, 6)).toBeCloseTo(33.333, 3)
    expect(salesRate(3, 3)).toBe(100)
  })

  // A project with no units would otherwise divide by zero — the "NaN%" GEN-31 is about.
  it('is 0 when there are no units', () => {
    expect(salesRate(0, 0)).toBe(0)
  })
})

describe('averagePer', () => {
  it('divides, and is 0 rather than NaN for a count of 0', () => {
    expect(averagePer(1_120_000.5, 5)).toBeCloseTo(224_000.1, 6)
    expect(averagePer(0, 0)).toBe(0)
  })
})

describe('soldRevenue', () => {
  it('sums the list price of sold units only', () => {
    expect(soldRevenue([unit('Sold', 200_000), unit('Sold', 150_000.5), unit('Reserved', 180_000), unit('Available', 1)]))
      .toBe(350_000.5)
  })

  it('reads numeric strings and treats a missing price as 0', () => {
    expect(soldRevenue([unit('Sold', '120000.25'), unit('Sold', null)])).toBe(120_000.25)
  })

  it('adds what linkedPrice returns for each sold unit', () => {
    const prices = new Map([['g1', 15_000]])
    const units = [{ status: 'Sold', price: 200_000, garage: 'g1' }, { status: 'Available', price: 170_000, garage: 'g1' }]
    expect(soldRevenue(units, u => prices.get(u.garage) ?? 0)).toBe(215_000)
  })

  it('is 0 for no units', () => {
    expect(soldRevenue([])).toBe(0)
  })
})

describe('customerFunnel', () => {
  it('counts buyers, leads and interested, and converts buyers over everyone', () => {
    const customers = ['buyer', 'buyer', 'lead', 'lead', 'interested'].map(status => ({ status }))
    expect(customerFunnel(customers)).toEqual({ total: 5, buyers: 2, interested: 1, leads: 2, activeLeads: 3, conversionRate: 40 })
  })

  it('is all zeros for no customers', () => {
    expect(customerFunnel([])).toEqual({ total: 0, buyers: 0, interested: 0, leads: 0, activeLeads: 0, conversionRate: 0 })
  })

  it('conversionRate is 0 with no customers', () => {
    expect(conversionRate(0, 0)).toBe(0)
    expect(conversionRate(1, 4)).toBe(25)
  })
})

describe('collected from sales', () => {
  const payments = [
    { amount: 45_000, payment_date: '2026-10-05', apartment: 'a1' },
    { amount: '30000.50', payment_date: '2026-10-01', apartment: 'a2' },
    { amount: 50_000, payment_date: '2026-09-30', apartment: 'a1' },
    { amount: null, payment_date: '2026-10-07', apartment: 'a3' },
    { amount: 1_000, payment_date: null, apartment: 'a9' },
  ]

  it('sums every payment, a numeric string included and a missing amount as 0', () => {
    expect(collectedFromSales(payments)).toBe(126_000.5)
    expect(collectedFromSales([])).toBe(0)
  })

  it('counts from local midnight on, the first day included and an undated payment left out', () => {
    expect(collectedSince(payments, new Date(2026, 9, 1))).toBe(75_000.5)
  })

  it('buckets by the month the payment date says', () => {
    expect(collectedByMonth(payments)).toEqual(new Map([['2026-10', 75_000.5], ['2026-09', 50_000], ['', 1_000]]))
  })

  it('sums per project and leaves out a payment with no project', () => {
    const projectOf = (p: { apartment: string }) => ({ a1: 'p1', a2: 'p2', a3: 'p1' } as Record<string, string>)[p.apartment]
    expect(collectedByProject(payments, projectOf)).toEqual(new Map([['p1', 95_000], ['p2', 30_000.5]]))
  })
})
