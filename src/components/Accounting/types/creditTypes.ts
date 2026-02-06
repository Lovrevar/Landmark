export interface Company {
  id: string
  name: string
  oib: string
}

export interface Project {
  id: string
  name: string
}

export interface Credit {
  id: string
  company_id: string
  project_id: string | null
  credit_name: string
  start_date: string
  maturity_date: string
  grace_period: number
  interest_rate: number
  amount: number
  used_amount: number
  repaid_amount: number
  outstanding_balance: number
  created_at: string
}

export interface CreditWithCompany extends Credit {
  company: Company
  project?: Project
}

export interface CreditFormData {
  company_id: string
  project_id: string
  credit_name: string
  start_date: string
  end_date: string
  grace_period_months: number
  interest_rate: number
  initial_amount: number
}
