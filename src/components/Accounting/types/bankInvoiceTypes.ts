export interface BankInvoiceFormModalProps {
  onClose: () => void
  onSuccess: () => void
}

export interface BankCompany {
  id: string
  name: string
  contact_person?: string
  contact_email?: string
}

export interface BankCredit {
  id: string
  company_id: string
  credit_name: string
  amount: number
  outstanding_balance: number
}

export interface MyCompany {
  id: string
  name: string
}

export interface InvoiceCategory {
  id: string
  name: string
}

export interface BankInvoiceFormData {
  invoice_type: 'INCOMING_BANK' | 'OUTGOING_BANK'
  company_id: string
  bank_id: string
  bank_credit_id: string
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
  description: string
}

export interface CalculatedTotals {
  vat1: number
  vat2: number
  vat3: number
  vat4: number
  subtotal1: number
  subtotal2: number
  subtotal3: number
  subtotal4: number
  total: number
}
