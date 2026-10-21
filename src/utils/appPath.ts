// Any fixed origin will do: only whether the address keeps it matters.
const BASE = 'https://app.invalid'

/**
 * Whether a link or image address from markdown is one of the app's own paths.
 *
 * Resolved with the URL parser rather than matched on characters: browsers read `/\host` and
 * `/<tab>/host` as `//host`, another site, and a `startsWith('//')` check misses both (SEC-A13).
 */
export function isAppPath(url: string | undefined): url is string {
  if (!url?.startsWith('/')) return false
  try {
    return new URL(url, BASE).origin === BASE
  } catch {
    return false
  }
}
