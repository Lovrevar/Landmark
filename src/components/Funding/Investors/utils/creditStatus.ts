/**
 * The one renderer for `bank_credits.status`.
 *
 * The column's CHECK allows exactly three values — `active | paid | defaulted`
 * (`bank_credits_status_check`, baseline_schema.sql:2814). Every screen that showed a credit
 * status had invented its own map around `'active' | 'pending' | 'closed'`, so a **defaulted**
 * credit fell through to a calm blue "default" badge while the pending/closed branches could
 * never run. The raw enum was printed as the label, in English, in a Croatian UI.
 *
 * Pure and unit-tested (`creditStatus.test.ts`). Kept out of `creditCalculations.ts` (financial
 * maths) on purpose: this is display mapping, not arithmetic.
 */

export type CreditStatusVariant = 'green' | 'gray' | 'red'

export interface CreditStatusDisplay {
  /** i18n key for the badge label. */
  labelKey: string
  /** Badge variant: active green, fully repaid gray, defaulted red. */
  variant: CreditStatusVariant
}

export const CREDIT_STATUS_DISPLAY: Readonly<Record<string, CreditStatusDisplay>> = {
  active: { labelKey: 'funding.credit_status.active', variant: 'green' },
  paid: { labelKey: 'funding.credit_status.paid', variant: 'gray' },
  defaulted: { labelKey: 'funding.credit_status.defaulted', variant: 'red' },
}

/**
 * Display mapping for a stored status, or `null` for a value the database cannot hold.
 * Callers fall back to showing the raw value in a neutral badge rather than hiding it —
 * an unexpected status is worth seeing, but it must not borrow "active" green.
 */
export function getCreditStatusDisplay(status: string | null | undefined): CreditStatusDisplay | null {
  if (!status) return null
  return CREDIT_STATUS_DISPLAY[status] ?? null
}

/** Badge variant for a status; neutral gray for anything unrecognised. */
export function getCreditStatusVariant(status: string | null | undefined): CreditStatusVariant {
  return getCreditStatusDisplay(status)?.variant ?? 'gray'
}
