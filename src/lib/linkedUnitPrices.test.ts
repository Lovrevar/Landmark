import { beforeEach, describe, expect, it, vi } from 'vitest'
import { emptyFakeDb, type FakeDb } from '../test/fakeSupabase'

const db = vi.hoisted((): FakeDb => ({ tables: {}, failing: {}, failingIn: {} }))
vi.mock('./supabase', async () => {
  const { fakeSupabase } = await import('../test/fakeSupabase')
  return { supabase: fakeSupabase(db) }
})

import { fetchLinkedPrices } from './linkedUnitPrices'

beforeEach(() => {
  Object.assign(db, emptyFakeDb(), {
    tables: {
      apartment_garages: [
        { id: 'l1', apartment_id: 'a1', garages: { price: 15_000 } },
        { id: 'l2', apartment_id: 'a2', garages: { price: 12_000 } },
        { id: 'l3', apartment_id: 'a2', garages: null },
      ],
      apartment_repositories: [{ id: 'l4', apartment_id: 'a1', repositories: { price: 5_000 } }],
    },
  })
})

describe('fetchLinkedPrices', () => {
  it("groups both kinds of link by apartment, a missing unit's price as 0", async () => {
    expect(await fetchLinkedPrices()).toEqual(new Map([['a1', [15_000, 5_000]], ['a2', [12_000, 0]]]))
  })

  it('pages past the first 1000 links', async () => {
    db.tables.apartment_garages = Array.from({ length: 1001 }, (_, i) => ({ id: `l${String(i).padStart(4, '0')}`, apartment_id: 'a1', garages: { price: 1 } }))
    expect((await fetchLinkedPrices()).get('a1')).toHaveLength(1002)
  })

  it.each(['apartment_garages', 'apartment_repositories'])('rejects when the %s read fails', async table => {
    db.failing = { [table]: 'canceling statement due to statement timeout' }
    await expect(fetchLinkedPrices()).rejects.toMatchObject({ message: 'canceling statement due to statement timeout' })
  })
})
