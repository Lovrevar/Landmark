export interface Project {
  id: string
  name: string
  location: string
  budget: number
  status: string
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
  /**
   * `'junior' | 'senior'`, and the reason a line of credit has two labels rather than one
   * (`getCreditTypeLabelKey`). The dashboard service selects `*`, so the column has always been
   * present in this data — it was simply missing from the type.
   */
  credit_seniority?: string | null
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

/**
 * One line in the investment dashboard's activity feed.
 *
 * `title` and `description` used to be English sentences built in
 * `investmentDashboardService` ("Credit facility approved", "… matures in 12 days") and
 * rendered verbatim into a Croatian dashboard. The service has no translator, so it now hands
 * over `type` plus the values that go into the sentence and `InvestmentDashboard` looks up
 * `dashboards.investment.activity.<type>.*`. Same shape as `DerivedAlert` on the Director
 * dashboard.
 */
export interface RecentActivity {
  id: string
  type: 'credit' | 'maturity' | 'usage_expiring'
  /** Interpolation values for the activity's title and description. */
  params: Record<string, string | number>
  date: string
  amount?: number
}
