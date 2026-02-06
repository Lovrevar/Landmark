export interface Invoice {
  id: string
  invoice_number: string
  invoice_type: 'INCOMING_SUPPLIER' | 'INCOMING_INVESTMENT' | 'OUTGOING_SUPPLIER' | 'OUTGOING_SALES' | 'INCOMING_OFFICE' | 'OUTGOING_OFFICE' | 'INCOMING_BANK' | 'OUTGOING_BANK'
  supplier_id: string | null
  customer_id: string | null
  office_supplier_id: string | null
  due_date: string
  total_amount: number
  base_amount: number
  vat_amount: number
  status: 'UNPAID' | 'PARTIALLY_PAID' | 'PAID'
  paid_amount: number
  remaining_amount: number
  company_id: string
  category: string | null
  company?: { name: string }
  supplier?: { name: string }
  customer?: { name: string }
  office_supplier?: { name: string }
  bank_company?: { name: string }
}

export interface MonthlyBudget {
  id: string
  year: number
  month: number
  budget_amount: number
  notes: string
}
