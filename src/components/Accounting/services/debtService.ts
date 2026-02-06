import { supabase } from '../../../lib/supabase'
import { DebtSummary } from '../types/debtTypes'

export const formatEuropeanNumber = (num: number): string => {
  const parts = num.toFixed(2).split('.')
  const integerPart = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  return `${integerPart},${parts[1]}`
}

export const fetchDebtData = async (): Promise<DebtSummary[]> => {
  const { data: invoicesData, error: invoicesError } = await supabase
    .from('accounting_invoices')
    .select(`
      id,
      supplier_id,
      retail_supplier_id,
      office_supplier_id,
      remaining_amount,
      paid_amount,
      status
    `)
    .in('status', ['UNPAID', 'PARTIALLY_PAID', 'PAID'])

  if (invoicesError) throw invoicesError

  const supplierIds = new Set<string>()
  const retailSupplierIds = new Set<string>()
  const officeSupplierIds = new Set<string>()

  ;(invoicesData || []).forEach(invoice => {
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
    name: string
    type: 'subcontractor' | 'retail_supplier' | 'office_supplier'
    unpaid: number
    paid: number
    invoiceCount: number
  }>()

  ;(invoicesData || []).forEach(invoice => {
    const supplierId = invoice.supplier_id || invoice.retail_supplier_id || invoice.office_supplier_id
    if (!supplierId) return

    const supplierInfo = supplierMap.get(supplierId)
    if (!supplierInfo) return

    if (!debtMap.has(supplierId)) {
      debtMap.set(supplierId, {
        name: supplierInfo.name,
        type: supplierInfo.type,
        unpaid: 0,
        paid: 0,
        invoiceCount: 0
      })
    }

    const debt = debtMap.get(supplierId)!
    debt.invoiceCount++

    const paidAmount = parseFloat(invoice.paid_amount?.toString() || '0')
    const remainingAmount = parseFloat(invoice.remaining_amount?.toString() || '0')

    debt.paid += paidAmount

    if (invoice.status === 'UNPAID' || invoice.status === 'PARTIALLY_PAID') {
      debt.unpaid += remainingAmount
    }
  })

  const debtSummaries: DebtSummary[] = Array.from(debtMap.entries())
    .map(([id, data]) => ({
      supplier_id: id,
      supplier_name: data.name,
      supplier_type: data.type,
      total_unpaid: data.unpaid,
      total_paid: data.paid,
      invoice_count: data.invoiceCount
    }))
    .filter(d => d.total_unpaid > 0 || d.total_paid > 0)

  return debtSummaries
}
