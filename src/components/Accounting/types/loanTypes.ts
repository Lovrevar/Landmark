export interface CompanyLoan {
  id: string
  from_company_id: string
  from_bank_account_id: string
  to_company_id: string
  to_bank_account_id: string
  amount: number
  loan_date: string
  created_at: string
  from_company: { name: string }
  to_company: { name: string }
  from_bank_account: { bank_name: string; account_number: string | null }
  to_bank_account: { bank_name: string; account_number: string | null }
}

export interface Company {
  id: string
  name: string
  oib: string
}

export interface BankAccount {
  id: string
  company_id: string
  bank_name: string
  account_number: string | null
  current_balance: number
}

export interface LoanFormData {
  from_company_id: string
  from_bank_account_id: string
  to_company_id: string
  to_bank_account_id: string
  amount: string
  loan_date: string
}
