import { describe, expect, it } from 'vitest'
import { retailPortfolioCounts } from './retailFigures'

describe('retailPortfolioCounts', () => {
  // Pinned as the General report counts today. All three points are GEN-28; its fix changes them.
  it('counts with statuses the tables do not allow, and mixes buyer and supplier contracts', () => {
    expect(retailPortfolioCounts({
      projects: [{ status: 'In Progress' }, { status: 'Completed' }, { status: 'Planning' }],
      contracts: [
        { contract_amount: 80_000, budget_realized: 30_000 }, // a supplier's
        { contract_amount: '120000', budget_realized: 60_000 }, // a buyer's
      ],
      phases: [{ status: 'Completed' }, { status: 'In Progress' }, { status: 'Pending' }],
    })).toEqual({ projects: 3, activeProjects: 0, contracts: 2, contractValue: 200_000, realized: 90_000, phases: 3, completedPhases: 0 })
  })

  it('is all zeros for an empty portfolio', () => {
    expect(retailPortfolioCounts({ projects: [], contracts: [], phases: [] }))
      .toEqual({ projects: 0, activeProjects: 0, contracts: 0, contractValue: 0, realized: 0, phases: 0, completedPhases: 0 })
  })
})
