import type jsPDF from 'jspdf'
import notoSansRegularUrl from '../assets/fonts/NotoSans-Regular.ttf'
import notoSansBoldUrl from '../assets/fonts/NotoSans-Bold.ttf'

/**
 * The font every generated PDF is drawn in.
 *
 * jsPDF's built-in fonts are WinAnsi-encoded. WinAnsi has `š` and `ž` but **no mapping for `č`, `ć`
 * or `đ`**, and one unmapped character makes jsPDF re-encode the *entire string* as UCS-2BE, which
 * the built-in font then draws as garbage — `Račun` came out as `R a u n`, and the `hr-HR` minus
 * sign (U+2212) destroyed any line holding a negative number. So this is not a nicety: without an
 * embedded Unicode face, a Croatian document is unreadable rather than merely unaccented.
 *
 * The files are checked in under `src/assets/fonts/` (see the README there). They used to be
 * fetched from fonts.gstatic.com on every single export — ~1.1 MB a time, from the app's only
 * third-party origin, with a silent fallback to the broken built-in font whenever the request
 * failed. Now Vite emits them as hashed assets, so they are same-origin and cached for a year.
 *
 * **There is no fallback.** A failure here means a broken deploy, and the honest response is to
 * fail the export rather than hand someone a corrupted document with a company letterhead on it.
 */

export const PDF_FONT_FAMILY = 'NotoSans'

/** Faces registered below. jsPDF silently resolves an unregistered style to a WinAnsi standard
 *  font (asking for 'italic' gets you Times-Italic, diacritics and all), so callers must stay
 *  within these two. */
export type PdfFontStyle = 'normal' | 'bold'

const toBase64 = (buffer: ArrayBuffer): string => {
  const bytes = new Uint8Array(buffer)
  let binary = ''
  for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i])
  return btoa(binary)
}

/**
 * Fetched and base64-encoded once per session, not once per export: the encoding is a per-byte
 * string concat over a megabyte, and a user generating three reports paid it three times.
 */
let facesPromise: Promise<{ regular: string; bold: string }> | null = null

async function loadFaces(): Promise<{ regular: string; bold: string }> {
  if (!facesPromise) {
    facesPromise = (async () => {
      const [regularRes, boldRes] = await Promise.all([
        fetch(notoSansRegularUrl),
        fetch(notoSansBoldUrl),
      ])
      if (!regularRes.ok || !boldRes.ok) {
        throw new Error(`PDF font could not be loaded (${regularRes.status}/${boldRes.status})`)
      }
      const [regular, bold] = await Promise.all([regularRes.arrayBuffer(), boldRes.arrayBuffer()])
      return { regular: toBase64(regular), bold: toBase64(bold) }
    })().catch(error => {
      // Don't cache a failure: a transient one would otherwise poison every later export.
      facesPromise = null
      throw error
    })
  }
  return facesPromise
}

/**
 * Registers Noto Sans on `doc` and selects it. **Throws** if the font cannot be loaded — callers
 * must let that reach `useAsyncExport`, which tells the user, instead of carrying on in a font
 * that cannot spell the document.
 */
export async function loadUnicodeFont(doc: jsPDF): Promise<void> {
  const { regular, bold } = await loadFaces()
  doc.addFileToVFS('NotoSans-Regular.ttf', regular)
  doc.addFont('NotoSans-Regular.ttf', PDF_FONT_FAMILY, 'normal')
  doc.addFileToVFS('NotoSans-Bold.ttf', bold)
  doc.addFont('NotoSans-Bold.ttf', PDF_FONT_FAMILY, 'bold')
  doc.setFont(PDF_FONT_FAMILY, 'normal')
}
