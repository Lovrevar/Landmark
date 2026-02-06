import { supabase } from '../../../lib/supabase'
import { OfficeSupplier, OfficeSupplierWithStats, Invoice, OfficeSupplierFormData } from '../types/officeSupplierTypes'

export const fetchSuppliersWithStats = async (): Promise<OfficeSupplierWithStats[]> => {
  const { data: suppliersData, error: suppliersError } = await supabase
    .from('office_suppliers')
    .select('*')
    .order('name')

  if (suppliersError) throw suppliersError

  const suppliersWithStats = await Promise.all(
    (suppliersData || []).map(async (supplier) => {
      const { data: invoicesData } = await supabase
        .from('accounting_invoices')
        .select('base_amount, total_amount, paid_amount, remaining_amount')
        .eq('office_supplier_id', supplier.id)

      const invoices = invoicesData || []
      const total_amount = invoices.reduce((sum, inv) => sum + parseFloat(inv.base_amount || 0), 0)
      const total_amount_with_vat = invoices.reduce((sum, inv) => sum + parseFloat(inv.total_amount || 0), 0)
      const paid_amount = invoices.reduce((sum, inv) => sum + parseFloat(inv.paid_amount || 0), 0)

      return {
        ...supplier,
        total_invoices: invoices.length,
        total_amount,
        paid_amount,
        remaining_amount: total_amount_with_vat - paid_amount
      }
    })
  )

  return suppliersWithStats
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

  const { error } = await supabase
    .from('office_suppliers')
    .insert([supplierData])

  if (error) throw error
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
