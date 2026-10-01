import { useState, useCallback } from 'react'
import { retailProjectService } from '../services/retailProjectService'
import type { RetailProjectWithPhases, RetailContract } from '../../../../types/retail'

export function useProjectDetail(projectId: string) {
  const [project, setProject] = useState<RetailProjectWithPhases | null>(null)
  const [contractsMap, setContractsMap] = useState<Record<string, RetailContract[]>>({})
  const [loading, setLoading] = useState(false)
  // Phases, their contracts and the statistics all hang off this one load; a failure used
  // to render the project as if it had no phases at all.
  const [error, setError] = useState<Error | null>(null)

  const refetch = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const data = await retailProjectService.fetchProjectById(projectId)
      if (data) {
        setProject(data)

        const phaseIds = data.phases.map(p => p.id)
        const contractsByPhase = await retailProjectService.fetchContractsByPhases(phaseIds)
        const map: Record<string, RetailContract[]> = {}
        for (const [phaseId, contracts] of contractsByPhase) {
          map[phaseId] = contracts
        }
        setContractsMap(map)
      }
    } catch (err) {
      console.error('Error loading project details:', err)
      setError(err instanceof Error ? err : new Error(String(err)))
    } finally {
      setLoading(false)
    }
  }, [projectId])

  const dismissError = useCallback(() => setError(null), [])

  return { project, contractsMap, loading, error, dismissError, refetch }
}
