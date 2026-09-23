import { describe, it, expect } from 'vitest'
import { rollupContracts, remainingBudget, ContractRollupRow } from './contractRollup'

const row = (over: Partial<ContractRollupRow> = {}): ContractRollupRow => ({
  cost: 1000,
  paid: 0,
  hasContract: true,
  owed: 0,
  ...over
})

describe('rollupContracts', () => {
  it('sums contracted rows and the shortfall still owed on them', () => {
    const r = rollupContracts([
      row({ cost: 1000, paid: 400 }),
      row({ cost: 500, paid: 0 })
    ])
    expect(r).toEqual({ contracted: 1500, paid: 400, unpaid: 1100, unpaidWithoutContract: 0, count: 2 })
  })

  it('never reports negative unpaid when a row is overpaid', () => {
    const r = rollupContracts([row({ cost: 1000, paid: 1800 })])
    expect(r.unpaid).toBe(0)
    expect(r.paid).toBe(1800)
  })

  it('takes the amount owed from invoices for rows with no contract', () => {
    const r = rollupContracts([
      row({ hasContract: false, cost: 0, paid: 100, owed: 250 })
    ])
    expect(r).toEqual({ contracted: 0, paid: 100, unpaid: 250, unpaidWithoutContract: 250, count: 1 })
  })

  // Pins the pre-existing behaviour of both phase cards: a zero-cost row counts as uncontracted
  // even when has_contract is true. Refactoring must not quietly change this.
  it('treats a zero-amount row as uncontracted even when it has a contract', () => {
    const r = rollupContracts([row({ hasContract: true, cost: 0, owed: 700 })])
    expect(r.contracted).toBe(0)
    expect(r.unpaidWithoutContract).toBe(700)
  })

  // Both source tables declare `has_contract boolean DEFAULT true NOT NULL`, so an absent flag is
  // a row that was read without the column, not a row without a contract.
  it('treats an absent contract flag as contracted', () => {
    const r = rollupContracts([{ cost: 1000, paid: 250 }])
    expect(r.contracted).toBe(1000)
    expect(r.unpaid).toBe(750)
  })

  it('mixes contracted and uncontracted rows without double counting', () => {
    const r = rollupContracts([
      row({ cost: 1000, paid: 250 }),
      row({ hasContract: false, cost: 0, paid: 50, owed: 300 })
    ])
    expect(r).toEqual({ contracted: 1000, paid: 300, unpaid: 1050, unpaidWithoutContract: 300, count: 2 })
  })

  it('is empty for no contracts', () => {
    expect(rollupContracts([])).toEqual({
      contracted: 0, paid: 0, unpaid: 0, unpaidWithoutContract: 0, count: 0
    })
  })
})

describe('remainingBudget', () => {
  it('subtracts contracted value and uncontracted debt from the budget', () => {
    const r = rollupContracts([
      row({ cost: 1000 }),
      row({ hasContract: false, cost: 0, owed: 200 })
    ])
    expect(remainingBudget(5000, r)).toBe(3800)
  })

  it('goes negative when over budget, rather than clamping', () => {
    expect(remainingBudget(500, rollupContracts([row({ cost: 900 })]))).toBe(-400)
  })
})
