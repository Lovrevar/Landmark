/**
 * The money math behind every "contracted / paid / unpaid / remaining" tile.
 *
 * Supervision's site management and Retail's project phases show the same four figures over two
 * different tables, and each used to compute them inline — Retail with a second, drifting copy of
 * the arithmetic. The rules live here once, tested: what counts as contracted, where the amount
 * still owed comes from, and what "remaining budget" subtracts.
 *
 * Each module maps its own row shape onto `ContractRollupRow`; the mapping is what its own tests
 * pin, because "paid" is a different column in each (`contracts.budget_realized` in Supervision,
 * `retail_contracts.invoice_total_paid` in Retail).
 */

export interface ContractRollupRow {
  /**
   * Whether a formal contract exists. Undefined counts as "yes", matching the
   * `has_contract boolean DEFAULT true NOT NULL` column both tables are read from.
   */
  hasContract?: boolean
  /** The agreed contract value. */
  cost: number
  /** Money actually paid on the row. */
  paid: number
  /**
   * Still outstanding per invoices. Read only for rows that are not contracted, where there is no
   * agreed amount to measure what has been paid against.
   */
  owed?: number
}

export interface ContractRollup {
  contracted: number
  paid: number
  unpaid: number
  /** Owed on rows that have no contract; kept separate because the budget tiles subtract it. */
  unpaidWithoutContract: number
  count: number
}

/**
 * Reproduces the split both phase cards have always used: a row counts as "contracted" only when
 * it has a contract AND a non-zero amount. Everything else — including a contract row with a zero
 * amount — is treated as uncontracted, where the amount owed comes from invoices rather than from
 * a contract value.
 */
export function rollupContracts(rows: ContractRollupRow[]): ContractRollup {
  let contracted = 0
  let paid = 0
  let unpaid = 0
  let unpaidWithoutContract = 0

  for (const row of rows) {
    const cost = row.cost ?? 0
    const isContracted = row.hasContract !== false && cost > 0
    const rowPaid = row.paid || 0

    paid += rowPaid

    if (isContracted) {
      contracted += cost
      unpaid += Math.max(0, cost - rowPaid)
    } else {
      const owed = row.owed || 0
      unpaid += owed
      unpaidWithoutContract += owed
    }
  }

  return { contracted, paid, unpaid, unpaidWithoutContract, count: rows.length }
}

/** Budget headroom, matching the phase cards' "remaining" tile. */
export const remainingBudget = (
  budget: number,
  rollup: Pick<ContractRollup, 'contracted' | 'unpaidWithoutContract'>
): number => budget - rollup.contracted - rollup.unpaidWithoutContract
