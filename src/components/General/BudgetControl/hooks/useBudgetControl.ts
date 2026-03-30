import { useState, useEffect } from 'react'
import { supabase } from '../../../../lib/supabase'
import { calculateProjectEVM } from '../../../../utils/evm'
import type { EVMMetrics } from '../../../../utils/evm'
import type { Phase, ContractWithDetails, ProjectDisplay } from '../../Projects/types'

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
    async function fetchProjects() {
      const { data: projectsData, error: projectsError } = await supabase
        .from('projects')
        .select('*')
        .order('name', { ascending: true })
      if (projectsError) {
        setError(projectsError.message)
        return
      }
      const list = (projectsData || []) as unknown as ProjectDisplay[]
      setProjects(list)
      if (list.length > 0) {
        setSelectedProjectId(list[0].id)
      }
    }
    fetchProjects()
  }, [])

  useEffect(() => {
    if (!selectedProjectId) return

    async function fetchProjectData() {
      setLoading(true)
      setError(null)
      try {
        const { data: projectData, error: projectError } = await supabase
          .from('projects')
          .select('*')
          .eq('id', selectedProjectId)
          .single()
        if (projectError) throw projectError

        const { data: phasesData } = await supabase
          .from('project_phases')
          .select('*')
          .eq('project_id', selectedProjectId)
          .order('phase_number', { ascending: true })

        const { data: contractsData } = await supabase
          .from('contracts')
          .select(`
            *,
            subcontractor:subcontractors!contracts_subcontractor_id_fkey(id, name, contact),
            phase:project_phases!contracts_phase_id_fkey(phase_name)
          `)
          .eq('project_id', selectedProjectId)
          .in('status', ['draft', 'active'])

        const phases = (phasesData || []) as unknown as Phase[]
        const contracts = (contractsData || []) as unknown as ContractWithDetails[]

        const plannedBudget = phases.reduce((sum, p) => sum + Number(p.budget_allocated || 0), 0)
        const committed = contracts.reduce((sum, c) => sum + Number(c.contract_amount || 0), 0)
        const paid = contracts.reduce((sum, c) => sum + Number(c.budget_realized || 0), 0)

        const totalCommitted = committed
        const completionPct = totalCommitted > 0 ? Math.min(100, (paid / totalCommitted) * 100) : 0

        const metrics = calculateProjectEVM(phases, contracts)

        setData({
          tic: Number((projectData as unknown as ProjectDisplay).budget || 0),
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

    fetchProjectData()
  }, [selectedProjectId])

  return { projects, selectedProjectId, setSelectedProjectId, data, loading, error }
}
