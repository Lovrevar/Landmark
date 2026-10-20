/**
 * Postgres error-code helpers for Supabase mutations.
 *
 * Supabase surfaces Postgres errors as `{ code, message, details, hint }`, so the SQLSTATE
 * is available on the client. Prefer the code; fall back to the message text for errors that
 * reach us wrapped (e.g. via an RPC) and lose the code.
 */

export function isForeignKeyViolation(error: unknown): boolean {
  const e = error as { code?: string; message?: string } | null
  if (!e) return false
  return e.code === '23503' || (e.message ?? '').includes('violates foreign key constraint')
}

/**
 * A unique constraint or unique index refused the row (SQLSTATE 23505) — a unit number already
 * used in the building, a building name already used in the project. `toErrorMessage` hides the
 * constraint text behind the caller's generic fallback, so a caller that can say something more
 * useful ("that number is taken") tests for this first.
 */
export function isUniqueViolation(error: unknown): boolean {
  const e = error as { code?: string; message?: string } | null
  if (!e) return false
  return e.code === '23505' || (e.message ?? '').includes('duplicate key value violates unique constraint')
}

/**
 * RLS filters an UPDATE or DELETE down to zero rows without raising an error, so a write that
 * must hit a row selects it back (`.select('id')`) and passes the result here. Zero rows becomes
 * a permission error (SQLSTATE 42501), which `toErrorMessage` turns into the caller's fallback
 * and `isPermissionError` recognises — instead of a success toast and an activity-log entry for
 * a change that never happened.
 */
export function assertRowsAffected(rows: readonly unknown[] | null | undefined): void {
  if (rows && rows.length > 0) return
  throw Object.assign(new Error('NO_ROWS_AFFECTED'), { code: '42501' })
}
