export interface WorkLog {
  id: string
  date: string
  subcontractor_id: string
  subcontractor_name?: string
  work_description: string
  notes: string
  status: string
  color: string
  blocker_details?: string
  created_at: string
  contracts?: {
    contract_number: string
    job_description: string
  }
}

export interface SubcontractorStatus {
  id: string
  name: string
  project_name: string
  deadline: string
  progress: number
  cost: number
  budget_realized: number
  days_until_deadline: number
  is_overdue: boolean
  recent_work_logs: number
  last_activity: string | null
}

export interface WeeklyStats {
  completed_this_week: number
  active_crews: number
  active_sites: number
  work_logs_this_week: number
  overdue_tasks: number
  critical_deadlines: number
}
