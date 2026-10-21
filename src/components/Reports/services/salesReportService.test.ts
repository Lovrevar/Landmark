import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { emptyFakeDb, type FakeDb } from '../../../test/fakeSupabase'
import type { Project } from '../../../lib/supabase'

/**
 * Characterization tests: they record what the Sales report's two reports return today, before
 * their figures move into shared functions (docs/REGRESSION_PREVENTION.md, Step 7 item 2). They
 * are not a statement that every figure is right; where a pinned figure is known to be wrong or
 * to differ from another screen, the comment names the backlog id.
 *
 * Do not edit an expectation to get a refactor green. If one moves, the refactor changed a figure.
 */

const db = vi.hoisted((): FakeDb => ({ tables: {}, failing: {}, failingIn: {} }))
vi.mock('../../../lib/supabase', async () => {
  const { fakeSupabase } = await import('../../../test/fakeSupabase')
  return { supabase: fakeSupabase(db) }
})

import { generateCustomerReport, generateProjectReport } from './salesReportService'

// Mid-afternoon on 20 October 2026, local time, and the six months the screen offers. The months
// hold in UTC (CI) and east of it (Croatia); west of UTC the report reads '2026-05-01' as
// 30 April (GEN-34).
const NOW = new Date(2026, 9, 20, 15, 30, 0)
const RANGE = { start: '2026-05-01', end: '2026-10-20' }

/** Float summing order is not a figure: compare to six decimals, and never tell -0 from 0. */
const roundDeep = <T>(value: T): T => {
  if (typeof value === 'number') return ((Math.round(value * 1e6) / 1e6) || 0) as T
  if (Array.isArray(value)) return value.map(roundDeep) as T
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, inner]) => [key, roundDeep(inner)])) as T
  }
  return value
}

const PROJECTS = [
  { id: 'p1', name: 'Zelena Dolina', location: 'Zagreb', status: 'In Progress', budget: 6_500_000 },
  { id: 'p2', name: 'Precko Zapad', location: 'Zagreb', status: 'Completed', budget: 1_000_000_000 },
] as unknown as Project[]

const APARTMENTS = [
  { id: 'a1', project_id: 'p1', number: 'A1', status: 'Sold', price: 200_000 },
  { id: 'a2', project_id: 'p1', number: 'A2', status: 'Sold', price: 150_000.5 },
  { id: 'a3', project_id: 'p1', number: 'A3', status: 'Reserved', price: 180_000 },
  { id: 'a4', project_id: 'p1', number: 'A4', status: 'Available', price: 170_000 },
  { id: 'a10', project_id: 'p1', number: 'A5', status: 'Sold', price: 160_000 }, // sold in April
  { id: 'a5', project_id: 'p2', number: 'B1', status: 'Sold', price: 300_000 },
  { id: 'a6', project_id: 'p2', number: 'B2', status: 'Sold', price: 250_000 },
  { id: 'a12', project_id: 'p2', number: 'B3', status: 'Sold', price: 210_000 }, // sold after the range
]

// Each sale carries the apartment it joins to, as `apartments!inner(project_id)` returns it.
const SALES = [
  { id: 's1', apartment_id: 'a1', customer_id: 'cu1', sale_price: 198_000, sale_date: '2026-10-03', apartments: { project_id: 'p1' } },
  { id: 's2', apartment_id: 'a2', customer_id: 'cu2', sale_price: 150_000.5, sale_date: '2026-09-15', apartments: { project_id: 'p1' } },
  { id: 's5', apartment_id: 'a10', customer_id: 'cu4', sale_price: 160_000, sale_date: '2026-04-15', apartments: { project_id: 'p1' } },
  { id: 's3', apartment_id: 'a5', customer_id: 'cu1', sale_price: 295_000, sale_date: '2025-11-20', apartments: { project_id: 'p2' } },
  { id: 's4', apartment_id: 'a6', customer_id: 'cu3', sale_price: 250_000, sale_date: '2026-10-01', apartments: { project_id: 'p2' } },
  { id: 's6', apartment_id: 'a12', customer_id: 'cu6', sale_price: 205_000, sale_date: '2026-10-21', apartments: { project_id: 'p2' } },
]

const CUSTOMERS = [
  { id: 'cu1', name: 'Ana', surname: 'Horvat', status: 'buyer' },
  { id: 'cu2', name: 'Ivan', surname: 'Kovač', status: 'buyer' },
  { id: 'cu3', name: 'Marija', surname: 'Babić', status: 'buyer' },
  { id: 'cu4', name: 'Petar', surname: 'Marić', status: 'lead' },
  { id: 'cu5', name: 'Lucija', surname: 'Jurić', status: 'interested' },
  { id: 'cu6', name: 'Tomislav', surname: 'Novak', status: 'buyer' },
]

const DATA: Record<string, unknown[]> = {
  apartments: APARTMENTS,
  // a1 has a garage and a storage unit, a2 two garages, and the unsold a4 a garage of its own.
  apartment_garages: [
    { apartment_id: 'a1', garage_id: 'g1', garages: { id: 'g1', price: 15_000 } },
    { apartment_id: 'a2', garage_id: 'g5', garages: { id: 'g5', price: 12_000 } },
    { apartment_id: 'a2', garage_id: 'g6', garages: { id: 'g6', price: 8_000 } },
    { apartment_id: 'a4', garage_id: 'g7', garages: { id: 'g7', price: 10_000 } },
    { apartment_id: 'a5', garage_id: 'g2', garages: { id: 'g2', price: 20_000 } },
  ],
  apartment_repositories: [
    { apartment_id: 'a1', repository_id: 'r1', repositories: { id: 'r1', price: 5_000 } },
  ],
  sales: SALES,
  customers: CUSTOMERS,
  bank_credits: [
    { id: 'cr1', project_id: 'p1', banks: { name: 'Zagrebačka banka' } },
    { id: 'cr2', project_id: 'p1', banks: null },
  ],
  credit_allocations: [
    { id: 'al1', project_id: 'p1', bank_credits: { banks: { name: 'Erste' } } },
    { id: 'al2', project_id: 'p1', bank_credits: { banks: { name: 'Zagrebačka banka' } } },
  ],
  tic_cost_structures: [
    { project_id: 'p1', line_items: [{ name: 'Građenje', vlastita: 1_500_000, kreditna: 5_000_000 }] },
  ],
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(NOW)
  Object.assign(db, emptyFakeDb(), { tables: structuredClone(DATA) })
})

afterEach(() => {
  vi.useRealTimers()
})

const months = (values: Record<string, [number, number]>) =>
  ['2026-05-01', '2026-06-01', '2026-07-01', '2026-08-01', '2026-09-01', '2026-10-01'].map(month_key => {
    const [sales, revenue] = values[month_key] ?? [0, 0]
    return { month_key, sales, revenue, units_sold: sales }
  })

describe('generateProjectReport', () => {
  it('a project with sales in and out of the range', async () => {
    const r = roundDeep(await generateProjectReport('p1', PROJECTS, RANGE))
    const s1 = 198_000 + 15_000 + 5_000
    const s2 = 150_000.5 + 12_000 + 8_000
    expect(r).toEqual(roundDeep({
      project: { ...PROJECTS[0], investor: 'Zagrebačka banka, Erste' },
      budget_set: true,
      total_units: 5,
      sold_units: 3,
      available_units: 1,
      reserved_units: 1,
      // Sale price plus the linked garages and storage of the sales dated in the range.
      total_revenue: s1 + s2,
      // The average contracted sale in the range (GEN-38, changed on purpose: it was list price
      // plus linked units over all five apartments, sold or not).
      average_price: (s1 + s2) / 2,
      sales_rate: 60,
      monthly_sales: months({ '2026-09-01': [1, s2], '2026-10-01': [1, s1] }),
      apartments: APARTMENTS.filter(a => a.project_id === 'p1'),
      sales: [SALES[0], SALES[1]],
    }))
  })

  it('a project with no funding, no TIC and no sales in the range', async () => {
    const r = roundDeep(await generateProjectReport('p2', PROJECTS, RANGE))
    expect(r.project).toMatchObject({ investor: 'N/A' })
    expect(r.budget_set).toBe(false)
    // s4, on the first of October; a6 has no linked units, and s6 falls after the range.
    expect(r.total_revenue).toBe(250_000)
    // GEN-38, changed on purpose: it was (300.000 + 20.000 + 250.000 + 210.000) / 3.
    expect(r.average_price).toBe(250_000)
    expect(r.monthly_sales).toEqual(months({ '2026-10-01': [1, 250_000] }))
  })

  it('an unknown project is an error', async () => {
    await expect(generateProjectReport('p9', PROJECTS, RANGE)).rejects.toThrow('Project not found')
  })

  it.each(['bank_credits', 'credit_allocations', 'apartments', 'sales', 'tic_cost_structures'])(
    'rejects when the %s read fails',
    async table => {
      db.failing = { [table]: `permission denied for table ${table}` }
      await expect(generateProjectReport('p1', PROJECTS, RANGE)).rejects.toMatchObject({ message: `permission denied for table ${table}` })
    },
  )

  // GEN-42, changed on purpose: a failed read used to leave the garages and storage out of the
  // revenue without saying so.
  it.each(['apartment_garages', 'apartment_repositories'])('GEN-42: rejects when the %s read fails', async table => {
    db.failing = { [table]: 'canceling statement due to statement timeout' }
    await expect(generateProjectReport('p1', PROJECTS, RANGE)).rejects.toMatchObject({ message: 'canceling statement due to statement timeout' })
  })
})

describe('generateCustomerReport', () => {
  it('every customer, and the sales dated in the range', async () => {
    expect(roundDeep(await generateCustomerReport(RANGE))).toEqual(roundDeep({
      total_customers: 6,
      buyers: 4,
      interested: 1,
      leads: 1,
      // Σ sale_price of s1, s2 and s4 (s5 is before the range, s6 after it); linked garages and
      // storage play no part (GEN-38). Divided by the sales, not the buyers.
      total_revenue: 198_000 + 150_000.5 + 250_000,
      average_purchase: (198_000 + 150_000.5 + 250_000) / 3,
      customers: CUSTOMERS,
    }))
  })

  it('no rows at all', async () => {
    db.tables = {}
    expect(await generateCustomerReport(RANGE)).toEqual({
      total_customers: 0, buyers: 0, interested: 0, leads: 0, total_revenue: 0, average_purchase: 0, customers: [],
    })
  })

  it.each(['customers', 'sales'])('rejects when the %s read fails', async table => {
    db.failing = { [table]: `permission denied for table ${table}` }
    await expect(generateCustomerReport(RANGE)).rejects.toMatchObject({ message: `permission denied for table ${table}` })
  })
})
