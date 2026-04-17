import { supabase } from '../../../../lib/supabase'
import { logActivity } from '../../../../lib/activityLog'
import type { RetailCustomer } from '../../../../types/retail'

export interface CustomerWithStats extends RetailCustomer {
  total_purchased_area: number
  total_spent: number
  total_paid: number
  total_remaining: number
}

export interface RetailContractForDisplay {
  id: string
  contract_number: string
  contract_amount: number | null
  budget_realized: number | null
  total_surface_m2: number | null
  building_surface_m2: number | null
  price_per_m2: number | null
  status: string | null
  phase?: { phase_name: string; project?: { name: string; plot_number: string } | null } | null
  paid_amount: number
  remaining_amount: number
  payment_status: 'paid' | 'partial' | 'pending'
}

export interface CustomerDetailView extends RetailCustomer {
  sales?: RetailContractForDisplay[]
  total_purchased_area?: number
  total_spent?: number
  total_paid?: number
  total_remaining?: number
}

export interface CustomerFormData {
  name: string
  contact_phone: string
  contact_email: string
  oib: string
  address: string
}

export async function fetchCustomersWithStats(): Promise<CustomerWithStats[]> {
  const { data, error } = await supabase
    .from('retail_customers')
    .select('*')
    .order('name')

  if (error) throw error

  const customers = data || []

  if (customers.length === 0) return []

  // Fetch all contracts in one query instead of N+1
  const customerIds = customers.map(c => c.id)
  const { data: allContracts } = await supabase
    .from('retail_contracts')
    .select('id, customer_id, contract_amount, total_surface_m2, building_surface_m2')
    .in('customer_id', customerIds)

  const contractList = allContracts || []
  const contractIds = contractList.map(c => c.id)

  const invoiceMap = new Map<string, number>()
  if (contractIds.length > 0) {
    const { data: invoices } = await supabase
      .from('accounting_invoices')
      .select('retail_contract_id, paid_amount')
      .in('retail_contract_id', contractIds)

    for (const inv of invoices || []) {
      if (!inv.retail_contract_id) continue
      invoiceMap.set(
        inv.retail_contract_id,
        (invoiceMap.get(inv.retail_contract_id) || 0) + (inv.paid_amount || 0),
      )
    }
  }

  return customers.map(customer => {
    const contracts = contractList.filter(c => c.customer_id === customer.id)
    const total_purchased_area = contracts.reduce((sum, c) => sum + (c.total_surface_m2 || c.building_surface_m2 || 0), 0)
    const total_spent = contracts.reduce((sum, c) => sum + (c.contract_amount || 0), 0)
    const total_paid = contracts.reduce((sum, c) => sum + (invoiceMap.get(c.id) || 0), 0)
    return {
      ...customer,
      total_purchased_area,
      total_spent,
      total_paid,
      total_remaining: total_spent - total_paid,
    }
  })
}

export async function fetchCustomerContracts(customerId: string): Promise<RetailContractForDisplay[]> {
  const { data: contracts, error } = await supabase
    .from('retail_contracts')
    .select(`
      id,
      contract_number,
      contract_amount,
      budget_realized,
      total_surface_m2,
      building_surface_m2,
      price_per_m2,
      status,
      phase:retail_project_phases!inner(
        phase_name,
        project:retail_projects(name, plot_number)
      )
    `)
    .eq('customer_id', customerId)

  if (error) throw error

  const contractList = contracts || []
  if (contractList.length === 0) return []

  const contractIds = contractList.map(c => c.id)
  const { data: invoices } = await supabase
    .from('accounting_invoices')
    .select('retail_contract_id, paid_amount')
    .in('retail_contract_id', contractIds)

  const invoiceMap = new Map<string, number>()
  for (const inv of invoices || []) {
    if (!inv.retail_contract_id) continue
    invoiceMap.set(
      inv.retail_contract_id,
      (invoiceMap.get(inv.retail_contract_id) || 0) + (inv.paid_amount || 0),
    )
  }

  return contractList.map(contract => {
    const paid_amount = invoiceMap.get(contract.id) || 0
    const remaining_amount = (contract.contract_amount || 0) - paid_amount
    return {
      ...contract,
      paid_amount,
      remaining_amount,
      payment_status: remaining_amount === 0 ? 'paid' : paid_amount > 0 ? 'partial' : 'pending',
    } as unknown as RetailContractForDisplay
  })
}

export async function createCustomer(data: CustomerFormData): Promise<void> {
  const { data: inserted, error } = await supabase.from('retail_customers').insert([{
    name: data.name,
    contact_phone: data.contact_phone || null,
    contact_email: data.contact_email || null,
    oib: data.oib || null,
    address: data.address || null,
  }]).select('id').maybeSingle()
  if (error) throw error

  logActivity({ action: 'retail_customer.create', entity: 'retail_customer', entityId: inserted?.id ?? null, metadata: { severity: 'low', entity_name: data.name } })
}

export async function updateCustomer(id: string, data: CustomerFormData): Promise<void> {
  const { error } = await supabase
    .from('retail_customers')
    .update({
      name: data.name,
      contact_phone: data.contact_phone || null,
      contact_email: data.contact_email || null,
      oib: data.oib || null,
      address: data.address || null,
    })
    .eq('id', id)
  if (error) throw error

  logActivity({ action: 'retail_customer.update', entity: 'retail_customer', entityId: id, metadata: { severity: 'low', entity_name: data.name } })
}

export async function deleteCustomer(id: string): Promise<void> {
  const { error } = await supabase
    .from('retail_customers')
    .delete()
    .eq('id', id)
  if (error) throw error

  logActivity({ action: 'retail_customer.delete', entity: 'retail_customer', entityId: id, metadata: { severity: 'medium' } })
}
