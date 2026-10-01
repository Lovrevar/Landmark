import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
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
  /** Re-runs both loads. Every EVM figure on this screen comes from them. */
  refetch: () => void
}

export function useBudgetControl(): UseBudgetControlReturn {
  const { t } = useTranslation()
  const [projects, setProjects] = useState<ProjectDisplay[]>([])
  const [selectedProjectId, setSelectedProjectId] = useState<string>('')
  const [data, setData] = useState<BudgetControlData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)

  const refetch = useCallback(() => setReloadKey(k => k + 1), [])

  useEffect(() => {
    async function loadProjects() {
      try {
        setError(null)
        const list = await fetchProjectsList()
        setProjects(list)
        if (list.length > 0) {
          setSelectedProjectId(prev => prev || list[0].id)
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : t('common.projects_load_error'))
      }
    }
    loadProjects()
  }, [reloadKey, t])

  useEffect(() => {
    if (!selectedProjectId) return

    async function loadProjectData() {
      setLoading(true)
      setError(null)
      try {
        const { project, phases, contracts, milestones, ticTotal } = await fetchProjectBudgetData(selectedProjectId)

        const plannedBudget = phases.reduce((sum, p) => sum + Number(p.budget_allocated || 0), 0)
        const committed = contracts.reduce((sum, c) => sum + Number(c.contract_amount || 0), 0)
        const paid = contracts.reduce((sum, c) => sum + Number(c.budget_realized || 0), 0)

        const totalCommitted = committed
        const completionPct = totalCommitted > 0 ? Math.min(100, (paid / totalCommitted) * 100) : 0

        const metrics = calculateProjectEVM(phases, contracts, milestones)

        setData({
          // The real TIC when the project has one; the stored budget only as a fallback, so a
          // project with no TIC still shows a figure rather than a bare zero.
          tic: ticTotal ?? Number(project.budget || 0),
          plannedBudget,
          committed,
          paid,
          completionPct,
          metrics,
        })
      } catch (err) {
        setError(err instanceof Error ? err.message : t('budget_control.errors.load_data_failed'))
        // Dropped rather than left standing: these are one project's EVM figures, and keeping
        // them would attribute them to whichever project the selector now names.
        setData(null)
      } finally {
        setLoading(false)
      }
    }

    loadProjectData()
  }, [selectedProjectId, reloadKey, t])

  return { projects, selectedProjectId, setSelectedProjectId, data, loading, error, refetch }
}
