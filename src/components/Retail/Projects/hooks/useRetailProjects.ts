import { useState, useEffect, useCallback } from 'react'
import { retailProjectService } from '../services/retailProjectService'
import type { RetailProjectWithPhases } from '../../../../types/retail'

export const useRetailProjects = () => {
  const [projects, setProjects] = useState<RetailProjectWithPhases[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchProjects = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const data = await retailProjectService.fetchProjects()
      setProjects(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch projects')
      console.error('Error fetching retail projects:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchProjects()
  }, [fetchProjects])

  return {
    projects,
    loading,
    error,
    refetch: fetchProjects
  }
}
