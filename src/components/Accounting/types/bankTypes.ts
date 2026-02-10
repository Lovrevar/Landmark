export interface BankCredit {
  id: string
  bank_id: string
  company_id?: string
  project_id?: string
  credit_name?: string
  credit_type: string
  credit_seniority: string
  amount: number
  used_amount: number
  repaid_amount: number
  outstanding_balance: number
  interest_rate: number
  start_date: string
  maturity_date: string
  usage_expiration_date?: string
  grace_period?: number
  purpose?: string
  status: string
  repayment_type: string
  principal_repayment_type?: string
  interest_repayment_type?: string
  monthly_payment: number
  disbursed_to_account?: boolean
  disbursed_to_bank_account_id?: string
  project?: {
    id: string
    name: string
  }
  accounting_companies?: {
    name: string
  }
}

export interface BankWithCredits {
  id: string
  name: string
  contact_person?: string
  contact_email?: string
  contact_phone?: string
  total_credit_limit: number
  outstanding_debt: number
  available_funds: number
  interest_rate: number
  total_used: number
  total_repaid: number
  total_outstanding: number
  credits: BankCredit[]
}

export interface Project {
  id: string
  name: string
}

export interface Company {
  id: string
  name: string
  oib: string
}

export interface CompanyBankAccount {
  id: string
  company_id: string
  bank_id: string
  account_number: string
  current_balance: number
  bank?: {
    id: string
    name: string
  }
}

export interface NewCreditForm {
  bank_id: string
  company_id: string
  project_id: string
  credit_name: string
  credit_type: 'construction_loan_senior' | 'term_loan_senior' | 'line_of_credit_senior' | 'line_of_credit_junior' | 'bridge_loan_senior'
  amount: number
  interest_rate: number
  start_date: string
  maturity_date: string
  outstanding_balance: number
  monthly_payment: number
  purpose: string
  usage_expiration_date: string
  grace_period: number
  repayment_type: 'monthly' | 'yearly'
  credit_seniority: 'senior' | 'junior'
  principal_repayment_type: 'monthly' | 'quarterly' | 'biyearly' | 'yearly'
  interest_repayment_type: 'monthly' | 'quarterly' | 'biyearly' | 'yearly'
  disbursed_to_account?: boolean
  disbursed_to_bank_account_id?: string
}

export interface PaymentCalculation {
  principalPerPayment: number
  interestPerPayment: number
  totalPrincipalPayments: number
  totalInterestPayments: number
  paymentStartDate: Date
  principalFrequency: string
  interestFrequency: string
}
