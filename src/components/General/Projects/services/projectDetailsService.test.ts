import { beforeEach, describe, expect, it, vi } from 'vitest'
import { emptyFakeDb, type FakeDb } from '../../../../test/fakeSupabase'
import { unitStatusCounts } from '../../../../utils/salesFigures'

/**
 * Characterization tests: they record what Project details loads today and the sales figures
 * the page derives from it, before "sales revenue" moves to one definition
 * (docs/REGRESSION_PREVENTION.md, Step 7 item 2). Do not edit an expectation to get a refactor
 * green.
 */

const db = vi.hoisted((): FakeDb => ({ tables: {}, failing: {}, failingIn: {} }))
vi.mock('../../../../lib/supabase', async () => {
  const { fakeSupabase } = await import('../../../../test/fakeSupabase')
  return { supabase: fakeSupabase(db) }
})

import { fetchProjectDataEnhanced } from './projectDetailsService'

const DATA: Record<string, unknown[]> = {
  projects: [
    { id: 'p1', name: 'Zelena Dolina', budget: 6_500_000 },
    { id: 'p2', name: 'Precko Zapad', budget: 0 },
  ],
  apartments: [
    { id: 'a2', project_id: 'p1', floor: 2, status: 'Sold', price: 150_000.5 },
    { id: 'a1', project_id: 'p1', floor: 1, status: 'Sold', price: 200_000 },
    { id: 'a3', project_id: 'p1', floor: 3, status: 'Reserved', price: 180_000 },
    { id: 'a5', project_id: 'p2', floor: 1, status: 'Sold', price: 300_000 },
  ],
  // Each sale carries the apartment it joins to, as `apartments!inner(project_id)` returns it.
  sales: [
    { apartment_id: 'a1', sale_price: 198_000, sale_date: '2026-10-03', apartments: { project_id: 'p1' } },
    { apartment_id: 'a2', sale_price: 150_000.5, sale_date: '2026-09-15', apartments: { project_id: 'p1' } },
    { apartment_id: 'a5', sale_price: 290_000, sale_date: '2026-08-01', apartments: { project_id: 'p2' } },
  ],
  apartment_garages: [{ id: 'l1', apartment_id: 'a1', garages: { price: 15_000 } }],
  tic_cost_structures: [
    { project_id: 'p1', line_items: [{ name: 'Građenje', vlastita: 1_500_000, kreditna: 5_000_000 }] },
    { project_id: 'p2', line_items: [{ name: 'Građenje', vlastita: 0, kreditna: 0 }] },
  ],
}

beforeEach(() => {
  Object.assign(db, emptyFakeDb(), { tables: structuredClone(DATA) })
})

describe('fetchProjectDataEnhanced', () => {
  it("loads the project's apartments, by floor", async () => {
    const data = await fetchProjectDataEnhanced('p1')
    expect(data.project).toEqual(DATA.projects[0])
    expect(data.apartments.map(a => a.id)).toEqual(['a1', 'a2', 'a3'])
    expect(data.ticTotal).toBe(6_500_000)
  })

  it('"Prihodi od prodaje" is the project\'s contracted sales (GEN-38)', async () => {
    const { apartments, contractedSales } = await fetchProjectDataEnhanced('p1')
    // What ProjectDetailsEnhanced shows: a1 with its garage, and a2 (GEN-38, changed on purpose: it
    // was the list prices of the Sold apartments, 350.000,5). Another project's sale plays no part.
    expect(contractedSales).toEqual({ count: 2, value: 198_000 + 15_000 + 150_000.5, average: (198_000 + 15_000 + 150_000.5) / 2 })
    expect(unitStatusCounts(apartments)).toEqual({ total: 3, sold: 2, reserved: 1, available: 0 })
  })

  it('an all-zero TIC is no budget', async () => {
    expect((await fetchProjectDataEnhanced('p2')).ticTotal).toBeNull()
  })

  it.each(['projects', 'apartments', 'tic_cost_structures', 'sales', 'apartment_garages', 'apartment_repositories'])('rejects when the %s read fails', async table => {
    db.failing = { [table]: `permission denied for table ${table}` }
    await expect(fetchProjectDataEnhanced('p1')).rejects.toMatchObject({ message: `permission denied for table ${table}` })
  })
})
