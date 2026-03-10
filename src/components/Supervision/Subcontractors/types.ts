export interface SubcontractorBase {
  id: string
  name: string
  contact: string
  notes?: string
}

export interface SubcontractorContract {
  id: string
  project_name: string
  phase_name: string | null
  job_description: string
  cost: number
  budget_realized: number
  progress: number
  deadline: string
  created_at: string
  has_contract: boolean
  invoice_value: number
}

export interface SubcontractorSummary extends SubcontractorBase {
  total_contracts: number
  total_contract_value: number
  total_paid: number
  total_remaining: number
  active_contracts: number
  completed_contracts: number
  contracts: SubcontractorContract[]
}
