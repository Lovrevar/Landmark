import { supabase, ProjectPhase, Subcontractor, WirePayment } from '../../../lib/supabase'
import { PhaseFormInput } from '../types/siteTypes'

export const fetchAllProjects = async () => {
  const { data: projectsData, error: projectsError } = await supabase
    .from('projects')
    .select('*')
    .order('start_date', { ascending: false })

  if (projectsError) throw projectsError

  return projectsData || []
}

export const fetchProjectPhases = async () => {
  const { data: phasesData, error: phasesError } = await supabase
    .from('project_phases')
    .select('*')
    .order('project_id', { ascending: true })
    .order('phase_number', { ascending: true })

  if (phasesError) throw phasesError

  return phasesData || []
}

export const fetchSubcontractorsWithPhases = async () => {
  const { data: subcontractorsData, error: subError } = await supabase
    .from('subcontractors')
    .select(`
      *,
      project_phases(phase_name)
    `)

  if (subError) throw subError

  return subcontractorsData || []
}

export const fetchAllSubcontractors = async () => {
  const { data: allSubcontractorsData, error: subError2 } = await supabase
    .from('subcontractors')
    .select('*')
    .order('name')

  if (subError2) throw subError2

  return allSubcontractorsData || []
}

export const recalculatePhaseBudget = async (phaseId: string) => {
  const { data: phaseSubcontractors, error: subError } = await supabase
    .from('subcontractors')
    .select('cost')
    .eq('phase_id', phaseId)

  if (subError) throw subError

  const budgetUsed = (phaseSubcontractors || []).reduce((sum, sub) => sum + sub.cost, 0)

  const { error: updateError } = await supabase
    .from('project_phases')
    .update({ budget_used: budgetUsed })
    .eq('id', phaseId)

  if (updateError) throw updateError

  return budgetUsed
}

export const recalculateAllPhaseBudgets = async () => {
  const { data: phases, error: phasesError } = await supabase
    .from('project_phases')
    .select('id')

  if (phasesError) throw phasesError

  for (const phase of phases || []) {
    const { data: phaseSubcontractors, error: subError } = await supabase
      .from('subcontractors')
      .select('cost')
      .eq('phase_id', phase.id)

    if (subError) {
      console.error(`Error fetching subcontractors for phase ${phase.id}:`, subError)
      continue
    }

    const budgetUsed = (phaseSubcontractors || []).reduce((sum, sub) => sum + sub.cost, 0)

    await supabase
      .from('project_phases')
      .update({ budget_used: budgetUsed })
      .eq('id', phase.id)
  }
}

export const createPhases = async (projectId: string, phases: PhaseFormInput[]) => {
  const phasesToInsert = phases.map((phase, index) => ({
    project_id: projectId,
    phase_number: index + 1,
    phase_name: phase.phase_name,
    budget_allocated: phase.budget_allocated,
    budget_used: 0,
    start_date: phase.start_date || null,
    end_date: phase.end_date || null,
    status: 'planning'
  }))

  const { error } = await supabase
    .from('project_phases')
    .insert(phasesToInsert)

  if (error) throw error
}

export const updatePhase = async (
  phaseId: string,
  updates: {
    phase_name: string
    budget_allocated: number
    start_date: string | null
    end_date: string | null
    status: 'planning' | 'active' | 'completed' | 'on_hold'
  }
) => {
  const { error } = await supabase
    .from('project_phases')
    .update({
      phase_name: updates.phase_name,
      budget_allocated: updates.budget_allocated,
      start_date: updates.start_date,
      end_date: updates.end_date,
      status: updates.status
    })
    .eq('id', phaseId)

  if (error) throw error
}

export const deletePhase = async (phaseId: string) => {
  const { error } = await supabase
    .from('project_phases')
    .delete()
    .eq('id', phaseId)

  if (error) throw error
}

export const resequencePhases = async (phases: ProjectPhase[]) => {
  for (let i = 0; i < phases.length; i++) {
    await supabase
      .from('project_phases')
      .update({ phase_number: i + 1 })
      .eq('id', phases[i].id)
  }
}

export const createSubcontractor = async (data: {
  name: string
  contact: string
  job_description: string
  deadline: string
  cost: number
  budget_realized: number
  phase_id: string
}) => {
  const { error } = await supabase
    .from('subcontractors')
    .insert(data)

  if (error) throw error
}

export const linkSubcontractorToPhase = async (
  subcontractorId: string,
  phaseId: string,
  cost: number,
  deadline: string,
  jobDescription: string
) => {
  const { error } = await supabase
    .from('subcontractors')
    .update({
      phase_id: phaseId,
      cost: cost,
      deadline: deadline,
      job_description: jobDescription
    })
    .eq('id', subcontractorId)

  if (error) throw error
}

export const updateSubcontractor = async (
  subcontractorId: string,
  updates: {
    name: string
    contact: string
    job_description: string
    deadline: string
    cost: number
    progress: number
  }
) => {
  const { error } = await supabase
    .from('subcontractors')
    .update(updates)
    .eq('id', subcontractorId)

  if (error) throw error
}

export const deleteSubcontractor = async (subcontractorId: string) => {
  const { error } = await supabase
    .from('subcontractors')
    .delete()
    .eq('id', subcontractorId)

  if (error) throw error
}

export const getSubcontractorDetails = async (subcontractorId: string) => {
  const { data, error } = await supabase
    .from('subcontractors')
    .select('cost, phase_id')
    .eq('id', subcontractorId)
    .single()

  if (error) throw error

  return data
}

export const createContract = async (data: {
  contract_number: string
  project_id: string
  phase_id: string
  subcontractor_id: string
  job_description: string
  contract_amount: number
  budget_realized: number
  end_date: string | null
  status: string
}) => {
  const { data: newContract, error } = await supabase
    .from('contracts')
    .insert(data)
    .select()
    .single()

  if (error) throw error

  return newContract
}

export const getContractCount = async () => {
  const { count } = await supabase
    .from('contracts')
    .select('*', { count: 'exact', head: true })

  return count || 0
}

export const updateSubcontractorContract = async (subcontractorId: string, contractId: string) => {
  const { error } = await supabase
    .from('subcontractors')
    .update({ contract_id: contractId })
    .eq('id', subcontractorId)

  if (error) throw error
}

export const createWirePayment = async (data: {
  subcontractor_id: string
  contract_id: string | null
  amount: number
  payment_date: string | null
  notes: string | null
  created_by: string
}) => {
  const { data: paymentData, error } = await supabase
    .from('wire_payments')
    .insert(data)
    .select()

  if (error) throw error

  return paymentData
}

export const updateSubcontractorBudgetRealized = async (
  subcontractorId: string,
  budgetRealized: number
) => {
  const { error } = await supabase
    .from('subcontractors')
    .update({ budget_realized: budgetRealized })
    .eq('id', subcontractorId)

  if (error) throw error
}

export const updateContractBudgetRealized = async (
  contractId: string,
  budgetRealized: number
) => {
  const { error } = await supabase
    .from('contracts')
    .update({ budget_realized: budgetRealized })
    .eq('id', contractId)

  if (error) throw error
}

export const fetchWirePayments = async (subcontractorId: string) => {
  const { data, error } = await supabase
    .from('wire_payments')
    .select('*')
    .eq('subcontractor_id', subcontractorId)
    .order('created_at', { ascending: false })

  if (error) throw error

  return data || []
}

export const updateWirePayment = async (
  paymentId: string,
  updates: {
    amount: number
    payment_date: string | null
    notes: string | null
  }
) => {
  const { error } = await supabase
    .from('wire_payments')
    .update(updates)
    .eq('id', paymentId)

  if (error) throw error
}

export const deleteWirePayment = async (paymentId: string) => {
  const { error } = await supabase
    .from('wire_payments')
    .delete()
    .eq('id', paymentId)

  if (error) throw error
}

export const getPhaseInfo = async (phaseId: string) => {
  const { data, error } = await supabase
    .from('project_phases')
    .select('project_id, phase_name')
    .eq('id', phaseId)
    .single()

  if (error) throw error

  return data
}

export const fetchSubcontractorComments = async (subcontractorId: string) => {
  const { data, error } = await supabase
    .from('subcontractor_comments')
    .select(`
      *,
      users!inner(username, role)
    `)
    .eq('subcontractor_id', subcontractorId)
    .order('created_at', { ascending: true })

  if (error) throw error

  return (data || []).map(comment => ({
    ...comment,
    user: comment.users
  }))
}

export const createSubcontractorComment = async (data: {
  subcontractor_id: string
  user_id: string
  comment: string
  comment_type: 'completed' | 'issue' | 'general'
}) => {
  const { error } = await supabase
    .from('subcontractor_comments')
    .insert(data)

  if (error) throw error
}
