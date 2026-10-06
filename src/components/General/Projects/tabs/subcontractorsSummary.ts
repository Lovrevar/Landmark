import { isContracted, rollupContracts, type ContractRollupRow } from '../../../../utils/contractRollup'
import type { ContractWithDetails } from '../types'

/**
 * The money behind the project's Subcontractors tab.
 *
 * A supplier engaged without a formal contract is stored with `contract_amount = 0`, but payments
 * against it still accumulate in `budget_realized`. The tab used to compute `contract − realized`
 * for every row, so those rows printed a green "remaining" of −€2.500 — and the total at the top,
 * being all contract values minus all payments, took every euro paid to such a supplier off the
 * remaining on contracts that had nothing to do with it.
 *
 * Both now go through `contractRollup.ts`, the same rules the Supervision phase cards use.
 */

const toRollupRow = (c: ContractWithDetails): ContractRollupRow => ({
  hasContract: c.has_contract,
  cost: Number(c.contract_amount || 0),
  paid: Number(c.budget_realized || 0),
})

/** Whether the row has an agreed amount for "remaining" to be measured against. */
export const hasContractAmount = (c: ContractWithDetails): boolean => isContracted(toRollupRow(c))

/**
 * What is still to pay on the contract, or `null` when there is no contract to measure against.
 * Negative when a real contract has been overpaid — that is a true statement, unlike the negative
 * a zero-amount row used to produce.
 */
export const contractRemaining = (c: ContractWithDetails): number | null => {
  const row = toRollupRow(c)
  return isContracted(row) ? row.cost - row.paid : null
}

export interface SubcontractorsSummary {
  /** Sum of agreed contract values. */
  totalValue: number
  /** Everything paid out, contracted or not — it is all money that left the project. */
  totalRealized: number
  /**
   * Still to pay on contracts: each contract's `cost − paid`, floored at 0 so an overpaid contract
   * does not reduce what is owed on the others. Payments to suppliers with no contract are not
   * subtracted from it.
   */
  totalRemaining: number
  count: number
}

export function summariseContracts(contracts: ContractWithDetails[]): SubcontractorsSummary {
  const rollup = rollupContracts(contracts.map(toRollupRow))
  return {
    totalValue: rollup.contracted,
    totalRealized: rollup.paid,
    // No `owed` is passed — this tab has no invoice data — so `unpaid` is the contracted part only.
    totalRemaining: rollup.unpaid,
    count: rollup.count,
  }
}
