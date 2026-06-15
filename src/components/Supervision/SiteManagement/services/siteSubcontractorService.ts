import { supabase } from '../../../../lib/supabase'
import { logActivity } from '../../../../lib/activityLog'
import { uploadDocument } from '../../../Documents/services/documentService'
import type { AssociationInput } from '../../../Documents/types'
import { recalculatePhaseBudget } from './phaseService'

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

export const createSubcontractor = async (data: {
  name: string
  contact: string
  financed_by_type?: 'investor' | 'bank' | null
  financed_by_bank_id?: string | null
}) => {
  const { data: inserted, error } = await supabase
    .from('subcontractors')
    .insert(data)
    .select('id')
    .maybeSingle()

  if (error) throw error

  logActivity({ action: 'subcontractor.create', entity: 'subcontractor', entityId: inserted?.id ?? null, metadata: { severity: 'medium', entity_name: data.name } })
}

export const createSubcontractorWithReturn = async (data: {
  name: string
  contact: string
  financed_by_type?: 'investor' | 'bank' | null
  financed_by_bank_id?: string | null
}) => {
  const { data: newSubcontractor, error } = await supabase
    .from('subcontractors')
    .insert(data)
    .select()
    .single()

  if (error) throw error

  logActivity({ action: 'subcontractor.create', entity: 'subcontractor', entityId: newSubcontractor.id, metadata: { severity: 'medium', entity_name: data.name } })

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

  logActivity({
    action: 'subcontractor.update',
    entity: 'subcontractor',
    entityId: subcontractorId,
    metadata: { severity: 'medium', changed_fields: ['phase_id', 'cost', 'deadline', 'job_description'], phase_id: phaseId }
  })
}

export const updateSubcontractor = async (
  contractId: string,
  updates: {
    name: string
    contact: string
    job_description?: string
    deadline?: string
    cost?: number
    progress: number
    base_amount?: number
    vat_rate?: number
    vat_amount?: number
    total_amount?: number
    phase_id?: string
    contract_type_id?: number
    has_contract?: boolean
  }
) => {
  // First, get the contract to find the subcontractor
  const { data: contract, error: contractError } = await supabase
    .from('contracts')
    .select('subcontractor_id, phase_id, project_id')
    .eq('id', contractId)
    .single()

  if (contractError) {
    console.error('Error fetching contract:', contractError)
    throw contractError
  }

  // Update contract-specific fields in contracts table
  const contractUpdateData: Record<string, unknown> = {
    job_description: updates.job_description,
    end_date: updates.deadline,
    contract_amount: updates.cost
  }

  if (updates.base_amount !== undefined) {
    contractUpdateData.base_amount = updates.base_amount
  }
  if (updates.vat_rate !== undefined) {
    contractUpdateData.vat_rate = updates.vat_rate
  }
  if (updates.vat_amount !== undefined) {
    contractUpdateData.vat_amount = updates.vat_amount
  }
  if (updates.total_amount !== undefined) {
    contractUpdateData.total_amount = updates.total_amount
  }
  if (updates.phase_id !== undefined) {
    contractUpdateData.phase_id = updates.phase_id
  }
  if (updates.contract_type_id !== undefined) {
    contractUpdateData.contract_type_id = updates.contract_type_id
  }
  if (updates.has_contract !== undefined) {
    contractUpdateData.has_contract = updates.has_contract
  }

  const { error: contractUpdateError } = await supabase
    .from('contracts')
    .update(contractUpdateData)
    .eq('id', contractId)

  if (contractUpdateError) {
    console.error('Error updating contract:', contractUpdateError)
    throw contractUpdateError
  }

  // Update subcontractor fields (name, contact) in subcontractors table
  const subcontractorUpdateData: Record<string, unknown> = {
    name: updates.name,
    contact: updates.contact
  }

  const { error: subError } = await supabase
    .from('subcontractors')
    .update(subcontractorUpdateData)
    .eq('id', contract.subcontractor_id)

  if (subError) {
    console.error('Error updating subcontractor:', subError)
    throw subError
  }

  // If phase was changed, recalculate budgets for both old and new phases
  if (updates.phase_id && updates.phase_id !== contract.phase_id) {
    if (contract.phase_id) {
      await recalculatePhaseBudget(contract.phase_id)
    }
    await recalculatePhaseBudget(updates.phase_id)
  }

  logActivity({ action: 'subcontractor.update', entity: 'subcontractor', entityId: contract.subcontractor_id, projectId: contract.project_id ?? null, metadata: { severity: 'medium', changed_fields: Object.keys(updates) } })
}

export const deleteSubcontractor = async (contractId: string) => {
  const { data: contractRow } = await supabase
    .from('contracts')
    .select('project_id')
    .eq('id', contractId)
    .maybeSingle()

  const { error } = await supabase
    .from('contracts')
    .delete()
    .eq('id', contractId)

  if (error) throw error

  logActivity({ action: 'subcontractor.delete', entity: 'subcontractor', entityId: contractId, projectId: contractRow?.project_id ?? null, metadata: { severity: 'high' } })
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
  const { data: inserted, error } = await supabase
    .from('subcontractor_comments')
    .insert(data)
    .select('id')
    .maybeSingle()

  if (error) throw error

  logActivity({
    action: 'subcontractor.comment',
    entity: 'subcontractor',
    entityId: data.subcontractor_id,
    metadata: { severity: 'low', comment_id: inserted?.id ?? null, comment_type: data.comment_type }
  })
}

export const insertSubcontractorRecord = async (data: { name: string; contact: string; notes: string | null }) => {
  const { data: inserted, error } = await supabase
    .from('subcontractors')
    .insert(data)
    .select('id')
    .maybeSingle()
  if (error) throw error

  logActivity({ action: 'subcontractor.create', entity: 'subcontractor', entityId: inserted?.id ?? null, metadata: { severity: 'medium', entity_name: data.name } })
}

export const updateSubcontractorRecord = async (id: string, data: { name: string; contact: string; notes: string | null }) => {
  const { error } = await supabase.from('subcontractors').update(data).eq('id', id)
  if (error) throw error

  logActivity({ action: 'subcontractor.update', entity: 'subcontractor', entityId: id, metadata: { severity: 'medium', entity_name: data.name, changed_fields: Object.keys(data) } })
}

export const fetchInvoiceStatsForContracts = async (contractIds: string[]) => {
  const map = new Map<string, { totalPaid: number; totalOwed: number }>()
  if (contractIds.length === 0) return map

  const { data, error } = await supabase
    .from('accounting_invoices')
    .select('contract_id, total_amount, paid_amount, status')
    .in('contract_id', contractIds)

  if (error) {
    console.error('Error fetching batch invoice stats:', error)
    return map
  }

  for (const id of contractIds) map.set(id, { totalPaid: 0, totalOwed: 0 })

  for (const inv of data || []) {
    const cid = inv.contract_id as string | null
    if (!cid) continue
    const entry = map.get(cid) ?? { totalPaid: 0, totalOwed: 0 }
    const paid = parseFloat(inv.paid_amount?.toString() || '0')
    const total = parseFloat(inv.total_amount?.toString() || '0')
    entry.totalPaid += paid
    if (inv.status !== 'PAID') entry.totalOwed += (total - paid)
    map.set(cid, entry)
  }

  return map
}

export const fetchSubcontractorInvoiceStats = async (subcontractorId: string, contractId?: string) => {
  let query = supabase
    .from('accounting_invoices')
    .select(`
      id,
      base_amount,
      total_amount,
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
      const totalAmount = parseFloat(inv.total_amount?.toString() || '0')
      const paidAmount = parseFloat(inv.paid_amount?.toString() || '0')
      return sum + (totalAmount - paidAmount)
    }, 0)

  return {
    totalPaid,
    totalOwed
  }
}

export const uploadSubcontractorDocuments = async (
  subcontractorId: string,
  contractId: string | null,
  files: File[],
) => {
  const { data: cat, error: catErr } = await supabase
    .from('document_categories')
    .select('id')
    .eq('code', 'IZVODACI')
    .maybeSingle()
  if (catErr) throw catErr
  if (!cat) throw new Error('Document category IZVODACI not found')
  const categoryId = cat.id as string

  let projectId: string | null = null
  let phaseId: string | null = null
  if (contractId) {
    const { data: contractRow, error: contractErr } = await supabase
      .from('contracts')
      .select('project_id, phase_id')
      .eq('id', contractId)
      .maybeSingle()
    if (contractErr) throw contractErr
    projectId = (contractRow?.project_id as string | undefined) ?? null
    phaseId   = (contractRow?.phase_id   as string | undefined) ?? null
  }

  const associations: AssociationInput[] = [
    { entityType: 'subcontractor', entityId: subcontractorId },
  ]
  if (contractId) associations.push({ entityType: 'contract', entityId: contractId })
  if (projectId)  associations.push({ entityType: 'project',  entityId: projectId  })
  if (phaseId)    associations.push({ entityType: 'phase',    entityId: phaseId    })

  for (const file of files) {
    await uploadDocument(file, { categoryId, associations })
  }
}
