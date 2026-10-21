import { describe, expect, it } from 'vitest'
import {
  profitAndMargin,
  projectRiskLevel,
  projectStatusCounts,
  recommendationKeys,
  reportRisks,
  returnOnEquity,
  topProjectsByRevenue,
} from './projectFigures'

describe('profitAndMargin and returnOnEquity', () => {
  it('profit is revenue less expenses, the margin its share of revenue', () => {
    expect(profitAndMargin(50_000, 70_000)).toEqual({ profit: -20_000, margin: -40 })
    expect(profitAndMargin(770_000, 0)).toEqual({ profit: 770_000, margin: 100 })
  })

  it('the margin is 0 with no revenue, ROI 0 with no equity', () => {
    expect(profitAndMargin(0, 1_000)).toEqual({ profit: -1_000, margin: 0 })
    expect(returnOnEquity(100_000, 0)).toBe(0)
    expect(returnOnEquity(100_000, 400_000)).toBe(25)
  })
})

describe('projectRiskLevel', () => {
  it.each([
    [10, 50, 'High'], // barely sold
    [60, -1, 'High'], // at a loss
    [19.99, 30, 'High'],
    [20, 30, 'Medium'],
    [49, 30, 'Medium'],
    [60, 14.9, 'Medium'],
    [50, 15, 'Low'],
    [100, 100, 'Low'],
  ] as const)('sales rate %s %% and margin %s %% is %s', (rate, margin, level) => {
    expect(projectRiskLevel(rate, margin)).toBe(level)
  })

  // Pinned (GEN-32): no units reads as a 0 % sales rate.
  it('calls a project with no units high risk', () => {
    expect(projectRiskLevel(0, 0)).toBe('High')
  })
})

const project = (name: string, revenue: number, sales_rate: number, total_units = 10) => ({ name, revenue, sales_rate, total_units })

describe('reportRisks', () => {
  it('counts projects with units below 40 % sold as slow sales', () => {
    expect(reportRisks([project('a', 1, 39.9), project('b', 1, 40), project('c', 0, 0, 0), project('d', 1, 10)]))
      .toEqual([{ kind: 'slow_sales', count: 2 }])
  })

  it('raises nothing when no project is slow', () => {
    expect(reportRisks([project('b', 1, 40)])).toEqual([])
    expect(reportRisks([])).toEqual([])
  })
})

describe('topProjectsByRevenue', () => {
  it('takes the three with most revenue, highest first, and leaves the input alone', () => {
    const projects = [project('a', 10, 1), project('b', 30, 2), project('c', 20, 3), project('d', 5, 4)]
    expect(topProjectsByRevenue(projects).map(p => p.name)).toEqual(['b', 'c', 'a'])
    expect(topProjectsByRevenue(projects, 5).map(p => p.name)).toEqual(['b', 'c', 'a', 'd'])
    expect(projects.map(p => p.name)).toEqual(['a', 'b', 'c', 'd'])
  })

  it('GEN-38: leaves out projects with nothing sold, even when that leaves fewer than n', () => {
    const projects = [project('a', 0, 1), project('b', 30, 2), project('c', 0, 3)]
    expect(topProjectsByRevenue(projects).map(p => p.name)).toEqual(['b'])
    expect(topProjectsByRevenue([project('a', 0, 1)])).toEqual([])
  })
})

describe('recommendationKeys', () => {
  it('adds marketing below 50 % sold and inventory when more is available than sold', () => {
    expect(recommendationKeys({ salesRate: 30, available: 7, sold: 3 })).toEqual([
      'reports.general.recs.marketing', 'reports.general.recs.inventory', 'reports.general.recs.budgets', 'reports.general.recs.partners',
    ])
    expect(recommendationKeys({ salesRate: 50, available: 3, sold: 3 })).toEqual(['reports.general.recs.budgets', 'reports.general.recs.partners'])
  })
})

describe('projectStatusCounts', () => {
  it('active is In Progress', () => {
    expect(projectStatusCounts([{ status: 'In Progress' }, { status: 'Completed' }, { status: 'Planning' }, { status: 'On Hold' }]))
      .toEqual({ total: 4, active: 1, completed: 1 })
  })
})
