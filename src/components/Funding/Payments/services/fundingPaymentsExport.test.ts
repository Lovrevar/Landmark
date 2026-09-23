import { describe, it, expect } from 'vitest'
import { buildFundingPaymentsSheet } from './fundingPaymentsExport'
import { exportT } from '../../../../utils/exportLanguage'
import type { BankPaymentWithDetails } from './bankPaymentsService'

const t = exportT()

const payment = (over: Partial<BankPaymentWithDetails>): BankPaymentWithDetails => ({
  id: 'p1',
  bank_credit_id: 'c1',
  bank_id: 'b1',
  amount: 250000,
  payment_date: '2026-01-05',
  notes: null,
  created_by: null,
  created_at: '2026-01-06T09:00:00.000Z',
  updated_at: '2026-01-06T09:00:00.000Z',
  bank_name: 'PANNONIA, d.o.o.',
  credit_type: 'line_of_credit',
  credit_seniority: 'junior',
  project_name: 'Savska Opatovina',
  invoice_type: 'OUTGOING_BANK',
  direction: 'IN',
  ...over,
})

describe('buildFundingPaymentsSheet', () => {
  it('writes Croatian headers in the screen\'s column order', () => {
    const [header] = buildFundingPaymentsSheet([], t)
    expect(header).toEqual(['Datum', 'Tip', 'Primatelj', 'Projekt', 'Kategorija', 'Iznos', 'Napomene'])
  })

  it('writes the amount as a number and the date as the day the column says', () => {
    const [, row] = buildFundingPaymentsSheet([payment({})], t)
    expect(row[5]).toBe(250000)
    const date = row[0] as Date
    expect([date.getFullYear(), date.getMonth() + 1, date.getDate()]).toEqual([2026, 1, 5])
  })

  it('translates the direction and the credit type rather than writing the enum', () => {
    const [, row] = buildFundingPaymentsSheet([payment({})], t)
    expect(row[1]).toBe('PRIHOD')
    expect(row[4]).not.toContain('_')
    expect(row[4]).toBe(t('banks.credit_form.loc_junior'))
  })

  it('falls back to created_at when the payment has no date', () => {
    const [, row] = buildFundingPaymentsSheet([payment({ payment_date: null })], t)
    expect(row[0]).toBeInstanceOf(Date)
  })

  it('keeps a comma in a supplier name in its own cell, and empties placeholders', () => {
    const [, row] = buildFundingPaymentsSheet([payment({ project_name: null })], t)
    expect(row[2]).toBe('PANNONIA, d.o.o.')
    expect(row[3]).toBe('')
  })

  it('keeps an unmapped credit type readable', () => {
    const [, row] = buildFundingPaymentsSheet([payment({ credit_type: 'some_new_type' })], t)
    expect(row[4]).toBe('some new type')
  })
})
