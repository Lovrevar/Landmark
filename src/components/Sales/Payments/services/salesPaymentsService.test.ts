import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest'
import { buildSalesPaymentsSheet, calculateSalesPaymentStats, type SalesPaymentWithDetails } from './salesPaymentsService'
import { exportT } from '../../../../utils/exportLanguage'

const t = exportT()

const payment = (over: Partial<SalesPaymentWithDetails> = {}): SalesPaymentWithDetails => ({
  id: 'p1',
  payment_date: '2026-01-05',
  amount: 12500.5,
  payment_method: 'WIRE',
  description: 'Prva rata',
  created_at: '2026-01-06T09:00:00.000Z',
  invoice_number: 'R-2026-001',
  issue_date: '2025-12-31',
  invoice_total_amount: 250000,
  apartment_number: 'S-12',
  project_name: 'Savska Opatovina',
  customer_name: 'PANNONIA, d.o.o.',
  bank_account_name: 'Zagrebačka banka',
  ...over,
})

describe('buildSalesPaymentsSheet', () => {
  it('writes Croatian headers in the screen\'s column order', () => {
    expect(buildSalesPaymentsSheet([], t)[0]).toEqual([
      'Datum plaćanja', 'Račun', 'Datum računa', 'Stan', 'Projekt', 'Kupac',
      'Ukupno račun', 'Plaćanje', 'Metoda', 'Banka', 'Opis',
    ])
  })

  it('writes both amounts as numbers', () => {
    const [, row] = buildSalesPaymentsSheet([payment()], t)
    expect(row[6]).toBe(250000)
    expect(row[7]).toBe(12500.5)
  })

  it('keeps the day each date-only column says', () => {
    const [, row] = buildSalesPaymentsSheet([payment()], t)
    const paid = row[0] as Date
    const issued = row[2] as Date
    expect([paid.getMonth() + 1, paid.getDate()]).toEqual([1, 5])
    expect([issued.getMonth() + 1, issued.getDate()]).toEqual([12, 31])
  })

  it('translates the payment method rather than writing WIRE', () => {
    expect(buildSalesPaymentsSheet([payment()], t)[1][8]).toBe('Virman')
  })

  it('keeps a comma in a customer name in one cell and empties the N/A placeholder', () => {
    const [, row] = buildSalesPaymentsSheet([payment({ apartment_number: 'N/A' })], t)
    expect(row[5]).toBe('PANNONIA, d.o.o.')
    expect(row[3]).toBe('')
  })
})

// Characterization tests: what the stat cards show today, before "collected from sales" moves
// into a shared function (docs/REGRESSION_PREVENTION.md, Step 7 item 2). Do not edit an
// expectation to get a refactor green.
describe('calculateSalesPaymentStats', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 9, 20, 15, 30, 0)) // 20 October 2026, local time
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('totals every payment, and those since the first of the month', () => {
    expect(calculateSalesPaymentStats([
      payment({ payment_date: '2026-10-05', amount: 45_000 }),
      payment({ payment_date: '2026-10-01', amount: 30_000 }),
      payment({ payment_date: '2026-09-30', amount: 50_000 }),
      payment({ payment_date: '2025-10-15', amount: 100_000.5 }),
    ])).toEqual({
      totalPayments: 4,
      totalAmount: 225_000.5,
      paymentsThisMonth: 2,
      amountThisMonth: 75_000,
    })
  })

  it('"this month" holds west of UTC (the same UTC parse as GEN-34)', () => {
    const tz = process.env.TZ
    process.env.TZ = 'America/New_York'
    try {
      vi.setSystemTime(new Date(2026, 9, 20, 15, 30, 0))
      expect(calculateSalesPaymentStats([
        payment({ payment_date: '2026-10-01', amount: 30_000 }),
        payment({ payment_date: '2026-09-30', amount: 50_000 }),
      ])).toMatchObject({ paymentsThisMonth: 1, amountThisMonth: 30_000 })
    } finally {
      process.env.TZ = tz
    }
  })

  it('no payments', () => {
    expect(calculateSalesPaymentStats([])).toEqual({ totalPayments: 0, totalAmount: 0, paymentsThisMonth: 0, amountThisMonth: 0 })
  })
})
