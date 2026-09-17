/**
 * What a bulk price update actually did.
 *
 * The old service threw `new Error('Failed to update N units')`, which the page turned into a
 * generic toast and — because it threw — skipped the refetch, so units whose price *had*
 * changed kept showing the old figure. Reporting is therefore a value, not an exception.
 *
 * `selected` is what the user ticked; `updated` counts rows the database confirmed. The two
 * differ legitimately: sold units are excluded by design (both in the pre-fetch and in each
 * update's `.neq('status', 'Sold')`), so `updated < selected` on its own is not a failure.
 * Only `failed > 0` is.
 */
export interface BulkPriceUpdateResult {
  /** How many units the user had selected when they submitted. */
  selected: number
  /** Rows the database reported as written. */
  updated: number
  /** Update statements that came back with an error. */
  failed: number
}

/** One update's outcome, as postgrest-js returns it. */
export interface BulkUpdateOutcome {
  error: unknown
  data: unknown[] | null
}

/**
 * Folds the per-row outcomes into one report. Pure, so the counting rules are testable
 * without a database.
 */
export function summarizeBulkPriceUpdate(
  selected: number,
  outcomes: BulkUpdateOutcome[],
): BulkPriceUpdateResult {
  let updated = 0
  let failed = 0
  for (const outcome of outcomes) {
    if (outcome.error) {
      failed++
      continue
    }
    updated += outcome.data?.length ?? 0
  }
  return { selected, updated, failed }
}
