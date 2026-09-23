/**
 * Shared result handling for the apartment and garage Excel imports.
 *
 * Both modals used to show a green "Import complete!" whatever happened, so a file whose rows
 * all failed looked like a success. The outcome is classified here, once, and the step-3 screen
 * picks its icon and headline from it.
 */

export type ImportOutcome = 'nothing_imported' | 'partial' | 'success'

/** How many row errors step 3 lists before collapsing the rest into "and N more". */
export const MAX_LISTED_IMPORT_ERRORS = 10

export function classifyImportOutcome(succeeded: number, failed: number): ImportOutcome {
  if (succeeded <= 0) return 'nothing_imported'
  if (failed > 0) return 'partial'
  return 'success'
}

/**
 * Human-readable message from anything a row import can throw. Supabase hands back its errors
 * as plain `{ message, code, ... }` objects rather than `Error` instances, which `String()`
 * would render as "[object Object]".
 */
export function importErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  if (typeof error === 'object' && error !== null && 'message' in error) {
    const { message } = error as { message: unknown }
    if (typeof message === 'string' && message) return message
  }
  return String(error)
}
