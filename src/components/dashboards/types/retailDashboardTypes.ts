export interface DashboardStats {
  total_projects: number
  total_customers: number
  total_invested: number
  total_costs: number
  total_revenue: number
  total_paid: number
  total_remaining: number
  profit: number
}

export interface OverdueInvoice {
  id: string
  invoice_number: string
  customer_name: string
  contract_number: string
  remaining_amount: number
  due_date: string
  days_overdue: number
}
