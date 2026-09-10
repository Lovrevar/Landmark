import { Project, Subcontractor, ProjectPhase, WirePayment, SubcontractorMilestone, CostClassification, PhaseClassificationBudget } from '../../../lib/supabase'

export interface ProjectWithPhases extends Project {
  phases: ProjectPhase[]
  subcontractors: Subcontractor[]
  /** Per-(phase, classification) budget rows for this project's phases. */
  classification_budgets: PhaseClassificationBudget[]
  /** The project's TIC investment total, or null when it has no TIC. */
  tic_total: number | null
  /** How many phases the TIC plans. 0 for an unphased TIC or none at all. */
  tic_phase_count: number
  /** TIC money belonging to the project but to no single phase — land, project preparation. */
  tic_not_phased: number
  completion_percentage: number
  total_subcontractor_cost: number
  overdue_subcontractors: number
  has_phases: boolean
  total_budget_allocated: number
  total_paid_out: number
  total_contracted: number
}

export interface SubcontractorWithPhase extends Subcontractor {
  phase_name?: string
  job_description?: string
  deadline?: string
  cost: number
  budget_realized: number
  project_id?: string
  phase_id?: string
  contract_id?: string
  subcontractor_id?: string
  has_contract?: boolean
  /** Outstanding per invoices. There is no `invoice_total_paid` twin: paid is `budget_realized`. */
  invoice_total_owed?: number
  contract_type_id?: number | null
  contract_type_name?: string | null
  classification_id?: number | null
  classification_name?: string | null
  classification_sort_order?: number | null
}

export interface SubcontractorWithMilestones extends Subcontractor {
  milestones: SubcontractorMilestone[]
  total_milestone_percentage: number
  remaining_percentage: number
}

export interface MilestoneWithCalculatedAmount extends SubcontractorMilestone {
  calculated_amount: number
}

// No budget field on either form input: the TIC is the only writer of planned budget. A form
// that round-trips `budget_allocated` looks harmless but reverts the phase to whatever figure
// the client happened to load — silently undoing a sync that ran while the modal was open.
export interface PhaseFormInput {
  id?: string
  phase_name: string
  start_date: string
  end_date: string
}

export interface EditPhaseFormData {
  phase_name: string
  start_date: string | null
  end_date: string | null
  status: 'planning' | 'active' | 'completed' | 'on_hold'
}

export interface SubcontractorFormData {
  existing_subcontractor_id: string
  useExisting?: boolean
  name?: string
  contact?: string
  job_description: string
  start_date?: string
  deadline: string
  cost: number
  base_amount: number
  vat_rate: number
  vat_amount: number
  total_amount: number
  phase_id: string
  contract_type_id: number | null
  classification_id: number | null
  financed_by_type?: 'investor' | 'bank' | null
  financed_by_bank_id?: string | null
  financed_by_investor_id?: string | null
  has_contract?: boolean
}

export interface ContractType {
  id: number
  name: string
  description: string | null
  is_active: boolean
}

export type { CostClassification, PhaseClassificationBudget }

/**
 * Which axis nests inside which, on the Site Management contract tree.
 *
 * Contract type is always innermost; only the top two levels swap, which is the entire
 * difference between the "by phase" and "by classification" views.
 */
export type GroupDimension = 'phase' | 'classification' | 'contractType'

export type SiteGrouping = 'byPhase' | 'byClassification'

export const VIEW_DIMENSIONS: Record<SiteGrouping, GroupDimension[]> = {
  byPhase: ['phase', 'classification', 'contractType'],
  byClassification: ['classification', 'phase', 'contractType']
}

/** Money rolled up over a set of contracts. Same shape at every level of the tree. */
export interface GroupRollup {
  contracted: number
  paid: number
  unpaid: number
  /** Owed on rows that have no contract; kept separate because the budget tiles subtract it. */
  unpaidWithoutContract: number
  count: number
}

export interface TreeNode {
  /** Full path key, e.g. `phase:<uuid>|cls:12|type:3`. Unique per view. */
  key: string
  dimension: GroupDimension
  id: string | number | null
  label: string
  /** phase_number or classification sort_order; contract types use 0 and sort by label. */
  sortKey: number
  /** Allocated budget for this node, or null where the dimension has no budget of its own. */
  budget: number | null
  rollup: GroupRollup
  children: TreeNode[]
  /** Populated on leaf nodes only. */
  contracts: SubcontractorWithPhase[]
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

export const VAT_RATE_OPTIONS = [0, 5, 13, 25]
