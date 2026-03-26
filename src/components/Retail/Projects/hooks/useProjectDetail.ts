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

        const map: Record<string, RetailContract[]> = {}
        await Promise.all(
          data.phases.map(async (phase) => {
            const contracts = await retailProjectService.fetchContractsByPhase(phase.id)
            map[phase.id] = contracts
          })
        )
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
