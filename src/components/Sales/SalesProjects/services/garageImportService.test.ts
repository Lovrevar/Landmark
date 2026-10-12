import { describe, it, expect, vi } from 'vitest'

vi.mock('../../../../lib/supabase', () => ({ supabase: {} }))
vi.mock('../../../../lib/activityLog', () => ({ logActivity: vi.fn() }))

import { markExistingGarages } from './garageImportService'

const row = (number: string) => ({ number, size_m2: 12, price: 15000 })

describe('markExistingGarages', () => {
  it('updates a garage that is already in the building and inserts one that is not', () => {
    const marked = markExistingGarages([row('G-1'), row('G-2')], new Set(['G-1']))
    expect(marked.map(r => r.exists)).toEqual([true, false])
  })

  // The existing numbers were read once, so a new number repeated in the file was inserted twice
  // (SALES-9). The second row now updates what the first one created.
  it('treats a number repeated in the file as one garage', () => {
    const marked = markExistingGarages([row('G-7'), row('G-7'), row('G-8')], new Set())
    expect(marked.map(r => r.exists)).toEqual([false, true, false])
  })

  it('compares numbers the way the unique index does, and aims the update at the stored spelling', () => {
    const marked = markExistingGarages([row(' g-1 '), row('G-9'), row('g-9')], new Set(['G-1']))
    expect(marked.map(r => [r.exists, r.target])).toEqual([[true, 'G-1'], [false, 'G-9'], [true, 'G-9']])
  })
})
