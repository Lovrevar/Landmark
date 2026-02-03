import { Project, Subcontractor, ProjectPhase, WirePayment, SubcontractorMilestone } from '../../../lib/supabase'

export interface ProjectWithPhases extends Project {
  phases: ProjectPhase[]
  subcontractors: Subcontractor[]
  completion_percentage: number
  total_subcontractor_cost: number
  overdue_subcontractors: number
  has_phases: boolean
  total_budget_allocated: number
  total_paid_out: number
}

export interface SubcontractorWithPhase extends Subcontractor {
  phase_name?: string
  job_description?: string
  deadline?: string
  cost?: number
  budget_realized?: number
  phase_id?: string
  contract_id?: string
  subcontractor_id?: string
  has_contract?: boolean
  invoice_total_paid?: number
  invoice_total_owed?: number
}

export interface SubcontractorWithMilestones extends Subcontractor {
  milestones: SubcontractorMilestone[]
  total_milestone_percentage: number
  remaining_percentage: number
}

export interface MilestoneWithCalculatedAmount extends SubcontractorMilestone {
  calculated_amount: number
}

export interface PhaseFormInput {
  id?: string
  phase_name: string
  budget_allocated: number
  start_date: string
  end_date: string
}

export interface EditPhaseFormData {
  phase_name: string
  budget_allocated: number
  start_date: string
  end_date: string
  status: 'planning' | 'active' | 'completed' | 'on_hold'
}

export interface SubcontractorFormData {
  existing_subcontractor_id: string
  name: string
  contact: string
  job_description: string
  deadline: string
  cost: number
  phase_id: string
  financed_by_type?: 'investor' | 'bank' | null
  financed_by_investor_id?: string | null
  financed_by_bank_id?: string | null
  has_contract?: boolean
}

export interface MilestoneFormData {
  contract_id: string
  milestone_name: string
  description: string
  percentage: number
  due_date: string | null
}

export interface MilestoneStats {
  total_percentage: number
  remaining_percentage: number
  total_amount: number
  total_paid: number
  pending_count: number
  completed_count: number
  paid_count: number
}

export interface CommentWithUser {
  id: string
  subcontractor_id: string
  user_id: string
  comment: string
  comment_type: 'completed' | 'issue' | 'general'
  created_at: string
  user?: {
    username: string
    role: string
  }
}

export type OnSelectProjectCallback = (project: ProjectWithPhases) => void
export type OnPhaseActionCallback = (phase: ProjectPhase) => void
export type OnSubcontractorActionCallback = (subcontractor: Subcontractor) => void
export type OnPaymentActionCallback = (payment: WirePayment) => void
export type OnMilestoneActionCallback = (milestone: SubcontractorMilestone) => void
