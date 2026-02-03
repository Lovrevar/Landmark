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
      subcontractor:subcontractors!contracts_subcontractor_id_fkey(
        id,
        name,
        contact,
        financed_by_type,
        financed_by_investor_id,
        financed_by_bank_id,
        completed_at,
        created_at
      ),
      phase:project_phases!contracts_phase_id_fkey(phase_name)
    `)
    .in('status', ['draft', 'active'])
  
  if (contractError) {
    console.error('Error fetching subcontractors with phases:', contractError)
    throw contractError
  }

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
      financed_by_investor_id: contract.subcontractor.financed_by_investor_id,
      financed_by_bank_id: contract.subcontractor.financed_by_bank_id,
      completed_at: contract.subcontractor.completed_at,
      contract_id: contract.id,
      contract_title: contract.contract_number,
      company_name: contract.subcontractor.name,
      created_at: contract.subcontractor.created_at,
      project_phases: contract.phase,
      has_contract: contract.has_contract !== false
    }
  })

  return subcontractorsWithPhaseData
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
  const { data: phaseContracts, error: subError } = await supabase
    .from('contracts')
    .select('contract_amount')
    .eq('phase_id', phaseId)
    .in('status', ['draft', 'active'])

  if (subError) throw subError

  const budgetUsed = (phaseContracts || []).reduce((sum, contract) => sum + parseFloat(contract.contract_amount || 0), 0)

  const { error: updateError } = await supabase
    .from('project_phases')
    .update({ budget_used: budgetUsed })
    .eq('id', phaseId)

  if (updateError) throw updateError

  return budgetUsed
}

export const recalculateAllPhaseBudgets = async () => {
  const { data: contractSums, error: contractError } = await supabase
    .from('contracts')
    .select('phase_id, contract_amount')
    .in('status', ['draft', 'active'])

  if (contractError) throw contractError

  const budgetByPhase = new Map<string, number>()

  for (const contract of contractSums || []) {
    if (!contract.phase_id) continue
    const currentSum = budgetByPhase.get(contract.phase_id) || 0
    budgetByPhase.set(contract.phase_id, currentSum + parseFloat(contract.contract_amount || '0'))
  }

  const { data: allPhases, error: phasesError } = await supabase
    .from('project_phases')
    .select('id')

  if (phasesError) throw phasesError

  const updatePromises = (allPhases || []).map(phase => {
    const budgetUsed = budgetByPhase.get(phase.id) || 0
    return supabase
      .from('project_phases')
      .update({ budget_used: budgetUsed })
      .eq('id', phase.id)
  })

  await Promise.all(updatePromises)
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

export const updateProjectPhases = async (projectId: string, phases: PhaseFormInput[]) => {
  const existingPhasesData = await supabase
    .from('project_phases')
    .select('*')
    .eq('project_id', projectId)
    .order('phase_number')

  if (existingPhasesData.error) throw existingPhasesData.error

  const existingPhases = existingPhasesData.data || []
  const existingPhaseIds = new Set(existingPhases.map(p => p.id))
  const updatedPhaseIds = new Set(phases.filter(p => p.id).map(p => p.id))

  const phasesToDelete = existingPhases.filter(p => !updatedPhaseIds.has(p.id))
  if (phasesToDelete.length > 0) {
    const { error: deleteError } = await supabase
      .from('project_phases')
      .delete()
      .in('id', phasesToDelete.map(p => p.id))

    if (deleteError) throw deleteError
  }

  for (let i = 0; i < phases.length; i++) {
    const phase = phases[i]
    const phaseNumber = i + 1

    if (phase.id && existingPhaseIds.has(phase.id)) {
      const { error: updateError } = await supabase
        .from('project_phases')
        .update({
          phase_number: phaseNumber,
          phase_name: phase.phase_name,
          budget_allocated: phase.budget_allocated,
          start_date: phase.start_date || null,
          end_date: phase.end_date || null
        })
        .eq('id', phase.id)

      if (updateError) throw updateError
    } else {
      const { error: insertError } = await supabase
        .from('project_phases')
        .insert({
          project_id: projectId,
          phase_number: phaseNumber,
          phase_name: phase.phase_name,
          budget_allocated: phase.budget_allocated,
          budget_used: 0,
          start_date: phase.start_date || null,
          end_date: phase.end_date || null,
          status: 'planning'
        })

      if (insertError) throw insertError
    }
  }
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
  contractId: string,
  updates: {
    name: string
    contact: string
    job_description: string
    deadline: string
    cost: number
    progress: number
    phase_id?: string
    has_contract?: boolean
  }
) => {
  console.log('updateSubcontractor service called with:', { contractId, updates })

  // First, get the contract to find the subcontractor
  const { data: contract, error: contractError } = await supabase
    .from('contracts')
    .select('subcontractor_id, phase_id')
    .eq('id', contractId)
    .single()

  if (contractError) {
    console.error('Error fetching contract:', contractError)
    throw contractError
  }

  console.log('Current contract data:', contract)

  // Update contract-specific fields in contracts table
  const contractUpdateData: any = {
    job_description: updates.job_description,
    end_date: updates.deadline,
    contract_amount: updates.cost
  }

  // Add phase_id if provided
  if (updates.phase_id !== undefined) {
    contractUpdateData.phase_id = updates.phase_id
  }

  // Add has_contract if provided
  if (updates.has_contract !== undefined) {
    contractUpdateData.has_contract = updates.has_contract
  }

  console.log('Updating contract with data:', contractUpdateData)

  const { error: contractUpdateError } = await supabase
    .from('contracts')
    .update(contractUpdateData)
    .eq('id', contractId)

  if (contractUpdateError) {
    console.error('Error updating contract:', contractUpdateError)
    throw contractUpdateError
  }

  console.log('Contract updated successfully')

  // Update subcontractor fields (name, contact) in subcontractors table
  const subcontractorUpdateData: any = {
    name: updates.name,
    contact: updates.contact
  }

  console.log('Updating subcontractor with data:', subcontractorUpdateData)

  const { error: subError } = await supabase
    .from('subcontractors')
    .update(subcontractorUpdateData)
    .eq('id', contract.subcontractor_id)

  if (subError) {
    console.error('Error updating subcontractor:', subError)
    throw subError
  }

  console.log('Subcontractor updated successfully')

  // If phase was changed, recalculate budgets for both old and new phases
  if (updates.phase_id && updates.phase_id !== contract.phase_id) {
    if (contract.phase_id) {
      await recalculatePhaseBudget(contract.phase_id)
    }
    await recalculatePhaseBudget(updates.phase_id)
  }
}

export const deleteSubcontractor = async (contractId: string) => {
  const { error } = await supabase
    .from('contracts')
    .delete()
    .eq('id', contractId)

  if (error) throw error
}

export const getSubcontractorDetails = async (contractId: string) => {
  const { data, error } = await supabase
    .from('contracts')
    .select('contract_amount, phase_id')
    .eq('id', contractId)
    .single()

  if (error) throw error

  return {
    cost: parseFloat(data.contract_amount || 0),
    phase_id: data.phase_id
  }
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
  has_contract?: boolean
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

export const generateUniqueContractNumber = async (projectId: string) => {
  const { data: existingContracts } = await supabase
    .from('contracts')
    .select('contract_number')
    .eq('project_id', projectId)
    .not('contract_number', 'is', null)

  const year = new Date().getFullYear()
  const timestamp = Date.now().toString().slice(-6)
  const prefix = `CNT-${year}-`

  let maxNumber = 0
  if (existingContracts && existingContracts.length > 0) {
    existingContracts.forEach(contract => {
      if (contract.contract_number && contract.contract_number.startsWith(prefix)) {
        const parts = contract.contract_number.replace(prefix, '').split('-')
        const num = parseInt(parts[0], 10)
        if (!isNaN(num) && num > maxNumber) {
          maxNumber = num
        }
      }
    })
  }

  return `${prefix}${String(maxNumber + 1).padStart(4, '0')}-${timestamp}`
}

// DEPRECATED: contract_id column removed from subcontractors table
// Relationship is maintained through contracts.subcontractor_id

// DEPRECATED: Payment creation moved to Accounting module
// Site Management only displays payments, creation happens in Accounting → Invoices


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

export const fetchWirePayments = async (contractId: string) => {
  const { data, error } = await supabase
    .from('accounting_payments')
    .select(`
      *,
      invoice:accounting_invoices!inner(
        id,
        invoice_number,
        invoice_type,
        invoice_category,
        supplier_id,
        contract_id,
        project_id,
        total_amount,
        status
      )
    `)
    .eq('invoice.contract_id', contractId)
    .order('payment_date', { ascending: false })

  if (error) throw error

  return data || []
}

// DEPRECATED: Payment updates moved to Accounting module

// DEPRECATED: Payment deletion moved to Accounting module

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

export const fetchMilestonesByContract = async (
  contractId: string
) => {
  const { data, error } = await supabase
    .from('subcontractor_milestones')
    .select('*')
    .eq('contract_id', contractId)
    .order('milestone_number', { ascending: true })

  if (error) throw error

  return data || []
}

export const fetchMilestonesBySubcontractor = async (subcontractorId: string) => {
  const { data, error } = await supabase
    .from('subcontractor_milestones')
    .select(`
      *,
      contract:contracts!inner(subcontractor_id, project_id, phase_id)
    `)
    .eq('contract.subcontractor_id', subcontractorId)
    .order('milestone_number', { ascending: true })

  if (error) throw error

  return data || []
}

export const getNextMilestoneNumber = async (
  contractId: string
) => {
  const { data, error } = await supabase
    .from('subcontractor_milestones')
    .select('milestone_number')
    .eq('contract_id', contractId)
    .order('milestone_number', { ascending: false })
    .limit(1)

  if (error) throw error

  return data && data.length > 0 ? data[0].milestone_number + 1 : 1
}

export const createMilestone = async (data: {
  contract_id: string
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

export const validateMilestonePercentagesForContract = async (
  contractId: string,
  excludeMilestoneId?: string
) => {
  let query = supabase
    .from('subcontractor_milestones')
    .select('percentage')
    .eq('contract_id', contractId)

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

export const getMilestoneStatsForContract = async (
  contractId: string,
  contractCost: number
) => {
  const milestones = await fetchMilestonesByContract(contractId)

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

export const fetchSubcontractorInvoiceStats = async (subcontractorId: string, contractId?: string) => {
  let query = supabase
    .from('accounting_invoices')
    .select(`
      id,
      base_amount,
      status,
      paid_amount
    `)

  if (contractId) {
    query = query.eq('contract_id', contractId)
  } else {
    query = query.eq('supplier_id', subcontractorId)
  }

  const { data: invoicesData, error: invoicesError } = await query

  if (invoicesError) {
    console.error('Error fetching invoice stats:', invoicesError)
    return { totalPaid: 0, totalOwed: 0 }
  }

  const invoices = invoicesData || []

  const totalPaid = invoices.reduce((sum, inv) => {
    return sum + parseFloat(inv.paid_amount?.toString() || '0')
  }, 0)

  const totalOwed = invoices
    .filter(inv => inv.status !== 'PAID')
    .reduce((sum, inv) => {
      const baseAmount = parseFloat(inv.base_amount?.toString() || '0')
      const paidAmount = parseFloat(inv.paid_amount?.toString() || '0')
      return sum + (baseAmount - paidAmount)
    }, 0)

  return {
    totalPaid,
    totalOwed
  }
}
