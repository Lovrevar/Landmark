import { supabase } from '../../../../lib/supabase'
import { logActivity } from '../../../../lib/activityLog'

export const fetchMilestonesByContract = async (
  contractId: string
) => {
  const { data: milestones, error } = await supabase
    .from('subcontractor_milestones')
    .select('*')
    .eq('contract_id', contractId)
    .order('milestone_number', { ascending: true })

  if (error) throw error

  const milestonesData = milestones || []

  const milestoneIds = milestonesData.map(m => m.id)

  if (milestoneIds.length === 0) {
    return []
  }

  const { data: invoices, error: invoicesError } = await supabase
    .from('accounting_invoices')
    .select('milestone_id, base_amount, status')
    .in('milestone_id', milestoneIds)
    .not('milestone_id', 'is', null)

  if (invoicesError) {
    console.error('Error fetching invoice payments:', invoicesError)
  }

  const paymentsByMilestone = (invoices || []).reduce((acc, inv) => {
    if (inv.milestone_id) {
      acc[inv.milestone_id] = (acc[inv.milestone_id] || 0) + parseFloat(inv.base_amount || 0)
    }
    return acc
  }, {} as Record<string, number>)

  return milestonesData.map(milestone => ({
    ...milestone,
    paid_amount: paymentsByMilestone[milestone.id] || 0
  }))
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

  const { data: contractRow } = await supabase
    .from('contracts')
    .select('project_id')
    .eq('id', data.contract_id)
    .maybeSingle()

  logActivity({ action: 'contract_milestone.create', entity: 'milestone', entityId: newMilestone.id, projectId: contractRow?.project_id ?? null, metadata: { severity: 'low', entity_name: data.milestone_name } })

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

  const { data: milestoneRow } = await supabase
    .from('subcontractor_milestones')
    .select('contract:contracts!inner(project_id)')
    .eq('id', milestoneId)
    .maybeSingle()
  const projectId = (milestoneRow?.contract as unknown as { project_id: string } | null)?.project_id ?? null

  logActivity({ action: 'contract_milestone.update', entity: 'milestone', entityId: milestoneId, projectId, metadata: { severity: 'low', changed_fields: Object.keys(updates) } })
}

export const updateMilestoneStatus = async (
  milestoneId: string,
  status: 'pending' | 'completed' | 'paid',
  dateField?: { completed_date?: string | null; paid_date?: string | null }
) => {
  const updates: Record<string, string | null | undefined> = { status }
  if (dateField) {
    Object.assign(updates, dateField)
  }

  const { error } = await supabase
    .from('subcontractor_milestones')
    .update(updates)
    .eq('id', milestoneId)

  if (error) throw error

  logActivity({
    action: 'contract_milestone.update',
    entity: 'milestone',
    entityId: milestoneId,
    metadata: { severity: 'medium', changed_fields: Object.keys(updates), status }
  })
}

export const deleteMilestone = async (milestoneId: string) => {
  const { data: milestoneRow } = await supabase
    .from('subcontractor_milestones')
    .select('contract:contracts!inner(project_id)')
    .eq('id', milestoneId)
    .maybeSingle()
  const projectId = (milestoneRow?.contract as unknown as { project_id: string } | null)?.project_id ?? null

  const { error } = await supabase
    .from('subcontractor_milestones')
    .delete()
    .eq('id', milestoneId)

  if (error) throw error

  logActivity({ action: 'contract_milestone.delete', entity: 'milestone', entityId: milestoneId, projectId, metadata: { severity: 'medium' } })
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
  const totalPaid = milestones.reduce((sum, m) => sum + (m.paid_amount || 0), 0)

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
