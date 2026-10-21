import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { emptyFakeDb, type FakeDb } from '../../../test/fakeSupabase'

/**
 * Characterization tests: they record what `fetchSalesDashboardData` returns today, before its
 * figures move into shared functions (docs/REGRESSION_PREVENTION.md, Step 7 item 2). They are not
 * a statement that every figure is right; where a pinned figure is known to differ from another
 * screen, the comment names the backlog id.
 *
 * Do not edit an expectation to get a refactor green. If one moves, the refactor changed a figure.
 */

const db = vi.hoisted((): FakeDb => ({ tables: {}, failing: {}, failingIn: {} }))
vi.mock('../../../lib/supabase', async () => {
  const { fakeSupabase } = await import('../../../test/fakeSupabase')
  return { supabase: fakeSupabase(db) }
})

import { fetchSalesDashboardData } from './salesDashboardService'

// Mid-afternoon on 20 October 2026, local time.
const NOW = new Date(2026, 9, 20, 15, 30, 0)

/** Float summing order is not a figure: compare to six decimals, and never tell -0 from 0. */
const roundDeep = <T>(value: T): T => {
  if (typeof value === 'number') return ((Math.round(value * 1e6) / 1e6) || 0) as T
  if (Array.isArray(value)) return value.map(roundDeep) as T
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, inner]) => [key, roundDeep(inner)])) as T
  }
  return value
}

const dashboard = async () => roundDeep(await fetchSalesDashboardData())
const pct = (part: number, whole: number) => (part / whole) * 100

const SALES = [
  { id: 's1', apartment_id: 'a1', customer_id: 'cu1', sale_price: 198_000, sale_date: '2026-10-03', payment_method: 'cash' },
  { id: 's2', apartment_id: 'a2', customer_id: 'cu2', sale_price: 150_000.5, sale_date: '2026-09-15', payment_method: 'bank_loan' },
  { id: 's3', apartment_id: 'a5', customer_id: 'cu1', sale_price: 295_000, sale_date: '2025-11-20', payment_method: 'bank_loan' },
  { id: 's4', apartment_id: 'a6', customer_id: 'cu3', sale_price: 250_000, sale_date: '2026-10-01', payment_method: 'installments' },
]

// Three projects with units, and one without. Garages and storage belong to a building; g4's
// building is unknown, so it counts towards the totals but towards no project.
const PORTFOLIO: Record<string, unknown[]> = {
  projects: [
    { id: 'p1', name: 'Zelena Dolina' },
    { id: 'p2', name: 'Precko Zapad' },
    { id: 'p3', name: 'Lučko' },
    { id: 'p4', name: 'Sveta Nedelja' },
  ],
  buildings: [
    { id: 'bd1', project_id: 'p1' },
    { id: 'bd2', project_id: 'p2' },
  ],
  apartments: [
    { id: 'a1', number: 'A1', project_id: 'p1', status: 'Sold' },
    { id: 'a2', number: 'A2', project_id: 'p1', status: 'Sold' },
    { id: 'a3', number: 'A3', project_id: 'p1', status: 'Reserved' },
    { id: 'a4', number: 'A4', project_id: 'p1', status: 'Available' },
    { id: 'a5', number: 'B1', project_id: 'p2', status: 'Sold' },
    { id: 'a6', number: 'B2', project_id: 'p2', status: 'Sold' },
    { id: 'a7', number: 'L1', project_id: 'p3', status: 'Sold' }, // no sale row (SALES-22)
    { id: 'a8', number: 'L2', project_id: 'p3', status: 'Available' },
  ],
  garages: [
    { id: 'g1', building_id: 'bd1', status: 'Sold' },
    { id: 'g2', building_id: 'bd2', status: 'Sold' },
    { id: 'g3', building_id: 'bd1', status: 'Available' },
    { id: 'g4', building_id: 'bdX', status: 'Reserved' },
  ],
  repositories: [
    { id: 'r1', building_id: 'bd1', status: 'Sold' },
    { id: 'r2', building_id: 'bd2', status: 'Available' },
  ],
  sales: SALES,
  customers: [
    { id: 'cu1', name: 'Ana', surname: 'Horvat', status: 'buyer' },
    { id: 'cu2', name: 'Ivan', surname: 'Kovač', status: 'buyer' },
    { id: 'cu3', name: 'Marija', surname: 'Babić', status: 'buyer' },
    { id: 'cu4', name: 'Petar', surname: 'Marić', status: 'lead' },
    { id: 'cu5', name: 'Lucija', surname: 'Jurić', status: 'interested' },
    { id: 'cu6', name: 'Tomislav', surname: 'Novak', status: 'lead' },
  ],
  // Payments on the apartments' sales invoices. The query keeps OUTGOING_SALES invoices that
  // carry an apartment; q7 and q8 must drop out.
  accounting_payments: [
    { amount: 45_000, payment_date: '2026-10-05', invoice: { apartment_id: 'a1', invoice_type: 'OUTGOING_SALES' } },
    { amount: 30_000, payment_date: '2026-10-01', invoice: { apartment_id: 'a6', invoice_type: 'OUTGOING_SALES' } },
    { amount: 50_000, payment_date: '2026-09-12', invoice: { apartment_id: 'a2', invoice_type: 'OUTGOING_SALES' } },
    { amount: 100_000, payment_date: '2026-05-20', invoice: { apartment_id: 'a5', invoice_type: 'OUTGOING_SALES' } },
    { amount: '20000.00', payment_date: '2026-04-30', invoice: { apartment_id: 'a5', invoice_type: 'OUTGOING_SALES' } },
    // A deposit on an apartment that is not sold counts as collected.
    { amount: 5_000, payment_date: '2026-08-08', invoice: { apartment_id: 'a8', invoice_type: 'OUTGOING_SALES' } },
    { amount: 7_000, payment_date: '2026-10-10', invoice: { apartment_id: null, invoice_type: 'OUTGOING_SALES' } }, // q7
    { amount: 9_000, payment_date: '2026-10-11', invoice: { apartment_id: 'a1', invoice_type: 'INCOMING_SUPPLIER' } }, // q8
    // An apartment the dashboard cannot place: collected, but in no project.
    { amount: 1_000, payment_date: '2026-10-12', invoice: { apartment_id: 'a9', invoice_type: 'OUTGOING_SALES' } },
  ],
}

const COLLECTED = 45_000 + 30_000 + 50_000 + 100_000 + 20_000 + 5_000 + 1_000

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(NOW)
  Object.assign(db, emptyFakeDb(), { tables: structuredClone(PORTFOLIO) })
})

afterEach(() => {
  vi.useRealTimers()
})

describe('fetchSalesDashboardData: a realistic portfolio', () => {
  it('stats', async () => {
    expect((await dashboard()).stats).toEqual(roundDeep({
      // Every apartment, garage and storage unit ("sve jedinice", GEN-9).
      totalUnits: 14,
      availableUnits: 4,
      reservedUnits: 2,
      soldUnits: 8,
      // Cash collected on the apartments' sales invoices ("Naplaćeno od prodaje", GEN-9).
      totalRevenue: COLLECTED,
      // Σ sale_price over the sale rows; linked garages and storage play no part (GEN-38).
      avgSalePrice: (198_000 + 150_000.5 + 295_000 + 250_000) / 4,
      salesRate: pct(8, 14),
      totalCustomers: 6,
      activeLeads: 3,
      // Collected since 1 October, the month's first day included.
      monthlyRevenue: 45_000 + 30_000 + 1_000,
    }))
  })

  it('per project, projects without units left out', async () => {
    expect((await dashboard()).projectStats).toEqual(roundDeep([
      { project_id: 'p1', project_name: 'Zelena Dolina', total_units: 7, sold_units: 4, reserved_units: 1, available_units: 2, total_revenue: 95_000, sales_rate: pct(4, 7) },
      { project_id: 'p2', project_name: 'Precko Zapad', total_units: 4, sold_units: 3, reserved_units: 0, available_units: 1, total_revenue: 150_000, sales_rate: 75 },
      { project_id: 'p3', project_name: 'Lučko', total_units: 2, sold_units: 1, reserved_units: 0, available_units: 1, total_revenue: 5_000, sales_rate: 50 },
    ]))
  })

  it('six months of trend: sales by sale date, revenue by payment date', async () => {
    expect((await dashboard()).monthlyTrends).toEqual([
      { month: '2026-05-01', sales_count: 0, revenue: 100_000 },
      { month: '2026-06-01', sales_count: 0, revenue: 0 },
      { month: '2026-07-01', sales_count: 0, revenue: 0 },
      { month: '2026-08-01', sales_count: 0, revenue: 5_000 },
      { month: '2026-09-01', sales_count: 1, revenue: 50_000 },
      { month: '2026-10-01', sales_count: 2, revenue: 76_000 },
    ])
  })

  it('payment methods', async () => {
    expect((await dashboard()).paymentMethodBreakdown).toEqual({ cash: 1, bank_loan: 2, installments: 1 })
  })

  it('recent sales, newest first, with apartment, project and buyer', async () => {
    const [s1, s2, s3, s4] = SALES
    expect((await dashboard()).recentSales).toEqual([
      { ...s1, apartment_number: 'A1', project_name: 'Zelena Dolina', customer_name: 'Ana Horvat' },
      { ...s4, apartment_number: 'B2', project_name: 'Precko Zapad', customer_name: 'Marija Babić' },
      { ...s2, apartment_number: 'A2', project_name: 'Zelena Dolina', customer_name: 'Ivan Kovač' },
      { ...s3, apartment_number: 'B1', project_name: 'Precko Zapad', customer_name: 'Ana Horvat' },
    ])
  })
})

describe('fetchSalesDashboardData: no rows at all', () => {
  it('is a dashboard of zeros, not an error', async () => {
    db.tables = {}
    const r = await dashboard()
    expect(r.stats).toEqual({
      totalUnits: 0, availableUnits: 0, reservedUnits: 0, soldUnits: 0, totalRevenue: 0, avgSalePrice: 0, salesRate: 0,
      totalCustomers: 0, activeLeads: 0, monthlyRevenue: 0,
    })
    expect(r.projectStats).toEqual([])
    expect(r.monthlyTrends.map(m => m.revenue + m.sales_count)).toEqual([0, 0, 0, 0, 0, 0])
    expect(r.paymentMethodBreakdown).toEqual({})
    expect(r.recentSales).toEqual([])
  })
})

describe('fetchSalesDashboardData: a failed load', () => {
  it.each(['apartments', 'garages', 'repositories', 'buildings', 'sales', 'customers', 'projects', 'accounting_payments'])(
    'rejects when the %s read fails, rather than showing zeros',
    async table => {
      db.failing = { [table]: `permission denied for table ${table}` }
      await expect(fetchSalesDashboardData()).rejects.toMatchObject({ message: `permission denied for table ${table}` })
    },
  )

  it.each(['apartments', 'customers', 'projects'])('rejects when the recent sales\' %s lookup fails', async table => {
    db.failingIn = { [table]: 'canceling statement due to statement timeout' }
    await expect(fetchSalesDashboardData()).rejects.toMatchObject({ message: 'canceling statement due to statement timeout' })
  })
})
