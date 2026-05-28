import { supabase } from '../../../../lib/supabase'
import type { Phase, ContractWithDetails, ProjectDisplay } from '../../Projects/types'
import type { MilestoneProgress } from '../../../../utils/evm'

export async function fetchProjectsList(): Promise<ProjectDisplay[]> {
  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .order('name', { ascending: true })

  if (error) throw error
  return (data || []) as unknown as ProjectDisplay[]
}

export interface ProjectBudgetData {
  project: ProjectDisplay
  phases: Phase[]
  contracts: ContractWithDetails[]
  milestones: MilestoneProgress[]
}

export async function fetchProjectBudgetData(projectId: string): Promise<ProjectBudgetData> {
  const { data: projectData, error: projectError } = await supabase
    .from('projects')
    .select('*')
    .eq('id', projectId)
    .single()
  if (projectError) throw projectError

  const { data: phasesData } = await supabase
    .from('project_phases')
    .select('*')
    .eq('project_id', projectId)
    .order('phase_number', { ascending: true })

  const { data: contractsData } = await supabase
    .from('contracts')
    .select(`
      *,
      subcontractor:subcontractors!contracts_subcontractor_id_fkey(id, name, contact),
      phase:project_phases!contracts_phase_id_fkey(phase_name)
    `)
    .eq('project_id', projectId)
    .in('status', ['draft', 'active'])

  const contracts = (contractsData || []) as unknown as ContractWithDetails[]
  const contractIds = contracts.map(c => c.id)

  let milestones: MilestoneProgress[] = []
  if (contractIds.length > 0) {
    const { data: milestonesData } = await supabase
      .from('subcontractor_milestones')
      .select('contract_id, percentage, status')
      .in('contract_id', contractIds)
    milestones = (milestonesData || []) as unknown as MilestoneProgress[]
  }

  return {
    project: projectData as unknown as ProjectDisplay,
    phases: (phasesData || []) as unknown as Phase[],
    contracts,
    milestones,
  }
}
