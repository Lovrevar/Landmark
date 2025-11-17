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

export const getSubcontractorById = async (id: string) => {
  const { data, error } = await supabase
    .from('subcontractors')
    .select('*')
    .eq('id', id)
    .single()

  if (error) throw error

  return data
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
  financed_by_type?: 'investor' | 'bank' | null
  financed_by_investor_id?: string | null
  financed_by_bank_id?: string | null
}) => {
  const { error } = await supabase
    .from('subcontractors')
    .insert(data)

  if (error) throw error
}

export const createSubcontractorWithReturn = async (data: {
  name: string
  contact: string
  job_description: string
  deadline: string
  cost: number
  budget_realized: number
  phase_id: string
  financed_by_type?: 'investor' | 'bank' | null
  financed_by_investor_id?: string | null
  financed_by_bank_id?: string | null
}) => {
  const { data: newSubcontractor, error } = await supabase
    .from('subcontractors')
    .insert(data)
    .select()
    .single()

  if (error) throw error

  return newSubcontractor
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
  const updateData: any = { ...updates }

  if (updates.progress === 100) {
    updateData.completed_at = new Date().toISOString()
  } else if (updates.progress < 100) {
    updateData.completed_at = null
  }

  const { error } = await supabase
    .from('subcontractors')
    .update(updateData)
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
  milestone_id?: string | null
  paid_by_type?: 'investor' | 'bank' | null
  paid_by_investor_id?: string | null
  paid_by_bank_id?: string | null
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
    .select(`
      *,
      investor:paid_by_investor_id(id, name, type),
      bank:paid_by_bank_id(id, name)
    `)
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

export const fetchMilestonesBySubcontractorAndPhase = async (
  subcontractorId: string,
  phaseId: string
) => {
  const { data, error } = await supabase
    .from('subcontractor_milestones')
    .select('*')
    .eq('subcontractor_id', subcontractorId)
    .eq('phase_id', phaseId)
    .order('milestone_number', { ascending: true })

  if (error) throw error

  return data || []
}

export const fetchMilestonesBySubcontractor = async (subcontractorId: string) => {
  const { data, error } = await supabase
    .from('subcontractor_milestones')
    .select('*')
    .eq('subcontractor_id', subcontractorId)
    .order('phase_id', { ascending: true })
    .order('milestone_number', { ascending: true })

  if (error) throw error

  return data || []
}

export const getNextMilestoneNumber = async (
  subcontractorId: string,
  phaseId: string
) => {
  const { data, error } = await supabase
    .from('subcontractor_milestones')
    .select('milestone_number')
    .eq('subcontractor_id', subcontractorId)
    .eq('phase_id', phaseId)
    .order('milestone_number', { ascending: false })
    .limit(1)

  if (error) throw error

  return data && data.length > 0 ? data[0].milestone_number + 1 : 1
}

export const createMilestone = async (data: {
  subcontractor_id: string
  project_id: string
  phase_id: string
  milestone_number: number
  milestone_name: string
  description: string
  percentage: number
  due_date: string | null
}) => {
  const { data: newMilestone, error } = await supabase
    .from('subcontractor_milestones')
    .insert(data)
    .select()
    .single()

  if (error) throw error

  return newMilestone
}

export const updateMilestone = async (
  milestoneId: string,
  updates: {
    milestone_name: string
    description: string
    percentage: number
    due_date: string | null
  }
) => {
  const { error } = await supabase
    .from('subcontractor_milestones')
    .update(updates)
    .eq('id', milestoneId)

  if (error) throw error
}

export const updateMilestoneStatus = async (
  milestoneId: string,
  status: 'pending' | 'completed' | 'paid',
  dateField?: { completed_date?: string | null; paid_date?: string | null }
) => {
  const updates: any = { status }
  if (dateField) {
    Object.assign(updates, dateField)
  }

  const { error } = await supabase
    .from('subcontractor_milestones')
    .update(updates)
    .eq('id', milestoneId)

  if (error) throw error
}

export const deleteMilestone = async (milestoneId: string) => {
  const { error } = await supabase
    .from('subcontractor_milestones')
    .delete()
    .eq('id', milestoneId)

  if (error) throw error
}

export const validateMilestonePercentagesForPhase = async (
  subcontractorId: string,
  phaseId: string,
  excludeMilestoneId?: string
) => {
  let query = supabase
    .from('subcontractor_milestones')
    .select('percentage')
    .eq('subcontractor_id', subcontractorId)
    .eq('phase_id', phaseId)

  if (excludeMilestoneId) {
    query = query.neq('id', excludeMilestoneId)
  }

  const { data, error } = await query

  if (error) throw error

  const totalPercentage = (data || []).reduce((sum, m) => sum + m.percentage, 0)
  return {
    totalPercentage,
    remainingPercentage: 100 - totalPercentage,
    isValid: totalPercentage <= 100
  }
}

export const getMilestoneStatsForPhase = async (
  subcontractorId: string,
  phaseId: string,
  contractCost: number
) => {
  const milestones = await fetchMilestonesBySubcontractorAndPhase(subcontractorId, phaseId)

  const totalPercentage = milestones.reduce((sum, m) => sum + m.percentage, 0)
  const remainingPercentage = 100 - totalPercentage

  const pendingCount = milestones.filter(m => m.status === 'pending').length
  const completedCount = milestones.filter(m => m.status === 'completed').length
  const paidCount = milestones.filter(m => m.status === 'paid').length

  const totalAmount = (contractCost * totalPercentage) / 100
  const totalPaid = milestones
    .filter(m => m.status === 'paid')
    .reduce((sum, m) => sum + (contractCost * m.percentage) / 100, 0)

  return {
    total_percentage: totalPercentage,
    remaining_percentage: remainingPercentage,
    total_amount: totalAmount,
    total_paid: totalPaid,
    pending_count: pendingCount,
    completed_count: completedCount,
    paid_count: paidCount
  }
}

export const fetchProjectFunders = async (projectId: string) => {
  const { data: investorsData, error: investorsError } = await supabase
    .from('project_investments')
    .select('investor_id, investors(id, name, type)')
    .eq('project_id', projectId)
    .not('investor_id', 'is', null)

  if (investorsError) throw investorsError

  const { data: banksData, error: banksError } = await supabase
    .from('bank_credits')
    .select('bank_id, banks(id, name)')
    .eq('project_id', projectId)
    .not('bank_id', 'is', null)

  if (banksError) throw banksError

  const uniqueInvestors = Array.from(
    new Map(
      (investorsData || [])
        .filter(inv => inv.investors)
        .map(inv => [inv.investors.id, inv.investors])
    ).values()
  )

  const uniqueBanks = Array.from(
    new Map(
      (banksData || [])
        .filter(bank => bank.banks)
        .map(bank => [bank.banks.id, bank.banks])
    ).values()
  )

  return {
    investors: uniqueInvestors,
    banks: uniqueBanks
  }
}
