import { supabase } from '../../../../lib/supabase'
import type { Phase, ContractWithDetails, ApartmentItem, CreditAllocationItem, Milestone, ProjectDisplay } from '../types'
import { ticGrandTotal } from '../../../Funding/TIC/utils/ticBudget'
import type { LineItem } from '../../../Funding/TIC/utils/ticFormatters'

export async function fetchProjectDataEnhanced(id: string): Promise<{
  project: ProjectDisplay
  milestones: Milestone[]
  phases: Phase[]
  contracts: ContractWithDetails[]
  apartments: ApartmentItem[]
  investments: CreditAllocationItem[]
  /** The project's TIC investment total; null when it has no TIC, meaning it has no planned budget. */
  ticTotal: number | null
}> {
  const [
    { data: projectData, error: projectError },
    { data: milestonesData },
    { data: phasesData },
    { data: contractsData },
    { data: apartmentsData },
    { data: investmentsData },
    { data: ticData },
  ] = await Promise.all([
    supabase.from('projects').select('*').eq('id', id).single(),
    supabase
      .from('project_milestones')
      .select('*')
      .eq('project_id', id)
      .order('due_date', { ascending: true }),
    supabase
      .from('project_phases')
      .select('*')
      .eq('project_id', id)
      .order('phase_number', { ascending: true }),
    supabase
      .from('contracts')
      .select(`
        *,
        subcontractor:subcontractors!contracts_subcontractor_id_fkey(id, name, contact),
        phase:project_phases!contracts_phase_id_fkey(phase_name, phase_number),
        classification:cost_classifications!contracts_classification_id_fkey(id, name, sort_order)
      `)
      .eq('project_id', id)
      .order('created_at', { ascending: false }),
    supabase
      .from('apartments')
      .select('*')
      .eq('project_id', id)
      .order('floor', { ascending: true }),
    supabase
      .from('credit_allocations')
      .select(`
        id,
        allocated_amount,
        used_amount,
        description,
        created_at,
        bank_credits(credit_name, credit_type, start_date, banks(name))
      `)
      .eq('project_id', id)
      .order('created_at', { ascending: false }),
    supabase.from('tic_cost_structures').select('line_items').eq('project_id', id).maybeSingle(),
  ])
  if (projectError) throw projectError

  const contracts = (contractsData || []) as unknown as ContractWithDetails[]

  // A TIC row of all zeros is an untouched template, not a plan — the same test the database
  // trigger applies before it writes any budget.
  const ticLineItems = (ticData?.line_items || []) as LineItem[]
  const ticTotal = ticLineItems.length > 0 ? ticGrandTotal(ticLineItems) : 0

  return {
    project: projectData as unknown as ProjectDisplay,
    milestones: (milestonesData || []) as unknown as Milestone[],
    phases: (phasesData || []) as unknown as Phase[],
    contracts,
    apartments: (apartmentsData || []) as unknown as ApartmentItem[],
    investments: (investmentsData || []) as unknown as CreditAllocationItem[],
    ticTotal: ticTotal > 0 ? ticTotal : null,
  }
}
