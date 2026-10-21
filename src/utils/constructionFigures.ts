import { daysFromToday } from './dateOnly'

/**
 * Construction figures: contracts committed and paid, phases done, milestones settled, recent
 * work logs. One definition each, for the General report, Budget Control and the Director
 * dashboard (REGRESSION_PREVENTION Step 7).
 *
 * - **Contract value** sums every contract, draft and terminated ones included, and what is paid
 *   on them is `budget_realized` — the trigger-kept cache of payments. The Director dashboard
 *   counts active and completed contracts only, and `contractRollup.committedAmount` counts a
 *   terminated contract at what was paid (SUP-18).
 * - **A milestone is settled once it is `paid`.** The payment trigger sets `completed` on a
 *   *partial* payment, so `completed` is not done (GEN-2, `dashboards/utils/directorAlerts.ts`).
 * - **Recent work logs** are today and the six days before, in local days.
 */

const num = (value: unknown): number => Number(value || 0)

/** A `contracts` row, narrowed to what these figures read. */
export interface ContractRow {
  status?: string | null
  contract_amount?: number | string | null
  budget_realized?: number | string | null
  contract_types?: { name?: string | null } | null
}

export interface ContractTotals {
  count: number
  active: number
  completed: number
  /** Σ `contract_amount`, every status. */
  value: number
  /** Σ `budget_realized`. */
  realized: number
  /** Realized as a percentage of value; 0 with no value (GEN-32). Not capped at 100. */
  utilization: number
}

export function contractTotals(contracts: readonly ContractRow[]): ContractTotals {
  const value = contracts.reduce((sum, c) => sum + num(c.contract_amount), 0)
  const realized = contracts.reduce((sum, c) => sum + num(c.budget_realized), 0)
  return {
    count: contracts.length,
    active: contracts.filter(c => c.status === 'active').length,
    completed: contracts.filter(c => c.status === 'completed').length,
    value,
    realized,
    utilization: value > 0 ? (realized / value) * 100 : 0,
  }
}

/** Contracts per type name, in first-seen order; a contract with no type counts under `''`. */
export function contractTypeCounts(contracts: readonly ContractRow[]): { name: string; count: number }[] {
  const counts = new Map<string, number>()
  for (const contract of contracts) {
    const name = contract.contract_types?.name || ''
    counts.set(name, (counts.get(name) ?? 0) + 1)
  }
  return [...counts].map(([name, count]) => ({ name, count }))
}

/** Phases (project or retail) whose status is `completed`. */
export const completedPhaseCount = (phases: readonly { status?: string | null }[]): number =>
  phases.filter(phase => phase.status === 'completed').length

/** Completed phases as a percentage of all of them; 0 with none. */
export const phaseCompletionRate = (completed: number, total: number): number => (total > 0 ? (completed / total) * 100 : 0)

/** A milestone is finished, for alerting and counting, only once it is fully paid. */
export const isSettledMilestone = (status: string | null | undefined): boolean => status === 'paid'

/** Work logs dated today or in the six days before, in local days. A log with no date is not counted. */
export const recentWorkLogCount = (
  logs: readonly { date?: string | null }[],
  daysFrom: (date: string | null | undefined) => number = daysFromToday,
): number =>
  logs.filter(log => {
    const days = daysFrom(log.date)
    return days <= 0 && days >= -6 // NaN (no date) fails both
  }).length
