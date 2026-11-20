import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest'
import { emptyFakeDb, type FakeDb } from '../../../../test/fakeSupabase'

const db = vi.hoisted((): FakeDb => ({ tables: {}, failing: {}, failingIn: {} }))
vi.mock('../../../../lib/supabase', async () => {
  const { fakeSupabase } = await import('../../../../test/fakeSupabase')
  return { supabase: fakeSupabase(db) }
})

import { buildSalesPaymentsSheet, calculateSalesPaymentStats, fetchSalesPayments, type SalesPaymentWithDetails } from './salesPaymentsService'
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
      // Assigning undefined would set TZ to the string "undefined", which Node reads as UTC.
      if (tz === undefined) delete process.env.TZ
      else process.env.TZ = tz
    }
  })

  it('no payments', () => {
    expect(calculateSalesPaymentStats([])).toEqual({ totalPayments: 0, totalAmount: 0, paymentsThisMonth: 0, amountThisMonth: 0 })
  })
})

describe('fetchSalesPayments', () => {
  // Payments carry their invoice as the `!inner` join returns it; only apartment sales invoices
  // belong on this screen.
  const sale = (n: number) => ({
    id: `i${n}`, invoice_number: `R-${n}`, issue_date: '2026-10-01', total_amount: 100, customer_id: 'cu1', apartment_id: 'a1',
    invoice_type: 'OUTGOING_SALES', customers: { name: 'Ana', surname: 'Horvat' }, apartments: { number: 'A1', projects: { name: 'Zelena Dolina' } },
  })
  const paid = (n: number, invoiceId = `i${n}`, invoice = { invoice_type: 'OUTGOING_SALES', apartment_id: 'a1' }) => ({
    id: `pay${n}`, payment_date: '2026-10-05', amount: '10', payment_method: 'WIRE', description: null,
    created_at: '2026-10-05T09:00:00.000Z', invoice_id: invoiceId, company_bank_account_id: 'ba1', invoice,
  })

  beforeEach(() => {
    Object.assign(db, emptyFakeDb(), {
      tables: {
        accounting_invoices: [sale(1)],
        accounting_payments: [
          paid(1),
          // A supplier invoice's payment is not a sales payment.
          paid(2, 'i-supplier', { invoice_type: 'INCOMING_SUPPLIER', apartment_id: 'a1' }),
        ],
        company_bank_accounts: [{ id: 'ba1', bank_name: 'Zagrebačka banka' }],
      },
    })
  })

  it('lists the apartment sales payments with their invoice, buyer and bank', async () => {
    expect(await fetchSalesPayments()).toEqual([{
      id: 'pay1', payment_date: '2026-10-05', amount: 10, payment_method: 'WIRE', description: null,
      created_at: '2026-10-05T09:00:00.000Z', invoice_number: 'R-1', issue_date: '2026-10-01', invoice_total_amount: 100,
      apartment_number: 'A1', project_name: 'Zelena Dolina', customer_name: 'Ana Horvat', bank_account_name: 'Zagrebačka banka',
    }])
  })

  // GEN-43: the invoices and payments stopped at row 1000 without a word, and the payments were
  // asked for with every invoice id in the URL. Here 1001 invoices each have one payment.
  it('GEN-43: lists every payment, not the first 1000', async () => {
    db.tables.accounting_invoices = Array.from({ length: 1_001 }, (_, n) => sale(n))
    db.tables.accounting_payments = Array.from({ length: 1_001 }, (_, n) => paid(n))
    const payments = await fetchSalesPayments()
    expect(payments).toHaveLength(1_001)
    expect(calculateSalesPaymentStats(payments).totalAmount).toBe(10_010)
    expect(payments.every(p => p.invoice_number.startsWith('R-'))).toBe(true)
  })

  it.each(['accounting_invoices', 'accounting_payments', 'company_bank_accounts'])(
    'rejects when the %s read fails, rather than showing payments without it',
    async table => {
      db.failing = { [table]: `permission denied for table ${table}` }
      await expect(fetchSalesPayments()).rejects.toMatchObject({ message: `permission denied for table ${table}` })
    },
  )
})
