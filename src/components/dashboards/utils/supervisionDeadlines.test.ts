import { describe, it, expect } from 'vitest'
import { isDeadlineNear, isDueThisWeek } from './supervisionDeadlines'

const at = (days_until_deadline: number | null, progress = 40) => ({ days_until_deadline, progress })

describe('supervision deadlines', () => {
  // `null <= 7` is true in JavaScript: a contract with no end date must not read as due.
  it('never treats a contract without a deadline as near or due', () => {
    expect(isDeadlineNear(at(null))).toBe(false)
    expect(isDueThisWeek(at(null))).toBe(false)
  })

  it('counts today through seven days out as due this week', () => {
    expect([0, 3, 7].map(days => isDueThisWeek(at(days)))).toEqual([true, true, true])
    expect(isDueThisWeek(at(8))).toBe(false)
  })

  it('keeps a late contract near, but not "due this week" — it is overdue instead', () => {
    expect(isDeadlineNear(at(-2))).toBe(true)
    expect(isDueThisWeek(at(-2))).toBe(false)
  })

  it('leaves finished work alone', () => {
    expect(isDeadlineNear(at(2, 100))).toBe(false)
    expect(isDueThisWeek(at(2, 100))).toBe(false)
  })
})
