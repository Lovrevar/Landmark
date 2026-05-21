// sort-document — automatic email document sorting.
//
// The Make.com email-automation scenario watches the documents@ mailbox, and
// for every PDF/image attachment POSTs a JSON envelope here. This function:
//   1. authenticates the caller via a shared secret (x-doc-sort-secret),
//   2. classifies the document with the Claude API (see classifier.ts),
//   3. uploads the file to the `documents` storage bucket and writes the
//      `documents` + `document_associations` rows that the in-app Documents
//      page already reads.
//
// There is no user JWT — the caller is a machine — so config.toml sets
// verify_jwt = false and authentication is handled here.

import Anthropic from 'npm:@anthropic-ai/sdk@0.97.0'
import { decodeBase64 } from 'jsr:@std/encoding@1/base64'
import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders, handlePreflight } from '../_shared/cors.ts'
import type { Database } from '../_shared/database.ts'
import {
  classifyDocument,
  loadEntityCandidates,
  type CategoryRow,
  type DocumentInput,
  type EmailContext,
} from './classifier.ts'

const jsonHeaders = { ...corsHeaders, 'content-type': 'application/json' }

// 50 MB — matches the `documents` bucket cap enforced by the in-app uploader
// (src/components/Documents/services/documentService.ts).
const MAX_FILE_SIZE = 50 * 1024 * 1024

// Accepted attachment MIME types. Make.com filters before POSTing; we re-check.
const ALLOWED_MIME = new Set([
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/webp',
])

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), { status, headers: jsonHeaders })
}

function errorResponse(code: string, message: string, status: number): Response {
  return jsonResponse({ error: { code, message } }, status)
}

// Constant-time string comparison — avoids leaking the secret via timing.
function safeEqual(a: string, b: string): boolean {
  const ea = new TextEncoder().encode(a)
  const eb = new TextEncoder().encode(b)
  if (ea.length !== eb.length) return false
  let diff = 0
  for (let i = 0; i < ea.length; i++) diff |= ea[i] ^ eb[i]
  return diff === 0
}

function sanitizeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_')
}

// SHA-256 of the file bytes, as a lowercase hex string. Used to detect a file
// that was already imported (e.g. a Make.com retry of the same attachment).
async function sha256Hex(bytes: Uint8Array): Promise<string> {
  // `bytes` is always ArrayBuffer-backed here; the cast satisfies the DOM lib's
  // BufferSource type, which excludes SharedArrayBuffer-backed views.
  const digest = await crypto.subtle.digest('SHA-256', bytes as BufferSource)
  return Array.from(new Uint8Array(digest))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}

// Anthropic's image blocks expect `image/jpeg`, not `image/jpg`.
function normalizeMime(mime: string): string {
  return mime === 'image/jpg' ? 'image/jpeg' : mime
}

// Maps Anthropic SDK errors to a code + HTTP status (mirrors ai-chat's
// mapAnthropicError). All model failures are 5xx so Make.com can retry.
function mapAnthropicError(err: unknown): { code: string; status: number } {
  if (err instanceof Anthropic.RateLimitError) return { code: 'model_rate_limited', status: 503 }
  if (err instanceof Anthropic.APIConnectionTimeoutError) return { code: 'model_timeout', status: 504 }
  if (err instanceof Anthropic.APIConnectionError) return { code: 'model_unreachable', status: 502 }
  if (err instanceof Anthropic.AuthenticationError) return { code: 'model_auth_failed', status: 500 }
  if (err instanceof Anthropic.BadRequestError) return { code: 'model_bad_request', status: 500 }
  return { code: 'model_error', status: 502 }
}

// ---------------------------------------------------------------------------
// Request body
// ---------------------------------------------------------------------------

interface RequestBody {
  email_subject?: string
  email_body?: string
  email_from?: string
  email_message_id?: string
  attachment?: {
    file_name?: string
    mime_type?: string
    data_base64?: string
  }
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

Deno.serve(async (req) => {
  const preflight = handlePreflight(req)
  if (preflight) return preflight

  if (req.method !== 'POST') {
    return errorResponse('method_not_allowed', 'Only POST is supported.', 405)
  }

  // --- Auth: shared secret -------------------------------------------------
  const expectedSecret = Deno.env.get('DOC_SORT_WEBHOOK_SECRET')
  if (!expectedSecret) {
    console.error('[sort-document] DOC_SORT_WEBHOOK_SECRET not configured')
    return errorResponse('not_configured', 'Function is not configured.', 500)
  }
  const providedSecret = req.headers.get('x-doc-sort-secret') ?? ''
  if (!safeEqual(providedSecret, expectedSecret)) {
    return errorResponse('unauthorized', 'Invalid or missing secret.', 401)
  }

  // --- Parse + validate body ----------------------------------------------
  let body: RequestBody
  try {
    body = await req.json()
  } catch {
    return errorResponse('bad_request', 'Body is not valid JSON.', 400)
  }

  const att = body.attachment
  if (!att || !att.file_name || !att.mime_type || !att.data_base64) {
    return errorResponse('bad_request', 'Missing attachment fields.', 400)
  }

  const mimeType = normalizeMime(att.mime_type.toLowerCase())
  if (!ALLOWED_MIME.has(att.mime_type.toLowerCase())) {
    return errorResponse('unsupported_media_type', `Unsupported type: ${att.mime_type}`, 415)
  }

  let bytes: Uint8Array
  try {
    bytes = decodeBase64(att.data_base64)
  } catch {
    return errorResponse('bad_request', 'Attachment data is not valid base64.', 400)
  }
  if (bytes.byteLength === 0) {
    return errorResponse('bad_request', 'Attachment is empty.', 400)
  }
  if (bytes.byteLength > MAX_FILE_SIZE) {
    return errorResponse('payload_too_large', `File exceeds ${MAX_FILE_SIZE} bytes.`, 413)
  }

  // --- Service client ------------------------------------------------------
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const client = createClient<Database>(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  // --- Duplicate check -----------------------------------------------------
  // Hash the bytes and short-circuit if this exact file was already imported.
  // This runs BEFORE classification, so a Make.com retry costs zero tokens.
  const contentHash = await sha256Hex(bytes)
  const { data: existing, error: dupErr } = await client
    .from('documents')
    .select('id')
    .eq('content_hash', contentHash)
    .limit(1)
    .maybeSingle()
  if (dupErr) {
    console.error('[sort-document] duplicate lookup failed', { message: dupErr.message })
    return errorResponse('db_failed', 'Failed to check for duplicates.', 502)
  }
  if (existing) {
    console.log('[sort-document] duplicate skipped', { documentId: existing.id, contentHash })
    return jsonResponse({ document_id: existing.id, duplicate: true }, 200)
  }

  const email: EmailContext = {
    subject: body.email_subject ?? '',
    body: body.email_body ?? '',
    from: body.email_from ?? '',
  }

  // --- Anthropic client ----------------------------------------------------
  const anthropic = new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY') })
  const model = Deno.env.get('DOC_SORT_MODEL') ?? 'claude-sonnet-4-6'

  // --- Classify ------------------------------------------------------------
  let classification
  try {
    const [{ data: categoryRows, error: catErr }, candidates] = await Promise.all([
      client
        .from('document_categories')
        .select('id, code, name_hr, path, parent_id')
        .eq('is_active', true)
        .order('display_order', { ascending: true }),
      loadEntityCandidates(client),
    ])
    if (catErr) throw catErr

    const doc: DocumentInput = {
      fileName: att.file_name,
      mimeType,
      base64: att.data_base64,
    }
    classification = await classifyDocument(
      anthropic,
      model,
      doc,
      email,
      (categoryRows ?? []) as CategoryRow[],
      candidates,
    )
  } catch (err) {
    if (err instanceof Anthropic.APIError) {
      const { code, status } = mapAnthropicError(err)
      console.error('[sort-document] classification failed', { code, message: String(err) })
      return errorResponse(code, 'Document classification failed.', status)
    }
    console.error('[sort-document] classification error', { message: String(err) })
    return errorResponse('classification_failed', 'Document classification failed.', 502)
  }

  // --- Upload to storage ---------------------------------------------------
  const filePath = `${crypto.randomUUID()}/${sanitizeFilename(att.file_name)}`
  const { error: uploadErr } = await client.storage
    .from('documents')
    .upload(filePath, bytes, { contentType: mimeType })
  if (uploadErr) {
    console.error('[sort-document] storage upload failed', { message: uploadErr.message })
    return errorResponse('storage_failed', 'Failed to store the document.', 502)
  }

  // --- Insert documents row ------------------------------------------------
  const { data: inserted, error: insertErr } = await client
    .from('documents')
    .insert({
      file_path: filePath,
      file_name: att.file_name,
      file_size: bytes.byteLength,
      mime_type: mimeType,
      category_id: classification.categoryId,
      source: 'email_import',
      description: classification.description || null,
      uploaded_by: null,
      content_hash: contentHash,
    })
    .select('id')
    .single()

  if (insertErr || !inserted) {
    // Rollback: drop the orphaned storage object.
    await client.storage.from('documents').remove([filePath])
    console.error('[sort-document] documents insert failed', { message: insertErr?.message })
    return errorResponse('db_failed', 'Failed to record the document.', 502)
  }
  const documentId = inserted.id

  // --- Insert associations -------------------------------------------------
  if (classification.associations.length > 0) {
    const rows = classification.associations.map(a => ({
      document_id: documentId,
      entity_type: a.entity_type,
      entity_id: a.entity_id,
    }))
    const { error: assocErr } = await client.from('document_associations').insert(rows)
    if (assocErr) {
      // Rollback: remove the document row and the storage object.
      await client.from('documents').delete().eq('id', documentId)
      await client.storage.from('documents').remove([filePath])
      console.error('[sort-document] associations insert failed', { message: assocErr.message })
      return errorResponse('db_failed', 'Failed to link the document.', 502)
    }
  }

  // NOTE: activity_logs.user_id / user_role are NOT NULL, so email imports
  // (which have no user) cannot use the standard activity-log path. Logging is
  // deliberately skipped for v1 — see plan section 4.

  console.log('[sort-document] imported', {
    documentId,
    categoryId: classification.categoryId,
    confidence: classification.confidence,
    associations: classification.associations.length,
  })

  return jsonResponse(
    {
      document_id: documentId,
      duplicate: false,
      category_id: classification.categoryId,
      confidence: classification.confidence,
      associations_count: classification.associations.length,
    },
    200,
  )
})
