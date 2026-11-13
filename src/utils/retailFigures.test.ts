import { describe, expect, it } from 'vitest'
import { retailPortfolioCounts } from './retailFigures'

const phases = [
  { id: 'ph-dev', phase_type: 'development', status: 'Completed' },
  { id: 'ph-con', phase_type: 'construction', status: 'In Progress' },
  { id: 'ph-sal', phase_type: 'sales', status: 'Pending' },
]

describe('retailPortfolioCounts', () => {
  // GEN-28: the statuses are the ones the tables allow, and buyers' contracts are kept apart from
  // suppliers' by the phase they sit on.
  it('GEN-28: counts the allowed statuses and splits cost contracts from sales', () => {
    expect(retailPortfolioCounts({
      projects: [{ status: 'In Progress' }, { status: 'Completed' }, { status: 'Planning' }],
      phases,
      contracts: [
        { id: 'c1', phase_id: 'ph-dev', contract_amount: 20_000, budget_realized: 5_000 },
        { id: 'c2', phase_id: 'ph-con', contract_amount: 80_000, budget_realized: 30_000 },
        { id: 'c3', phase_id: 'ph-sal', customer_id: 'cu1', contract_amount: '120000', budget_realized: 60_000 },
        // No phase: left out of every sum rather than guessed at.
        { id: 'c4', phase_id: null, contract_amount: 999, budget_realized: 999 },
      ],
    })).toEqual({
      projects: 3,
      activeProjects: 1,
      contracts: 4,
      costContractValue: 100_000,
      costRealized: 35_000,
      salesContracted: 120_000,
      collected: 60_000,
      phases: 3,
      completedPhases: 1,
    })
  })

  it('is all zeros for an empty portfolio', () => {
    expect(retailPortfolioCounts({ projects: [], phases: [], contracts: [] })).toEqual({
      projects: 0, activeProjects: 0, contracts: 0, costContractValue: 0, costRealized: 0,
      salesContracted: 0, collected: 0, phases: 0, completedPhases: 0,
    })
  })
})
