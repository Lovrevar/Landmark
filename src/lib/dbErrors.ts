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
