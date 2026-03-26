import { useState } from 'react'

export function useLazySection<T>(fetcher: () => Promise<T[]>) {
  const [expanded, setExpanded] = useState(false)
  const [loading,  setLoading]  = useState(false)
  const [fetched,  setFetched]  = useState(false)
  const [items,    setItems]    = useState<T[]>([])

  const toggle = () => {
    if (!expanded && !fetched) {
      setLoading(true)
      fetcher()
        .then(setItems)
        .catch(console.error)
        .finally(() => { setLoading(false); setFetched(true) })
    }
    setExpanded(v => !v)
  }

  return { expanded, loading, fetched, items, toggle }
}
