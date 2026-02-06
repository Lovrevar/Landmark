export interface ProjectReportData {
  id: string
  name: string
  location: string
  status: string
  total_area_m2: number
  land_cost: number
  development: PhaseReportData
  construction: PhaseReportData
  sales: PhaseReportData
  total_costs: number
  total_revenue: number
  total_collected: number
  total_outstanding: number
  profit: number
  roi: number
}

export interface PhaseReportData {
  budget_allocated: number
  contract_cost: number
  budget_realized: number
  unpaid: number
  contracts_count: number
}

export interface CustomerReportData {
  id: string
  name: string
  total_contracts: number
  total_amount: number
  total_paid: number
  total_remaining: number
  total_area_m2: number
}

export interface SupplierReportData {
  id: string
  name: string
  supplier_type: string
  total_contracts: number
  total_amount: number
  total_paid: number
}

export interface SupplierTypeSummary {
  type: string
  count: number
  total_amount: number
  total_paid: number
}

export interface InvoiceSummary {
  total: number
  paid: number
  pending: number
  overdue: number
  total_amount: number
  paid_amount: number
  remaining_amount: number
  overdue_amount: number
}

export interface RetailReportData {
  portfolio: {
    total_projects: number
    active_projects: number
    completed_projects: number
    total_land_area: number
    total_land_investment: number
    total_land_plots: number
    total_development_cost: number
    total_construction_cost: number
    total_sales_revenue: number
    total_collected: number
    total_outstanding: number
    total_costs: number
    profit: number
    roi: number
    total_customers: number
    total_suppliers: number
    avg_price_per_m2: number
  }
  projects: ProjectReportData[]
  customers: CustomerReportData[]
  suppliers: SupplierReportData[]
  supplier_types: SupplierTypeSummary[]
  invoices: InvoiceSummary
}
