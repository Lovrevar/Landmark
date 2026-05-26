import { useState, useCallback } from 'react'
import { SubcontractorSummary } from '../types'
import {
  fetchSubcontractorsWithSummary,
  deleteSubcontractor as deleteSubcontractorService,
} from '../services/subcontractorService'

export const useSubcontractorData = () => {
  const [subcontractors, setSubcontractors] = useState<Map<string, SubcontractorSummary>>(new Map())
  const [loading, setLoading] = useState(true)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const grouped = await fetchSubcontractorsWithSummary()
      setSubcontractors(grouped)
    } catch (error) {
      console.error('Error fetching subcontractors:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  const deleteSubcontractor = async (id: string): Promise<void> => {
    await deleteSubcontractorService(id)
  }

  return { subcontractors, loading, fetchData, deleteSubcontractor }
}
