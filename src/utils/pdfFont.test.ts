import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { jsPDF } from 'jspdf'

/**
 * The reason the font is checked into this repo, asserted against the real jsPDF build.
 *
 * jsPDF's built-in fonts are WinAnsi. WinAnsi has `š` and `ž` but **no mapping for `č`, `ć` or
 * `đ`**, and one unmapped character makes jsPDF re-encode the *whole string* as UCS-2BE — which a
 * WinAnsi font then draws as two garbage glyphs per character. `Račun` came out as `R a u n`, and
 * the `hr-HR` minus sign (U+2212) did the same to any line holding a negative number.
 *
 * These tests fail if someone drops the embedded font, replaces it with a face that lacks Croatian,
 * or reverts to a built-in one. They read the TTF from disk rather than importing `pdfFont.ts`,
 * because that module imports the font as a Vite asset URL and fetches it in the browser.
 */

const FONTS = join(__dirname, '../assets/fonts')
const CROATIAN = 'Račun −1.234 Đakovo šušanj'

const withNotoSans = (): jsPDF => {
  const doc = new jsPDF()
  doc.addFileToVFS('NotoSans-Regular.ttf', readFileSync(join(FONTS, 'NotoSans-Regular.ttf')).toString('base64'))
  doc.addFont('NotoSans-Regular.ttf', 'NotoSans', 'normal')
  doc.addFileToVFS('NotoSans-Bold.ttf', readFileSync(join(FONTS, 'NotoSans-Bold.ttf')).toString('base64'))
  doc.addFont('NotoSans-Bold.ttf', 'NotoSans', 'bold')
  return doc
}

/** The UCS-2BE signature: every ASCII letter preceded by a NUL byte. */
// eslint-disable-next-line no-control-regex -- the NUL bytes are the thing being detected
const isMojibake = (output: string): boolean => /\u0000R\u0000a/.test(output)

describe('the embedded font', () => {
  it('renders Croatian without the UCS-2BE fallback', () => {
    const doc = withNotoSans()
    doc.setFont('NotoSans', 'normal')
    doc.text(CROATIAN, 10, 10)
    expect(isMojibake(doc.output())).toBe(false)
  })

  it('embeds the face into the document, so the reader needs nothing installed', () => {
    const doc = withNotoSans()
    doc.setFont('NotoSans', 'normal')
    doc.text(CROATIAN, 10, 10)
    expect(doc.output()).toMatch(/FontFile2|NotoSans/)
  })

  it('registers both faces the generators use', () => {
    const list = withNotoSans().getFontList()
    expect(Object.keys(list)).toContain('NotoSans')
    expect(list.NotoSans).toEqual(expect.arrayContaining(['normal', 'bold']))
  })

  it('proves the bug it exists to fix: the built-in font garbles the same string', () => {
    // Not a test of our code — a test of the premise. If jsPDF ever gains a Unicode built-in,
    // this fails and the embedded font becomes optional.
    const doc = new jsPDF()
    doc.setFont('helvetica', 'normal')
    doc.text(CROATIAN, 10, 10)
    expect(isMojibake(doc.output())).toBe(true)
  })
})
