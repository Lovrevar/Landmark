import { describe, it, expect } from 'vitest'
import { contractRemaining, hasContractAmount, summariseContracts } from './subcontractorsSummary'
import type { ContractWithDetails } from '../types'

const row = (
  name: string,
  contract_amount: number,
  budget_realized: number,
  has_contract?: boolean,
): ContractWithDetails => ({
  id: name,
  contract_number: name,
  subcontractor: { id: name, name, contact: '' },
  job_description: '',
  contract_amount,
  budget_realized,
  has_contract,
  status: contract_amount > 0 ? 'active' : 'draft',
  start_date: null,
  end_date: null,
  phase_id: null,
  phase: null,
})

// The rows from the project that surfaced the bug: four suppliers paid on invoice with no
// contract amount, beside contracts that have not been paid yet.
const PROJECT = [
  row('BARBARIĆ VELJKO I SANJA', 20_000, 0),
  row('BORDOR PROJEKT d.o.o.', 0, 2_500),
  row('COLLIERS ADVISORY d.o.o.', 0, 12_500),
  row('DALEKOVOD d.d.', 0, 20_000),
  row('Dragutin Šuler', 133_100, 0),
  row('FAKULTET STROJARSTVA I BRODOGRADNJE', 58_750, 0),
  row('FINA', 0, 169.15),
]

describe('contractRemaining', () => {
  it('has no remaining for a supplier with no contract amount, instead of a negative', () => {
    // Was 0 − 2.500 = −2.500, printed in green.
    expect(contractRemaining(row('BORDOR PROJEKT d.o.o.', 0, 2_500))).toBeNull()
    expect(contractRemaining(row('FINA', 0, 169.15))).toBeNull()
  })

  it('treats has_contract = false as no contract even if an amount is stored', () => {
    expect(contractRemaining(row('legacy', 10_000, 4_000, false))).toBeNull()
  })

  it('is contract minus paid on a real contract', () => {
    expect(contractRemaining(row('FAKULTET', 58_750, 0))).toBe(58_750)
    expect(contractRemaining(row('part-paid', 10_000, 4_000))).toBe(6_000)
  })

  it('goes negative only when a real contract is overpaid, which is worth showing', () => {
    expect(contractRemaining(row('overpaid', 10_000, 12_500))).toBe(-2_500)
  })
})

describe('hasContractAmount', () => {
  it('matches the rule the Supervision phase cards use', () => {
    expect(hasContractAmount(row('a', 20_000, 0))).toBe(true)
    expect(hasContractAmount(row('b', 0, 2_500))).toBe(false)
    expect(hasContractAmount(row('c', 5_000, 0, false))).toBe(false)
  })
})

describe('summariseContracts', () => {
  it('does not take payments to uncontracted suppliers off the contracts\' remaining', () => {
    const s = summariseContracts(PROJECT)
    // 20.000 + 133.100 + 58.750, none of it paid yet.
    expect(s.totalValue).toBe(211_850)
    expect(s.totalRemaining).toBe(211_850)
    // The old total was 211.850 − 35.169,15 = 176.680,85: understated by exactly the four
    // no-contract payments.
    expect(s.totalRemaining).not.toBeCloseTo(176_680.85)
  })

  it('still counts every euro paid out, contracted or not', () => {
    const s = summariseContracts(PROJECT)
    expect(s.totalRealized).toBeCloseTo(35_169.15)
    expect(s.count).toBe(7)
  })

  it('floors an overpaid contract at zero rather than letting it cancel another\'s debt', () => {
    const s = summariseContracts([row('overpaid', 10_000, 12_500), row('open', 20_000, 5_000)])
    expect(s.totalRemaining).toBe(15_000)
  })

  it('is all zeros for an empty project', () => {
    expect(summariseContracts([])).toEqual({ totalValue: 0, totalRealized: 0, totalRemaining: 0, count: 0 })
  })
})
