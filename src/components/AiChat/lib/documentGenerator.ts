import type jsPDF from 'jspdf'
import type { DocumentSheet, DocumentSpec } from '../../../types/aiChat'

// Client-side document generation for the AI chat `create_document` tool.
//
// The agent authors a DocumentSpec (validated server-side by
// handleCreateDocument and again on arrival by parseDocumentSpec); the file
// itself is built here, in the browser, when the user clicks Download. This
// mirrors the repo's existing jsPDF / @e965/xlsx / blob-download patterns and
// keeps both heavy libraries out of the main bundle via dynamic import.

const MIME_MARKDOWN = 'text/markdown;charset=utf-8'
const MIME_XLSX =
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'

// Strip characters illegal in filenames; collapse whitespace; cap length.
function sanitizeFilename(title: string): string {
  const cleaned = title
    // eslint-disable-next-line no-control-regex -- intentionally strips control chars illegal in filenames
    .replace(/[/\\:*?"<>|\x00-\x1f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  return (cleaned || 'dokument').slice(0, 120)
}

// Trigger a browser download for an in-memory blob (anchor + object URL —
// the same pattern used across the Reports/exports code).
function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

/**
 * Generate the file described by `spec` and trigger its download.
 * Throws if generation fails — the caller (DocumentCard) surfaces the error.
 */
export async function generateAndDownloadDocument(spec: DocumentSpec): Promise<void> {
  const base = sanitizeFilename(spec.title)
  switch (spec.format) {
    case 'markdown':
      downloadBlob(
        new Blob([spec.markdown ?? ''], { type: MIME_MARKDOWN }),
        `${base}.md`,
      )
      return
    case 'xlsx':
      await generateXlsx(spec.sheets ?? [], `${base}.xlsx`)
      return
    case 'pdf':
      await generatePdf(spec.title, spec.markdown ?? '', `${base}.pdf`)
      return
  }
}

// ---------------------------------------------------------------------------
// xlsx
// ---------------------------------------------------------------------------

async function generateXlsx(sheets: DocumentSheet[], filename: string): Promise<void> {
  const XLSX = await import('@e965/xlsx')
  const wb = XLSX.utils.book_new()
  const usedNames = new Set<string>()
  sheets.forEach((sheet, i) => {
    const aoa = [sheet.columns, ...sheet.rows]
    const ws = XLSX.utils.aoa_to_sheet(aoa)
    XLSX.utils.book_append_sheet(wb, ws, uniqueSheetName(sheet.name, i, usedNames))
  })
  const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer
  downloadBlob(new Blob([buf], { type: MIME_XLSX }), filename)
}

// Excel rejects worksheet names > 31 chars, those containing []:*?/\, and
// duplicates. Sanitize, then disambiguate.
function uniqueSheetName(raw: string, index: number, used: Set<string>): string {
  let name = (raw || `List${index + 1}`)
    .replace(/[[\]:*?/\\]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 31)
  if (!name) name = `List${index + 1}`
  let candidate = name
  let n = 2
  while (used.has(candidate.toLowerCase())) {
    const suffix = ` (${n})`
    candidate = name.slice(0, 31 - suffix.length) + suffix
    n++
  }
  used.add(candidate.toLowerCase())
  return candidate
}

// ---------------------------------------------------------------------------
// pdf
// ---------------------------------------------------------------------------

async function generatePdf(
  title: string,
  markdown: string,
  filename: string,
): Promise<void> {
  const [{ default: JsPDF }, { loadUnicodeFont, PDF_FONT_FAMILY }] = await Promise.all([
    import('jspdf'),
    import('../../../utils/pdfFont'),
  ])
  const doc = new JsPDF('p', 'mm', 'a4')
  // No fallback: Helvetica cannot encode č/ć/đ, and jsPDF answers one unmapped character by
  // re-encoding the whole string into garbage. A failure here means the font asset did not ship,
  // so let it reach the caller rather than handing the user an unreadable document.
  await loadUnicodeFont(doc)
  renderMarkdownToPdf(doc, title, markdown, PDF_FONT_FAMILY)
  doc.save(filename)
}

interface Segment {
  text: string
  bold: boolean
}

// Split a line into bold/non-bold segments on `**` delimiters. Unbalanced
// markers degrade gracefully (best-effort, not a full Markdown parser).
function parseBold(text: string): Segment[] {
  const parts = text.split('**')
  const segs: Segment[] = []
  parts.forEach((p, i) => {
    if (p === '') return
    segs.push({ text: p, bold: i % 2 === 1 })
  })
  return segs.length > 0 ? segs : [{ text, bold: false }]
}

// Minimal Markdown → PDF renderer. Covers the subset the agent is told to
// use: headings (#/##/###), paragraphs, **bold**, and bullet/numbered lists.
// Markdown table rows render as plain text (separator rows are dropped) —
// best-effort by design.
function renderMarkdownToPdf(
  doc: jsPDF,
  title: string,
  markdown: string,
  font: string,
): void {
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const margin = 18
  const maxWidth = pageWidth - margin * 2
  let y = margin

  const newPageIfNeeded = (h: number): void => {
    if (y + h > pageHeight - margin) {
      doc.addPage()
      y = margin
    }
  }

  // Lay out a run of bold/normal segments with word wrapping and a hanging
  // left indent. `baseBold` forces the whole run bold (used for headings);
  // inline **markers** still toggle on top of it. Advances `y` past the block.
  const drawRich = (
    text: string,
    fontSize: number,
    indent: number,
    baseBold = false,
  ): void => {
    doc.setFontSize(fontSize)
    const lineH = fontSize * 0.52
    const tokens: Segment[] = []
    for (const seg of parseBold(text)) {
      for (const word of seg.text.split(/\s+/)) {
        if (word) tokens.push({ text: word, bold: baseBold || seg.bold })
      }
    }
    if (tokens.length === 0) {
      y += lineH
      return
    }
    let x = margin + indent
    let lineStart = true
    newPageIfNeeded(lineH)
    for (const tok of tokens) {
      doc.setFont(font, tok.bold ? 'bold' : 'normal')
      const wordW = doc.getTextWidth(tok.text)
      const spaceW = lineStart ? 0 : doc.getTextWidth(' ')
      if (!lineStart && x + spaceW + wordW > margin + maxWidth) {
        y += lineH
        newPageIfNeeded(lineH)
        x = margin + indent
        lineStart = true
      }
      if (!lineStart) x += spaceW
      doc.text(tok.text, x, y)
      x += wordW
      lineStart = false
    }
    y += lineH
  }

  // Title
  doc.setFont(font, 'bold')
  doc.setFontSize(18)
  for (const line of doc.splitTextToSize(title, maxWidth) as string[]) {
    newPageIfNeeded(9)
    doc.text(line, margin, y)
    y += 9
  }
  y += 3

  let orderedCounter = 0
  for (const rawLine of markdown.replace(/\r\n/g, '\n').split('\n')) {
    const line = rawLine.trimEnd()

    if (line.trim() === '') {
      y += 3
      orderedCounter = 0
      continue
    }

    // Markdown table separator row (|---|---|) — drop it.
    if (/^\s*\|?[\s:|-]+\|?\s*$/.test(line) && line.includes('-')) {
      continue
    }

    // Headings
    const heading = /^(#{1,3})\s+(.*)$/.exec(line)
    if (heading) {
      orderedCounter = 0
      const level = heading[1].length
      const size = level === 1 ? 14.5 : level === 2 ? 12.5 : 11.5
      y += 2
      drawRich(heading[2], size, 0, true)
      y += 1.5
      continue
    }

    // Bullet / numbered list items
    const bullet = /^[-*]\s+(.*)$/.exec(line)
    const numbered = /^(\d+)[.)]\s+(.*)$/.exec(line)
    if (bullet || numbered) {
      const marker = bullet ? '•' : `${++orderedCounter}.`
      const body = bullet ? bullet[1] : numbered![2]
      // Reserve space first so the marker and the first body line never
      // straddle a page break.
      newPageIfNeeded(6)
      doc.setFont(font, 'normal')
      doc.setFontSize(10.5)
      doc.text(marker, margin, y)
      drawRich(body, 10.5, 7)
      continue
    }

    // Plain paragraph
    orderedCounter = 0
    drawRich(line, 10.5, 0)
  }
}
