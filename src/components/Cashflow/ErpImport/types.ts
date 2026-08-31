/**
 * ERP import — uploading 4D Wand feed exports.
 * See docs/erp-integration/SPEC.md §2.1.
 */

export type FeedName =
  | 'invoices' | 'payments' | 'partners' | 'accounts' | 'cost_centers' | 'bank_balances'

export const FEED_NAMES: FeedName[] = [
  'accounts', 'cost_centers', 'partners', 'invoices', 'payments', 'bank_balances',
]

/**
 * Reference feeds must land before the documents that reference them —
 * classification reads the mappings, and the mappings key off these codes.
 */
export const REFERENCE_FEEDS: FeedName[] = ['accounts', 'cost_centers', 'partners']

export type RunStatus =
  'received' | 'parsing' | 'staged' | 'promoting' | 'completed' | 'failed'

export interface ImportRun {
  id: string
  feed: string
  transport: 'agent' | 'manual'
  file_name: string
  file_size_bytes: number | null
  status: RunStatus
  rows_total: number
  rows_staged: number
  rows_promoted: number
  rows_skipped: number
  rows_rejected: number
  error_message: string | null
  started_at: string
  finished_at: string | null
}

export interface StagingProblem {
  import_run_id: string
  feed: string
  row_number: number
  document_ref: string
  validation_errors: string[]
}

/** What the edge function returns for one upload. */
export interface UploadResult {
  run_id: string
  feed?: FeedName
  rows_total?: number
  rows_staged?: number
  rows_rejected?: number
  problems?: { row: number; errors: string[] }[]
  error?: string
}
