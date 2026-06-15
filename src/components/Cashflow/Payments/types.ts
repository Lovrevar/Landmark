export interface Invoice {
  id: string
  invoice_number: string
  invoice_type: 'INCOMING_SUPPLIER' | 'INCOMING_INVESTMENT' | 'OUTGOING_SUPPLIER' | 'OUTGOING_SALES' | 'INCOMING_OFFICE' | 'OUTGOING_OFFICE' | 'INCOMING_BANK' | 'OUTGOING_BANK' | 'INCOMING_BANK_EXPENSES'
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
  retail_suppliers?: { name: string }
}

// Share the entity shapes with the Invoices module so the standalone payment
// flow can reuse PaymentFormModal's CesijaPaymentFields and credit-allocation UI.
export type { Company, CompanyBankAccount, CompanyCredit, CreditAllocation } from '../Invoices/types'

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
  cesija_bank_account_id?: string | null
  cesija_credit_id?: string | null
  cesija_credit_allocation_id?: string | null
  payment_source_type?: 'bank_account' | 'credit' | 'kompenzacija' | 'gotovina' | null
  credit_id?: string | null
  credit_allocation_id?: string | null
  company_bank_account_id?: string | null
  company_bank_accounts?: { bank_name: string; account_number?: string } | null
  bank_credits?: { credit_name: string } | null
  accounting_invoices?: Invoice
}

export interface PaymentFormData {
  invoice_id: string
  payment_source_type: 'bank_account' | 'credit' | 'kompenzacija' | 'gotovina'
  company_bank_account_id: string
  credit_id: string
  credit_allocation_id: string
  is_cesija: boolean
  cesija_company_id: string
  cesija_bank_account_id: string
  cesija_credit_id: string
  cesija_credit_allocation_id: string
  payment_date: string
  amount: number
  payment_method: 'WIRE' | 'CASH' | 'CHECK' | 'CARD'
  reference_number: string
  description: string
  // Loosened to allow CesijaPaymentFields' generic onFormChange merges
  [key: string]: unknown
}

export interface VisibleColumns {
  [key: string]: boolean
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
