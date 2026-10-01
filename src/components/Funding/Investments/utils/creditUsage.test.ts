import { describe, it, expect } from 'vitest'
import { calculateCreditUsage } from './creditUsage'

const base = {
  amount: 1_000_000,
  disbursedToAccount: false,
  totalAllocated: 0,
  usedInAllocations: 0,
  unallocatedDisbursements: 0,
}

describe('calculateCreditUsage', () => {
  it('splits an untouched facility into nothing used and everything free', () => {
    const usage = calculateCreditUsage(base)
    expect(usage.used).toBe(0)
    expect(usage.unallocated).toBe(1_000_000)
    expect(usage.overCommitted).toBe(false)
    expect(usage.totalUsagePercent).toBe(0)
  })

  it('counts allocated-but-unspent money as committed, not as drawn', () => {
    const usage = calculateCreditUsage({ ...base, totalAllocated: 400_000, usedInAllocations: 100_000 })
    expect(usage.used).toBe(100_000)
    expect(usage.remainingAllocated).toBe(300_000)
    expect(usage.unallocated).toBe(600_000)
    expect(usage.usedPercent).toBe(10)
    expect(usage.remainingAllocatedPercent).toBe(30)
    expect(usage.totalUsagePercent).toBe(40)
  })

  it('takes direct drawdowns off the free amount as well as allocations', () => {
    const usage = calculateCreditUsage({ ...base, totalAllocated: 300_000, unallocatedDisbursements: 200_000 })
    expect(usage.used).toBe(200_000)
    expect(usage.unallocated).toBe(500_000)
  })

  it('reports a negative free amount instead of clamping over-commitment to zero', () => {
    // The old `Math.max(0, …)` printed €0 here, and the red branch below it was unreachable.
    const usage = calculateCreditUsage({ ...base, totalAllocated: 1_200_000 })
    expect(usage.unallocated).toBe(-200_000)
    expect(usage.overCommitted).toBe(true)
    expect(usage.overCommittedBy).toBe(200_000)
  })

  it('sees over-commitment that comes from drawdowns alone, which the old warning missed', () => {
    const usage = calculateCreditUsage({ ...base, totalAllocated: 900_000, unallocatedDisbursements: 250_000 })
    expect(usage.overCommitted).toBe(true)
    expect(usage.overCommittedBy).toBe(150_000)
  })

  it('is not over-committed when allocations exactly fill the facility', () => {
    const usage = calculateCreditUsage({ ...base, totalAllocated: 1_000_000 })
    expect(usage.unallocated).toBe(0)
    expect(usage.overCommitted).toBe(false)
    expect(usage.overCommittedBy).toBe(0)
  })

  it('treats a credit paid straight to the account as fully drawn with nothing to allocate', () => {
    const usage = calculateCreditUsage({
      ...base,
      disbursedToAccount: true,
      totalAllocated: 400_000,
      usedInAllocations: 50_000,
      unallocatedDisbursements: 999,
    })
    expect(usage.used).toBe(1_000_000)
    expect(usage.remainingAllocated).toBe(0)
    expect(usage.unallocated).toBe(0)
    expect(usage.overCommitted).toBe(false)
    expect(usage.usedPercent).toBe(100)
  })

  it('never divides by a zero facility', () => {
    const usage = calculateCreditUsage({ ...base, amount: 0, unallocatedDisbursements: 5_000 })
    expect(usage.usedPercent).toBe(0)
    expect(usage.totalUsagePercent).toBe(0)
    expect(usage.unallocated).toBe(-5_000)
    expect(usage.overCommitted).toBe(true)
  })

  it('does not let spending beyond an allocation turn into negative remaining allocated', () => {
    const usage = calculateCreditUsage({ ...base, totalAllocated: 100_000, usedInAllocations: 150_000 })
    expect(usage.remainingAllocated).toBe(0)
    expect(usage.used).toBe(150_000)
  })
})
