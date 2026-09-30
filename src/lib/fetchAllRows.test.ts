import { describe, it, expect } from 'vitest'
import { fetchAllRows } from './fetchAllRows'

const table = Array.from({ length: 7 }, (_, i) => ({ id: i }))
const pageOf = (from: number, to: number) => Promise.resolve({ data: table.slice(from, to + 1), error: null })

describe('fetchAllRows', () => {
  it('keeps reading until a short page comes back', async () => {
    const calls: Array<[number, number]> = []
    const rows = await fetchAllRows((from, to) => { calls.push([from, to]); return pageOf(from, to) }, 3)
    expect(rows).toEqual(table)
    expect(calls).toEqual([[0, 2], [3, 5], [6, 8]])
  })

  it('makes one extra request when the last page is exactly full', async () => {
    let requests = 0
    const rows = await fetchAllRows((from, to) => { requests++; return Promise.resolve({ data: table.slice(0, 6).slice(from, to + 1), error: null }) }, 3)
    expect(rows).toHaveLength(6)
    expect(requests).toBe(3)
  })

  it('throws on a failed page instead of returning a partial list', async () => {
    const error = { message: 'boom', details: '', hint: '', code: 'XX000', name: 'PostgrestError' }
    await expect(fetchAllRows((from) => Promise.resolve(from === 0 ? { data: table.slice(0, 3), error: null } : { data: null, error }), 3)).rejects.toBe(error)
  })
})
