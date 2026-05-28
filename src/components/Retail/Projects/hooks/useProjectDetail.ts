import { useState, useCallback } from 'react'
import { retailProjectService } from '../services/retailProjectService'
import type { RetailProjectWithPhases, RetailContract } from '../../../../types/retail'

export function useProjectDetail(projectId: string) {
  const [project, setProject] = useState<RetailProjectWithPhases | null>(null)
  const [contractsMap, setContractsMap] = useState<Record<string, RetailContract[]>>({})
  const [loading, setLoading] = useState(false)

  const refetch = useCallback(async () => {
    try {
      setLoading(true)
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
    } catch (error) {
      console.error('Error loading project details:', error)
    } finally {
      setLoading(false)
    }
  }, [projectId])

  return { project, contractsMap, loading, refetch }
}
