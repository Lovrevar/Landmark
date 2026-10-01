/**
 * What a contract's payments say about its price — and, most of the time, that is nothing.
 *
 * This replaces a "Gain/Loss" row that showed paid − contracted with the sign flipped, so a
 * €200.000 contract with nothing paid yet read as a €200.000 gain, right under a "Remaining"
 * row showing the same number. A contract still being paid has no variance: "Remaining" already
 * says what it owes. Only two things are worth a row:
 *
 * - **overrun** — more paid than contracted. True the moment it happens, open or not.
 * - **saving** — the contract was closed for less than its value. Only knowable once it is
 *   settled; before that, an unpaid balance is simply unpaid.
 *
 * Shared by Supervision's contract card and details modal and Retail's phase card. Each caller
 * decides what "settled" means for its own rows; this only does the comparison.
 */
export type ContractVariance =
  | { kind: 'none' }
  | { kind: 'overrun'; amount: number } // paid beyond the contract — red
  | { kind: 'saving'; amount: number } // settled for less — green

const NONE: ContractVariance = { kind: 'none' }

export function contractVariance(input: { contracted: number; paid: number; settled: boolean }): ContractVariance {
  const { contracted, paid, settled } = input

  // No agreed amount means nothing to be over or under. `!(x > 0)` also catches NaN.
  if (!(contracted > 0)) return NONE

  // Compared in whole cents. `paid` is often a client-side sum of payments, and 0.1 + 0.2 is not
  // 0.3 in floating point — a contract paid to the cent must not show a €0,00 overrun.
  const diffCents = Math.round((paid - contracted) * 100)
  if (!Number.isFinite(diffCents)) return NONE

  if (diffCents > 0) return { kind: 'overrun', amount: diffCents / 100 }
  if (settled && diffCents < 0) return { kind: 'saving', amount: -diffCents / 100 }
  return NONE
}
