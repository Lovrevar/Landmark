import { supabase } from '../../../../lib/supabase'
import type { ProjectWithDetails, Phase, ContractWithDetails, ApartmentItem, CreditAllocationItem, Milestone } from '../types'

export async function fetchProjectDetails(id: string): Promise<ProjectWithDetails> {
  const { data: projectData, error: projectError } = await supabase
    .from('projects')
    .select('*')
    .eq('id', id)
    .single()
  if (projectError) throw projectError

  const { data: contractsData, error: subError } = await supabase
    .from('contracts')
    .select(`
      *,
      subcontractor:subcontractors!contracts_subcontractor_id_fkey(id, name, contact),
      phase:project_phases!contracts_phase_id_fkey(phase_name)
    `)
    .eq('project_id', id)
    .in('status', ['draft', 'active'])
    .order('end_date', { ascending: true })
  if (subError) throw subError

  const subcontractors = (contractsData || []).map((c: any) => {
    const cost = parseFloat(c.contract_amount || 0)
    const budgetRealized = parseFloat(c.budget_realized || 0)
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

  const { data: invoicesData, error: invoicesError } = await supabase
    .from('invoices')
    .select('*')
    .eq('project_id', id)
    .order('due_date', { ascending: true })
  if (invoicesError) throw invoicesError

  const { data: apartmentsData, error: apartmentsError } = await supabase
    .from('apartments')
    .select('*')
    .eq('project_id', id)
    .order('floor', { ascending: true })
    .order('number', { ascending: true })
  if (apartmentsError) throw apartmentsError

  const { data: milestonesData, error: milestonesError } = await supabase
    .from('project_milestones')
    .select('*')
    .eq('project_id', id)
    .order('created_at', { ascending: true })
  if (milestonesError) throw milestonesError

  const { data: bankCreditsData, error: bankCreditsError } = await supabase
    .from('bank_credits')
    .select('*, banks(name)')
    .eq('project_id', id)
  if (bankCreditsError) throw bankCreditsError

  const { data: allocationsData, error: allocationsError } = await supabase
    .from('credit_allocations')
    .select('*, bank_credits(banks(name))')
    .eq('project_id', id)
  if (allocationsError) throw allocationsError

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
    const bankName = (alloc.bank_credits as any)?.banks?.name
    if (bankName && !investorNames.includes(bankName)) investorNames.push(bankName)
  })

  return {
    ...projectData,
    subcontractors,
    invoices,
    apartments,
    milestones: milestonesData || [],
    total_spent,
    total_revenue,
    pending_invoices,
    investors: investorNames.length > 0 ? investorNames.join(', ') : 'N/A'
  }
}

export async function fetchProjectDataEnhanced(id: string): Promise<{
  project: any
  milestones: Milestone[]
  phases: Phase[]
  contracts: ContractWithDetails[]
  apartments: ApartmentItem[]
  investments: CreditAllocationItem[]
}> {
  const { data: projectData, error: projectError } = await supabase
    .from('projects')
    .select('*')
    .eq('id', id)
    .single()
  if (projectError) throw projectError

  const { data: milestonesData } = await supabase
    .from('project_milestones')
    .select('*')
    .eq('project_id', id)
    .order('due_date', { ascending: true })

  const { data: phasesData } = await supabase
    .from('project_phases')
    .select('*')
    .eq('project_id', id)
    .order('phase_number', { ascending: true })

  const { data: contractsData } = await supabase
    .from('contracts')
    .select(`
      *,
      subcontractor:subcontractors!contracts_subcontractor_id_fkey(id, name, contact),
      phase:project_phases!contracts_phase_id_fkey(phase_name)
    `)
    .eq('project_id', id)
    .order('created_at', { ascending: false })

  const { data: apartmentsData } = await supabase
    .from('apartments')
    .select('*')
    .eq('project_id', id)
    .order('floor', { ascending: true })

  const { data: investmentsData } = await supabase
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
    .order('created_at', { ascending: false })

  return {
    project: projectData,
    milestones: milestonesData || [],
    phases: phasesData || [],
    contracts: contractsData || [],
    apartments: apartmentsData || [],
    investments: (investmentsData || []) as CreditAllocationItem[]
  }
}
