import { describe, it, expect } from 'vitest'
import { buildRetailSalesPaymentsSheet, type RetailSalesPaymentWithDetails } from './retailSalesService'
import { exportT } from '../../../../utils/exportLanguage'

const t = exportT()

const payment = (over: Partial<RetailSalesPaymentWithDetails> = {}): RetailSalesPaymentWithDetails => ({
  id: 'p1',
  payment_date: '2026-01-05',
  amount: 9000,
  payment_method: 'CASH',
  description: 'Gotovinska uplata',
  created_at: '2026-01-06T09:00:00.000Z',
  invoice_number: 'R-2026-010',
  issue_date: '2025-12-31',
  invoice_total_amount: 45000,
  project_name: 'Zemljište Osijek',
  customer_name: 'PANNONIA, d.o.o.',
  contract_number: 'U-2026-3',
  bank_account_name: 'N/A',
  ...over,
})

describe('buildRetailSalesPaymentsSheet', () => {
  it('writes Croatian headers in the screen\'s column order', () => {
    expect(buildRetailSalesPaymentsSheet([], t)[0]).toEqual([
      'Datum plaćanja', 'Račun', 'Datum računa', 'Ugovor', 'Projekt', 'Kupac',
      'Ukupno računa', 'Plaćanje', 'Metoda', 'Banka', 'Opis',
    ])
  })

  it('writes both amounts as numbers and both dates as dates', () => {
    const [, row] = buildRetailSalesPaymentsSheet([payment()], t)
    expect(row[6]).toBe(45000)
    expect(row[7]).toBe(9000)
    expect(row[0]).toBeInstanceOf(Date)
    expect(row[2]).toBeInstanceOf(Date)
  })

  it('translates the payment method rather than writing CASH', () => {
    expect(buildRetailSalesPaymentsSheet([payment()], t)[1][8]).toBe('Gotovina')
  })

  it('keeps a comma in a customer name in one cell and empties the N/A placeholder', () => {
    const [, row] = buildRetailSalesPaymentsSheet([payment()], t)
    expect(row[5]).toBe('PANNONIA, d.o.o.')
    expect(row[9]).toBe('')
  })
})
