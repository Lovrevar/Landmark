import type { Project, Apartment, Bank } from '../../lib/supabase'

// ── ProjectsManagement ────────────────────────────────────────────────────

export interface ProjectStats {
  total_spent: number
  completion_percentage: number
  milestones_completed: number
  milestones_total: number
}

export interface ProjectWithStats extends Project {
  stats: ProjectStats
}

// ── Shared ────────────────────────────────────────────────────────────────

export interface Milestone {
  id: string
  name: string
  due_date: string | null
  completed: boolean
  created_at?: string
}

// ── ProjectDetailsEnhanced ────────────────────────────────────────────────

export interface Phase {
  id: string
  phase_number: number
  phase_name: string
  budget_allocated: number
  budget_used: number
  start_date: string | null
  end_date: string | null
  status: string
}

export interface ContractWithDetails {
  id: string
  contract_number: string
  subcontractor: { id: string; name: string; contact: string }
  job_description: string
  contract_amount: number
  budget_realized: number
  status: string
  start_date: string | null
  end_date: string | null
  phase: { phase_name: string } | null
}

export interface ApartmentItem {
  id: string
  number: string
  floor: number
  size_m2: number
  price: number
  status: string
  buyer_name: string | null
}

export interface CreditAllocationItem {
  id: string
  allocated_amount: number
  used_amount: number
  description: string | null
  created_at: string
  bank_credits?: {
    credit_name: string
    credit_type: string
    start_date: string | null
    banks?: { name: string }
  }
}

export type TabType = 'overview' | 'phases' | 'apartments' | 'subcontractors' | 'financing' | 'milestones'

// ── ProjectDetails ────────────────────────────────────────────────────────

export interface SubcontractorMapped {
  id: string
  subcontractor_id: string
  name: string
  contact: string
  job_description: string
  deadline: string
  cost: number
  budget_realized: number
  progress: number
  phase_name?: string
}

export interface ProjectWithDetails extends Project {
  subcontractors: SubcontractorMapped[]
  invoices: any[]
  apartments: Apartment[]
  milestones: any[]
  total_spent: number
  total_revenue: number
  pending_invoices: number
  investors: string
}

// ── InvestmentProjects ────────────────────────────────────────────────────

export interface CreditAllocation {
  id: string
  credit_id: string
  project_id: string | null
  allocated_amount: number
  used_amount: number
  description: string | null
  created_at: string
  credit?: {
    id: string
    credit_name: string
    credit_type: string
    interest_rate: number
    start_date: string
    maturity_date: string
    usage_expiration_date: string | null
    outstanding_balance: number
    monthly_payment: number
    repayment_type: string
    bank?: Bank
  }
}

export interface ProjectWithFinancials extends Project {
  total_investment: number
  total_debt: number
  debt_allocations: CreditAllocation[]
  banks: Bank[]
  funding_ratio: number
  debt_to_equity: number
  expected_roi: number
  risk_level: 'Low' | 'Medium' | 'High'
}

export interface FundingUtilizationItem {
  id: string
  type: string
  name: string
  totalAmount: number
  spentAmount: number
  availableAmount: number
  usageExpirationDate: string | null
  investmentDate: string
}
