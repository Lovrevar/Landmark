import { describe, it, expect } from 'vitest'
import { calculatePhaseEVM, calculateProjectEVM, indexAxisTop, type MilestoneProgress } from './evm'
import type { Phase, ContractWithDetails } from '../components/General/Projects/types'

// Minimal fixture builders — EVM only reads a handful of fields, so we cast
// trimmed objects rather than constructing the full domain types.
const phase = (over: Partial<Phase>): Phase => ({
  // An explicit id matters: contracts are joined to phases by id, and a fixture that leaves
  // both sides undefined would match everything and silently pass regardless of the join.
  id: 'ph-default',
  phase_name: 'Phase',
  budget_allocated: 0,
  start_date: null,
  end_date: null,
  ...over,
} as unknown as Phase)

const contract = (over: Partial<ContractWithDetails> & { phaseId?: string }): ContractWithDetails => {
  const { phaseId, ...rest } = over
  return {
    id: 'c',
    contract_amount: 0,
    budget_realized: 0,
    phase_id: phaseId ?? null,
    phase: null,
    ...rest,
  } as unknown as ContractWithDetails
}

describe('calculatePhaseEVM', () => {
  // 10-day window; "now" at day 5 => planned 50% complete.
  const start = '2026-01-01T00:00:00.000Z'
  const end = '2026-01-11T00:00:00.000Z'
  const midpoint = new Date('2026-01-06T00:00:00.000Z')

  it('reports an on-track phase (CPI=SPI=1, zero variances)', () => {
    const m = calculatePhaseEVM(100000, 50, start, end, 50000, midpoint)
    expect(m.PV).toBe(50000)
    expect(m.EV).toBe(50000)
    expect(m.AC).toBe(50000)
    expect(m.CPI).toBe(1)
    expect(m.SPI).toBe(1)
    expect(m.CV).toBe(0)
    expect(m.SV).toBe(0)
    expect(m.EAC).toBe(100000)
    expect(m.VAC).toBe(0)
  })

  it('reports over-budget AND behind-schedule (CPI<1, SPI<1, negative CV/SV/VAC)', () => {
    // Only 25% physically done, but 40k already spent at the schedule midpoint.
    const m = calculatePhaseEVM(100000, 25, start, end, 40000, midpoint)
    expect(m.PV).toBe(50000)
    expect(m.EV).toBe(25000)
    expect(m.CPI).toBeCloseTo(0.625, 10)
    expect(m.SPI).toBe(0.5)
    expect(m.CV).toBe(-15000) // over budget
    expect(m.SV).toBe(-25000) // behind schedule
    expect(m.EAC).toBe(160000)
    expect(m.VAC).toBe(-60000) // projected overrun = budget - EAC
  })

  it('reports under-budget AND ahead-of-schedule (CPI>1, SPI>1)', () => {
    const m = calculatePhaseEVM(100000, 75, start, end, 30000, midpoint)
    expect(m.PV).toBe(50000)
    expect(m.EV).toBe(75000)
    expect(m.CPI).toBe(2.5)
    expect(m.SPI).toBe(1.5)
    expect(m.CV).toBe(45000)
    expect(m.SV).toBe(25000)
    expect(m.EAC).toBe(40000)
    expect(m.VAC).toBe(60000)
  })

  it('guards CPI to 1 when nothing has been spent yet (AC=0, no divide-by-zero)', () => {
    const m = calculatePhaseEVM(100000, 30, start, end, 0, midpoint)
    expect(m.AC).toBe(0)
    expect(m.CPI).toBe(1)
    expect(m.EAC).toBe(100000)
    expect(m.VAC).toBe(0)
    expect(m.CV).toBe(30000)
  })

  it('guards SPI to 1 and PV to 0 for a zero-duration phase (start === end)', () => {
    const m = calculatePhaseEVM(100000, 40, start, start, 20000, midpoint)
    expect(m.PV).toBe(0)
    expect(m.SPI).toBe(1)
    expect(m.SV).toBe(40000)
    expect(m.CPI).toBe(2)
  })

  it('clamps planned completion to 0% before the phase starts', () => {
    const before = new Date('2025-12-01T00:00:00.000Z')
    const m = calculatePhaseEVM(100000, 10, start, end, 5000, before)
    expect(m.PV).toBe(0)
    expect(m.SPI).toBe(1) // PV=0 guard
  })

  it('clamps planned completion to 100% after the phase ends', () => {
    const after = new Date('2026-02-01T00:00:00.000Z')
    const m = calculatePhaseEVM(100000, 100, start, end, 100000, after)
    expect(m.PV).toBe(100000)
    expect(m.EV).toBe(100000)
    expect(m.SPI).toBe(1)
  })

  it('accepts Date objects as well as ISO strings for the planned dates', () => {
    const m = calculatePhaseEVM(100000, 50, new Date(start), new Date(end), 50000, midpoint)
    expect(m.PV).toBe(50000)
    expect(m.SPI).toBe(1)
  })
})

describe('calculateProjectEVM', () => {
  // All phases are dated in the past so planned completion is deterministically
  // 100% regardless of the wall-clock "now" the function reads internally.
  const PAST_START = '2020-01-01T00:00:00.000Z'
  const PAST_END = '2020-06-01T00:00:00.000Z'

  it('returns guarded zeros for an empty project', () => {
    const m = calculateProjectEVM([], [])
    expect(m).toEqual({ PV: 0, EV: 0, AC: 0, CPI: 1, SPI: 1, EAC: 0, VAC: 0, CV: 0, SV: 0, scheduleAvailable: false, costAvailable: false, costUnavailableReason: 'nothing_paid' })
  })

  it('derives physical completion from milestones (not money spent)', () => {
    const phases = [phase({ id: 'ph1', phase_name: 'Foundation', budget_allocated: 100000, start_date: PAST_START, end_date: PAST_END })]
    const contracts = [contract({ id: 'c1', phaseId: 'ph1', contract_amount: 100000, budget_realized: 40000 })]
    const milestones: MilestoneProgress[] = [
      { contract_id: 'c1', percentage: 30, status: 'completed' },
      { contract_id: 'c1', percentage: 20, status: 'paid' },
      { contract_id: 'c1', percentage: 50, status: 'pending' }, // not done -> excluded
    ]
    const m = calculateProjectEVM(phases, contracts, milestones)
    expect(m.PV).toBe(100000) // past phase -> 100% planned
    expect(m.EV).toBe(50000) // 30% + 20% physically done
    expect(m.AC).toBe(40000)
    expect(m.CPI).toBe(1.25)
    expect(m.SPI).toBe(0.5)
    expect(m.CV).toBe(10000)
    expect(m.SV).toBe(-50000)
    expect(m.EAC).toBe(80000)
    expect(m.VAC).toBe(20000)
  })

  it('falls back to the financial proxy (realized/amount) when a contract has no milestones', () => {
    const phases = [phase({ id: 'ph1', phase_name: 'Foundation', budget_allocated: 100000, start_date: PAST_START, end_date: PAST_END })]
    const contracts = [contract({ id: 'c1', phaseId: 'ph1', contract_amount: 100000, budget_realized: 60000 })]
    const m = calculateProjectEVM(phases, contracts, [])
    // No milestones -> physical = 60000/100000 = 60%
    expect(m.EV).toBe(60000)
    expect(m.AC).toBe(60000)
    expect(m.CPI).toBe(1)
  })

  it('value-weights physical completion across contracts in the same phase', () => {
    const phases = [phase({ id: 'ph1', phase_name: 'Foundation', budget_allocated: 100000, start_date: PAST_START, end_date: PAST_END })]
    const contracts = [
      contract({ id: 'big', phaseId: 'ph1', contract_amount: 90000, budget_realized: 0 }),
      contract({ id: 'small', phaseId: 'ph1', contract_amount: 10000, budget_realized: 0 }),
    ]
    const milestones: MilestoneProgress[] = [
      { contract_id: 'big', percentage: 10, status: 'completed' },
      { contract_id: 'small', percentage: 100, status: 'completed' },
    ]
    // weighted = (90000*10 + 10000*100) / 100000 = (900000 + 1000000)/100000 = 19%
    const m = calculateProjectEVM(phases, contracts, milestones)
    expect(m.EV).toBe(19000)
  })

  it('caps milestone-derived completion at 100%', () => {
    const phases = [phase({ id: 'ph1', phase_name: 'Foundation', budget_allocated: 100000, start_date: PAST_START, end_date: PAST_END })]
    const contracts = [contract({ id: 'c1', phaseId: 'ph1', contract_amount: 100000, budget_realized: 0 })]
    const milestones: MilestoneProgress[] = [
      { contract_id: 'c1', percentage: 80, status: 'completed' },
      { contract_id: 'c1', percentage: 80, status: 'paid' }, // 160% -> clamped to 100%
    ]
    const m = calculateProjectEVM(phases, contracts, milestones)
    expect(m.EV).toBe(100000)
  })

  it('counts an undated phase in EV/AC but not in PV, and flags the missing schedule', () => {
    const phases = [
      phase({ id: 'ph-sched', phase_name: 'Scheduled', budget_allocated: 100000, start_date: PAST_START, end_date: PAST_END }),
      phase({ id: 'ph-undated', phase_name: 'Undated', budget_allocated: 50000, start_date: null, end_date: null }),
    ]
    const contracts = [
      contract({ id: 'c1', phaseId: 'ph-sched', contract_amount: 100000, budget_realized: 100000 }),
      contract({ id: 'c2', phaseId: 'ph-undated', contract_amount: 50000, budget_realized: 50000 }),
    ]
    const milestones: MilestoneProgress[] = [
      { contract_id: 'c1', percentage: 100, status: 'paid' },
      { contract_id: 'c2', percentage: 100, status: 'paid' },
    ]
    const m = calculateProjectEVM(phases, contracts, milestones)

    // PV needs a schedule, so only the dated phase contributes to it.
    expect(m.PV).toBe(100000)
    // EV and AC do not need one. The undated phase's work is real and its money is spent, so
    // both include it. Dropping them (as this previously did) left EV = AC = 0 for a project
    // with no dated phases, which made CPI fall back to 1 and reported every such project as
    // perfectly on budget.
    expect(m.EV).toBe(150000)
    expect(m.AC).toBe(150000)
    expect(m.CPI).toBe(1)
    expect(m.EAC).toBe(150000)
    expect(m.VAC).toBe(0)
    // A schedule existed for at least one phase, so SPI is meaningful here.
    expect(m.scheduleAvailable).toBe(true)
  })

  it('marks the cost side unavailable while nothing is paid, rather than implying under budget', () => {
    const phases = [phase({ id: 'ph1', phase_name: 'Foundation', budget_allocated: 100000, start_date: PAST_START, end_date: PAST_END })]
    const contracts = [contract({ id: 'c1', phaseId: 'ph1', contract_amount: 100000, budget_realized: 0 })]

    const m = calculateProjectEVM(phases, contracts)

    expect(m.AC).toBe(0)
    expect(m.costAvailable).toBe(false)
    expect(m.costUnavailableReason).toBe('nothing_paid')
    // CPI 1 and EAC = budget are conventions here, not measurements — callers must check
    // costAvailable before presenting them as "under budget".
    expect(m.CPI).toBe(1)
    expect(m.VAC).toBe(0)
  })

  // GEN-23: available once something is paid on a contract whose progress is measured by its
  // milestones. Before, any payment made it available, also when progress was only paid/amount.
  it('reports the cost side as available once a contract with milestones is paid', () => {
    const phases = [phase({ id: 'ph1', phase_name: 'Foundation', budget_allocated: 100000, start_date: PAST_START, end_date: PAST_END })]
    const contracts = [contract({ id: 'c1', phaseId: 'ph1', contract_amount: 100000, budget_realized: 1 })]
    const milestones: MilestoneProgress[] = [{ contract_id: 'c1', percentage: 10, status: 'completed' }]
    const m = calculateProjectEVM(phases, contracts, milestones)
    expect(m.costAvailable).toBe(true)
    expect(m.costUnavailableReason).toBeUndefined()
  })

  it('GEN-23: does not measure CPI when no paid contract has milestones', () => {
    // Progress is then paid/amount, so earned equals paid and CPI is 1 by construction: an
    // overpriced contract would read "within plan". Every paid contract on production was like this.
    const phases = [phase({ id: 'ph1', budget_allocated: 1000, start_date: PAST_START, end_date: PAST_END })]
    const contracts = [contract({ id: 'c1', phaseId: 'ph1', contract_amount: 600, budget_realized: 300 })]
    const m = calculateProjectEVM(phases, contracts)
    expect(m.AC).toBe(300)
    expect(m.costAvailable).toBe(false)
    expect(m.costUnavailableReason).toBe('no_milestones')
  })

  it('marks the schedule unavailable when no phase is dated, rather than implying on-track', () => {
    const phases = [phase({ id: 'ph-u', phase_name: 'Undated', budget_allocated: 100000, start_date: null, end_date: null })]
    const contracts = [contract({ id: 'c1', phaseId: 'ph-u', contract_amount: 100000, budget_realized: 80000 })]
    const milestones: MilestoneProgress[] = [{ contract_id: 'c1', percentage: 50, status: 'paid' }]

    const m = calculateProjectEVM(phases, contracts, milestones)

    expect(m.PV).toBe(0)
    expect(m.scheduleAvailable).toBe(false)
    // SPI is 1 only because there is no baseline to compare against — callers must check
    // scheduleAvailable before presenting it as "on schedule".
    expect(m.SPI).toBe(1)
    // CPI, by contrast, is genuinely computed: 50k earned against 80k spent.
    expect(m.EV).toBe(50000)
    expect(m.AC).toBe(80000)
    expect(m.CPI).toBeCloseTo(0.625, 5)
  })

  it('does not pull in a same-named phase belonging to another project', () => {
    // Every project now has a phase called "Faza 1"; a name-keyed join merged them.
    const phases = [phase({ id: 'ph-mine', phase_name: 'Faza 1', budget_allocated: 100000, start_date: PAST_START, end_date: PAST_END })]
    const contracts = [
      contract({ id: 'c1', phaseId: 'ph-mine', contract_amount: 100000, budget_realized: 10000 }),
      contract({ id: 'c2', phaseId: 'ph-other-project', contract_amount: 999999, budget_realized: 999999 }),
    ]
    const milestones: MilestoneProgress[] = [{ contract_id: 'c1', percentage: 100, status: 'paid' }]

    const m = calculateProjectEVM(phases, contracts, milestones)

    expect(m.AC).toBe(10000)
    expect(m.EV).toBe(100000)
  })

  // GEN-23 follow-up. A supplier paid without a contract (has_contract false, amount 0) is spent
  // money that could never be earned, so measuring against the plan sank CPI: Precko Zapad on
  // production read CPI 0,29 and a forecast of about €2,1 billion from €1,27M of such payments.
  it('counts work bought without a contract as done for what was paid', () => {
    const phases = [phase({ id: 'ph1', budget_allocated: 100000, start_date: PAST_START, end_date: PAST_END })]
    const contracts = [
      contract({ id: 'c1', phaseId: 'ph1', contract_amount: 20000, budget_realized: 10000 }),
      contract({ id: 'c2', phaseId: 'ph1', contract_amount: 0, budget_realized: 30000, has_contract: false }),
    ]
    const milestones: MilestoneProgress[] = [{ contract_id: 'c1', percentage: 50, status: 'paid' }]

    const m = calculateProjectEVM(phases, contracts, milestones)

    // 20000×50% + 30000 paid for work received
    expect(m.EV).toBe(40000)
    expect(m.AC).toBe(40000)
    expect(m.CPI).toBeCloseTo(1)
    expect(m.EAC).toBeCloseTo(100000)
    expect(m.costAvailable).toBe(true)
  })

  it('has no cost performance when everything paid went to suppliers without a contract', () => {
    // CPI is then 1 by construction, not measured — four production projects were in this state.
    const phases = [phase({ id: 'ph1', budget_allocated: 100000, start_date: PAST_START, end_date: PAST_END })]
    const contracts = [contract({ id: 'c1', phaseId: 'ph1', contract_amount: 0, budget_realized: 30000, has_contract: false })]

    const m = calculateProjectEVM(phases, contracts)

    expect(m.AC).toBe(30000)
    expect(m.costAvailable).toBe(false)
    expect(m.costUnavailableReason).toBe('no_contract')
  })

  // GEN-22. An unphased TIC leaves every phase NULL; the plan is the project's TIC total.
  describe('an unphased plan over several phases', () => {
    const now = new Date('2026-07-01T00:00:00.000Z')
    const phases = [
      phase({ id: 'ph-1', budget_allocated: null, start_date: '2026-01-01', end_date: '2026-03-31' }),
      phase({ id: 'ph-2', budget_allocated: null, start_date: '2026-04-01', end_date: '2026-12-31' }),
    ]
    const tic = 1000
    // Phase 1 is finished and paid; phase 2 is a quarter paid.
    const contracts = [
      contract({ id: 'c1', phaseId: 'ph-1', contract_amount: 200, budget_realized: 200 }),
      contract({ id: 'c2', phaseId: 'ph-2', contract_amount: 600, budget_realized: 150 }),
    ]

    it('does not count the whole budget as earned because the first phase is finished', () => {
      const m = calculateProjectEVM(phases, contracts, [], now, tic)
      // 200×100% + 600×25% = 350 of the 1000 plan. The 200 not yet contracted is not started
      // (GEN-23); it used to be credited at the contracts' average, 437,5.
      expect(m.EV).toBeCloseTo(350)
      expect(m.AC).toBe(350)
      expect(m.CPI).toBeCloseTo(1)
      // and so the forecast is not simply what has been paid so far
      expect(m.EAC).toBeCloseTo(1000)
      expect(m.EAC).not.toBeCloseTo(m.AC)
    })

    it('measures the schedule over the whole project, not over the first phase', () => {
      const m = calculateProjectEVM(phases, contracts, [], now, tic)
      // 1 Jan to 31 Dec, seen on 1 Jul: about half the plan should be done, not all of it
      expect(m.scheduleAvailable).toBe(true)
      expect(m.PV).toBeGreaterThan(480)
      expect(m.PV).toBeLessThan(520)
    })

    it('uses the project span for the schedule even before the later phases have contracts', () => {
      const m = calculateProjectEVM(phases, [contracts[0]], [], now, tic)
      expect(m.PV).toBeGreaterThan(480)
      expect(m.PV).toBeLessThan(520)
    })

    // GEN-23. The test above fed this case but checked only PV; EV, CPI and the forecast were
    // still the GEN-22 symptom (EV 1000, CPI 5, EAC 200 = paid to date).
    it('GEN-23: a phase with nothing contracted yet counts as not started, not as done', () => {
      // Phase 1 is finished and paid (200 of the 1000 plan); phase 2 has no contracts.
      const m = calculateProjectEVM(phases, [contracts[0]], [], now, tic)
      expect(m.EV).toBeCloseTo(200)
      expect(m.CPI).toBeCloseTo(1)
      expect(m.EAC).toBeCloseTo(1000)
    })

    it('GEN-23: an undated later phase makes the schedule unknown instead of ending it early', () => {
      // Taking the span from the dated phases only had the whole plan due by 31 March.
      const partlyDated = [phases[0], phase({ id: 'ph-2', budget_allocated: null, start_date: null, end_date: null })]
      const m = calculateProjectEVM(partlyDated, contracts, [], now, tic)
      expect(m.scheduleAvailable).toBe(false)
      expect(m.PV).toBe(0)
    })

    it('leaves a phased plan alone', () => {
      // Budgets chosen so phase by phase and whole-project give different answers: phase 1's
      // contract (200) exceeds its plan (100), so it can earn only that plan.
      const phased = [
        phase({ id: 'ph-1', budget_allocated: 100, start_date: '2026-01-01', end_date: '2026-03-31' }),
        phase({ id: 'ph-2', budget_allocated: 900, start_date: '2026-04-01', end_date: '2026-12-31' }),
      ]
      const m = calculateProjectEVM(phased, contracts, [], now, tic)
      // 100 (phase 1, capped at its plan) + 600×25% = 250; as one project it would be 350
      expect(m.EV).toBeCloseTo(250)
    })

    it('GEN-23: in a phased plan, work not yet contracted is not started either', () => {
      // Phase 2 is planned at 600 but only 300 of it is contracted, a quarter done.
      const phased = [
        phase({ id: 'ph-1', budget_allocated: 400, start_date: '2026-01-01', end_date: '2026-03-31' }),
        phase({ id: 'ph-2', budget_allocated: 600, start_date: '2026-04-01', end_date: '2026-12-31' }),
      ]
      const partial = [contracts[0], contract({ id: 'c3', phaseId: 'ph-2', contract_amount: 300, budget_realized: 75 })]
      const m = calculateProjectEVM(phased, partial, [], now, tic)
      // 200×100% + 300×25% = 275. Spreading the progress over each phase's plan gave
      // 400 + 150 = 550, and a CPI of 2 for work paid at exactly its contract price.
      expect(m.EV).toBeCloseTo(275)
      expect(m.AC).toBe(275)
      expect(m.CPI).toBeCloseTo(1)
    })

    // The client used to guess an unphased plan from "one funded phase among several", which
    // also caught a phased TIC that plans nothing for one phase.
    it('measures a phased plan with an unfunded phase phase by phase', () => {
      const phased = [
        phase({ id: 'ph-1', budget_allocated: 1000, start_date: '2026-01-01', end_date: '2026-03-31' }),
        phase({ id: 'ph-2', budget_allocated: 0, start_date: '2026-04-01', end_date: '2026-12-31' }),
      ]
      const m = calculateProjectEVM(phased, contracts, [], now, tic)
      // 200×100% of phase 1's plan + nothing for phase 2, which the TIC does not plan. Measured
      // as one project it would be 350.
      expect(m.EV).toBeCloseTo(200)
    })

    it('has no plan to earn against when the project budget is unknown', () => {
      const m = calculateProjectEVM(phases, contracts, [], now)
      expect(m.EV).toBe(0)
      expect(m.AC).toBe(350)
    })
  })
})

describe('indexAxisTop', () => {
  it('keeps the axis at 2 while every index fits', () => {
    expect(indexAxisTop(1.4)).toBe(2)
    expect(indexAxisTop(2)).toBe(2)
  })

  it('rounds a larger index up to the next half', () => {
    expect(indexAxisTop(2.527306968)).toBe(3)
    expect(indexAxisTop(3.2)).toBe(3.5)
  })

  it('falls back to 2 when there is no point to fit', () => {
    expect(indexAxisTop(-Infinity)).toBe(2)
  })
})
