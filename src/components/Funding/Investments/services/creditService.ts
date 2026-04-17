import { supabase } from '../../../../lib/supabase'
import { logActivity } from '../../../../lib/activityLog'
import type { BankCredit, CreditAllocation, AllocationFormData, RawCreditInvoice, CreditInvoiceRow } from '../types'
import { mapCreditInvoice } from '../types'

export interface ReferenceItem {
  id: string
  name: string
}

export async function fetchCredits(): Promise<BankCredit[]> {
  const { data, error } = await supabase
    .from('bank_credits')
    .select(`
      *,
      bank:banks(id, name),
      project:projects(id, name),
      company:accounting_companies(id, name)
    `)
    .order('created_at', { ascending: false })

  if (error) throw error
  return data || []
}

export async function fetchAllocationsForCredit(creditId: string): Promise<CreditAllocation[]> {
  const { data, error } = await supabase
    .from('credit_allocations')
    .select(`
      *,
      project:projects(id, name)
    `)
    .eq('credit_id', creditId)
    .order('created_at', { ascending: false })

  if (error) throw error

  const enriched = await Promise.all((data || []).map(async (allocation) => {
    if (allocation.allocation_type === 'refinancing' && allocation.refinancing_entity_id) {
      if (allocation.refinancing_entity_type === 'company') {
        const { data: company } = await supabase
          .from('accounting_companies')
          .select('id, name')
          .eq('id', allocation.refinancing_entity_id)
          .maybeSingle()
        return { ...allocation, refinancing_company: company }
      } else if (allocation.refinancing_entity_type === 'bank') {
        const { data: bank } = await supabase
          .from('banks')
          .select('id, name')
          .eq('id', allocation.refinancing_entity_id)
          .maybeSingle()
        return { ...allocation, refinancing_bank: bank }
      }
    }
    return allocation
  }))

  return enriched as CreditAllocation[]
}

export async function fetchDisbursedAmounts(creditIds: string[]): Promise<Map<string, number>> {
  const { data, error } = await supabase
    .from('accounting_invoices')
    .select('bank_credit_id, total_amount, credit_allocation_id')
    .eq('invoice_type', 'OUTGOING_BANK')
    .in('bank_credit_id', creditIds)

  if (error) throw error

  const map = new Map<string, number>()
  for (const row of data || []) {
    if (!row.bank_credit_id) continue
    if (!row.credit_allocation_id) {
      map.set(row.bank_credit_id, (map.get(row.bank_credit_id) || 0) + Number(row.total_amount))
    }
  }
  return map
}

export async function fetchProjects(): Promise<ReferenceItem[]> {
  const { data, error } = await supabase
    .from('projects')
    .select('id, name')
    .order('name', { ascending: true })

  if (error) throw error
  return data || []
}

export async function fetchCompanies(): Promise<ReferenceItem[]> {
  const { data, error } = await supabase
    .from('accounting_companies')
    .select('id, name')
    .order('name', { ascending: true })

  if (error) throw error
  return data || []
}

export async function fetchBanks(): Promise<ReferenceItem[]> {
  const { data, error } = await supabase
    .from('banks')
    .select('id, name')
    .order('name', { ascending: true })

  if (error) throw error
  return data || []
}

export async function createAllocation(creditId: string, form: AllocationFormData): Promise<void> {
  const payload: {
    credit_id: string
    allocation_type: string
    allocated_amount: number
    description: string
    project_id: string | null
    refinancing_entity_type: string | null
    refinancing_entity_id: string | null
  } = {
    credit_id: creditId,
    allocation_type: form.allocation_type,
    allocated_amount: form.allocated_amount,
    description: form.description,
    project_id: null,
    refinancing_entity_type: null,
    refinancing_entity_id: null,
  }

  if (form.allocation_type === 'project') {
    payload.project_id = form.project_id || null
  } else if (form.allocation_type === 'refinancing') {
    payload.refinancing_entity_type = form.refinancing_entity_type
    payload.refinancing_entity_id = form.refinancing_entity_id
  }

  const { data: inserted, error } = await supabase.from('credit_allocations').insert(payload).select('id').maybeSingle()
  if (error) throw error

  logActivity({ action: 'credit_allocation.create', entity: 'credit_allocation', entityId: inserted?.id ?? null, metadata: { severity: 'high', amount: form.allocated_amount, allocation_type: form.allocation_type } })
}

export async function deleteAllocation(allocationId: string): Promise<void> {
  const { error } = await supabase
    .from('credit_allocations')
    .delete()
    .eq('id', allocationId)

  if (error) throw error

  logActivity({ action: 'credit_allocation.delete', entity: 'credit_allocation', entityId: allocationId, metadata: { severity: 'high' } })
}

export async function fetchCreditInvoices(
  creditId: string,
  invoiceType: string,
  showAllocation: boolean,
): Promise<CreditInvoiceRow[]> {
  const selectFields = showAllocation
    ? `
        id,
        invoice_number,
        issue_date,
        total_amount,
        status,
        description,
        company:accounting_companies(name),
        bank:banks(name),
        payments:accounting_payments(payment_date, amount),
        credit_allocation:credit_allocations(
          allocation_type,
          project:projects(name)
        )
      `
    : `
        id,
        invoice_number,
        issue_date,
        total_amount,
        status,
        description,
        company:accounting_companies(name),
        bank:banks(name),
        payments:accounting_payments(payment_date, amount)
      `

  const { data, error } = await supabase
    .from('accounting_invoices')
    .select(selectFields)
    .eq('invoice_type', invoiceType)
    .eq('bank_credit_id', creditId)
    .order('issue_date', { ascending: false })

  if (error) throw error
  return (data as unknown as RawCreditInvoice[] || []).map(mapCreditInvoice)
}
