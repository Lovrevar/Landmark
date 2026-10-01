import { describe, it, expect } from 'vitest'
import { summarizeBulkPriceUpdate } from './bulkPriceResult'

describe('summarizeBulkPriceUpdate', () => {
  it('counts every written row across the updates', () => {
    expect(
      summarizeBulkPriceUpdate(3, [
        { error: null, data: [{ id: 'a1' }] },
        { error: null, data: [{ id: 'a2' }] },
        { error: null, data: [{ id: 'a3' }] },
      ]),
    ).toEqual({ selected: 3, updated: 3, failed: 0 })
  })

  it('reports partial success instead of discarding the rows that landed', () => {
    expect(
      summarizeBulkPriceUpdate(3, [
        { error: null, data: [{ id: 'a1' }] },
        { error: { message: 'permission denied' }, data: null },
        { error: null, data: [{ id: 'a3' }] },
      ]),
    ).toEqual({ selected: 3, updated: 2, failed: 1 })
  })

  it('treats a row the update matched nothing for as neither written nor failed', () => {
    // `.neq('status', 'Sold')` on the update means a unit sold between the fetch and the
    // write comes back successful with an empty `data`.
    expect(
      summarizeBulkPriceUpdate(2, [
        { error: null, data: [{ id: 'a1' }] },
        { error: null, data: [] },
      ]),
    ).toEqual({ selected: 2, updated: 1, failed: 0 })
  })

  it('handles no outcomes at all — every selected unit was skipped', () => {
    expect(summarizeBulkPriceUpdate(4, [])).toEqual({ selected: 4, updated: 0, failed: 0 })
  })

  it('does not count a null data payload as a write', () => {
    expect(summarizeBulkPriceUpdate(1, [{ error: null, data: null }])).toEqual({
      selected: 1,
      updated: 0,
      failed: 0,
    })
  })
})
