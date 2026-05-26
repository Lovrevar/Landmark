import { supabase } from '../../../../lib/supabase'
import type { BankCompany, BankCredit, CreditAllocation, MyCompany, InvoiceCategory } from '../bankInvoiceTypes'

export async function fetchBanksForInvoice(): Promise<BankCompany[]> {
  const { data, error } = await supabase
    .from('banks')
    .select('id, name, contact_person, contact_email')
    .order('name')

  if (error) throw error
  return data || []
}

export async function fetchCreditsForBank(bankId: string): Promise<BankCredit[]> {
  const { data, error } = await supabase
    .from('bank_credits')
    .select('id, company_id, credit_name, amount, outstanding_balance')
    .eq('bank_id', bankId)
    .order('credit_name')

  if (error) throw error
  return data || []
}

export async function fetchMyCompaniesForInvoice(): Promise<MyCompany[]> {
  const { data, error } = await supabase
    .from('accounting_companies')
    .select('id, name')
    .order('name')

  if (error) throw error
  return data || []
}

export async function fetchActiveInvoiceCategories(): Promise<InvoiceCategory[]> {
  const { data, error } = await supabase
    .from('invoice_categories')
    .select('id, name')
    .eq('is_active', true)
    .order('sort_order')

  if (error) throw error
  return data || []
}

export async function fetchCreditAllocations(creditId: string): Promise<CreditAllocation[]> {
  const { data, error } = await supabase
    .from('credit_allocations')
    .select('id, credit_id, project_id, allocated_amount, used_amount, description, allocation_type, project:projects(id, name)')
    .eq('credit_id', creditId)
    .order('created_at', { ascending: true })

  if (error) throw error
  return (data || []) as unknown as CreditAllocation[]
}
