import { supabase } from '../../../../lib/supabase'
import type { ProjectWithDetails, Phase, ContractWithDetails, ApartmentItem, CreditAllocationItem, Milestone, ProjectDisplay } from '../types'

export async function fetchProjectDetails(id: string): Promise<ProjectWithDetails> {
  const [
    { data: projectData, error: projectError },
    { data: contractsData, error: subError },
    { data: invoicesData, error: invoicesError },
    { data: apartmentsData, error: apartmentsError },
    { data: milestonesData, error: milestonesError },
    { data: bankCreditsData, error: bankCreditsError },
    { data: allocationsData, error: allocationsError },
  ] = await Promise.all([
    supabase.from('projects').select('*').eq('id', id).single(),
    supabase
      .from('contracts')
      .select(`
        *,
        subcontractor:subcontractors!contracts_subcontractor_id_fkey(id, name, contact),
        phase:project_phases!contracts_phase_id_fkey(phase_name)
      `)
      .eq('project_id', id)
      .in('status', ['draft', 'active'])
      .order('end_date', { ascending: true }),
    supabase.from('invoices').select('*').eq('project_id', id).order('due_date', { ascending: true }),
    supabase
      .from('apartments')
      .select('*')
      .eq('project_id', id)
      .order('floor', { ascending: true })
      .order('number', { ascending: true }),
    supabase
      .from('project_milestones')
      .select('*')
      .eq('project_id', id)
      .order('created_at', { ascending: true }),
    supabase.from('bank_credits').select('*, banks(name)').eq('project_id', id),
    supabase.from('credit_allocations').select('*, bank_credits(banks(name))').eq('project_id', id),
  ])

  if (projectError) throw projectError
  if (subError) throw subError
  if (invoicesError) throw invoicesError
  if (apartmentsError) throw apartmentsError
  if (milestonesError) throw milestonesError
  if (bankCreditsError) throw bankCreditsError
  if (allocationsError) throw allocationsError

  type RawContract = {
    id: string
    contract_amount: string | number | null
    budget_realized: string | number | null
    job_description: string | null
    end_date: string | null
    subcontractor: { id: string; name: string; contact: string | null }
    phase?: { phase_name: string } | null
  }
  const subcontractors = (contractsData || []).map((c: RawContract) => {
    const cost = Number(c.contract_amount || 0)
    const budgetRealized = Number(c.budget_realized || 0)
    return {
      id: c.id,
      subcontractor_id: c.subcontractor.id,
      name: c.subcontractor.name,
      contact: c.subcontractor.contact,
      job_description: c.job_description,
      deadline: c.end_date,
      cost,
      budget_realized: budgetRealized,
      progress: cost > 0 ? Math.min(100, (budgetRealized / cost) * 100) : 0,
      phase_name: c.phase?.phase_name
    }
  })

  const invoices = invoicesData || []
  const apartments = apartmentsData || []
  const total_spent = invoices.filter(inv => inv.paid).reduce((sum, inv) => sum + inv.amount, 0)
  const total_revenue = apartments.filter(apt => apt.status === 'Sold').reduce((sum, apt) => sum + apt.price, 0)
  const pending_invoices = invoices.filter(inv => !inv.paid).length

  const investorNames: string[] = []
  ;(bankCreditsData || []).forEach(bc => {
    if (bc.banks?.name && !investorNames.includes(bc.banks.name)) investorNames.push(bc.banks.name)
  })
  ;(allocationsData || []).forEach(alloc => {
    const bankName = (alloc.bank_credits as { banks?: { name?: string } | null } | null)?.banks?.name
    if (bankName && !investorNames.includes(bankName)) investorNames.push(bankName)
  })

  return {
    ...projectData,
    subcontractors,
    invoices,
    apartments,
    milestones: (milestonesData || []) as unknown as Milestone[],
    total_spent,
    total_revenue,
    pending_invoices,
    investors: investorNames.length > 0 ? investorNames.join(', ') : 'N/A'
  }
}

export async function fetchProjectDataEnhanced(id: string): Promise<{
  project: ProjectDisplay
  milestones: Milestone[]
  phases: Phase[]
  contracts: ContractWithDetails[]
  apartments: ApartmentItem[]
  investments: CreditAllocationItem[]
}> {
  const [
    { data: projectData, error: projectError },
    { data: milestonesData },
    { data: phasesData },
    { data: contractsData },
    { data: apartmentsData },
    { data: investmentsData },
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
        phase:project_phases!contracts_phase_id_fkey(phase_name)
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
  ])
  if (projectError) throw projectError

  return {
    project: projectData as unknown as ProjectDisplay,
    milestones: (milestonesData || []) as unknown as Milestone[],
    phases: (phasesData || []) as unknown as Phase[],
    contracts: (contractsData || []) as unknown as ContractWithDetails[],
    apartments: (apartmentsData || []) as unknown as ApartmentItem[],
    investments: (investmentsData || []) as unknown as CreditAllocationItem[]
  }
}
