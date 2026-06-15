export interface ActivityLogEntry {
  id: string
  user_id: string
  username: string
  user_role: string
  action: string
  entity: string
  entity_id: string | null
  project_id: string | null
  project_name: string | null
  metadata: Record<string, unknown>
  ip_address: string | null
  created_at: string
  total_count: number
}

export type SeverityFilter = 'ALL' | 'low' | 'medium' | 'high'

export const ACTION_CATEGORIES = [
  'ALL',
  'auth',
  'project',
  'milestone',
  'building',
  'apartment',
  'garage',
  'repository',
  'customer',
  'sale',
  'sale_payment',
  'invoice',
  'payment',
  'company',
  'bank_account',
  'supplier',
  'office_supplier',
  'loan',
  'monthly_budget',
  'phase',
  'subcontractor',
  'subcontractor_payment',
  'contract',
  'contract_type',
  'contract_milestone',
  'payment_notification',
  'document',
  'work_log',
  'investor',
  'bank_credit',
  'credit_allocation',
  'equity_investment',
  'tic',
  'retail_project',
  'retail_phase',
  'retail_customer',
  'retail_sale',
  'retail_invoice',
  'retail_contract',
  'retail_milestone',
  'retail_supplier',
  'retail_supplier_type',
  'land_plot',
  'export',
  'conversation',
  'calendar_event',
  'task',
] as const

export type ActionCategory = (typeof ACTION_CATEGORIES)[number]

export interface ActivityLogFilters {
  searchTerm: string
  userId: string
  actionCategory: ActionCategory
  severity: SeverityFilter
  dateFrom: string
  dateTo: string
  projectId: string
}

/** Maps an entity type to the route where it can be viewed */
export const ENTITY_ROUTE_MAP: Record<string, string> = {
  project: '/projects',
  invoice: '/accounting-invoices',
  payment: '/accounting-payments',
  company: '/accounting-companies',
  supplier: '/accounting-suppliers',
  office_supplier: '/office-suppliers',
  bank_account: '/accounting-banks',
  customer: '/customers',
  apartment: '/apartments',
  milestone: '/projects',
  building: '/sales-projects',
  sale: '/sales-payments',
  subcontractor: '/subcontractors',
  work_log: '/work-logs',
  investor: '/banks',
  bank_credit: '/funding-credits',
  credit_allocation: '/funding-credits',
  retail_project: '/retail-projects',
  retail_customer: '/retail-customers',
  retail_sale: '/retail-sales-payments',
  retail_invoice: '/retail-invoices',
  retail_phase: '/retail-projects',
  retail_contract: '/retail-projects',
  retail_milestone: '/retail-projects',
  retail_supplier: '/retail-projects',
  retail_supplier_type: '/retail-projects',
  land_plot: '/retail-land-plots',
  conversation: '/chat',
  calendar_event: '/calendar',
  task: '/tasks',
  document: '/documents',
  garage: '/sales-projects',
  repository: '/sales-projects',
  contract: '/site-management',
  contract_type: '/site-management',
  phase: '/site-management',
  monthly_budget: '/accounting-calendar',
  payment_notification: '/funding-payments',
  subcontractor_payment: '/funding-payments',
  tic_cost_structures: '/tic',
}
