import { useState } from 'react'

/**
 * Collapsed-by-default section that loads its rows the first time it is opened.
 *
 * The failure case is the point: the old version did `.catch(console.error)` and then set
 * `fetched` in `finally`, while `toggle` only fetched when `!fetched`. A dropped request was
 * therefore cached as success for the life of the component — the header read "(0)" and the
 * body showed the section's "nothing here" message, with no way to retry. `error` and `retry`
 * exist so the consumer can say so instead.
 */
export function useLazySection<T>(fetcher: () => Promise<T[]>) {
  const [expanded, setExpanded] = useState(false)
  const [loading,  setLoading]  = useState(false)
  const [fetched,  setFetched]  = useState(false)
  const [error,    setError]    = useState<Error | null>(null)
  const [items,    setItems]    = useState<T[]>([])

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      setItems(await fetcher())
      setFetched(true)
    } catch (err) {
      // Not `fetched`: a retry has to be allowed to run.
      setError(err instanceof Error ? err : new Error(String(err)))
      setItems([])
    } finally {
      setLoading(false)
    }
  }

  const toggle = () => {
    if (!expanded && !fetched && !loading) void load()
    setExpanded(v => !v)
  }

  const retry = () => { void load() }

  return { expanded, loading, fetched, error, items, toggle, retry }
}
