/**
 * How much of a credit line is committed, drawn and still free.
 *
 * Shared by the two screens that render the same credits — `Cashflow/Banks` and
 * `Funding/Investments` — which each carried their own copy and had drifted. What the copies got
 * wrong, and this fixes:
 *
 * - **"Nealocirano" was clamped to zero** (`Math.max(0, …)`), so a line committed beyond its
 *   facility read as a tidy €0 and the red branch below it was unreachable. It is signed here.
 * - **The over-allocation warning ignored direct drawdowns**, comparing allocations alone against
 *   the amount. A credit paid straight out of the line was over-committed in silence.
 *
 * Deliberately *not* here: "Dug". That is `bank_credits.outstanding_balance`, maintained by
 * `recalculate_bank_credit_fields`, and the screens colour it by the figure they show. The old
 * local `netUsed = used_amount + drawdowns − repaid` double-counted every drawdown, because
 * payments against OUTGOING_BANK invoices are already in `used_amount`.
 *
 * Pure and unit-tested (`creditUsage.test.ts`).
 */

export interface CreditUsageInput {
  /** The facility (`bank_credits.amount`). */
  amount: number
  /** Paid straight to the company account: there are no allocations to track. */
  disbursedToAccount?: boolean | null
  /** Σ `credit_allocations.allocated_amount`. */
  totalAllocated: number
  /** Σ `credit_allocations.used_amount` — allocated money actually spent. */
  usedInAllocations: number
  /** Drawdowns (paid OUTGOING_BANK invoices) not tied to any allocation. */
  unallocatedDisbursements: number
}

export interface CreditUsage {
  /** Money actually drawn from the line — the quantity labelled "Iskorišteno" everywhere. */
  used: number
  /** Allocated but not yet drawn. */
  remainingAllocated: number
  /** amount − allocations − direct drawdowns. **Negative when the line is over-committed.** */
  unallocated: number
  /** True when allocations plus direct drawdowns exceed the facility. */
  overCommitted: boolean
  /** By how much the facility is exceeded; 0 when it is not. */
  overCommittedBy: number
  usedPercent: number
  remainingAllocatedPercent: number
  /** Drawn + still-allocated, as a share of the facility. */
  totalUsagePercent: number
}

const percentOf = (value: number, total: number): number => (total > 0 ? (value / total) * 100 : 0)

export function calculateCreditUsage(input: CreditUsageInput): CreditUsage {
  const { amount, totalAllocated, usedInAllocations, unallocatedDisbursements } = input
  const disbursedToAccount = !!input.disbursedToAccount

  const used = disbursedToAccount ? amount : usedInAllocations + unallocatedDisbursements
  const remainingAllocated = disbursedToAccount ? 0 : Math.max(0, totalAllocated - usedInAllocations)
  const unallocated = disbursedToAccount ? 0 : amount - totalAllocated - unallocatedDisbursements
  const overCommitted = unallocated < 0

  const usedPercent = percentOf(used, amount)
  const remainingAllocatedPercent = percentOf(remainingAllocated, amount)

  return {
    used,
    remainingAllocated,
    unallocated,
    overCommitted,
    overCommittedBy: overCommitted ? -unallocated : 0,
    usedPercent,
    remainingAllocatedPercent,
    totalUsagePercent: usedPercent + remainingAllocatedPercent,
  }
}
