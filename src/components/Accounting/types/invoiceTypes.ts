export interface Company {
  id: string
  name: string
  tax_id: string
  vat_id: string
}

export interface CompanyBankAccount {
  id: string
  company_id: string
  bank_name: string
  account_number: string | null
  current_balance: number
}

export interface CompanyCredit {
  id: string
  company_id: string
  credit_name: string
  amount: number
  outstanding_balance: number
  used_amount: number
  repaid_amount: number
}

export interface CreditAllocation {
  id: string
  credit_id: string
  project_id: string | null
  allocated_amount: number
  used_amount: number
  description: string | null
  project?: {
    id: string
    name: string
  }
}

export interface Supplier {
  id: string
  name: string
  contact: string
}

export interface OfficeSupplier {
  id: string
  name: string
  contact: string | null
  email: string | null
}

export interface Customer {
  id: string
  name: string
  surname: string
  email: string
}

export interface Project {
  id: string
  name: string
}

export interface Refund {
  id: number
  name: string
}

export interface Contract {
  id: string
  contract_number: string
  project_id: string
  phase_id: string | null
  subcontractor_id: string
  job_description: string
  contract_amount: number
  projects?: { name: string }
  phases?: { phase_name: string }
}

export interface Milestone {
  id: string
  contract_id: string
  milestone_number: number
  milestone_name: string
  description: string
  percentage: number
  due_date: string | null
  status: 'pending' | 'completed' | 'paid'
}

export interface Invoice {
  id: string
  invoice_type: 'INCOMING_SUPPLIER' | 'INCOMING_INVESTMENT' | 'OUTGOING_SUPPLIER' | 'OUTGOING_SALES' | 'INCOMING_OFFICE' | 'OUTGOING_OFFICE' | 'INCOMING_BANK' | 'OUTGOING_BANK'
  invoice_category?: string
  company_id: string
  company_bank_account_id: string | null
  supplier_id: string | null
  customer_id: string | null
  retail_supplier_id: string | null
  retail_customer_id: string | null
  investor_id: string | null
  bank_id: string | null
  apartment_id: string | null
  contract_id: string | null
  milestone_id: string | null
  office_supplier_id: string | null
  invoice_number: string
  reference_number?: string | null
  iban?: string | null
  issue_date: string
  due_date: string
  base_amount: number
  vat_rate: number
  vat_amount: number
  base_amount_1: number
  vat_rate_1: number
  vat_amount_1: number
  base_amount_2: number
  vat_rate_2: number
  vat_amount_2: number
  base_amount_3: number
  vat_rate_3: number
  vat_amount_3: number
  base_amount_4: number
  vat_rate_4: number
  vat_amount_4: number
  total_amount: number
  category: string
  project_id: string | null
  refund_id: number | null
  description: string
  status: 'UNPAID' | 'PARTIALLY_PAID' | 'PAID'
  paid_amount: number
  remaining_amount: number
  approved: boolean
  created_at: string
  companies?: { name: string }
  subcontractors?: { name: string }
  customers?: { name: string; surname: string }
  retail_suppliers?: { name: string }
  retail_customers?: { name: string }
  investors?: { name: string }
  banks?: { name: string }
  projects?: { name: string }
  contracts?: { contract_number: string; job_description: string }
  office_suppliers?: { name: string }
  refunds?: { name: string }
}
