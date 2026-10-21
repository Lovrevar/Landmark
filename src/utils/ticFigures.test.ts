import { describe, expect, it } from 'vitest'
import type { LineItem } from '../components/Funding/TIC/utils/ticFormatters'
import { portfolioValue, ticPlanSummary, ticTotalsByProject } from './ticFigures'

const line = (name: string, vlastita: number, kreditna: number): LineItem => ({ name, vlastita, kreditna })

describe('portfolio figures from TIC rows', () => {
  const tics = [
    { project_id: 'p1', line_items: [line('Zemljište', 2_000_000, 0), line('Građenje', 1_500_000, 3_000_000)] },
    { project_id: 'p2', line_items: [] },
    { project_id: 'p3', line_items: null },
    { project_id: null, line_items: [line('Studija', 250_000, 0)] },
  ]

  // GEN-5: the plan is the TIC, never projects.budget, and a project without one has none.
  it('ticTotalsByProject keeps projects whose TIC totals above 0, and skips rows with no project', () => {
    expect([...ticTotalsByProject(tics)]).toEqual([['p1', 6_500_000]])
  })

  it('portfolioValue sums the plans of the given projects', () => {
    const totals = ticTotalsByProject(tics)
    expect(portfolioValue(['p1', 'p2', 'p9'], totals)).toBe(6_500_000)
    expect(portfolioValue([], totals)).toBe(0)
  })

  // Pinned as the General report's PDF counts it today (GEN-30): the unlinked row is a "plan".
  it('ticPlanSummary counts TIC rows, not projects', () => {
    expect(ticPlanSummary(tics, 4)).toEqual({ totalPlanned: 6_750_000, projectsWithPlan: 2, projectsWithoutPlan: 2 })
    expect(ticPlanSummary(tics, 1).projectsWithoutPlan).toBe(-1)
    expect(ticPlanSummary([], 0)).toEqual({ totalPlanned: 0, projectsWithPlan: 0, projectsWithoutPlan: 0 })
  })
})
