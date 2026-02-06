export interface Invoice {
  id: string
  invoice_number: string
  invoice_type: 'INCOMING_SUPPLIER' | 'INCOMING_INVESTMENT' | 'OUTGOING_SUPPLIER' | 'OUTGOING_SALES' | 'INCOMING_OFFICE' | 'OUTGOING_OFFICE' | 'INCOMING_BANK' | 'OUTGOING_BANK'
  total_amount: number
  paid_amount: number
  remaining_amount: number
  vat_amount: number
  company_id: string
  companies?: { name: string }
  subcontractors?: { name: string }
  customers?: { name: string; surname: string }
  office_suppliers?: { name: string }
  bank_company?: { name: string }
}

export interface CompanyBankAccount {
  id: string
  company_id: string
  bank_name: string
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

export interface Company {
  id: string
  name: string
}

export interface Payment {
  id: string
  invoice_id: string
  payment_date: string
  amount: number
  payment_method: 'WIRE' | 'CASH' | 'CHECK' | 'CARD'
  reference_number: string | null
  description: string
  created_at: string
  is_cesija: boolean
  cesija_company_id: string | null
  cesija_company_name?: string
  accounting_invoices?: Invoice
}

export interface PaymentFormData {
  invoice_id: string
  payment_source_type: 'bank_account' | 'credit'
  company_bank_account_id: string
  credit_id: string
  is_cesija: boolean
  cesija_company_id: string
  cesija_bank_account_id: string
  payment_date: string
  amount: number
  payment_method: 'WIRE' | 'CASH' | 'CHECK' | 'CARD'
  reference_number: string
  description: string
}

export interface VisibleColumns {
  payment_date: boolean
  invoice_number: boolean
  my_company: boolean
  invoice_type: boolean
  company_supplier: boolean
  amount: boolean
  payment_method: boolean
  reference_number: boolean
  description: boolean
}

export type FilterMethod = 'ALL' | 'WIRE' | 'CASH' | 'CHECK' | 'CARD'
export type FilterInvoiceType = 'ALL' | 'INCOME' | 'EXPENSE'
