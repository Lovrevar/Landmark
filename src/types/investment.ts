export interface Project {
  id: string
  name: string
  location: string
  budget: number
  status: string
  investor: string
  start_date: string
  end_date: string
}

export interface Company {
  id: string
  name: string
  oib: string
}

export interface Bank {
  id: string
  name: string
  contact_person?: string
  contact_email?: string
}

export interface CreditAllocation {
  id: string
  credit_id: string
  project_id: string | null
  allocated_amount: number
  used_amount: number
  description: string | null
  project?: Project
}

export interface BankCredit {
  id: string
  credit_name: string
  company_id: string
  project_id: string | null
  amount: number
  used_amount: number
  repaid_amount: number
  outstanding_balance: number
  interest_rate: number
  start_date: string
  maturity_date: string | null
  usage_expiration_date: string | null
  status: string
  credit_type: string
  company?: Company
  project?: Project
  credit_allocations?: CreditAllocation[]
}

export interface FinancialSummary {
  total_portfolio_value: number
  total_debt: number
  total_equity: number
  debt_to_equity_ratio: number
  weighted_avg_interest: number
  upcoming_maturities: number
  total_credit_lines: number
  available_credit: number
  total_used_credit: number
  total_repaid_credit: number
}

export interface RecentActivity {
  id: string
  type: 'credit' | 'maturity' | 'usage_expiring'
  title: string
  description: string
  date: string
  amount?: number
}
