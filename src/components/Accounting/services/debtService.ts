import { supabase } from '../../../lib/supabase'
import { DebtSummary } from '../types/debtTypes'

export const formatEuropeanNumber = (num: number): string => {
  const parts = num.toFixed(2).split('.')
  const integerPart = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  return `${integerPart},${parts[1]}`
}

export const fetchProjects = async () => {
  const [
    { data: siteProjects },
    { data: retailProjects }
  ] = await Promise.all([
    supabase.from('projects').select('id, name').order('name'),
    supabase.from('retail_projects').select('id, name').order('name')
  ])

  const allProjects = [
    ...(siteProjects || []).map(p => ({ ...p, type: 'site' as const })),
    ...(retailProjects || []).map(p => ({ ...p, type: 'retail' as const }))
  ].sort((a, b) => a.name.localeCompare(b.name))

  return allProjects
}

export const fetchDebtData = async (projectId?: string): Promise<DebtSummary[]> => {
  let invoicesQuery = supabase
    .from('accounting_invoices')
    .select(`
      id,
      supplier_id,
      retail_supplier_id,
      office_supplier_id,
      remaining_amount,
      paid_amount,
      status,
      contract_id,
      retail_contract_id
    `)
    .in('status', ['UNPAID', 'PARTIALLY_PAID', 'PAID'])

  const { data: invoicesData, error: invoicesError } = await invoicesQuery

  if (invoicesError) throw invoicesError

  let filteredInvoices = invoicesData || []

  if (projectId) {
    const contractIds = new Set<string>()
    const retailContractIds = new Set<string>()

    const [
      { data: contracts },
      { data: retailPhases }
    ] = await Promise.all([
      supabase
        .from('contracts')
        .select('id')
        .eq('project_id', projectId),
      supabase
        .from('retail_project_phases')
        .select('id')
        .eq('project_id', projectId)
    ])

    ;(contracts || []).forEach(c => contractIds.add(c.id))

    if (retailPhases && retailPhases.length > 0) {
      const phaseIds = retailPhases.map(p => p.id)
      const { data: retailContracts } = await supabase
        .from('retail_contracts')
        .select('id')
        .in('phase_id', phaseIds)

      ;(retailContracts || []).forEach(c => retailContractIds.add(c.id))
    }

    filteredInvoices = filteredInvoices.filter(inv => {
      if (inv.contract_id && contractIds.has(inv.contract_id)) return true
      if (inv.retail_contract_id && retailContractIds.has(inv.retail_contract_id)) return true
      return false
    })
  }

  const supplierIds = new Set<string>()
  const retailSupplierIds = new Set<string>()
  const officeSupplierIds = new Set<string>()

  filteredInvoices.forEach(invoice => {
    if (invoice.supplier_id) supplierIds.add(invoice.supplier_id)
    if (invoice.retail_supplier_id) retailSupplierIds.add(invoice.retail_supplier_id)
    if (invoice.office_supplier_id) officeSupplierIds.add(invoice.office_supplier_id)
  })

  const [
    { data: suppliersData },
    { data: retailSuppliersData },
    { data: officeSuppliersData }
  ] = await Promise.all([
    supabase
      .from('subcontractors')
      .select('id, name')
      .in('id', Array.from(supplierIds)),
    supabase
      .from('retail_suppliers')
      .select('id, name')
      .in('id', Array.from(retailSupplierIds)),
    supabase
      .from('office_suppliers')
      .select('id, name')
      .in('id', Array.from(officeSupplierIds))
  ])

  const supplierMap = new Map<string, { name: string; type: 'subcontractor' | 'retail_supplier' | 'office_supplier' }>()

  ;(suppliersData || []).forEach(s => {
    supplierMap.set(s.id, { name: s.name, type: 'subcontractor' })
  })
  ;(retailSuppliersData || []).forEach(s => {
    supplierMap.set(s.id, { name: s.name, type: 'retail_supplier' })
  })
  ;(officeSuppliersData || []).forEach(s => {
    supplierMap.set(s.id, { name: s.name, type: 'office_supplier' })
  })

  const debtMap = new Map<string, {
    types: Set<'subcontractor' | 'retail_supplier' | 'office_supplier'>
    unpaid: number
    paid: number
    invoiceCount: number
  }>()

  filteredInvoices.forEach(invoice => {
    const supplierId = invoice.supplier_id || invoice.retail_supplier_id || invoice.office_supplier_id
    if (!supplierId) return

    const supplierInfo = supplierMap.get(supplierId)
    if (!supplierInfo) return

    const supplierName = supplierInfo.name

    if (!debtMap.has(supplierName)) {
      debtMap.set(supplierName, {
        types: new Set(),
        unpaid: 0,
        paid: 0,
        invoiceCount: 0
      })
    }

    const debt = debtMap.get(supplierName)!
    debt.types.add(supplierInfo.type)
    debt.invoiceCount++

    const paidAmount = parseFloat(invoice.paid_amount?.toString() || '0')
    const remainingAmount = parseFloat(invoice.remaining_amount?.toString() || '0')

    debt.paid += paidAmount

    if (invoice.status === 'UNPAID' || invoice.status === 'PARTIALLY_PAID') {
      debt.unpaid += remainingAmount
    }
  })

  const debtSummaries: DebtSummary[] = Array.from(debtMap.entries())
    .map(([name, data]) => ({
      supplier_id: name,
      supplier_name: name,
      supplier_type: data.types.size > 1 ? 'mixed' : Array.from(data.types)[0] || 'subcontractor',
      total_unpaid: data.unpaid,
      total_paid: data.paid,
      invoice_count: data.invoiceCount
    }))
    .filter(d => d.total_unpaid > 0 || d.total_paid > 0)

  return debtSummaries
}
