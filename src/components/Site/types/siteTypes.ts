import { Project, Subcontractor, ProjectPhase, WirePayment } from '../../../lib/supabase'

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
}

export interface PhaseFormInput {
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
  budget_realized: number
  phase_id: string
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
