export interface RetailLandPlot {
  id: string
  owner_first_name: string
  owner_last_name: string
  plot_number: string
  total_area_m2: number
  purchased_area_m2: number
  price_per_m2: number
  total_price: number
  payment_date: string | null
  payment_status: 'paid' | 'pending' | 'partial'
  notes: string | null
  created_at: string
  updated_at: string
}

export interface RetailCustomer {
  id: string
  name: string
  contact_phone: string | null
  contact_email: string | null
  oib: string | null
  address: string | null
  created_at: string
  updated_at: string
}

export interface RetailSale {
  id: string
  land_plot_id: string
  customer_id: string
  sale_area_m2: number
  sale_price_per_m2: number
  total_sale_price: number
  payment_deadline: string
  paid_amount: number
  remaining_amount: number
  payment_status: 'paid' | 'pending' | 'partial' | 'overdue'
  contract_number: string | null
  notes: string | null
  created_at: string
  updated_at: string
  land_plot?: RetailLandPlot
  customer?: RetailCustomer
}

export interface RetailLandPlotWithSales extends RetailLandPlot {
  sales: RetailSale[]
  total_sold_area: number
  total_revenue: number
  available_area: number
}

export interface RetailCustomerWithSales extends RetailCustomer {
  sales: RetailSale[]
  total_purchased_area: number
  total_spent: number
  total_paid: number
  total_remaining: number
}

export interface RetailProject {
  id: string
  name: string
  location: string
  plot_number: string
  total_area_m2: number
  purchase_price: number
  price_per_m2: number
  status: 'Planning' | 'In Progress' | 'Completed' | 'On Hold'
  start_date: string | null
  end_date: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

export interface RetailProjectPhase {
  id: string
  project_id: string
  phase_name: string
  phase_type: 'acquisition' | 'development' | 'sales'
  phase_order: number
  budget_allocated: number
  status: 'Pending' | 'In Progress' | 'Completed'
  start_date: string | null
  end_date: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

export interface RetailSupplier {
  id: string
  name: string
  supplier_type: 'Geodet' | 'Arhitekt' | 'Projektant' | 'Consultant' | 'Other'
  contact_person: string | null
  contact_phone: string | null
  contact_email: string | null
  oib: string | null
  address: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

export interface RetailContract {
  id: string
  phase_id: string
  supplier_id: string
  contract_number: string
  contract_amount: number
  budget_realized: number
  status: 'Active' | 'Completed' | 'Cancelled'
  start_date: string | null
  end_date: string | null
  notes: string | null
  created_at: string
  updated_at: string
  supplier?: RetailSupplier
}

export interface RetailContractMilestone {
  id: string
  contract_id: string
  customer_id: string
  milestone_name: string
  amount: number
  status: 'pending' | 'approved' | 'in_progress' | 'completed' | 'paid'
  due_date: string | null
  completed_date: string | null
  notes: string | null
  created_at: string
  updated_at: string
  customer?: RetailCustomer
}

export interface RetailProjectWithPhases extends RetailProject {
  phases: RetailProjectPhase[]
}

export interface RetailPhaseWithContracts extends RetailProjectPhase {
  contracts: RetailContract[]
}

export interface RetailContractWithMilestones extends RetailContract {
  milestones: RetailContractMilestone[]
}
