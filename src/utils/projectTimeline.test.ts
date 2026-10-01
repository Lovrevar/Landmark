import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { projectTimeline, PROJECT_TIMELINE_TONE, DUE_SOON_DAYS } from './projectTimeline'

const NOW = new Date(2026, 8, 21, 15, 30, 0) // 21 September 2026, local

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(NOW)
})

afterEach(() => {
  vi.useRealTimers()
})

describe('projectTimeline', () => {
  it('says completed only when the status says so', () => {
    // The old rule was "past its end date", which called a stalled project finished.
    expect(projectTimeline('Completed', '2026-12-31')).toEqual({ state: 'completed', days: null })
    expect(projectTimeline('Completed', '2020-01-01')).toEqual({ state: 'completed', days: null })
    expect(projectTimeline('Completed', null)).toEqual({ state: 'completed', days: null })

    expect(projectTimeline('In Progress', '2020-01-01').state).toBe('overdue')
    expect(projectTimeline('On Hold', '2020-01-01').state).toBe('overdue')
    expect(projectTimeline('Planning', '2020-01-01').state).toBe('overdue')
  })

  it('is not overdue on the end date itself', () => {
    // The day before the deadline used to read "Overdue": differenceInDays truncates.
    expect(projectTimeline('In Progress', '2026-09-21')).toEqual({ state: 'due_today', days: 0 })
    expect(projectTimeline('In Progress', '2026-09-22')).toEqual({ state: 'due_soon', days: 1 })
    expect(projectTimeline('In Progress', '2026-09-20')).toEqual({ state: 'overdue', days: -1 })
  })

  it('counts the overdue days as a positive figure for the caller to render', () => {
    const info = projectTimeline('In Progress', '2026-08-21')
    expect(info.state).toBe('overdue')
    expect(info.days).toBe(-31)
    expect(Math.abs(info.days!)).toBe(31)
  })

  it('switches from due_soon to on_track at the threshold', () => {
    expect(projectTimeline('In Progress', '2026-10-20')).toEqual({ state: 'due_soon', days: 29 })
    expect(projectTimeline('In Progress', '2026-10-21')).toEqual({ state: 'on_track', days: 30 })
    expect(DUE_SOON_DAYS).toBe(30)
  })

  it('treats a missing or unparseable end date as open-ended, never as overdue', () => {
    // `new Date(null)` is 1970, which is what made every undated row overdue.
    expect(projectTimeline('In Progress', null)).toEqual({ state: 'no_end_date', days: null })
    expect(projectTimeline('In Progress', undefined)).toEqual({ state: 'no_end_date', days: null })
    expect(projectTimeline('In Progress', '')).toEqual({ state: 'no_end_date', days: null })
    expect(projectTimeline('In Progress', 'nije poznato')).toEqual({ state: 'no_end_date', days: null })
  })

  it('is stable through the day', () => {
    vi.setSystemTime(new Date(2026, 8, 21, 0, 0, 1))
    expect(projectTimeline('In Progress', '2026-09-21').state).toBe('due_today')
    vi.setSystemTime(new Date(2026, 8, 21, 23, 59, 59))
    expect(projectTimeline('In Progress', '2026-09-21').state).toBe('due_today')
  })
})

describe('PROJECT_TIMELINE_TONE', () => {
  it('has a dark pair for every state', () => {
    const states = ['completed', 'overdue', 'due_today', 'due_soon', 'on_track', 'no_end_date'] as const
    for (const state of states) {
      expect(PROJECT_TIMELINE_TONE[state]).toMatch(/dark:/)
    }
  })
})
