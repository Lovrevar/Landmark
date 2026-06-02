import { supabase } from '../../../lib/supabase'
import type { AttachmentKind } from '../../../types/aiChat'

export const AI_CHAT_BUCKET = 'ai-chat-attachments'
export const MAX_ATTACHMENTS_PER_MESSAGE = 4
export const SIGNED_URL_TTL_SECONDS = 3600

// Per-kind raw-file size caps. The server re-enforces these — these are UX
// guards only; never trust them across the trust boundary.
export const SIZE_LIMITS: Record<AttachmentKind, number> = {
  image: 5 * 1024 * 1024,
  pdf: 10 * 1024 * 1024,
  text: 2 * 1024 * 1024,
}

// Hard cap on extracted text after parsing. Anything beyond this is truncated
// with a "...[truncated]" suffix; the server enforces the same cap.
export const EXTRACTED_TEXT_MAX_BYTES = 50 * 1024

// Whitelists, matched against MIME and (defense-in-depth) the filename's
// extension. Both must pass for a file to be accepted.
const IMAGE_MIMES = new Set(['image/png', 'image/jpeg', 'image/webp'])
const PDF_MIMES = new Set(['application/pdf'])
const TEXT_MIMES = new Set([
  'text/plain',
  'text/csv',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
])
const IMAGE_EXTS = new Set(['png', 'jpg', 'jpeg', 'webp'])
const PDF_EXTS = new Set(['pdf'])
const TEXT_EXTS = new Set(['txt', 'csv', 'xls', 'xlsx'])

// Accept attribute for the <input type="file">. Browsers use it as a hint;
// the validation below is the real gate.
export const ACCEPT_ATTR =
  '.png,.jpg,.jpeg,.webp,.pdf,.txt,.csv,.xls,.xlsx,' +
  'image/png,image/jpeg,image/webp,application/pdf,' +
  'text/plain,text/csv,' +
  'application/vnd.ms-excel,' +
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'

export interface AttachmentMeta {
  storage_path: string
  file_name: string
  file_size: number
  mime_type: string
  kind: AttachmentKind
  extracted_text?: string
}

export type AttachmentErrorCode =
  | 'too_large'
  | 'unsupported_type'
  | 'extraction_failed'
  | 'upload_failed'
  | 'no_session'

export class AttachmentError extends Error {
  readonly code: AttachmentErrorCode
  constructor(code: AttachmentErrorCode, message: string) {
    super(message)
    this.name = 'AttachmentError'
    this.code = code
  }
}

function inferExtension(name: string): string {
  const i = name.lastIndexOf('.')
  if (i === -1 || i === name.length - 1) return 'bin'
  return name.slice(i + 1).toLowerCase()
}

// Resolve the attachment kind from MIME + filename extension. Both must
// agree; mismatches are rejected with `unsupported_type`. We deliberately
// don't sniff bytes — the server's whitelist is the security boundary, this
// only filters the obvious mistakes out of the UI.
function classify(file: File): AttachmentKind {
  const ext = inferExtension(file.name)
  const mime = file.type || ''
  if (IMAGE_MIMES.has(mime) && IMAGE_EXTS.has(ext)) return 'image'
  if (PDF_MIMES.has(mime) && PDF_EXTS.has(ext)) return 'pdf'
  // Some browsers report .csv as application/vnd.ms-excel or no MIME at all.
  // Trust the extension if the MIME is blank or in the text whitelist, but
  // require the extension to be in the text set.
  if (TEXT_EXTS.has(ext) && (mime === '' || TEXT_MIMES.has(mime) || mime === 'application/octet-stream')) {
    return 'text'
  }
  throw new AttachmentError(
    'unsupported_type',
    `Format datoteke "${file.name}" nije podržan.`,
  )
}

// Extract a UTF-8 text representation suitable for inlining in the prompt.
// For .xlsx/.xls: first sheet only, converted to CSV. For .txt/.csv: raw
// text. Truncated to EXTRACTED_TEXT_MAX_BYTES if necessary, with a
// "...[truncated]" suffix appended.
async function extractTextFromFile(file: File): Promise<string> {
  let raw: string
  const ext = inferExtension(file.name)
  if (ext === 'xlsx' || ext === 'xls') {
    try {
      // Dynamically imported so the ~500 KB xlsx lib stays out of the eager
      // bundle — it loads only when a user actually attaches a spreadsheet.
      const XLSX = await import('@e965/xlsx')
      const buf = await file.arrayBuffer()
      const wb = XLSX.read(new Uint8Array(buf), { type: 'array' })
      const firstName = wb.SheetNames[0]
      if (!firstName) {
        throw new AttachmentError('extraction_failed', 'Datoteka nema listova.')
      }
      raw = XLSX.utils.sheet_to_csv(wb.Sheets[firstName])
    } catch (err) {
      if (err instanceof AttachmentError) throw err
      throw new AttachmentError(
        'extraction_failed',
        `Greška pri čitanju Excel datoteke "${file.name}".`,
      )
    }
  } else {
    try {
      raw = await file.text()
    } catch {
      throw new AttachmentError(
        'extraction_failed',
        `Greška pri čitanju datoteke "${file.name}".`,
      )
    }
  }
  const enc = new TextEncoder()
  const bytes = enc.encode(raw)
  if (bytes.byteLength <= EXTRACTED_TEXT_MAX_BYTES) return raw
  // Slicing UTF-8 bytes can land mid-codepoint; TextDecoder with fatal=false
  // replaces the dangling bytes with U+FFFD which is fine for display.
  const truncated = new TextDecoder().decode(bytes.slice(0, EXTRACTED_TEXT_MAX_BYTES))
  return `${truncated}\n\n...[truncated]`
}

// Upload a single file to the private AI chat bucket. Path convention:
//   {auth_user_id}/{session_id}/{uuid}.{ext}
// The first segment MUST be auth.users.id (not public.users.id) because the
// storage RLS policy compares against auth.uid().
export async function uploadAiAttachment(
  file: File,
  sessionId: string,
): Promise<AttachmentMeta> {
  const kind = classify(file) // throws unsupported_type

  if (file.size <= 0 || file.size > SIZE_LIMITS[kind]) {
    throw new AttachmentError(
      'too_large',
      `Datoteka "${file.name}" prelazi maksimalnu veličinu.`,
    )
  }

  const { data: { user }, error: userErr } = await supabase.auth.getUser()
  if (userErr || !user) {
    throw new AttachmentError('no_session', 'Niste prijavljeni.')
  }

  let extracted_text: string | undefined
  if (kind === 'text') {
    extracted_text = await extractTextFromFile(file) // throws extraction_failed
  }

  const ext = inferExtension(file.name)
  const objectId = crypto.randomUUID()
  const storage_path = `${user.id}/${sessionId}/${objectId}.${ext}`

  const { error: uploadErr } = await supabase.storage
    .from(AI_CHAT_BUCKET)
    .upload(storage_path, file, {
      contentType: file.type || undefined,
      upsert: false,
    })
  if (uploadErr) {
    throw new AttachmentError(
      'upload_failed',
      `Greška pri prijenosu datoteke "${file.name}".`,
    )
  }

  return {
    storage_path,
    file_name: file.name,
    file_size: file.size,
    mime_type: file.type || 'application/octet-stream',
    kind,
    extracted_text,
  }
}

// Remove a previously-uploaded object. Used both to clean up orphans on
// send failure and to undo a pending-attachment removal in the UI.
// Errors are swallowed to a console.warn — callers should treat this as
// fire-and-forget cleanup.
export async function deleteAiAttachment(storagePath: string): Promise<void> {
  const { error } = await supabase.storage
    .from(AI_CHAT_BUCKET)
    .remove([storagePath])
  if (error) {
    console.warn('[aiAttachmentsService] delete failed:', storagePath, error)
  }
}

// Issue a short-lived signed URL for a stored object. Used by the message
// renderer for image thumbnails and PDF/text download links. TTL matches
// the pattern in documentService.ts / tasksService.ts (3600s).
export async function getAiAttachmentSignedUrl(
  storagePath: string,
  ttl: number = SIGNED_URL_TTL_SECONDS,
): Promise<string | null> {
  const { data, error } = await supabase.storage
    .from(AI_CHAT_BUCKET)
    .createSignedUrl(storagePath, ttl)
  if (error || !data?.signedUrl) {
    console.warn('[aiAttachmentsService] signed URL failed:', storagePath, error)
    return null
  }
  return data.signedUrl
}

// Issue a short-lived signed URL for a system-stored document (the ones
// surfaced by the `get_document_download_link` AI tool). Bucket selection
// mirrors documentService.bucketForSource: legacy_subcontractor rows live
// in the old `contract-documents` bucket; everything else in `documents`.
// We re-implement the rule here so AiChat has no dependency on the
// Documents module.
const SERVER_DOCUMENTS_BUCKET = 'documents'
const SERVER_DOCUMENTS_LEGACY_BUCKET = 'contract-documents'

export type ServerDocumentSourceKind =
  | 'app_upload'
  | 'legacy_subcontractor'
  | 'accounting_sync'
  | 'filesystem_scan'

export async function getServerDocumentSignedUrl(
  filePath: string,
  source: ServerDocumentSourceKind,
  ttl: number = SIGNED_URL_TTL_SECONDS,
): Promise<string | null> {
  const bucket = source === 'legacy_subcontractor'
    ? SERVER_DOCUMENTS_LEGACY_BUCKET
    : SERVER_DOCUMENTS_BUCKET
  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(filePath, ttl)
  if (error || !data?.signedUrl) {
    console.warn('[aiAttachmentsService] server document signed URL failed:', filePath, error)
    return null
  }
  return data.signedUrl
}
