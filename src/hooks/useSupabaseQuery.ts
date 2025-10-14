import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'

interface QueryOptions {
  enabled?: boolean
  refetchInterval?: number
}

export function useSupabaseQuery<T>(
  queryFn: () => Promise<{ data: T | null; error: any }>,
  dependencies: any[] = [],
  options: QueryOptions = {}
) {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<any>(null)

  const { enabled = true, refetchInterval } = options

  const fetchData = useCallback(async () => {
    if (!enabled) return

    setLoading(true)
    setError(null)

    try {
      const result = await queryFn()
      if (result.error) throw result.error
      setData(result.data)
    } catch (err) {
      console.error('Query error:', err)
      setError(err)
    } finally {
      setLoading(false)
    }
  }, [enabled, ...dependencies])

  useEffect(() => {
    fetchData()

    if (refetchInterval) {
      const interval = setInterval(fetchData, refetchInterval)
      return () => clearInterval(interval)
    }
  }, [fetchData, refetchInterval])

  return { data, loading, error, refetch: fetchData }
}
