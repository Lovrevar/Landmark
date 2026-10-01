import { describe, it, expect } from 'vitest'
import { buildSalesPaymentsSheet, type SalesPaymentWithDetails } from './salesPaymentsService'
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
