import { describe, expect, it } from 'vitest'
import { parseNumber } from './excelParsers'

describe('parseNumber', () => {
  it('returns numeric cells unchanged, decimals included', () => {
    expect(parseNumber(12.5)).toBe(12.5)
    expect(parseNumber(152300.75)).toBe(152300.75)
    expect(parseNumber(0)).toBe(0)
  })

  it('reads European-formatted text', () => {
    expect(parseNumber('3.000,00')).toBe(3000)
    expect(parseNumber('152.300,75')).toBe(152300.75)
    expect(parseNumber('12,5')).toBe(12.5)
  })

  it('treats blanks and junk as zero', () => {
    expect(parseNumber(null)).toBe(0)
    expect(parseNumber(undefined)).toBe(0)
    expect(parseNumber('')).toBe(0)
    expect(parseNumber('n/a')).toBe(0)
    expect(parseNumber(Number.NaN)).toBe(0)
  })
})
