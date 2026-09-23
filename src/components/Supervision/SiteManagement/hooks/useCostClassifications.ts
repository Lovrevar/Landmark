import { useState, useCallback } from 'react'
import { CostClassification } from '../types'
import { fetchCostClassifications } from '../services/costClassificationService'

/**
 * Classifications are global, not per project, so this is loaded once at the SiteManagement
 * root and passed down rather than duplicated onto every ProjectWithPhases.
 */
export const useCostClassifications = (includeInactive = false) => {
  const [classifications, setClassifications] = useState<CostClassification[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const load = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const data = await fetchCostClassifications(includeInactive)
      setClassifications(data)
    } catch (err) {
      console.error('Error loading cost classifications:', err)
      // Without the list every contract reads as unclassified and the classification dropdown is
      // empty — indistinguishable from a database with no classifications in it.
      setError(err instanceof Error ? err : new Error(String(err)))
    } finally {
      setLoading(false)
    }
  }, [includeInactive])

  return { classifications, loading, error, load, refetch: load }
}
