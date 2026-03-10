export interface OfficeSupplier {
  id: string
  name: string
  contact: string | null
  email: string | null
  address: string | null
  tax_id: string | null
  vat_id: string | null
  created_at: string
}

export interface OfficeSupplierWithStats extends OfficeSupplier {
  total_invoices: number
  total_amount: number
  paid_amount: number
  remaining_amount: number
}

export interface Invoice {
  id: string
  invoice_number: string
  issue_date: string
  due_date: string
  base_amount: string
  total_amount: string
  paid_amount: string
  remaining_amount: string
  status: string
  description: string | null
}

export interface OfficeSupplierFormData {
  name: string
  contact: string
  email: string
  address: string
  tax_id: string
  vat_id: string
}
