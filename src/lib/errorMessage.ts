/**
 * Turning a rejected promise into something worth showing a user.
 *
 * Supabase rejects with `{ code, message, details, hint }`, services throw plain `Error`s with
 * text already written for people ("Ne možete obrisati faze koje imaju ugovore: …"), and the
 * network throws its own. `toErrorMessage` prefers a message that was written to be read and
 * falls back to the caller's translated key, so a toast never says "[object Object]" and never
 * swallows a specific reason in favour of a generic one.
 */

/** Postgres: insufficient_privilege. An RLS policy refused the row. */
const PERMISSION_DENIED = '42501'

type Postgresish = { code?: string; message?: string } | null | undefined

export function isPermissionError(error: unknown): boolean {
  return (error as Postgresish)?.code === PERMISSION_DENIED
}

/**
 * A raw Postgres message ("new row violates row-level security policy for table …") tells the
 * user nothing they can act on, so anything that looks like machine text is rejected in favour
 * of the caller's fallback.
 */
function isReadable(message: string): boolean {
  if (!message.trim()) return false
  // A bare code, e.g. "PGRST301" or "NO_ROWS" — no spaces, no lower case.
  if (/^[A-Z0-9_]+$/.test(message)) return false
  return !/violates|constraint|syntax error|JWT|relation ".*" does not exist|duplicate key value/i.test(message)
}

/**
 * @param error    whatever was caught
 * @param fallback an already-translated sentence to use when the error has nothing readable
 */
export function toErrorMessage(error: unknown, fallback: string): string {
  if (isPermissionError(error)) return fallback
  const message = error instanceof Error ? error.message : (error as Postgresish)?.message
  return message && isReadable(message) ? message : fallback
}
