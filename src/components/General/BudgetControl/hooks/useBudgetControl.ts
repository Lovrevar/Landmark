import { useState, useEffect } from 'react'
import { calculateProjectEVM } from '../../../../utils/evm'
import type { EVMMetrics } from '../../../../utils/evm'
import type { ProjectDisplay } from '../../Projects/types'
import { fetchProjectsList, fetchProjectBudgetData } from '../services/budgetControlService'

export interface BudgetControlData {
  tic: number
  plannedBudget: number
  committed: number
  paid: number
  completionPct: number
  metrics: EVMMetrics
}

interface UseBudgetControlReturn {
  projects: ProjectDisplay[]
  selectedProjectId: string
  setSelectedProjectId: (id: string) => void
  data: BudgetControlData | null
  loading: boolean
  error: string | null
}

export function useBudgetControl(): UseBudgetControlReturn {
  const [projects, setProjects] = useState<ProjectDisplay[]>([])
  const [selectedProjectId, setSelectedProjectId] = useState<string>('')
  const [data, setData] = useState<BudgetControlData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function loadProjects() {
      try {
        const list = await fetchProjectsList()
        setProjects(list)
        if (list.length > 0) {
          setSelectedProjectId(list[0].id)
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load projects')
      }
    }
    loadProjects()
  }, [])

  useEffect(() => {
    if (!selectedProjectId) return

    async function loadProjectData() {
      setLoading(true)
      setError(null)
      try {
        const { project, phases, contracts, milestones } = await fetchProjectBudgetData(selectedProjectId)

        const plannedBudget = phases.reduce((sum, p) => sum + Number(p.budget_allocated || 0), 0)
        const committed = contracts.reduce((sum, c) => sum + Number(c.contract_amount || 0), 0)
        const paid = contracts.reduce((sum, c) => sum + Number(c.budget_realized || 0), 0)

        const totalCommitted = committed
        const completionPct = totalCommitted > 0 ? Math.min(100, (paid / totalCommitted) * 100) : 0

        const metrics = calculateProjectEVM(phases, contracts, milestones)

        setData({
          tic: Number(project.budget || 0),
          plannedBudget,
          committed,
          paid,
          completionPct,
          metrics,
        })
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load data')
      } finally {
        setLoading(false)
      }
    }

    loadProjectData()
  }, [selectedProjectId])

  return { projects, selectedProjectId, setSelectedProjectId, data, loading, error }
}
