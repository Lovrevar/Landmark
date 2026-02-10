export interface Company {
  id: string
  name: string
  oib: string
  initial_balance: number
  created_at: string
}

export interface BankAccount {
  id?: string
  bank_name: string
  account_number?: string | null
  initial_balance: number
  current_balance: number
}

export interface Credit {
  id: string
  credit_name: string
  start_date: string
  maturity_date: string
  grace_period_months: number
  interest_rate: number
  amount: number
  used_amount: number
  repaid_amount: number
  outstanding_balance: number
  disbursed_to_account?: boolean
  allocations?: Array<{
    id: string
    allocated_amount: number
    description?: string
    project?: {
      id: string
      name: string
    }
  }>
}

export interface Invoice {
  id: string
  invoice_number: string
  invoice_type: 'INCOMING_SUPPLIER' | 'INCOMING_INVESTMENT' | 'OUTGOING_SUPPLIER' | 'OUTGOING_SALES' | 'INCOMING_OFFICE' | 'OUTGOING_OFFICE' | 'OUTGOING_RETAIL_DEVELOPMENT' | 'OUTGOING_RETAIL_CONSTRUCTION' | 'INCOMING_RETAIL_SALES'
  invoice_category: string
  total_amount: number
  paid_amount: number
  remaining_amount: number
  status: string
  issue_date: string
  supplier?: { name: string }
  customer?: { name: string; surname: string }
  office_supplier?: { name: string }
  retail_supplier?: { name: string }
  retail_customer?: { name: string }
  company?: { name: string }
  bank?: { name: string }
  is_cesija_payment?: boolean
  cesija_company_id?: string
  cesija_company_name?: string
  payments?: Array<{
    is_cesija: boolean
    cesija_company_id: string | null
    cesija_bank_account_id: string | null
  }>
}

export interface CompanyStats {
  id: string
  name: string
  oib: string
  initial_balance: number
  total_income_invoices: number
  total_income_amount: number
  total_income_paid: number
  total_income_unpaid: number
  total_expense_invoices: number
  total_expense_amount: number
  total_expense_paid: number
  total_expense_unpaid: number
  current_balance: number
  profit: number
  revenue: number
  bank_accounts: BankAccount[]
  credits: Credit[]
  invoices: Invoice[]
}

export interface CompanyFormData {
  name: string
  oib: string
  accountCount: number
  bankAccounts: Array<{
    id?: string
    bank_name: string
    initial_balance: number
  }>
}
