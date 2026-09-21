import { describe, it, expect } from 'vitest'
import {
  isSettledMilestone,
  countOverdueMilestones,
  countCriticalDeadlines,
  deriveAlerts,
  type MilestoneLike
} from './directorAlerts'

// Fixed stand-in for `daysFromToday`: the due date IS the day offset, as a string.
const days = (value: string | null | undefined): number => Number(value)

const milestone = (due: string | null, status: string | null, name = 'M'): MilestoneLike => ({
  milestone_name: name,
  due_date: due,
  status
})

describe('isSettledMilestone', () => {
  it('treats only "paid" as settled — "completed" means partly paid', () => {
    expect(isSettledMilestone('paid')).toBe(true)
    expect(isSettledMilestone('completed')).toBe(false)
    expect(isSettledMilestone('pending')).toBe(false)
    expect(isSettledMilestone(null)).toBe(false)
  })
})

describe('countOverdueMilestones', () => {
  it('counts part-paid and pending milestones past due, and skips fully paid ones', () => {
    const rows = [
      milestone('-5', 'pending'),
      milestone('-1', 'completed'), // partly paid, still owed → overdue
      milestone('-30', 'paid'),     // settled → not overdue, whatever its date
      milestone('3', 'pending')     // future
    ]
    expect(countOverdueMilestones(rows, days)).toBe(2)
  })

  it('a milestone due today is not overdue', () => {
    expect(countOverdueMilestones([milestone('0', 'pending')], days)).toBe(0)
  })

  it('ignores milestones with no due date', () => {
    expect(countOverdueMilestones([milestone(null, 'pending')], days)).toBe(0)
  })
})

describe('countCriticalDeadlines', () => {
  it('counts unpaid milestones due within the next 7 days, today included', () => {
    const rows = [
      milestone('0', 'pending'),
      milestone('7', 'completed'),
      milestone('8', 'pending'),  // outside the window
      milestone('-1', 'pending'), // already overdue, counted by the other helper
      milestone('2', 'paid')      // settled
    ]
    expect(countCriticalDeadlines(rows, days)).toBe(2)
  })
})

describe('deriveAlerts', () => {
  const base = {
    milestones: [] as MilestoneLike[],
    liveDebtCredits: [],
    debtToEquityRatio: 0,
    salesRate: 100,
    totalUnits: 10
  }

  it('returns nothing for a healthy portfolio', () => {
    expect(deriveAlerts(base, days)).toEqual([])
  })

  it('raises a critical alert for an overdue milestone, with the day count as a parameter', () => {
    const [alert] = deriveAlerts({ ...base, milestones: [milestone('-12', 'completed', 'Krov')] }, days)
    expect(alert).toEqual({
      type: 'critical',
      kind: 'overdue_milestone',
      params: { name: 'Krov', count: 12 },
      date: '-12'
    })
  })

  it('does not alert on a fully paid milestone past its date', () => {
    expect(deriveAlerts({ ...base, milestones: [milestone('-12', 'paid')] }, days)).toEqual([])
  })

  it('raises a warning for a milestone due within 3 days and nothing for day 4', () => {
    expect(deriveAlerts({ ...base, milestones: [milestone('3', 'pending')] }, days)[0].kind).toBe('urgent_deadline')
    expect(deriveAlerts({ ...base, milestones: [milestone('4', 'pending')] }, days)).toEqual([])
  })

  it('passes the credit amount through unformatted, falling back to the company name', () => {
    const alerts = deriveAlerts({
      ...base,
      liveDebtCredits: [
        { credit_name: null, maturity_date: '10', amount: 250000, company: { name: 'Pannonia d.o.o.' } },
        { credit_name: 'Bridge', maturity_date: '31', amount: 10, company: null } // outside 30 days
      ]
    }, days)

    expect(alerts).toHaveLength(1)
    expect(alerts[0]).toMatchObject({
      type: 'warning',
      kind: 'credit_maturity',
      params: { name: 'Pannonia d.o.o.', amount: 250000, count: 10 }
    })
  })

  it('flags high leverage above 2x only', () => {
    expect(deriveAlerts({ ...base, debtToEquityRatio: 2 }, days)).toEqual([])
    expect(deriveAlerts({ ...base, debtToEquityRatio: 2.5 }, days)[0]).toEqual({
      type: 'warning',
      kind: 'high_leverage',
      params: { ratio: '2.50' }
    })
  })

  it('flags a low sales rate only when there are units to sell', () => {
    expect(deriveAlerts({ ...base, salesRate: 10, totalUnits: 0 }, days)).toEqual([])
    expect(deriveAlerts({ ...base, salesRate: 10, totalUnits: 4 }, days)[0]).toEqual({
      type: 'info',
      kind: 'low_sales_rate',
      params: { rate: '10.0' }
    })
  })

  it('keeps milestones before credits before portfolio notes, and caps at 10', () => {
    const many = Array.from({ length: 12 }, (_, i) => milestone(`-${i + 1}`, 'pending'))
    const alerts = deriveAlerts({
      ...base,
      milestones: many,
      liveDebtCredits: [{ credit_name: 'C', maturity_date: '5', amount: 1, company: null }],
      debtToEquityRatio: 9,
      salesRate: 1,
      totalUnits: 3
    }, days)

    expect(alerts).toHaveLength(10)
    expect(alerts.every(a => a.kind === 'overdue_milestone')).toBe(true)
  })
})
