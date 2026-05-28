// SiteManagement service barrel.
//
// This file historically contained ~1200 lines of mixed service functions for
// phases, contracts, subcontractors, milestones, funding, and wire payments.
// Functions have been split into per-entity service files under this directory.
// This module re-exports them all so existing consumers (and `import * as
// siteService` patterns) continue to work unchanged. New code should import
// directly from the entity-specific file.

import { supabase } from '../../../../lib/supabase'

export const fetchAllProjects = async () => {
  const { data: projectsData, error: projectsError } = await supabase
    .from('projects')
    .select('*')
    .order('start_date', { ascending: false })

  if (projectsError) throw projectsError

  return projectsData || []
}

// The "subcontractors with phase info" view used by the SiteManagement landing
// page. Returns a flat list keyed by contract (one row per contract), enriched
// with subcontractor, phase, and contract-type details.
export const fetchSubcontractorsWithPhases = async () => {
  const { data: contractsData, error: contractError } = await supabase
    .from('contracts')
    .select(`
      id,
      contract_number,
      contract_amount,
      budget_realized,
      job_description,
      end_date,
      phase_id,
      project_id,
      status,
      has_contract,
      contract_type_id,
      subcontractor:subcontractors!contracts_subcontractor_id_fkey(
        id,
        name,
        contact,
        financed_by_type,
        financed_by_bank_id,
        completed_at,
        created_at
      ),
      phase:project_phases!contracts_phase_id_fkey(phase_name),
      contract_type:contract_types!contracts_contract_type_id_fkey(
        id,
        name,
        description
      )
    `)
    .in('status', ['draft', 'active'])

  if (contractError) {
    console.error('Error fetching subcontractors with phases:', contractError)
    throw contractError
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const subcontractorsWithPhaseData = (contractsData || []).map((contract: any) => {
    const cost = parseFloat(contract.contract_amount || 0)
    const budgetRealized = parseFloat(contract.budget_realized || 0)
    const progress = cost > 0 ? Math.min(100, (budgetRealized / cost) * 100) : 0

    return {
      id: contract.id,
      subcontractor_id: contract.subcontractor.id,
      name: contract.subcontractor.name,
      contact: contract.subcontractor.contact,
      job_description: contract.job_description,
      deadline: contract.end_date,
      cost,
      budget_realized: budgetRealized,
      phase_id: contract.phase_id,
      progress,
      financed_by_type: contract.subcontractor.financed_by_type,
      financed_by_bank_id: contract.subcontractor.financed_by_bank_id,
      completed_at: contract.subcontractor.completed_at,
      contract_id: contract.id,
      contract_title: contract.contract_number,
      company_name: contract.subcontractor.name,
      created_at: contract.subcontractor.created_at,
      project_phases: contract.phase,
      has_contract: contract.has_contract !== false,
      contract_type_id: contract.contract_type_id,
      contract_type_name: contract.contract_type?.name || null
    }
  })

  return subcontractorsWithPhaseData
}

// Re-exports — preserved for backward compatibility with existing consumers.
export * from './phaseService'
export * from './siteContractService'
export * from './siteSubcontractorService'
export * from './milestoneService'
export * from './siteFundingService'
export * from './wirePaymentService'
