/** The shape `weightedAverageInterestRate` needs from a `credit_allocations` row. */
export interface InterestBearingAllocation {
  allocated_amount: number | null
  credit?: { interest_rate?: number | null } | null
}

/**
 * Average interest rate across a project's debt allocations, weighted by allocated amount.
 *
 * This is what the "Prosječna kamatna stopa / Ponderirani prosjek" caption has always claimed
 * and never delivered: the previous version took a plain mean of `credit.interest_rate` over
 * *all* allocations, so a €4.000.000 equity row at 0% dragged a €1.000.000 loan at 5% down to
 * 2,5%. Pass debt allocations only (equity is not interest-bearing) — the caller already has
 * that split.
 *
 *   €1.000.000 @ 3% + €3.000.000 @ 5%
 *     → (1.000.000 × 3 + 3.000.000 × 5) / 4.000.000 = 4,5%
 *
 * Returns 0 when there is nothing to weight by, so the tile reads "0,0%" rather than "NaN%".
 */
export const weightedAverageInterestRate = (allocations: InterestBearingAllocation[]): number => {
  let weightedSum = 0
  let totalWeight = 0

  for (const allocation of allocations) {
    const amount = allocation.allocated_amount ?? 0
    if (!Number.isFinite(amount) || amount <= 0) continue
    weightedSum += amount * (allocation.credit?.interest_rate ?? 0)
    totalWeight += amount
  }

  return totalWeight > 0 ? weightedSum / totalWeight : 0
}
