import { describe, it, expect } from 'vitest'
import {
  calculateRowPercentages,
  calculateTotals,
  calculateSectionTotals,
  calculateConstructionTotals,
  toRomanNumeral,
  toSectionCode,
  formatNumber,
  formatPercentage,
  type LineItem,
  type ConstructionSection,
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

describe('construction totals', () => {
  const sections: ConstructionSection[] = [
    {
      code: 'A)',
      name: 'GRAĐEVINSKI RADOVI',
      items: [
        { numeral: 'I.', name: 'Pripremni radovi', vlastita: 0, kreditna: 20715.75 },
        { numeral: 'II.', name: 'Zemljani radovi', vlastita: 100, kreditna: 13362 },
      ],
    },
    {
      code: 'B)',
      name: 'OBRTNIČKI RADOVI',
      items: [{ numeral: 'I.', name: 'Asfalterski radovi', vlastita: 50, kreditna: 5500 }],
    },
  ]

  it('sums one section independently of the others', () => {
    expect(calculateSectionTotals(sections[0])).toEqual({ vlastita: 100, kreditna: 34077.75 })
    expect(calculateSectionTotals(sections[1])).toEqual({ vlastita: 50, kreditna: 5500 })
  })

  it('returns zeros for a section with no items', () => {
    expect(calculateSectionTotals({ code: 'C)', name: 'Prazno', items: [] })).toEqual({
      vlastita: 0,
      kreditna: 0,
    })
  })

  it('sums every section into the SVEUKUPNO row', () => {
    expect(calculateConstructionTotals(sections)).toEqual({ vlastita: 150, kreditna: 39577.75 })
  })

  it('returns zeros when there are no sections', () => {
    expect(calculateConstructionTotals([])).toEqual({ vlastita: 0, kreditna: 0 })
  })
})

describe('toRomanNumeral', () => {
  it('renders the numerals used by the construction sheet', () => {
    expect(toRomanNumeral(1)).toBe('I.')
    expect(toRomanNumeral(4)).toBe('IV.')
    expect(toRomanNumeral(9)).toBe('IX.')
    expect(toRomanNumeral(14)).toBe('XIV.')
  })

  it('returns an empty string below 1', () => {
    expect(toRomanNumeral(0)).toBe('')
  })
})

describe('toSectionCode', () => {
  it('renders sequential section codes', () => {
    expect(toSectionCode(0)).toBe('A)')
    expect(toSectionCode(2)).toBe('C)')
  })

  it('wraps past Z', () => {
    expect(toSectionCode(25)).toBe('Z)')
    expect(toSectionCode(26)).toBe('AA)')
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
