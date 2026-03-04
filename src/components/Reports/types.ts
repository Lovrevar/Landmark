import type { Project, Apartment, Customer, Sale, Subcontractor, Contract, WirePayment, ProjectPhase } from '../../lib/supabase'

// ── General Report ──────────────────────────────────────────────────────────

export interface ProjectData {
  id: string
  name: string
  location: string
  status: string
  budget: number
  revenue: number
  expenses: number
  units_sold: number
  total_units: number
  contracts: number
  phases_done: number
  total_phases: number
  equity: number
  debt: number
  sales_rate: number
  profit: number
  profit_margin: number
  risk_level: 'Low' | 'Medium' | 'High'
}

export interface ComprehensiveReport {
  executive_summary: {
    total_projects: number
    active_projects: number
    completed_projects: number
    total_revenue: number
    total_expenses: number
    total_profit: number
    profit_margin: number
    portfolio_value: number
    roi: number
  }
  kpis: {
    portfolio_value: number
    total_revenue: number
    net_profit: number
    roi: number
    sales_rate: number
    debt_equity_ratio: number
    active_projects: number
    total_customers: number
  }
  sales_performance: {
    total_units: number
    units_sold: number
    available_units: number
    reserved_units: number
    total_revenue: number
    avg_sale_price: number
    total_sales: number
    buyers: number
    active_leads: number
    conversion_rate: number
  }
  funding_structure: {
    total_equity: number
    total_debt: number
    debt_equity_ratio: number
    total_credit_lines: number
    available_credit: number
    active_investors: number
    active_banks: number
    bank_credits: number
    avg_interest_rate: number
    monthly_debt_service: number
  }
  construction_status: {
    total_contracts: number
    active_contracts: number
    completed_contracts: number
    contract_value: number
    budget_realized: number
    budget_utilization: number
    total_subcontractors: number
    total_phases: number
    completed_phases: number
    work_logs_7days: number
    total_milestones: number
    completed_milestones: number
  }
  accounting_overview: {
    total_invoices: number
    total_invoice_value: number
    paid_invoices: number
    paid_value: number
    pending_invoices: number
    pending_value: number
    overdue_invoices: number
    overdue_value: number
    payment_completion_rate: number
  }
  tic_cost_management: {
    total_companies: number
    total_tic_budget: number
    total_tic_spent: number
    tic_utilization: number
    companies_over_budget: number
  }
  office_expenses: {
    total_office_suppliers: number
    total_office_invoices: number
    total_office_spent: number
    avg_office_invoice: number
  }
  company_credits: {
    total_credits: number
    total_credit_value: number
    credits_available: number
    credits_used: number
    cesija_payments: number
    cesija_value: number
    total_allocations: number
    allocated_amount: number
  }
  company_loans: {
    total_loans: number
    total_loan_amount: number
    total_outstanding: number
    active_loans: number
  }
  bank_accounts: {
    total_accounts: number
    total_balance: number
    positive_balance_accounts: number
    negative_balance_accounts: number
  }
  buildings_units: {
    total_buildings: number
    total_units: number
    sold_units: number
    reserved_units: number
    available_units: number
    total_garages: number
    total_repositories: number
  }
  retail_portfolio: {
    total_retail_projects: number
    active_retail_projects: number
    total_land_plots: number
    total_retail_contracts: number
    retail_contract_value: number
    retail_budget_realized: number
    retail_phases: number
    completed_retail_phases: number
    total_retail_customers: number
    retail_suppliers: number
  }
  contract_types: Array<{
    name: string
    count: number
  }>
  cash_flow: Array<{
    month: string
    inflow: number
    outflow: number
    net: number
  }>
  projects: ProjectData[]
  risks: Array<{
    type: string
    count: number
    description: string
  }>
  insights: {
    top_projects: Array<{ name: string; revenue: number; sales_rate: number }>
    recommendations: string[]
  }
}

// ── Sales Report ─────────────────────────────────────────────────────────────

export interface SalesData {
  month: string
  sales: number
  revenue: number
  units_sold: number
}

export interface ProjectSalesReport {
  project: Project
  total_units: number
  sold_units: number
  available_units: number
  reserved_units: number
  total_revenue: number
  average_price: number
  sales_rate: number
  monthly_sales: SalesData[]
  apartments: Apartment[]
  sales: Sale[]
}

export interface CustomerReport {
  total_customers: number
  buyers: number
  interested: number
  leads: number
  total_revenue: number
  average_purchase: number
  customers: Customer[]
}

// ── Supervision Report ────────────────────────────────────────────────────────

export interface MonthlyData {
  month: string
  contracts: number
  payments: number
  subcontractors_paid: string
}

export interface WorkLog {
  id: string
  date: string
  subcontractor_id: string
  work_description: string
  status: string
  color: string
  notes: string | null
  blocker_details: string | null
  created_at: string
  subcontractors?: { name: string }
  contracts?: { contract_number: string; job_description: string }
}

export interface ProjectSupervisionReport {
  project: Project
  total_budget: number
  budget_used: number
  remaining_budget: number
  total_contracts: number
  active_contracts: number
  completed_contracts: number
  total_phases: number
  completed_phases: number
  total_subcontractors: number
  total_payments: number
  total_work_logs: number
  monthly_data: MonthlyData[]
  contracts: Contract[]
  phases: ProjectPhase[]
  subcontractors: Subcontractor[]
  payments: WirePayment[]
  work_logs: WorkLog[]
  investors: string
}
