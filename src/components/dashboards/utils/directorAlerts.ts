/**
 * Pure derivation behind the Director dashboard's payment-milestone counters and its alert
 * panel. No i18n and no formatting here: an alert carries a `kind` and its parameters, and
 * `DirectorAlertsSection` turns that into translated text.
 *
 * Two things this module fixes:
 *
 * 1. **The milestone filter was backwards.** `subcontractor_milestones.status` is
 *    `pending | completed | paid` (`baseline_schema.sql:4007`) and a trigger sets `paid` when
 *    the milestone is fully paid but `completed` when it is only **partly** paid. The old
 *    `status !== 'completed'` test therefore counted fully *paid* milestones as overdue and
 *    skipped the part-paid ones that actually still owe money. Settled means `paid`.
 * 2. **The alerts were English strings built in the service** and rendered raw.
 */

/** A milestone is finished, for alerting purposes, only once it is fully paid. */
export const isSettledMilestone = (status: string | null | undefined): boolean => status === 'paid'

export interface MilestoneLike {
  milestone_name?: string | null
  due_date: string | null
  status: string | null
}

export interface CreditLike {
  credit_name: string | null
  maturity_date: string | null
  amount: number | null
  company?: { name: string } | null
}

export type AlertKind =
  | 'overdue_milestone'
  | 'urgent_deadline'
  | 'credit_maturity'
  | 'high_leverage'
  | 'low_sales_rate'

export interface DerivedAlert {
  type: 'critical' | 'warning' | 'info'
  kind: AlertKind
  /**
   * Interpolation values for the alert's message; the section formats money and picks the
   * plural form. `count` is i18next's plural selector, and is always a whole day count here.
   */
  params?: Record<string, string | number>
  date?: string
}

/** Days-from-today, injected so the derivation stays pure and testable. */
export type DaysFromToday = (value: string | null | undefined) => number

export interface AlertInputs {
  milestones: MilestoneLike[]
  /** Already filtered to live debt by the caller — equity and settled facilities are out. */
  liveDebtCredits: CreditLike[]
  debtToEquityRatio: number
  salesRate: number
  totalUnits: number
}

/** Payment milestones past their due date that have not been paid in full. */
export function countOverdueMilestones(milestones: MilestoneLike[], daysFromToday: DaysFromToday): number {
  return milestones.filter(m => !!m.due_date && !isSettledMilestone(m.status) && daysFromToday(m.due_date) < 0).length
}

/** Unpaid payment milestones falling due within the next 7 days (today counts). */
export function countCriticalDeadlines(milestones: MilestoneLike[], daysFromToday: DaysFromToday): number {
  return milestones.filter(m => {
    if (!m.due_date || isSettledMilestone(m.status)) return false
    const daysUntil = daysFromToday(m.due_date)
    return daysUntil >= 0 && daysUntil <= 7
  }).length
}

/**
 * Severity/ordering is unchanged from the original: milestones first (critical before
 * warning as they are met), then credit maturities, then the two portfolio-level notes,
 * capped at 10.
 */
export function deriveAlerts(inputs: AlertInputs, daysFromToday: DaysFromToday): DerivedAlert[] {
  const alerts: DerivedAlert[] = []

  for (const milestone of inputs.milestones) {
    if (!milestone.due_date || isSettledMilestone(milestone.status)) continue
    const daysUntil = daysFromToday(milestone.due_date)
    if (daysUntil < 0) {
      alerts.push({
        type: 'critical',
        kind: 'overdue_milestone',
        params: { name: milestone.milestone_name || '', count: Math.abs(daysUntil) },
        date: milestone.due_date
      })
    } else if (daysUntil <= 3) {
      alerts.push({
        type: 'warning',
        kind: 'urgent_deadline',
        params: { name: milestone.milestone_name || '', count: daysUntil },
        date: milestone.due_date
      })
    }
  }

  for (const credit of inputs.liveDebtCredits) {
    if (!credit.maturity_date) continue
    const daysUntil = daysFromToday(credit.maturity_date)
    if (daysUntil >= 0 && daysUntil <= 30) {
      alerts.push({
        type: 'warning',
        kind: 'credit_maturity',
        params: {
          name: credit.credit_name || credit.company?.name || '',
          amount: Number(credit.amount || 0),
          count: daysUntil
        },
        date: credit.maturity_date
      })
    }
  }

  if (inputs.debtToEquityRatio > 2) {
    alerts.push({
      type: 'warning',
      kind: 'high_leverage',
      params: { ratio: inputs.debtToEquityRatio.toFixed(2) }
    })
  }

  if (inputs.salesRate < 30 && inputs.totalUnits > 0) {
    alerts.push({
      type: 'info',
      kind: 'low_sales_rate',
      params: { rate: inputs.salesRate.toFixed(1) }
    })
  }

  return alerts.slice(0, 10)
}
