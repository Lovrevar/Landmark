import { describe, it, expect } from 'vitest'
import { monthlyBarMax, barPercent } from './barScale'

describe('monthlyBarMax', () => {
  it('takes the largest value across every month and both series', () => {
    expect(monthlyBarMax([
      { incoming: 10_000, outgoing: 4_000 },
      { incoming: 2_000, outgoing: 90_000 },
      { incoming: 50_000, outgoing: 0 },
    ])).toBe(90_000)
  })

  it('scales a small month against the big one, not against itself', () => {
    const data = [
      { incoming: 1_000, outgoing: 500 },     // January
      { incoming: 100_000, outgoing: 80_000 }, // December
    ]
    const max = monthlyBarMax(data)
    expect(barPercent(data[0].incoming, max)).toBe(1)
    expect(barPercent(data[1].incoming, max)).toBe(100)
  })

  it('returns 1 for an empty list, not -Infinity', () => {
    expect(monthlyBarMax([])).toBe(1)
  })

  it('returns 1 when every month is zero', () => {
    expect(monthlyBarMax([{ incoming: 0, outgoing: 0 }])).toBe(1)
  })
})

describe('barPercent', () => {
  it('is proportional to the max', () => {
    expect(barPercent(25, 100)).toBe(25)
  })

  it('clamps to 0–100', () => {
    expect(barPercent(150, 100)).toBe(100)
    expect(barPercent(-5, 100)).toBe(0)
  })

  it('returns 0 for a non-finite value or a non-positive max', () => {
    expect(barPercent(Number.NaN, 100)).toBe(0)
    expect(barPercent(10, 0)).toBe(0)
  })
})
