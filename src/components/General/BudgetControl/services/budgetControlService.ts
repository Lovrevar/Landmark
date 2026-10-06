import { supabase } from '../../../../lib/supabase'
import { committedAmount } from '../../../../utils/contractRollup'
import { ticGrandTotal } from '../../../Funding/TIC/utils/ticBudget'
import type { LineItem } from '../../../Funding/TIC/utils/ticFormatters'
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
  /** The project's TIC investment total, or null when it has no TIC. */
  ticTotal: number | null
}

export async function fetchProjectBudgetData(projectId: string): Promise<ProjectBudgetData> {
  const { data: projectData, error: projectError } = await supabase
    .from('projects')
    .select('*')
    .eq('id', projectId)
    .single()
  if (projectError) throw projectError

  // Every read below is checked: a failure must show the error state, not "no budget data".
  // The screen's headline card is labelled "TIC / Ukupni investicijski trošak" but has always
  // rendered projects.budget, never touching tic_cost_structures. Read the real thing.
  const { data: ticData, error: ticError } = await supabase
    .from('tic_cost_structures')
    .select('line_items')
    .eq('project_id', projectId)
    .maybeSingle()
  if (ticError) throw ticError

  const { data: phasesData, error: phasesError } = await supabase
    .from('project_phases')
    .select('*')
    .eq('project_id', projectId)
    .order('phase_number', { ascending: true })
  if (phasesError) throw phasesError

  const { data: contractsData, error: contractsError } = await supabase
    .from('contracts')
    .select(`
      *,
      subcontractor:subcontractors!contracts_subcontractor_id_fkey(id, name, contact),
      phase:project_phases!contracts_phase_id_fkey(phase_name)
    `)
    .eq('project_id', projectId)
  if (contractsError) throw contractsError

  // Every status counts. A terminated contract commits only what was paid on it (committedAmount),
  // so it enters EVM and the committed total with that amount — and is then 100% complete.
  const contracts = ((contractsData || []) as unknown as ContractWithDetails[]).map(c =>
    c.status === 'terminated'
      ? { ...c, contract_amount: committedAmount({ cost: Number(c.contract_amount) || 0, paid: Number(c.budget_realized) || 0, status: c.status }) }
      : c)
  const contractIds = contracts.map(c => c.id)

  let milestones: MilestoneProgress[] = []
  if (contractIds.length > 0) {
    const { data: milestonesData, error: milestonesError } = await supabase
      .from('subcontractor_milestones')
      .select('contract_id, percentage, status')
      .in('contract_id', contractIds)
    if (milestonesError) throw milestonesError
    milestones = (milestonesData || []) as unknown as MilestoneProgress[]
  }

  return {
    project: projectData as unknown as ProjectDisplay,
    phases: (phasesData || []) as unknown as Phase[],
    contracts,
    milestones,
    ticTotal: ticData ? ticGrandTotal((ticData.line_items || []) as LineItem[]) : null,
  }
}
