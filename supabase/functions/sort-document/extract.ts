// File-type resolution and text extraction for the sort-document function.
//
// Claude reads PDFs (document block) and images (image block) natively; every
// other accepted format must be reduced to plain text here before
// classification. Extraction is best-effort: a corrupt or unreadable file
// degrades to metadata-only classification (email + filename), it never
// rejects the import.

import { Buffer } from 'node:buffer'

// How a document reaches Claude:
//   pdf / image — base64 passthrough (document / image block)
//   xml / text  — UTF-8 decode, sent as a plain-text document block
//   docx / xlsx — text extracted in-function, sent as a plain-text document block
//   doc         — legacy binary Word; no pure-JS extractor runs on Deno, so the
//                 file is stored but classified from email metadata only
export type DocKind = 'pdf' | 'image' | 'xml' | 'docx' | 'xlsx' | 'text' | 'doc'

const MIME_KIND: Record<string, DocKind> = {
  'application/pdf': 'pdf',
  'image/png': 'image',
  'image/jpeg': 'image',
  'image/jpg': 'image',
  'image/webp': 'image',
  'application/xml': 'xml',
  'text/xml': 'xml',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
  // Legacy .xls — @e965/xlsx parses both the OOXML and BIFF formats.
  'application/vnd.ms-excel': 'xlsx',
  'text/csv': 'text',
  'text/plain': 'text',
  'application/msword': 'doc',
}

// Mail clients (and Make.com) often ship attachments as application/octet-stream.
// Only these known extensions are rescued; anything else still 415s.
const EXT_TO_MIME: Record<string, string> = {
  pdf: 'application/pdf',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  xml: 'application/xml',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  xls: 'application/vnd.ms-excel',
  csv: 'text/csv',
  txt: 'text/plain',
  doc: 'application/msword',
}

export interface ResolvedDocument {
  kind: DocKind
  // The MIME stored in the bucket and the documents row. Differs from the
  // declared one when it was normalized (image/jpg) or derived from the
  // filename extension (application/octet-stream).
  effectiveMime: string
}

// Maps the declared MIME (+ filename, for octet-stream) to a document kind.
// Returns null for anything we don't accept — the caller responds 415.
export function resolveDocument(mime: string, fileName: string): ResolvedDocument | null {
  const lower = mime.toLowerCase()
  const direct = MIME_KIND[lower]
  if (direct) {
    // Anthropic's image blocks expect image/jpeg, not image/jpg.
    const effectiveMime = lower === 'image/jpg' ? 'image/jpeg' : lower
    return { kind: direct, effectiveMime }
  }
  if (lower === 'application/octet-stream') {
    const ext = fileName.toLowerCase().match(/\.([a-z0-9]+)$/)?.[1]
    const mapped = ext ? EXT_TO_MIME[ext] : undefined
    if (mapped) return { kind: MIME_KIND[mapped], effectiveMime: mapped }
  }
  return null
}

// 50,000 chars ≈ 12–18k tokens — bounds Claude input cost per document while
// comfortably covering real invoices/contracts. Mirrors the 50 KB cap used by
// the AI-chat uploader (aiAttachmentsService.EXTRACTED_TEXT_MAX_BYTES).
export const EXTRACTED_TEXT_MAX_CHARS = 50_000

export function truncateText(text: string): string {
  if (text.length <= EXTRACTED_TEXT_MAX_CHARS) return text
  return text.slice(0, EXTRACTED_TEXT_MAX_CHARS) + '\n\n...[skraćeno]'
}

function decodeUtf8(bytes: Uint8Array): string | null {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes)
  } catch {
    return null
  }
}

async function extractXlsx(bytes: Uint8Array): Promise<string | null> {
  const XLSX = await import('npm:@e965/xlsx@0.20.3')
  const wb = XLSX.read(bytes, { type: 'array' })
  // First sheet only — matches the AI-chat extraction behaviour.
  const firstName = wb.SheetNames[0]
  if (!firstName) return null
  return XLSX.utils.sheet_to_csv(wb.Sheets[firstName])
}

async function extractDocx(bytes: Uint8Array): Promise<string | null> {
  const mammoth = await import('npm:mammoth@1.8.0')
  const result = await mammoth.extractRawText({ buffer: Buffer.from(bytes) })
  return result.value
}

// Best-effort plain-text extraction. Returns null when the kind carries no
// readable content (doc) or extraction fails — the caller then classifies
// from email metadata only. Never throws.
export async function extractText(kind: DocKind, bytes: Uint8Array): Promise<string | null> {
  try {
    let text: string | null
    switch (kind) {
      case 'xml':
      case 'text':
        text = decodeUtf8(bytes)
        break
      case 'xlsx':
        text = await extractXlsx(bytes)
        break
      case 'docx':
        text = await extractDocx(bytes)
        break
      default: // pdf/image (never called) and doc (metadata-only by design)
        return null
    }
    if (text === null || text.trim().length === 0) {
      console.warn('[sort-document] extraction yielded no text, falling back to metadata-only', { kind })
      return null
    }
    return truncateText(text)
  } catch (err) {
    console.warn('[sort-document] extraction failed, falling back to metadata-only', {
      kind,
      message: String(err),
    })
    return null
  }
}
