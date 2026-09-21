import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { parseLocalDate, isValidDate, monthKey, startOfTodayLocal, daysFromToday } from './dateOnly'

/**
 * The due-day boundary is the whole point of these helpers.
 *
 * `new Date('2026-09-21') < new Date()` parses the left side as **UTC** midnight, so in Croatia
 * (UTC+1/+2) a contract due today reads as overdue from 01:00 or 02:00 — and the screens that
 * used that comparison said "Kasni za 0 dana". Everything below pins a system time so the
 * boundary is asserted rather than inferred.
 */

// Mid-afternoon deliberately: a bug that compares against "now" rather than local midnight
// only shows once the clock has passed the UTC offset.
const NOW = new Date(2026, 8, 21, 15, 30, 0) // 21 September 2026, local

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(NOW)
})

afterEach(() => {
  vi.useRealTimers()
})

describe('daysFromToday', () => {
  it('is 0 on the due day, whatever the time of day', () => {
    expect(daysFromToday('2026-09-21')).toBe(0)

    vi.setSystemTime(new Date(2026, 8, 21, 0, 0, 1))
    expect(daysFromToday('2026-09-21')).toBe(0)

    vi.setSystemTime(new Date(2026, 8, 21, 23, 59, 59))
    expect(daysFromToday('2026-09-21')).toBe(0)
  })

  it('is negative for yesterday and positive for tomorrow', () => {
    expect(daysFromToday('2026-09-20')).toBe(-1)
    expect(daysFromToday('2026-09-22')).toBe(1)
  })

  it('counts whole calendar days across a month and a year boundary', () => {
    expect(daysFromToday('2026-10-01')).toBe(10)
    expect(daysFromToday('2026-08-31')).toBe(-21)
    expect(daysFromToday('2027-09-21')).toBe(365)
  })

  it('reads a full ISO datetime as its calendar day', () => {
    // Supabase hands back `timestamptz` for some columns and `date` for others; both must land
    // on the same day rather than differing by the time component.
    expect(daysFromToday('2026-09-21T23:00:00.000Z')).toBe(0)
    expect(daysFromToday('2026-09-22T00:30:00+02:00')).toBe(1)
  })

  it('is NaN — never 0, and never "overdue" — for missing or unparseable input', () => {
    // `new Date(null)` is 1970, which made every contract without an end date overdue.
    expect(daysFromToday(null)).toBeNaN()
    expect(daysFromToday(undefined)).toBeNaN()
    expect(daysFromToday('')).toBeNaN()
    expect(daysFromToday('not a date')).toBeNaN()
    expect(daysFromToday('0000-00-00')).toBeNaN()

    // The comparison callers actually write must therefore be false, not true.
    expect(daysFromToday(null) < 0).toBe(false)
  })
})

describe('parseLocalDate', () => {
  it("treats 'YYYY-MM-DD' as local midnight, not UTC midnight", () => {
    const d = parseLocalDate('2026-09-21')
    expect(d.getFullYear()).toBe(2026)
    expect(d.getMonth()).toBe(8)
    expect(d.getDate()).toBe(21)
    expect(d.getHours()).toBe(0)
    expect(d.getMinutes()).toBe(0)
    // The whole point: identical to constructing the local date by parts.
    expect(d.getTime()).toBe(new Date(2026, 8, 21).getTime())
  })

  it('keeps the calendar day of an ISO datetime', () => {
    expect(parseLocalDate('2026-01-31T22:15:00Z').getTime()).toBe(new Date(2026, 0, 31).getTime())
  })

  it('returns an Invalid Date for empty or malformed input', () => {
    expect(Number.isNaN(parseLocalDate(null).getTime())).toBe(true)
    expect(Number.isNaN(parseLocalDate(undefined).getTime())).toBe(true)
    expect(Number.isNaN(parseLocalDate('').getTime())).toBe(true)
    expect(Number.isNaN(parseLocalDate('rujan').getTime())).toBe(true)
  })
})

describe('isValidDate', () => {
  it('separates a real calendar date from a missing one', () => {
    expect(isValidDate('2026-09-21')).toBe(true)
    expect(isValidDate('2026-09-21T10:00:00Z')).toBe(true)
    expect(isValidDate(null)).toBe(false)
    expect(isValidDate('')).toBe(false)
  })
})

describe('monthKey', () => {
  it('buckets from the string, so no timezone can move a row into the previous month', () => {
    expect(monthKey('2026-01-01')).toBe('2026-01')
    expect(monthKey('2026-01-01T00:00:00Z')).toBe('2026-01')
    expect(monthKey(null)).toBe('')
  })
})

describe('startOfTodayLocal', () => {
  it('is local midnight of the mocked day', () => {
    expect(startOfTodayLocal().getTime()).toBe(new Date(2026, 8, 21).getTime())
  })
})
