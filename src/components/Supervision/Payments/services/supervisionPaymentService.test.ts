import { describe, it, expect } from 'vitest'
import { buildSupervisionPaymentsSheet, type PaymentWithDetails } from './supervisionPaymentService'
import { exportT } from '../../../../utils/exportLanguage'

const t = exportT()

const payment = (over: Partial<PaymentWithDetails> = {}): PaymentWithDetails => ({
  id: 'p1',
  amount: 48250.75,
  payment_date: '2026-01-05',
  created_at: '2026-01-06T09:00:00.000Z',
  notes: 'Privremena situacija 3; "hitno"',
  subcontractor_name: 'PANNONIA, d.o.o.',
  project_name: 'Savska Opatovina',
  phase_name: 'Faza 1',
  paid_by_company_name: 'Landmark d.o.o.',
  ...over,
})

describe('buildSupervisionPaymentsSheet', () => {
  it('writes Croatian headers in the screen\'s column order', () => {
    expect(buildSupervisionPaymentsSheet([], t)[0]).toEqual([
      'Datum', 'Podugovaratelj', 'Projekt', 'Faza', 'Plaćeno od', 'Iznos', 'Napomene',
    ])
  })

  it('writes the amount as a number', () => {
    expect(buildSupervisionPaymentsSheet([payment()], t)[1][5]).toBe(48250.75)
  })

  it('keeps the day the date-only column says, not the UTC one before it', () => {
    const date = buildSupervisionPaymentsSheet([payment()], t)[1][0] as Date
    expect([date.getFullYear(), date.getMonth() + 1, date.getDate()]).toEqual([2026, 1, 5])
  })

  it('falls back to created_at when the payment has no date', () => {
    const date = buildSupervisionPaymentsSheet([payment({ payment_date: '' })], t)[1][0] as Date
    expect(date).toBeInstanceOf(Date)
    expect(date.getFullYear()).toBe(2026)
  })

  it('keeps a comma, a semicolon and a quote inside their own cells', () => {
    const [, row] = buildSupervisionPaymentsSheet([payment()], t)
    expect(row[1]).toBe('PANNONIA, d.o.o.')
    expect(row[6]).toBe('Privremena situacija 3; "hitno"')
  })

  it('empties the service-layer placeholders', () => {
    const [, row] = buildSupervisionPaymentsSheet([payment({ project_name: '—', paid_by_company_name: '-' })], t)
    expect(row[2]).toBe('')
    expect(row[4]).toBe('')
  })
})
