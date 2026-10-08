/**
 * Deadline tests for the Supervision dashboard.
 *
 * "No deadline" is `null`. It used to be the number 999, which every comparison had to remember
 * to stay clear of (GEN-15) — and `null <= 7` is true in JavaScript, so the tests live here, once,
 * rather than as bare comparisons in each component.
 */
interface Deadline {
  days_until_deadline: number | null
  progress: number
}

/** Seven days or fewer to go, or already past, with work still open. Drives the amber styling. */
export const isDeadlineNear = (item: Deadline): boolean =>
  item.days_until_deadline !== null && item.days_until_deadline <= 7 && item.progress < 100

/** Due within the coming week and not yet late — the "critical deadlines" count and list. */
export const isDueThisWeek = (item: Deadline): boolean =>
  isDeadlineNear(item) && (item.days_until_deadline as number) >= 0
