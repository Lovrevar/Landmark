import { describe, it, expect } from 'vitest'
import { calculatePhaseEVM, calculateProjectEVM, type MilestoneProgress } from './evm'
import type { Phase, ContractWithDetails } from '../components/General/Projects/types'

// Minimal fixture builders — EVM only reads a handful of fields, so we cast
// trimmed objects rather than constructing the full domain types.
const phase = (over: Partial<Phase>): Phase => ({
  phase_name: 'Phase',
  budget_allocated: 0,
  start_date: null,
  end_date: null,
  ...over,
} as unknown as Phase)

const contract = (over: Partial<ContractWithDetails> & { phaseName?: string }): ContractWithDetails => {
  const { phaseName, ...rest } = over
  return {
    id: 'c',
    contract_amount: 0,
    budget_realized: 0,
    phase: phaseName ? { phase_name: phaseName } : null,
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
    expect(m).toEqual({ PV: 0, EV: 0, AC: 0, CPI: 1, SPI: 1, EAC: 0, VAC: 0, CV: 0, SV: 0 })
  })

  it('derives physical completion from milestones (not money spent)', () => {
    const phases = [phase({ phase_name: 'Foundation', budget_allocated: 100000, start_date: PAST_START, end_date: PAST_END })]
    const contracts = [contract({ id: 'c1', phaseName: 'Foundation', contract_amount: 100000, budget_realized: 40000 })]
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
    const phases = [phase({ phase_name: 'Foundation', budget_allocated: 100000, start_date: PAST_START, end_date: PAST_END })]
    const contracts = [contract({ id: 'c1', phaseName: 'Foundation', contract_amount: 100000, budget_realized: 60000 })]
    const m = calculateProjectEVM(phases, contracts, [])
    // No milestones -> physical = 60000/100000 = 60%
    expect(m.EV).toBe(60000)
    expect(m.AC).toBe(60000)
    expect(m.CPI).toBe(1)
  })

  it('value-weights physical completion across contracts in the same phase', () => {
    const phases = [phase({ phase_name: 'Foundation', budget_allocated: 100000, start_date: PAST_START, end_date: PAST_END })]
    const contracts = [
      contract({ id: 'big', phaseName: 'Foundation', contract_amount: 90000, budget_realized: 0 }),
      contract({ id: 'small', phaseName: 'Foundation', contract_amount: 10000, budget_realized: 0 }),
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
    const phases = [phase({ phase_name: 'Foundation', budget_allocated: 100000, start_date: PAST_START, end_date: PAST_END })]
    const contracts = [contract({ id: 'c1', phaseName: 'Foundation', contract_amount: 100000, budget_realized: 0 })]
    const milestones: MilestoneProgress[] = [
      { contract_id: 'c1', percentage: 80, status: 'completed' },
      { contract_id: 'c1', percentage: 80, status: 'paid' }, // 160% -> clamped to 100%
    ]
    const m = calculateProjectEVM(phases, contracts, milestones)
    expect(m.EV).toBe(100000)
  })

  it('excludes phases without start/end dates from PV/EV/AC but still counts their budget', () => {
    const phases = [
      phase({ phase_name: 'Scheduled', budget_allocated: 100000, start_date: PAST_START, end_date: PAST_END }),
      phase({ phase_name: 'Undated', budget_allocated: 50000, start_date: null, end_date: null }),
    ]
    const contracts = [
      contract({ id: 'c1', phaseName: 'Scheduled', contract_amount: 100000, budget_realized: 100000 }),
      contract({ id: 'c2', phaseName: 'Undated', contract_amount: 50000, budget_realized: 50000 }),
    ]
    const milestones: MilestoneProgress[] = [
      { contract_id: 'c1', percentage: 100, status: 'paid' },
      { contract_id: 'c2', percentage: 100, status: 'paid' },
    ]
    const m = calculateProjectEVM(phases, contracts, milestones)
    // Only the scheduled phase contributes to earned/actual...
    expect(m.PV).toBe(100000)
    expect(m.EV).toBe(100000)
    expect(m.AC).toBe(100000)
    expect(m.CPI).toBe(1)
    // ...but total budget (150k) drives EAC — proving the unscheduled 50k is
    // still counted even though it contributed nothing to PV/EV/AC.
    expect(m.EAC).toBe(150000)
    expect(m.VAC).toBe(0) // CPI=1 here, so EAC==totalBudget
  })
})
