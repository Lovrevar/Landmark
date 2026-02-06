export interface Contract {
  id: string
  contract_number: string
  project_id: string
  phase_id: string | null
  job_description: string
  contract_amount: number
  budget_realized: number
  end_date: string | null
  status: string
  projects?: { name: string }
  phases?: { phase_name: string }
  actual_paid?: number
}

export interface Invoice {
  id: string
  invoice_number: string
  invoice_type: string
  base_amount: number
  total_amount: number
  paid_amount: number
  remaining_amount: number
  status: string
  issue_date: string
  actual_paid?: number
}

export interface Payment {
  id: string
  payment_date: string
  amount: number
  payment_method: string
}

export interface SupplierSummary {
  id: string
  name: string
  contact: string
  source: 'site' | 'retail'
  supplier_type?: string
  total_contracts: number
  total_contract_value: number
  total_paid: number
  total_paid_neto: number
  total_paid_pdv: number
  total_paid_total: number
  total_remaining: number
  total_invoices: number
  contracts: Contract[]
  invoices: Invoice[]
}

export interface SupplierFormData {
  name: string
  contact: string
  project_id: string
  phase_id: string
}

export interface Project {
  id: string
  name: string
}

export interface Phase {
  id: string
  phase_name: string
}
