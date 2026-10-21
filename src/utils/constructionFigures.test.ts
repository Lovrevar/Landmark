import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  completedPhaseCount,
  contractTotals,
  contractTypeCounts,
  isSettledMilestone,
  phaseCompletionRate,
  recentWorkLogCount,
} from './constructionFigures'

const contract = (status: string, contract_amount: number | string, budget_realized: number | string, name?: string | null) =>
  ({ status, contract_amount, budget_realized, contract_types: name === undefined ? null : { name } })

describe('contractTotals', () => {
  it('sums every contract, whatever its status, and counts active and completed', () => {
    expect(contractTotals([
      contract('active', 100_000, 40_000),
      contract('completed', 50_000, 50_000),
      contract('terminated', 30_000, 10_000),
      contract('draft', '20000', 0),
    ])).toEqual({ count: 4, active: 1, completed: 1, value: 200_000, realized: 100_000, utilization: 50 })
  })

  it('is not capped: paid above value reads above 100 %', () => {
    expect(contractTotals([contract('active', 100, 150)]).utilization).toBe(150)
  })

  it('is all zeros for no contracts', () => {
    expect(contractTotals([])).toEqual({ count: 0, active: 0, completed: 0, value: 0, realized: 0, utilization: 0 })
  })
})

describe('contractTypeCounts', () => {
  it('counts by type name in first-seen order, a missing type as an empty name', () => {
    expect(contractTypeCounts([
      contract('active', 1, 0, 'Građevinski radovi'),
      contract('active', 1, 0, null),
      contract('active', 1, 0, 'Projektiranje'),
      contract('active', 1, 0, 'Građevinski radovi'),
      contract('active', 1, 0),
    ])).toEqual([
      { name: 'Građevinski radovi', count: 2 },
      { name: '', count: 2 },
      { name: 'Projektiranje', count: 1 },
    ])
  })
})

describe('phases', () => {
  it('counts completed phases and their share', () => {
    expect(completedPhaseCount([{ status: 'completed' }, { status: 'active' }, { status: 'Completed' }])).toBe(1)
    expect(phaseCompletionRate(1, 4)).toBe(25)
    expect(phaseCompletionRate(0, 0)).toBe(0)
  })
})

describe('isSettledMilestone', () => {
  // GEN-2: the payment trigger writes `completed` for a part-paid milestone.
  it('is paid only', () => {
    expect(['paid', 'completed', 'pending', null].map(isSettledMilestone)).toEqual([true, false, false, false])
  })
})

describe('recentWorkLogCount', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 9, 20, 15, 30, 0))
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  // GEN-2: subMonths(now, 0.25) was not seven days.
  it('counts today and the six days before, not tomorrow, not a week ago, not undated', () => {
    const logs = ['2026-10-20', '2026-10-14', '2026-10-13', '2026-10-21', null].map(date => ({ date }))
    expect(recentWorkLogCount(logs)).toBe(2)
    expect(recentWorkLogCount([])).toBe(0)
  })
})
