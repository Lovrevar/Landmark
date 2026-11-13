import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { emptyFakeDb, type FakeDb } from '../../../test/fakeSupabase'

const db = vi.hoisted((): FakeDb => ({ tables: {}, failing: {}, failingIn: {} }))
vi.mock('../../../lib/supabase', async () => {
  const { fakeSupabase } = await import('../../../test/fakeSupabase')
  return { supabase: fakeSupabase(db) }
})

import { fetchCashFlowStats, fetchMonthlyTrends, fetchVATStats } from './accountingDashboardService'

// Mid-afternoon on 13 November 2026, local time.
const NOW = new Date(2026, 10, 13, 15, 0, 0)

/** 1001 rows: one more than PostgREST returns to a read that does not page. */
const PAST_ONE_PAGE = 1_001
const ids = Array.from({ length: PAST_ONE_PAGE }, (_, i) => String(i).padStart(4, '0'))

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(NOW)
  Object.assign(db, emptyFakeDb())
})

afterEach(() => {
  vi.useRealTimers()
})

describe('accounting dashboard: more rows this year than one PostgREST page', () => {
  // GEN-35: a year of payments easily passes 1000 rows, and the unpaged reads dropped the rest.
  beforeEach(() => {
    // Every payment is €10 received on a sales invoice, in this month.
    db.tables.accounting_payments = ids.map(id => ({
      id: `pay-${id}`, invoice_id: `inv-${id}`, amount: '10', payment_date: '2026-11-02',
      accounting_invoices: { invoice_type: 'OUTGOING_SALES' },
    }))
    // Every invoice is a paid sale with €2 output VAT, issued this month.
    db.tables.accounting_invoices = ids.map(id => ({
      id: `inv-${id}`, invoice_type: 'OUTGOING_SALES', status: 'PAID', issue_date: '2026-11-02',
      vat_amount_1: 2, vat_amount_2: 0, vat_amount_3: 0, vat_amount_4: 0,
    }))
  })

  it('GEN-35: the monthly trend counts every payment', async () => {
    const months = await fetchMonthlyTrends()
    expect(months.at(-1)).toEqual({ month: '2026-11-01', incoming: PAST_ONE_PAGE * 10, outgoing: 0 })
  })

  it('GEN-35: the cash-flow cards count every payment', async () => {
    const stats = await fetchCashFlowStats()
    expect(stats.totalIncoming).toBe(PAST_ONE_PAGE * 10)
    expect(stats.currentMonthIncoming).toBe(PAST_ONE_PAGE * 10)
  })

  it('GEN-35: the VAT cards count every paid invoice', async () => {
    const stats = await fetchVATStats()
    expect(stats.totalVATCollected).toBe(PAST_ONE_PAGE * 2)
    expect(stats.currentMonthVATCollected).toBe(PAST_ONE_PAGE * 2)
  })

  it('fails rather than counting a partial year', async () => {
    db.failing = { accounting_payments: 'canceling statement due to statement timeout' }
    await expect(fetchMonthlyTrends()).rejects.toMatchObject({ message: 'canceling statement due to statement timeout' })
    await expect(fetchCashFlowStats()).rejects.toMatchObject({ message: 'canceling statement due to statement timeout' })
  })
})
