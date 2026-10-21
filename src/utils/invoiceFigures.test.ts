import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { invoiceStatusSummary, isOpenInvoice, isOverdueInvoice, officeInvoiceTotals } from './invoiceFigures'

// Mid-afternoon, local: "overdue" must compare whole local days, not this instant.
const NOW = new Date(2026, 9, 20, 15, 30, 0)

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(NOW)
})

afterEach(() => {
  vi.useRealTimers()
})

const invoice = (status: string, total: number, remaining: number, due_date = '2026-11-30', invoice_category = 'SUBCONTRACTOR') =>
  ({ status, total_amount: total, remaining_amount: remaining, due_date, invoice_category })

describe('isOpenInvoice and isOverdueInvoice', () => {
  it('open is unpaid or partly paid', () => {
    expect(['UNPAID', 'PARTIALLY_PAID', 'PAID', null].map(isOpenInvoice)).toEqual([true, true, false, false])
  })

  it('overdue is open and due before today; due today is not overdue yet', () => {
    expect(isOverdueInvoice({ status: 'UNPAID', due_date: '2026-10-19' })).toBe(true)
    expect(isOverdueInvoice({ status: 'UNPAID', due_date: '2026-10-20' })).toBe(false)
    expect(isOverdueInvoice({ status: 'PARTIALLY_PAID', due_date: '2026-09-30' })).toBe(true)
    expect(isOverdueInvoice({ status: 'PAID', due_date: '2026-09-30' })).toBe(false)
    expect(isOverdueInvoice({ status: 'UNPAID', due_date: null })).toBe(false)
  })
})

describe('invoiceStatusSummary', () => {
  it('counts and values paid, open and overdue invoices; open is what remains, and includes overdue', () => {
    expect(invoiceStatusSummary([
      invoice('PAID', 60_000, 0),
      invoice('PARTIALLY_PAID', 14_499, 5_999, '2026-09-30'),
      invoice('UNPAID', 6_000, 6_000, '2026-11-15'),
      invoice('UNPAID', 500, 500, '2026-10-20'),
    ])).toEqual({
      count: 4,
      totalValue: 80_999,
      paidCount: 1,
      paidValue: 60_000,
      openCount: 3,
      openValue: 12_499,
      overdueCount: 1,
      overdueValue: 5_999,
      completionRate: 25,
    })
  })

  it('takes another today for tests', () => {
    expect(invoiceStatusSummary([invoice('UNPAID', 1, 1, '2026-10-20')], () => -1).overdueCount).toBe(1)
  })

  it('is all zeros for no invoices', () => {
    expect(invoiceStatusSummary([])).toEqual({
      count: 0, totalValue: 0, paidCount: 0, paidValue: 0, openCount: 0, openValue: 0, overdueCount: 0, overdueValue: 0, completionRate: 0,
    })
  })
})

describe('officeInvoiceTotals', () => {
  // Pinned as the General report counts it: unpaid ones too, at their total (GEN-36).
  it('sums every office-category invoice at its total', () => {
    expect(officeInvoiceTotals([
      invoice('PAID', 1_250, 0, '2026-08-15', 'OFFICE'),
      invoice('UNPAID', 500, 500, '2026-11-30', 'OFFICE'),
      invoice('PAID', 9_999, 0),
    ])).toEqual({ count: 2, spent: 1_750, average: 875 })
    expect(officeInvoiceTotals([])).toEqual({ count: 0, spent: 0, average: 0 })
  })
})
