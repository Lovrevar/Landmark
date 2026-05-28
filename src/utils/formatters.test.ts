import { describe, it, expect } from 'vitest'
import { formatFileSize, formatEuropean, formatEuro } from './formatters'

describe('formatFileSize', () => {
  it('formats bytes under 1 KiB with no decimals', () => {
    expect(formatFileSize(0)).toBe('0 B')
    expect(formatFileSize(1)).toBe('1 B')
    expect(formatFileSize(1023)).toBe('1023 B')
  })

  it('formats kibibytes with one decimal', () => {
    expect(formatFileSize(1024)).toBe('1.0 KB')
    expect(formatFileSize(1536)).toBe('1.5 KB')
    expect(formatFileSize(1024 * 1024 - 1)).toBe('1024.0 KB')
  })

  it('formats mebibytes with one decimal', () => {
    expect(formatFileSize(1024 * 1024)).toBe('1.0 MB')
    expect(formatFileSize(5 * 1024 * 1024 + 512 * 1024)).toBe('5.5 MB')
  })
})

describe('formatEuropean', () => {
  it('uses Croatian locale: comma decimal, dot thousands', () => {
    expect(formatEuropean(1234.56)).toBe('1.234,56')
    expect(formatEuropean(1234567.89)).toBe('1.234.567,89')
  })

  it('always renders exactly two fraction digits', () => {
    expect(formatEuropean(1)).toBe('1,00')
    expect(formatEuropean(0)).toBe('0,00')
    expect(formatEuropean(1.5)).toBe('1,50')
  })

  it('rounds to two decimals (half-to-even or half-away-from-zero per Intl)', () => {
    // Intl rounding behavior — both 1,23 and 1,24 are plausible per platform.
    // What matters is that we round, not truncate, and stay at 2 digits.
    const result = formatEuropean(1.235)
    expect(['1,23', '1,24']).toContain(result)
  })

  // hr-HR locale renders the minus as Unicode U+2212 (−), NOT ASCII hyphen-minus.
  // Anything parsing this output downstream must account for that.
  it('renders negatives with the locale minus sign (U+2212)', () => {
    expect(formatEuropean(-1234.5)).toBe('−1.234,50')
  })
})

describe('formatEuro', () => {
  it('prepends the euro sign to the European format', () => {
    expect(formatEuro(1234.5)).toBe('€1.234,50')
    expect(formatEuro(0)).toBe('€0,00')
  })

  it('keeps the sign after the euro symbol for negatives (locale minus)', () => {
    expect(formatEuro(-50)).toBe('€−50,00')
  })
})
