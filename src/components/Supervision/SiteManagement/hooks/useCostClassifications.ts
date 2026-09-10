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

  const load = useCallback(async () => {
    try {
      setLoading(true)
      const data = await fetchCostClassifications(includeInactive)
      setClassifications(data)
    } catch (error) {
      console.error('Error loading cost classifications:', error)
    } finally {
      setLoading(false)
    }
  }, [includeInactive])

  return { classifications, loading, load }
}
