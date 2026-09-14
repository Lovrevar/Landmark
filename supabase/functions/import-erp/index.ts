// import-erp — ingests a 4D Wand feed export.
//
// Both transports land here (docs/erp-integration/SPEC.md §2.1):
//   - the on-prem agent, authenticating with a shared secret;
//   - the in-app upload screen, authenticating with the user's JWT.
//
// The browser sends the file rather than parsing it, so there is exactly one
// parser, one set of validation rules and one audit trail regardless of how a
// file arrived.
//
// This function NEVER writes to `public`. It parses, validates and stages;
// promotion into accounting_invoices / accounting_payments is phase 3.
//
// config.toml sets verify_jwt = false because the agent has no JWT —
// authentication is handled below, the same way sort-document does it.

import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders, handlePreflight } from '../_shared/cors.ts'
import type { Database } from '../_shared/database.ts'
import { detectFileKind, parseFile } from './parse.ts'
import {
  FEED_NAMES,
  parseAccountRow,
  parseBankBalanceRow,
  parseCostCenterRow,
  parseInvoiceRow,
  parsePartnerRow,
  parsePaymentRow,
  validateInvoiceDocuments,
  validatePaymentGroups,
  type FeedName,
} from './feeds.ts'

const jsonHeaders = { ...corsHeaders, 'content-type': 'application/json' }

// 25 MB. A year of invoices is well under this; anything larger is a mistake
// worth failing loudly rather than timing out on.
const MAX_FILE_SIZE = 25 * 1024 * 1024

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: jsonHeaders })

Deno.serve(async (req) => {
  const preflight = handlePreflight(req)
  if (preflight) return preflight
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405)

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!supabaseUrl || !serviceKey) return json({ error: 'server not configured' }, 500)

  const admin = createClient<Database>(supabaseUrl, serviceKey, { auth: { persistSession: false } })

  // --- authentication ------------------------------------------------------
  const auth = await authenticate(req, admin)
  if ('error' in auth) return json({ error: auth.error }, auth.status)

  // --- request -------------------------------------------------------------
  let form: FormData
  try {
    form = await req.formData()
  } catch {
    return json({ error: 'expected multipart/form-data with a "file" part' }, 400)
  }

  const feed = String(form.get('feed') ?? '') as FeedName
  if (!FEED_NAMES.includes(feed)) {
    return json({ error: `feed must be one of ${FEED_NAMES.join(', ')}` }, 400)
  }

  const file = form.get('file')
  if (!(file instanceof File)) return json({ error: '"file" part is missing' }, 400)
  if (file.size > MAX_FILE_SIZE) {
    return json({ error: `file is ${file.size} bytes; the limit is ${MAX_FILE_SIZE}` }, 413)
  }

  const kind = detectFileKind(file.name, file.type)
  if (!kind) return json({ error: `cannot tell if "${file.name}" is CSV or XLSX` }, 400)

  const buffer = await file.arrayBuffer()
  const bytes = new Uint8Array(buffer)
  const fileHash = await sha256(buffer)

  // --- run bookkeeping -----------------------------------------------------
  const { data: run, error: runError } = await admin
    .schema('erp')
    .from('import_runs')
    .insert({
      feed,
      transport: auth.transport,
      file_name: file.name,
      file_hash: fileHash,
      file_size_bytes: file.size,
      status: 'parsing',
      uploaded_by: auth.userId,
    })
    .select('id')
    .single()

  if (runError || !run) {
    return json({ error: `could not open an import run: ${runError?.message}` }, 500)
  }
  const runId = run.id as string

  try {
    const { rows } = await parseFile(bytes, kind)
    if (rows.length === 0) {
      await finish(admin, runId, 'failed', {}, 'file contained no data rows')
      return json({ run_id: runId, error: 'file contained no data rows' }, 400)
    }

    const result = feed === 'invoices' ? await stageInvoices(admin, runId, rows)
      : feed === 'payments' ? await stagePayments(admin, runId, rows)
      : await replaceReferenceData(admin, runId, feed, rows)

    await finish(admin, runId, 'staged', result)

    // Classify and promote straight away, so the agent is unattended. Anything
    // that will not resolve stays in the review queue rather than blocking the
    // rest of the file; a person maps the missing code and re-runs via
    // public.erp_reclassify.
    const classification = await classify(admin, runId, feed)
    return json({ run_id: runId, feed, ...result, ...classification })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    await finish(admin, runId, 'failed', {}, message)
    return json({ run_id: runId, error: message }, 500)
  }
})

// ---------------------------------------------------------------------------
// Classification
// ---------------------------------------------------------------------------

interface Classification {
  /** Staged rows whose codes all resolved. */
  resolved?: number
  /** Staged rows with at least one unmapped code. */
  unresolved?: number
  /** Documents written to accounting_invoices / accounting_payments. */
  promoted?: number
  /** Documents already present and unchanged, so not rewritten. */
  skipped?: number
}

async function classify(admin: Admin, runId: string, feed: FeedName): Promise<Classification> {
  if (feed !== 'invoices' && feed !== 'payments') return {}

  // Written out per feed rather than with a computed rpc name, so the
  // argument and return types are actually checked.
  const erp = admin.schema('erp')
  const { data: res, error: resErr } = feed === 'invoices'
    ? await erp.rpc('resolve_invoices', { p_run_id: runId })
    : await erp.rpc('resolve_payments', { p_run_id: runId })
  if (resErr) throw new Error(`resolution failed: ${resErr.message}`)

  const { data: prom, error: promErr } = feed === 'invoices'
    ? await erp.rpc('promote_invoices', { p_run_id: runId })
    : await erp.rpc('promote_payments', { p_run_id: runId })
  if (promErr) throw new Error(`promotion failed: ${promErr.message}`)

  const r = Array.isArray(res) ? res[0] : res
  const p = Array.isArray(prom) ? prom[0] : prom
  // Promotion is all-or-nothing per document, so a count of unresolved *rows*
  // is not a count of held documents — the review queue is the place to see
  // those, and reporting a second, differently-scoped number here would just
  // invite the two to be read as the same thing.
  return {
    resolved: r?.rows_resolved ?? 0,
    unresolved: r?.rows_unresolved ?? 0,
    promoted: p?.promoted ?? 0,
    skipped: p?.skipped ?? 0,
  }
}

// ---------------------------------------------------------------------------
// Authentication
// ---------------------------------------------------------------------------

type Admin = SupabaseClient<Database>
type Auth =
  | { transport: 'agent' | 'manual'; userId: string | null }
  | { error: string; status: number }

async function authenticate(req: Request, admin: Admin): Promise<Auth> {
  // The agent: a shared secret, compared in constant time.
  const expected = Deno.env.get('ERP_IMPORT_SECRET')
  const presented = req.headers.get('x-erp-import-secret')
  if (presented) {
    if (!expected || !timingSafeEqual(presented, expected)) {
      return { error: 'invalid import secret', status: 401 }
    }
    return { transport: 'agent', userId: null }
  }

  // A person: a Supabase JWT, which must belong to Director or Accounting.
  // The role check is re-done here rather than trusted from the client, since
  // this function writes with the service role.
  const authHeader = req.headers.get('authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return { error: 'authentication required', status: 401 }
  }

  const { data: userData, error } = await admin.auth.getUser(authHeader.slice(7))
  if (error || !userData?.user) return { error: 'invalid token', status: 401 }

  const { data: profile } = await admin
    .from('users')
    .select('id, role')
    .eq('auth_user_id', userData.user.id)
    .maybeSingle()

  if (!profile || !['Director', 'Accounting'].includes(profile.role as string)) {
    return { error: 'Director or Accounting role required', status: 403 }
  }
  return { transport: 'manual', userId: profile.id as string }
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

async function sha256(buffer: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', buffer)
  return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, '0')).join('')
}

// ---------------------------------------------------------------------------
// Staging
// ---------------------------------------------------------------------------

interface StageResult {
  rows_total: number
  rows_staged: number
  rows_rejected: number
  problems: { row: number; errors: string[] }[]
}

/** Row 1 is the header, so a data row's spreadsheet line is index + 2. */
const sheetRow = (i: number) => i + 2

async function stageInvoices(admin: Admin, runId: string, rows: Record<string, string>[]): Promise<StageResult> {
  const parsed = rows.map((r, i) => {
    const { value, errors } = parseInvoiceRow(r)
    return { row_number: sheetRow(i), value, errors, raw: r }
  })

  // Cross-row checks need the whole file, so they run after per-row parsing.
  const docErrors = validateInvoiceDocuments(parsed)
  for (const p of parsed) {
    const extra = docErrors.get(p.row_number)
    if (extra) p.errors = [...p.errors, ...extra]
  }

  const records = parsed.map(p => ({
    import_run_id: runId,
    row_number: p.row_number,
    ...p.value,
    raw: p.raw,
    is_valid: p.errors.length === 0,
    validation_errors: p.errors,
  }))

  await insertChunked(admin, 'staging_invoices', records)
  return summarise(parsed)
}

async function stagePayments(admin: Admin, runId: string, rows: Record<string, string>[]): Promise<StageResult> {
  const parsed = rows.map((r, i) => {
    const { value, errors } = parsePaymentRow(r)
    return { row_number: sheetRow(i), value, errors, raw: r }
  })

  const groupErrors = validatePaymentGroups(parsed)
  for (const p of parsed) {
    const extra = groupErrors.get(p.row_number)
    if (extra) p.errors = [...p.errors, ...extra]
  }

  const records = parsed.map(p => ({
    import_run_id: runId,
    row_number: p.row_number,
    ...p.value,
    raw: p.raw,
    is_valid: p.errors.length === 0,
    validation_errors: p.errors,
  }))

  await insertChunked(admin, 'staging_payments', records)
  return summarise(parsed)
}

/**
 * Reference feeds are mirrors, so a run replaces the register outright: a code
 * removed in the ERP has to disappear here too, and an upsert alone would
 * leave it behind forever.
 *
 * The delete and the insert are separate statements, so a failure between them
 * leaves the register empty. Acceptable because the next run restores it and
 * nothing is promoted from these tables directly — but it is why a failed
 * reference run should not be left unattended. Moving this into an RPC would
 * make it atomic; worth doing if it ever bites.
 *
 * Each feed is written out explicitly rather than through a lookup table so
 * the row types are actually checked.
 */
async function replaceReferenceData(
  admin: Admin, runId: string, feed: FeedName, rows: Record<string, string>[],
): Promise<StageResult> {
  const parser = feed === 'partners' ? parsePartnerRow
    : feed === 'accounts' ? parseAccountRow
    : feed === 'cost_centers' ? parseCostCenterRow
    : parseBankBalanceRow

  const parsed = rows.map((r, i) => {
    const { value, errors } = parser(r)
    return { row_number: sheetRow(i), value, errors, raw: r }
  })

  const valid = parsed.filter(p => p.errors.length === 0)
  // A file that is mostly broken is a broken file — replacing a register from
  // it would do more damage than refusing to.
  if (valid.length === 0) throw new Error('every row failed validation; nothing was written')

  const stamp = { import_run_id: runId, imported_at: new Date().toISOString() }
  const erp = admin.schema('erp')
  const fail = (what: string, message: string) => { throw new Error(`could not write ${what}: ${message}`) }

  if (feed === 'partners') {
    const { error: del } = await erp.from('partners').delete().not('erp_id', 'is', null)
    if (del) fail('partners', del.message)
    const { error } = await erp.from('partners').upsert(
      valid.map(p => ({ ...(p.value as { erp_id: string; name: string }), ...stamp })),
      { onConflict: 'erp_id' })
    if (error) fail('partners', error.message)

  } else if (feed === 'accounts') {
    const { error: del } = await erp.from('chart_of_accounts').delete().not('account_code', 'is', null)
    if (del) fail('chart_of_accounts', del.message)
    const { error } = await erp.from('chart_of_accounts').upsert(
      valid.map(p => ({ ...(p.value as { account_code: string; name: string }), ...stamp })),
      { onConflict: 'account_code' })
    if (error) fail('chart_of_accounts', error.message)

  } else if (feed === 'cost_centers') {
    const { error: del } = await erp.from('cost_centers').delete().not('code', 'is', null)
    if (del) fail('cost_centers', del.message)
    const { error } = await erp.from('cost_centers').upsert(
      valid.map(p => ({ ...(p.value as { code: string; name: string }), ...stamp })),
      { onConflict: 'code' })
    if (error) fail('cost_centers', error.message)

  } else {
    // Balances are a time series keyed by (iban, date), so they accumulate
    // rather than being replaced — yesterday's balance stays true.
    const { error } = await erp.from('bank_balances').upsert(
      valid.map(p => ({ ...(p.value as { iban: string; company_oib: string; balance: number; balance_as_of: string }), ...stamp })),
      { onConflict: 'iban,balance_as_of' })
    if (error) fail('bank_balances', error.message)
  }

  return summarise(parsed)
}

type StagingTable = 'staging_invoices' | 'staging_payments'

async function insertChunked<T extends StagingTable>(
  admin: Admin, table: T, records: Database['erp']['Tables'][T]['Insert'][],
) {
  const CHUNK = 500
  for (let i = 0; i < records.length; i += CHUNK) {
    const chunk = records.slice(i, i + CHUNK)
    // The generic is sound but supabase-js cannot narrow insert() through it.
    const { error } = await admin.schema('erp').from(table).insert(chunk as never)
    if (error) throw new Error(`could not stage into ${table}: ${error.message}`)
  }
}

function summarise(parsed: { row_number: number; errors: string[] }[]): StageResult {
  const bad = parsed.filter(p => p.errors.length > 0)
  return {
    rows_total: parsed.length,
    rows_staged: parsed.length - bad.length,
    rows_rejected: bad.length,
    // Enough to act on without returning a megabyte of complaints.
    problems: bad.slice(0, 50).map(p => ({ row: p.row_number, errors: p.errors })),
  }
}

async function finish(
  admin: Admin, runId: string, status: string,
  counts: Partial<StageResult>, errorMessage?: string,
) {
  await admin.schema('erp').from('import_runs').update({
    status,
    rows_total: counts.rows_total ?? 0,
    rows_staged: counts.rows_staged ?? 0,
    rows_rejected: counts.rows_rejected ?? 0,
    error_message: errorMessage ?? null,
    finished_at: new Date().toISOString(),
  }).eq('id', runId)
}
