export interface ProjectStats {
  id: string
  name: string
  location: string
  status: string
  budget: number
  total_expenses: number
  apartment_sales: number
  total_investment: number
  total_debt: number
  profit_margin: number
  completion_percentage: number
}

export interface FinancialMetrics {
  total_revenue: number
  total_expenses: number
  total_profit: number
  profit_margin: number
  total_debt: number
  total_equity: number
  debt_to_equity_ratio: number
  cash_flow_current_month: number
  outstanding_receivables: number
  outstanding_payables: number
}

export interface SalesMetrics {
  total_units: number
  sold_units: number
  reserved_units: number
  available_units: number
  sales_rate: number
  total_sales_revenue: number
  avg_price_per_unit: number
  monthly_sales_count: number
  monthly_sales_revenue: number
}

export interface ConstructionMetrics {
  total_subcontractors: number
  active_subcontractors: number
  completed_contracts: number
  total_contract_value: number
  total_paid: number
  pending_payments: number
  overdue_tasks: number
  critical_deadlines: number
}

export interface FundingMetrics {
  total_investors: number
  total_banks: number
  total_bank_credit: number
  outstanding_debt: number
  credit_paid_out: number
  avg_interest_rate: number
  monthly_debt_service: number
  upcoming_maturities: number
}

export interface Alert {
  type: 'critical' | 'warning' | 'info'
  title: string
  message: string
  date?: string
}
