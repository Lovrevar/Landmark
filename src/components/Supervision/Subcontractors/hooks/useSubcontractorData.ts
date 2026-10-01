import { useState, useCallback } from 'react'
import { SubcontractorSummary } from '../types'
import {
  fetchSubcontractorsWithSummary,
  deleteSubcontractor as deleteSubcontractorService,
} from '../services/subcontractorService'

export const useSubcontractorData = () => {
  const [subcontractors, setSubcontractors] = useState<Map<string, SubcontractorSummary>>(new Map())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const grouped = await fetchSubcontractorsWithSummary()
      setSubcontractors(grouped)
    } catch (err) {
      console.error('Error fetching subcontractors:', err)
      // The page's four stat cards are summed from this map; leaving it empty reported €0 paid
      // and €0 outstanding across every subcontractor in the company.
      setError(err instanceof Error ? err : new Error(String(err)))
    } finally {
      setLoading(false)
    }
  }, [])

  const deleteSubcontractor = async (id: string): Promise<void> => {
    await deleteSubcontractorService(id)
  }

  return { subcontractors, loading, error, fetchData, refetch: fetchData, deleteSubcontractor }
}
