/**
 * Coercing a caught load failure into the `Error | null` every Cashflow hook exposes.
 *
 * Supabase rejects with a plain `{ code, message, details, hint }` object rather than an
 * `Error`, so the usual `new Error(String(err))` turns a perfectly good message into
 * "[object Object]" — which `toErrorMessage` would then happily show a user. This keeps the
 * message and the SQLSTATE, so `toErrorMessage` / `isPermissionError` still work downstream.
 */
export function toLoadError(error: unknown): Error {
  if (error instanceof Error) return error
  const source = error as { message?: string; code?: string } | null | undefined
  // 'LOAD_FAILED' rather than a sentence: `isReadable` in lib/errorMessage rejects a bare
  // SCREAMING_CASE token, so a failure with no message of its own falls through to the caller's
  // *translated* fallback instead of showing an English "Load failed" in a Croatian UI. The
  // console still gets something to grep for.
  const err = new Error(source?.message || 'LOAD_FAILED') as Error & { code?: string }
  if (source?.code) err.code = source.code
  return err
}
