import { supabase } from '../../../../lib/supabase'
import { logActivity } from '../../../../lib/activityLog'

export const createContract = async (data: {
  contract_number: string
  project_id: string
  phase_id: string
  subcontractor_id: string
  job_description: string
  contract_amount: number
  base_amount?: number
  vat_rate?: number
  vat_amount?: number
  total_amount?: number
  budget_realized: number
  start_date?: string | null
  end_date: string | null
  status: string
  contract_type_id?: number
  has_contract?: boolean
}) => {
  const { data: newContract, error } = await supabase
    .from('contracts')
    .insert(data)
    .select()
    .single()

  if (error) throw error

  logActivity({
    action: 'contract.create',
    entity: 'contract',
    entityId: newContract?.id ?? null,
    projectId: data.project_id,
    metadata: { severity: 'high', entity_name: data.contract_number, amount: data.contract_amount }
  })

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

export const fetchContractTypes = async () => {
  const { data, error } = await supabase
    .from('contract_types')
    .select('*')
    .eq('is_active', true)
    .order('name', { ascending: true })

  if (error) throw error

  return data || []
}

export const createContractType = async (name: string, description: string | null): Promise<number> => {
  const { data: existingTypes } = await supabase
    .from('contract_types')
    .select('id')
    .order('id', { ascending: false })
    .limit(1)

  const newId = (existingTypes && existingTypes.length > 0 ? existingTypes[0].id : 0) + 1

  const { error } = await supabase
    .from('contract_types')
    .insert({ id: newId, name, description: description || null, is_active: true })
    .select()
    .single()

  if (error) throw error

  // contract_types uses integer ids; activity_logs.entity_id is uuid, so keep the id in metadata
  logActivity({
    action: 'contract_type.create',
    entity: 'contract_type',
    metadata: { severity: 'medium', entity_name: name, contract_type_id: newId }
  })

  return newId
}

export interface ContractInvoiceRow {
  id: string
  invoice_number: string
  invoice_type: string
  status: string
  base_amount: number
  vat_amount: number
  total_amount: number
  paid_amount: number
  remaining_amount: number
  issue_date: string
  due_date: string
  description: string
  company_name: string
  contract_id: string
}

export const fetchContractInvoices = async (contractId: string): Promise<ContractInvoiceRow[]> => {
  type RawInvoice = { id: string; invoice_number: string; invoice_type: string; status: string; base_amount: number; vat_amount: number; total_amount: number; paid_amount: number; remaining_amount: number; issue_date: string; due_date: string; description: string; accounting_companies?: { name: string } | null; contracts?: { id: string } | null }

  const { data, error } = await supabase
    .from('accounting_invoices')
    .select(`
      id, invoice_number, invoice_type, status, base_amount, vat_amount,
      total_amount, paid_amount, remaining_amount, issue_date, due_date,
      description, company_id, contract_id,
      accounting_companies!accounting_invoices_company_id_fkey(name),
      contracts(id)
    `)
    .eq('contract_id', contractId)
    .order('issue_date', { ascending: false })

  if (error) throw error

  return ((data as unknown as RawInvoice[]) || []).map((inv) => ({
    id: inv.id,
    invoice_number: inv.invoice_number,
    invoice_type: inv.invoice_type,
    status: inv.status,
    base_amount: Number(inv.base_amount),
    vat_amount: Number(inv.vat_amount),
    total_amount: Number(inv.total_amount),
    paid_amount: Number(inv.paid_amount),
    remaining_amount: Number(inv.remaining_amount),
    issue_date: inv.issue_date,
    due_date: inv.due_date,
    description: inv.description || '',
    company_name: inv.accounting_companies?.name || 'N/A',
    contract_id: inv.contracts?.id || ''
  }))
}

export const fetchContractInvoiceTotals = async (contractId: string): Promise<{ totalInvoiceAmount: number; totalPaidAmount: number }> => {
  const { data, error } = await supabase
    .from('accounting_invoices')
    .select('total_amount, paid_amount')
    .eq('contract_id', contractId)

  if (error) throw error

  const totalInvoiceAmount = (data || []).reduce((sum, inv) => sum + parseFloat(inv.total_amount || '0'), 0)
  const totalPaidAmount = (data || []).reduce((sum, inv) => sum + parseFloat(inv.paid_amount || '0'), 0)
  return { totalInvoiceAmount, totalPaidAmount }
}

export interface ContractDetailsRow {
  contract_number: string
  base_amount: number
  vat_rate: number
  vat_amount: number
  total_amount: number
  end_date: string
  contract_type_name?: string
  status: string
}

export const fetchContractDetails = async (contractId: string): Promise<ContractDetailsRow | null> => {
  const { data, error } = await supabase
    .from('contracts')
    .select('contract_number, base_amount, vat_rate, vat_amount, total_amount, end_date, status, contract_types:contract_type_id(name)')
    .eq('id', contractId)
    .maybeSingle()

  if (error) throw error
  if (!data) return null

  return {
    contract_number: data.contract_number,
    base_amount: data.base_amount || 0,
    vat_rate: data.vat_rate || 0,
    vat_amount: data.vat_amount || 0,
    total_amount: data.total_amount || 0,
    end_date: data.end_date,
    contract_type_name: (data.contract_types as unknown as { name: string } | null)?.name,
    status: data.status
  }
}

export interface ContractFormDataResult {
  phases: { id: string; phase_name: string; project_id: string }[]
  contract_type_id: number
  base_amount: number
  vat_rate: number
}

export const fetchContractFormData = async (contractId: string): Promise<ContractFormDataResult> => {
  const { data: contractData, error: contractError } = await supabase
    .from('contracts')
    .select('project_id, contract_type_id, base_amount, vat_rate')
    .eq('id', contractId)
    .single()

  if (contractError) throw contractError

  const { data: phasesData, error: phasesError } = await supabase
    .from('project_phases')
    .select('id, phase_name, project_id')
    .eq('project_id', contractData.project_id)
    .order('phase_number')

  if (phasesError) throw phasesError

  return {
    phases: phasesData || [],
    contract_type_id: contractData.contract_type_id || 0,
    base_amount: contractData.base_amount || 0,
    vat_rate: contractData.vat_rate || 0
  }
}
