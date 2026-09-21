import { formatEuroRounded } from '../../utils/formatters'
import { PROJECT_STATUS, statusVariant, type StatusVariant } from '../../utils/statusDisplay'

/** Retail's whole-euro renderer. Delegates so the € leads, as it does everywhere else. */
export const formatCurrency = formatEuroRounded

/**
 * Badge colour for `retail_projects.status`.
 *
 * Delegates to the shared `PROJECT_STATUS` map so a retail project reads the same as a General
 * or Sales one. This used to carry its own table, with "Planning" yellow and "On Hold" grey —
 * the inverse of everywhere else. Pair it with `statusLabel(PROJECT_STATUS, …)` for the text:
 * the stored value is English and must never be translated where it is compared or written.
 */
export const getStatusBadgeVariant = (status: string): StatusVariant =>
  statusVariant(PROJECT_STATUS, status)
