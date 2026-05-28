import { supabase } from '../../../../lib/supabase'
import { logActivity } from '../../../../lib/activityLog'
import { OfficeSupplierWithStats, Invoice, OfficeSupplierFormData } from '../types'

export const fetchSuppliersWithStats = async (): Promise<OfficeSupplierWithStats[]> => {
  const { data: suppliersData, error: suppliersError } = await supabase
    .from('office_suppliers')
    .select('*')
    .order('name')

  if (suppliersError) throw suppliersError

  const suppliers = suppliersData || []
  if (suppliers.length === 0) return []

  const supplierIds = suppliers.map(s => s.id)
  const { data: invoicesData } = await supabase
    .from('accounting_invoices')
    .select('office_supplier_id, base_amount, total_amount, paid_amount, remaining_amount')
    .in('office_supplier_id', supplierIds)

  const statsBySupplier = new Map<string, { count: number; base: number; total: number; paid: number }>()
  for (const id of supplierIds) statsBySupplier.set(id, { count: 0, base: 0, total: 0, paid: 0 })

  for (const inv of invoicesData || []) {
    const stats = statsBySupplier.get(inv.office_supplier_id)
    if (!stats) continue
    stats.count += 1
    stats.base += parseFloat(inv.base_amount || 0)
    stats.total += parseFloat(inv.total_amount || 0)
    stats.paid += parseFloat(inv.paid_amount || 0)
  }

  return suppliers.map(supplier => {
    const stats = statsBySupplier.get(supplier.id) || { count: 0, base: 0, total: 0, paid: 0 }
    return {
      ...supplier,
      total_invoices: stats.count,
      total_amount: stats.base,
      paid_amount: stats.paid,
      remaining_amount: stats.total - stats.paid
    }
  })
}

export const createSupplier = async (formData: OfficeSupplierFormData): Promise<void> => {
  const supplierData = {
    name: formData.name,
    contact: formData.contact || null,
    email: formData.email || null,
    address: formData.address || null,
    tax_id: formData.tax_id || null,
    vat_id: formData.vat_id || null
  }

  const { data: inserted, error } = await supabase
    .from('office_suppliers')
    .insert([supplierData])
    .select('id')
    .maybeSingle()

  if (error) throw error

  logActivity({ action: 'office_supplier.create', entity: 'office_supplier', entityId: inserted?.id ?? null, metadata: { severity: 'low', entity_name: formData.name } })
}

export const updateSupplier = async (id: string, formData: OfficeSupplierFormData): Promise<void> => {
  const supplierData = {
    name: formData.name,
    contact: formData.contact || null,
    email: formData.email || null,
    address: formData.address || null,
    tax_id: formData.tax_id || null,
    vat_id: formData.vat_id || null
  }

  const { error } = await supabase
    .from('office_suppliers')
    .update(supplierData)
    .eq('id', id)

  if (error) throw error
}

export const deleteSupplier = async (id: string): Promise<void> => {
  const { error } = await supabase
    .from('office_suppliers')
    .delete()
    .eq('id', id)

  if (error) throw error

  logActivity({ action: 'office_supplier.delete', entity: 'office_supplier', entityId: id, metadata: { severity: 'medium' } })
}

export const fetchSupplierInvoices = async (supplierId: string): Promise<Invoice[]> => {
  const { data, error } = await supabase
    .from('accounting_invoices')
    .select('*')
    .eq('office_supplier_id', supplierId)
    .order('issue_date', { ascending: false })

  if (error) throw error
  return data || []
}
