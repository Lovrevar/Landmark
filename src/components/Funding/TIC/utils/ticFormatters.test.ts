import { describe, it, expect } from 'vitest'
import {
  calculateRowPercentages,
  calculateTotals,
  formatNumber,
  formatPercentage,
  type LineItem,
} from './ticFormatters'

describe('calculateRowPercentages', () => {
  it('returns share as a percentage', () => {
    expect(calculateRowPercentages(25, 100)).toBe(25)
    expect(calculateRowPercentages(50, 200)).toBe(25)
  })

  it('returns 0 when total is 0 (guards against division by zero)', () => {
    expect(calculateRowPercentages(10, 0)).toBe(0)
    expect(calculateRowPercentages(0, 0)).toBe(0)
  })

  it('handles values exceeding the total (>100%)', () => {
    expect(calculateRowPercentages(150, 100)).toBe(150)
  })

  it('handles fractional results without rounding', () => {
    expect(calculateRowPercentages(1, 3)).toBeCloseTo(33.3333, 4)
  })
})

describe('calculateTotals', () => {
  it('returns zeros for an empty line-item list', () => {
    expect(calculateTotals([])).toEqual({ vlastita: 0, kreditna: 0 })
  })

  it('sums vlastita and kreditna independently', () => {
    const items: LineItem[] = [
      { name: 'A', vlastita: 100, kreditna: 50 },
      { name: 'B', vlastita: 200, kreditna: 75 },
      { name: 'C', vlastita: 0,   kreditna: 25 },
    ]
    expect(calculateTotals(items)).toEqual({ vlastita: 300, kreditna: 150 })
  })

  it('handles negative values without short-circuiting', () => {
    // Negatives are unusual for cost breakdowns but should still sum mathematically.
    const items: LineItem[] = [
      { name: 'A', vlastita: 100, kreditna: 50 },
      { name: 'B', vlastita: -30, kreditna: -10 },
    ]
    expect(calculateTotals(items)).toEqual({ vlastita: 70, kreditna: 40 })
  })
})

describe('formatNumber', () => {
  it('renders integers with locale thousands separator', () => {
    expect(formatNumber(1234)).toBe('1.234')
    expect(formatNumber(1234567)).toBe('1.234.567')
  })

  it('rounds decimals to integers', () => {
    expect(formatNumber(1234.4)).toBe('1.234')
    expect(formatNumber(1234.6)).toBe('1.235')
  })

  it('renders zero', () => {
    expect(formatNumber(0)).toBe('0')
  })
})

describe('formatPercentage', () => {
  it('renders two fraction digits with locale separators', () => {
    expect(formatPercentage(12.34)).toBe('12,34')
    expect(formatPercentage(0)).toBe('0,00')
  })

  it('rounds beyond two decimals', () => {
    const result = formatPercentage(12.345)
    expect(['12,34', '12,35']).toContain(result)
  })
})
