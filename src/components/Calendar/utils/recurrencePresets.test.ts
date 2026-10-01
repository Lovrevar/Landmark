import { describe, it, expect } from 'vitest'
import { DEFAULT_RECURRENCE, describeRecurrence, serializeRecurrence } from './recurrencePresets'

// Returns the key itself, so the assertions show which labels were composed.
const t = (key: string) => key

describe('describeRecurrence', () => {
  it('names a simple preset', () => {
    expect(describeRecurrence('FREQ=DAILY', t, 'en-US')).toBe('calendar.modal.recurrence.preset.daily')
  })

  it('lists the weekdays of a weekly rule, Monday first', () => {
    expect(describeRecurrence('FREQ=WEEKLY;BYDAY=FR,MO', t, 'en-US')).toBe(
      'calendar.modal.recurrence.preset.weekly (calendar.day_names.mon, calendar.day_names.fri)',
    )
  })

  it('describes an interval the way the custom picker labels it', () => {
    expect(describeRecurrence('FREQ=MONTHLY;INTERVAL=2;BYMONTHDAY=15', t, 'en-US')).toBe(
      'calendar.modal.recurrence.every 2 calendar.modal.recurrence.freq.monthly',
    )
  })

  it('adds a count end', () => {
    expect(describeRecurrence('RRULE:FREQ=DAILY;COUNT=10', t, 'en-US')).toBe(
      'calendar.modal.recurrence.preset.daily · calendar.modal.recurrence.ends: calendar.modal.recurrence.end.after 10 calendar.modal.recurrence.occurrences',
    )
  })

  it('adds an until date', () => {
    const text = describeRecurrence('FREQ=YEARLY;UNTIL=20270615T120000Z', t, 'en-US')
    expect(text.startsWith('calendar.modal.recurrence.preset.yearly · calendar.modal.recurrence.ends: ')).toBe(true)
    expect(text).toContain('2027')
  })

  it('round-trips what the picker serializes', () => {
    const rule = serializeRecurrence(
      { ...DEFAULT_RECURRENCE, preset: 'weekly', endKind: 'after', endCount: 5 },
      new Date(2026, 8, 16, 9, 0), // a Wednesday
    )
    expect(describeRecurrence(rule!, t, 'en-US')).toBe(
      'calendar.modal.recurrence.preset.weekly (calendar.day_names.wed) · calendar.modal.recurrence.ends: calendar.modal.recurrence.end.after 5 calendar.modal.recurrence.occurrences',
    )
  })

  it('falls back to the generic label for a rule the picker cannot make', () => {
    expect(describeRecurrence('FREQ=HOURLY', t, 'en-US')).toBe('calendar.detail.recurring')
    expect(describeRecurrence('not a rule', t, 'en-US')).toBe('calendar.detail.recurring')
  })
})
