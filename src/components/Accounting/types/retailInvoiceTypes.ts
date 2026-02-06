export interface Company {
  id: string
  name: string
}

export interface RetailSupplier {
  id: string
  name: string
  contact_person: string | null
}

export interface RetailCustomer {
  id: string
  name: string
  contact_email: string | null
}

export interface RetailProject {
  id: string
  name: string
  plot_number: string | null
}

export interface RetailContract {
  id: string
  contract_number: string
  phase_id: string
  supplier_id: string | null
  customer_id: string | null
  phases?: {
    phase_type: string
    phase_name: string
  }
}

export interface RetailMilestone {
  id: string
  milestone_number: number
  milestone_name: string
  percentage: number
  status: 'pending' | 'paid' | 'cancelled'
  due_date: string | null
}

export interface RetailInvoiceFormData {
  invoice_type: 'incoming' | 'outgoing'
  entity_type: 'customer' | 'supplier'
  entity_id: string
  company_id: string
  retail_project_id: string
  retail_contract_id: string
  retail_milestone_id: string
  invoice_number: string
  reference_number: string
  iban: string
  issue_date: string
  due_date: string
  base_amount: string
  vat_rate: string
  base_amount_1: number
  base_amount_2: number
  base_amount_3: number
  base_amount_4: number
  category: string
  notes: string
}

export interface InvoiceCategory {
  id: string
  name: string
}

export interface VatCalculation {
  vat1: number
  vat2: number
  vat3: number
  vat4: number
  subtotal1: number
  subtotal2: number
  subtotal3: number
  subtotal4: number
  totalAmount: number
}

export interface RetailInvoiceFormModalProps {
  onClose: () => void
  onSuccess: () => void
}
