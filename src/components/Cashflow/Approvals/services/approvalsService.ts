import { supabase } from '../../../../lib/supabase'

export interface ApprovedInvoice {
  id: string
  invoice_number: string
  invoice_type: string
  invoice_category: string
  issue_date: string
  due_date: string
  total_amount: number
  base_amount: number
  vat_amount: number
  status: string
  description: string
  approved: boolean
  supplier_name?: string
  company_name?: string
  project_name?: string
  phase_name?: string
  contract_number?: string
  is_retail?: boolean
}

export async function fetchApprovedInvoices(): Promise<ApprovedInvoice[]> {
  const [
    { data: subcontractorData, error: subError },
    { data: retailData, error: retailError }
  ] = await Promise.all([
    supabase
      .from('accounting_invoices')
      .select(`
        *,
        supplier:subcontractors!accounting_invoices_supplier_id_fkey(id, name),
        company:accounting_companies!accounting_invoices_company_id_fkey(id, name),
        project:projects!accounting_invoices_project_id_fkey(id, name),
        contract:contracts!accounting_invoices_contract_id_fkey(id, contract_number, phase_id)
      `)
      .eq('invoice_category', 'SUBCONTRACTOR')
      .eq('approved', true)
      .not('project_id', 'is', null)
      .order('issue_date', { ascending: true }),
    supabase
      .from('accounting_invoices')
      .select(`
        *,
        retail_supplier:retail_suppliers!accounting_invoices_retail_supplier_id_fkey(id, name),
        retail_customer:retail_customers!accounting_invoices_retail_customer_id_fkey(id, name),
        retail_project:retail_projects!accounting_invoices_retail_project_id_fkey(id, name),
        company:accounting_companies!accounting_invoices_company_id_fkey(id, name)
      `)
      .eq('invoice_category', 'RETAIL')
      .eq('approved', true)
      .order('issue_date', { ascending: true })
  ])

  if (subError) throw subError
  if (retailError) throw retailError

  const { data: hiddenInvoices, error: hiddenError } = await supabase
    .from('hidden_approved_invoices')
    .select('invoice_id')

  if (hiddenError) throw hiddenError

  const hiddenIds = new Set(hiddenInvoices?.map((h) => h.invoice_id) || [])

  const { data: phasesData } = await supabase
    .from('project_phases')
    .select('id, phase_name')

  const phasesMap = new Map(phasesData?.map((p) => [p.id, p.phase_name]) || [])

  const formattedSubcontractor: ApprovedInvoice[] = (subcontractorData || [])
    .filter((inv) => !hiddenIds.has(inv.id))
    .map((inv) => ({
      id: inv.id,
      invoice_number: inv.invoice_number,
      invoice_type: inv.invoice_type,
      invoice_category: inv.invoice_category,
      issue_date: inv.issue_date,
      due_date: inv.due_date,
      total_amount: parseFloat(inv.total_amount || '0'),
      base_amount: parseFloat(inv.base_amount || '0'),
      vat_amount: parseFloat(inv.vat_amount || '0'),
      status: inv.status,
      description: inv.description || '',
      approved: inv.approved,
      supplier_name: (inv.supplier as { name?: string } | null)?.name || 'N/A',
      company_name: (inv.company as { name?: string } | null)?.name || 'N/A',
      project_name: (inv.project as { name?: string } | null)?.name || 'N/A',
      phase_name:
        inv.contract && (inv.contract as { phase_id?: string } | null)?.phase_id
          ? phasesMap.get((inv.contract as { phase_id?: string }).phase_id!) || 'N/A'
          : 'N/A',
      contract_number: (inv.contract as { contract_number?: string } | null)?.contract_number || 'N/A',
      is_retail: false
    }))

  const formattedRetail: ApprovedInvoice[] = (retailData || [])
    .filter((inv) => !hiddenIds.has(inv.id))
    .map((inv) => ({
      id: inv.id,
      invoice_number: inv.invoice_number,
      invoice_type: inv.invoice_type,
      invoice_category: inv.invoice_category,
      issue_date: inv.issue_date,
      due_date: inv.due_date,
      total_amount: parseFloat(inv.total_amount || '0'),
      base_amount: parseFloat(inv.base_amount || '0'),
      vat_amount: parseFloat(inv.vat_amount || '0'),
      status: inv.status,
      description: inv.description || '',
      approved: inv.approved,
      supplier_name: (inv.retail_supplier as { name?: string } | null)?.name || (inv.retail_customer as { name?: string } | null)?.name || 'N/A',
      company_name: (inv.company as { name?: string } | null)?.name || 'N/A',
      project_name: (inv.retail_project as { name?: string } | null)?.name || 'N/A',
      phase_name: 'N/A',
      contract_number: 'N/A',
      is_retail: true
    }))

  return [...formattedSubcontractor, ...formattedRetail].sort(
    (a, b) => new Date(a.issue_date).getTime() - new Date(b.issue_date).getTime()
  )
}

export async function hideInvoice(invoiceId: string, userId: string): Promise<void> {
  const { error } = await supabase.from('hidden_approved_invoices').insert({
    invoice_id: invoiceId,
    hidden_by: userId
  })
  if (error && error.code !== '23505') throw error
}

export async function bulkHideInvoices(invoiceIds: string[], userId: string): Promise<void> {
  for (const id of invoiceIds) {
    await hideInvoice(id, userId)
  }
}
