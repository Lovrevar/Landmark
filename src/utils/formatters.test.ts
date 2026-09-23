import { describe, it, expect, vi } from 'vitest'
import {
  formatFileSize, formatEuropean, formatEuro, formatEuroRounded, formatEuroCompact,
  formatDate, formatDateTime, formatMonthYear, formatDayMonth, formatMonthShort,
} from './formatters'

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

describe('formatEuroRounded', () => {
  it('renders whole euros with thousands separators', () => {
    expect(formatEuroRounded(73125)).toBe('€73.125')
    expect(formatEuroRounded(40000000)).toBe('€40.000.000')
  })

  it('drops the ragged single decimal that plain toLocaleString produces', () => {
    // (1425597.5).toLocaleString('hr-HR') is "1.425.597,5"
    expect(formatEuroRounded(1425597.5)).toBe('€1.425.598')
    expect(formatEuroRounded(58750.39)).toBe('€58.750')
  })

  it('handles zero and negatives', () => {
    expect(formatEuroRounded(0)).toBe('€0')
    // hr-HR uses U+2212 MINUS SIGN, not an ASCII hyphen. Asserted explicitly so a future change
    // to the locale or formatter shows up here rather than in a snapshot somewhere.
    expect(formatEuroRounded(-1500.6)).toBe('€\u22121.501')
  })
})

describe('formatEuroCompact', () => {
  it('abbreviates millions to one decimal, with the Croatian comma', () => {
    expect(formatEuroCompact(1234567)).toBe('€1,2M')
    expect(formatEuroCompact(40000000)).toBe('€40,0M')
  })

  it('abbreviates from ten thousand upwards', () => {
    expect(formatEuroCompact(45000)).toBe('€45K')
    expect(formatEuroCompact(450500)).toBe('€451K')
  })

  // The bug this helper exists for: every dashboard divided by a million itself, so a real
  // €45.000 rendered as "€0.0M".
  it('never collapses a smaller figure to zero', () => {
    expect(formatEuroCompact(45000)).not.toContain('0,0M')
    expect(formatEuroCompact(9500)).toBe('€9.500')
    expect(formatEuroCompact(999)).toBe('€999')
    expect(formatEuroCompact(0)).toBe('€0')
  })

  it('abbreviates negatives by magnitude', () => {
    expect(formatEuroCompact(-2500000)).toBe('€\u22122,5M')
    expect(formatEuroCompact(-45000)).toBe('€\u221245K')
  })
})

// Every money helper takes nullable input: a budget that was never set must read as a dash,
// not "€0" (the budget invariant in docs/CODEBASE_INDEX.md), and must never throw mid-render.
describe('missing and invalid values', () => {
  it.each([
    ['formatEuropean', formatEuropean],
    ['formatEuro', formatEuro],
    ['formatEuroRounded', formatEuroRounded],
    ['formatEuroCompact', formatEuroCompact],
  ])('%s renders a dash instead of throwing', (_name, format) => {
    expect(format(null)).toBe('—')
    expect(format(undefined)).toBe('—')
    expect(format(Number.NaN)).toBe('—')
    expect(format(Number.POSITIVE_INFINITY)).toBe('—')
  })

  it('still renders a real zero as money', () => {
    expect(formatEuro(0)).toBe('€0,00')
    expect(formatEuroCompact(0)).toBe('€0')
  })
})

// ----------------------------------------------------------------------------
// Dates
// ----------------------------------------------------------------------------

describe('formatDate', () => {
  it('renders Croatian with the trailing dot and English with the month name', () => {
    expect(formatDate('2026-01-05', 'hr')).toBe('05.01.2026.')
    expect(formatDate('2026-01-05', 'en')).toBe('Jan 05, 2026')
  })

  it('renders Croatian for the regional tag a Croatian browser reports', () => {
    // The bug this replaces: `i18n.language === 'hr'` is false for 'hr-HR', so these read English.
    expect(formatDate('2026-01-05', 'hr-HR')).toBe('05.01.2026.')
  })

  it('keeps a date-only column on its own day, whatever the clock says', () => {
    // 'YYYY-MM-DD' through `new Date()` is UTC midnight, which is the previous day in Croatia.
    // Asserted at 23:30 local, where a UTC-parsing implementation is a day out.
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 0, 5, 23, 30))
    expect(formatDate('2026-01-05', 'hr')).toBe('05.01.2026.')
    expect(formatDate('2026-03-01', 'hr')).toBe('01.03.2026.')
    vi.useRealTimers()
  })

  it('accepts a Date for timestamps', () => {
    expect(formatDate(new Date(2026, 0, 5, 14, 30), 'hr')).toBe('05.01.2026.')
  })

  it('renders a dash for missing or unparseable input instead of "Invalid Date"', () => {
    expect(formatDate(null, 'hr')).toBe('—')
    expect(formatDate(undefined, 'hr')).toBe('—')
    expect(formatDate('', 'hr')).toBe('—')
    expect(formatDate('not a date', 'hr')).toBe('—')
    expect(formatDate(new Date(Number.NaN), 'hr')).toBe('—')
  })
})

describe('formatDateTime', () => {
  it('keeps the time of day in both languages', () => {
    const at = new Date(2026, 0, 5, 14, 30)
    expect(formatDateTime(at, 'hr')).toBe('05.01.2026. 14:30')
    expect(formatDateTime(at, 'en')).toBe('Jan 05, 2026 14:30')
  })
})

describe('formatMonthYear', () => {
  it('uses the nominative Croatian month, which is what the labels interpolate', () => {
    // 'LLLL' is the standalone form: "siječanj". 'MMMM' would give the genitive "siječnja",
    // which reads wrong in "Mjesečni budžet - {{month}}".
    expect(formatMonthYear('2026-01-05', 'hr')).toBe('siječanj 2026.')
    expect(formatMonthYear('2026-09-05', 'hr')).toBe('rujan 2026.')
    expect(formatMonthYear('2026-01-05', 'en')).toBe('Jan 2026')
  })
})

describe('formatMonthShort', () => {
  it('abbreviates the month for a chart axis', () => {
    expect(formatMonthShort('2026-01-05', 'hr')).toBe('sij')
    expect(formatMonthShort('2026-09-05', 'hr')).toBe('ruj')
    expect(formatMonthShort('2026-01-05', 'en')).toBe('Jan')
  })
})

describe('formatDayMonth', () => {
  it('drops the year for compact rows', () => {
    expect(formatDayMonth('2026-01-05', 'hr')).toBe('05.01.')
    expect(formatDayMonth('2026-01-05', 'en')).toBe('Jan 05')
  })
})

describe('date helpers, missing values', () => {
  it.each([
    ['formatDate', formatDate],
    ['formatDateTime', formatDateTime],
    ['formatMonthYear', formatMonthYear],
    ['formatDayMonth', formatDayMonth],
    ['formatMonthShort', formatMonthShort],
  ])('%s renders a dash rather than throwing', (_name, fn) => {
    expect(fn(null, 'hr')).toBe('—')
    expect(fn(undefined, 'en')).toBe('—')
  })
})
