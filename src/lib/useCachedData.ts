import { useState, useEffect, useRef, useCallback } from 'react'

/**
 * Lightweight in-memory data cache + React hook.
 *
 * Motivation: most reports/dashboards in this app fire many parallel Supabase
 * queries and aggregate heavily on the client, with no caching — so every page
 * open (and every profile switch that re-mounts a dashboard) repeats the full
 * cost. This hook serves a recent result instantly from memory when one exists.
 *
 * Scope: the cache is module-level, so it survives component unmount/remount
 * (navigating away and back) within a session, but is cleared on a full page
 * reload. It is shared across all consumers and keyed by a caller-provided
 * string — encode any parameters (project id, date range, profile) into the key.
 */

const DEFAULT_TTL_MS = 5 * 60 * 1000 // 5 minutes

interface CacheEntry<T> {
  data: T
  fetchedAt: number
}

const store = new Map<string, CacheEntry<unknown>>()

/**
 * Drop cached entries. With no argument, clears everything. With a predicate,
 * removes only the keys it matches — useful after a mutation, e.g.
 * `invalidateCachedData(k => k.startsWith('dashboard:'))`.
 */
export function invalidateCachedData(predicate?: (key: string) => boolean): void {
  if (!predicate) {
    store.clear()
    return
  }
  for (const key of Array.from(store.keys())) {
    if (predicate(key)) store.delete(key)
  }
}

interface UseCachedDataOptions {
  /** Freshness window in ms. Defaults to 5 minutes. */
  ttlMs?: number
  /** When false, the fetch is skipped (e.g. waiting on a required param). */
  enabled?: boolean
}

interface UseCachedDataResult<T> {
  data: T | null
  loading: boolean
  /** The error from the last failed fetch, or null. Lets callers distinguish a
   *  genuine empty result from a load failure (which must not render as zeros). */
  error: Error | null
  /** Epoch ms of when the currently-shown data was fetched, or null. */
  fetchedAt: number | null
  /** Force a fresh fetch, bypassing (and refreshing) the cache. */
  refetch: () => void
}

export function useCachedData<T>(
  key: string,
  fetcher: () => Promise<T>,
  options: UseCachedDataOptions = {}
): UseCachedDataResult<T> {
  const { ttlMs = DEFAULT_TTL_MS, enabled = true } = options

  // Keep the latest fetcher without making it a dependency — callers almost
  // always pass an inline closure whose identity changes every render.
  const fetcherRef = useRef(fetcher)
  fetcherRef.current = fetcher

  const readFresh = useCallback((): CacheEntry<T> | null => {
    const entry = store.get(key) as CacheEntry<T> | undefined
    if (entry && Date.now() - entry.fetchedAt < ttlMs) return entry
    return null
  }, [key, ttlMs])

  const initial = enabled ? readFresh() : null
  const [data, setData] = useState<T | null>(initial?.data ?? null)
  const [fetchedAt, setFetchedAt] = useState<number | null>(initial?.fetchedAt ?? null)
  const [loading, setLoading] = useState(enabled && initial === null)
  const [error, setError] = useState<Error | null>(null)

  const load = useCallback(async (force: boolean) => {
    if (!enabled) return
    if (!force) {
      const fresh = readFresh()
      if (fresh) {
        setData(fresh.data)
        setFetchedAt(fresh.fetchedAt)
        setError(null)
        setLoading(false)
        return
      }
    }
    setLoading(true)
    try {
      const result = await fetcherRef.current()
      const entry: CacheEntry<T> = { data: result, fetchedAt: Date.now() }
      store.set(key, entry)
      setData(result)
      setFetchedAt(entry.fetchedAt)
      setError(null)
    } catch (err) {
      // Surface the failure instead of silently leaving stale/empty data —
      // a financial dashboard must never render a load error as legitimate zeros.
      console.error(`[useCachedData] fetch failed for "${key}":`, err)
      setError(err instanceof Error ? err : new Error(String(err)))
    } finally {
      setLoading(false)
    }
  }, [key, enabled, readFresh])

  useEffect(() => {
    load(false)
  }, [load])

  return { data, loading, error, fetchedAt, refetch: () => load(true) }
}
