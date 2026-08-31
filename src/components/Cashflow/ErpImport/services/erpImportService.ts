import { supabase } from '../../../../lib/supabase'
import { logActivity } from '../../../../lib/activityLog'
import type { FeedName, ImportRun, StagingProblem, UploadResult } from '../types'

/**
 * The browser uploads the file rather than parsing it: the edge function owns
 * the parser, the validation rules and the audit trail, so a manual upload and
 * an agent push are treated identically. See SPEC.md §2.1.
 */
export async function uploadFeedFile(feed: FeedName, file: File): Promise<UploadResult> {
  const { data } = await supabase.auth.getSession()
  const accessToken = data.session?.access_token
  if (!accessToken) throw new Error('Not signed in')

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
  if (!supabaseUrl) throw new Error('VITE_SUPABASE_URL is not configured')

  const form = new FormData()
  form.append('feed', feed)
  form.append('file', file)

  // Content-Type is deliberately not set — the browser must add the multipart
  // boundary itself. Mirrors pushNotify in sending the JWT as apikey too.
  const response = await fetch(`${supabaseUrl}/functions/v1/import-erp`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, apikey: accessToken },
    body: form,
  })

  let result: UploadResult
  try {
    result = await response.json() as UploadResult
  } catch {
    throw new Error(`Import failed (HTTP ${response.status})`)
  }
  if (!response.ok) throw new Error(result.error ?? `Import failed (HTTP ${response.status})`)

  logActivity({
    action: 'erp_import.upload',
    entity: 'erp_import_run',
    entityId: result.run_id,
    metadata: {
      severity: 'high',
      entity_name: file.name,
      feed,
      rows_total: result.rows_total ?? 0,
      rows_rejected: result.rows_rejected ?? 0,
    },
  })

  return result
}

export async function fetchImportRuns(limit = 50): Promise<ImportRun[]> {
  const { data, error } = await supabase
    .from('erp_import_runs')
    .select('*')
    .order('started_at', { ascending: false })
    .limit(limit)
  if (error) throw error
  return (data ?? []) as ImportRun[]
}

export async function fetchRunProblems(runId: string): Promise<StagingProblem[]> {
  const { data, error } = await supabase
    .from('erp_staging_problems')
    .select('*')
    .eq('import_run_id', runId)
    .order('row_number')
    .limit(500)
  if (error) throw error
  return (data ?? []) as StagingProblem[]
}
