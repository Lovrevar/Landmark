import { supabase } from '../../../../lib/supabase'
import type {
  Company,
  RetailSupplier,
  RetailCustomer,
  RetailProject,
  RetailContract,
  RetailMilestone,
  InvoiceCategory,
  Refund,
} from '../retailInvoiceTypes'

export interface RetailInvoiceInitialData {
  companies: Company[]
  projects: RetailProject[]
  invoiceCategories: InvoiceCategory[]
  refunds: Refund[]
}

export async function fetchRetailInvoiceInitialData(): Promise<RetailInvoiceInitialData> {
  const [companiesRes, projectsRes, categoriesRes, refundsRes] = await Promise.all([
    supabase.from('accounting_companies').select('id, name').order('name'),
    supabase.from('retail_projects').select('id, name, plot_number').order('name'),
    supabase.from('invoice_categories').select('id, name').eq('is_active', true).order('sort_order'),
    supabase.from('accounting_invoices_refund').select('id, name').order('name'),
  ])

  if (companiesRes.error) throw companiesRes.error
  if (projectsRes.error) throw projectsRes.error

  return {
    companies: companiesRes.data || [],
    projects: projectsRes.data || [],
    invoiceCategories: categoriesRes.error ? [] : (categoriesRes.data || []),
    refunds: refundsRes.error ? [] : (refundsRes.data || []),
  }
}

export async function fetchRetailSuppliers(): Promise<RetailSupplier[]> {
  const { data, error } = await supabase
    .from('retail_suppliers')
    .select('id, name, contact_person')
    .order('name')

  if (error) throw error
  return data || []
}

export async function fetchRetailCustomers(): Promise<RetailCustomer[]> {
  const { data, error } = await supabase
    .from('retail_customers')
    .select('id, name, contact_email')
    .order('name')

  if (error) throw error
  return data || []
}

export async function fetchRetailContracts(
  projectId: string,
  entityType: 'supplier' | 'customer',
  entityId: string,
): Promise<RetailContract[]> {
  const entityColumn = entityType === 'supplier' ? 'supplier_id' : 'customer_id'
  const { data, error } = await supabase
    .from('retail_contracts')
    .select(`
      id,
      contract_number,
      phase_id,
      supplier_id,
      customer_id,
      phases:retail_project_phases!inner(phase_type, phase_name, project_id)
    `)
    .eq('retail_project_phases.project_id', projectId)
    .eq(entityColumn, entityId)
    .order('contract_number')

  if (error) throw error
  return (data || []) as unknown as RetailContract[]
}

export async function fetchRetailMilestones(contractId: string): Promise<RetailMilestone[]> {
  const { data, error } = await supabase
    .from('retail_contract_milestones')
    .select('id, milestone_number, milestone_name, percentage, status, due_date')
    .eq('contract_id', contractId)
    .order('milestone_number', { ascending: true })

  if (error) throw error
  return data || []
}
