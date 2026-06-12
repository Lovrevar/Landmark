// Unit tests for extract.ts — MIME/extension resolution, truncation, and the
// degrade-to-null behaviour of extractText.
//
// Run: `deno test` from supabase/functions/ (or `deno test extract.test.ts`).

import * as XLSX from 'npm:@e965/xlsx@0.20.3'
import { assert, assertEquals } from 'jsr:@std/assert@1'
import {
  EXTRACTED_TEXT_MAX_CHARS,
  extractText,
  resolveDocument,
  truncateText,
} from './extract.ts'

// ===========================================================================
// resolveDocument
// ===========================================================================

Deno.test('resolveDocument: maps whitelisted MIMEs to their kind', () => {
  assertEquals(resolveDocument('application/pdf', 'a.pdf'), {
    kind: 'pdf',
    effectiveMime: 'application/pdf',
  })
  assertEquals(resolveDocument('image/png', 'a.png')?.kind, 'image')
  assertEquals(resolveDocument('application/xml', 'racun.xml')?.kind, 'xml')
  assertEquals(resolveDocument('text/xml', 'racun.xml')?.kind, 'xml')
  assertEquals(
    resolveDocument(
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'ugovor.docx',
    )?.kind,
    'docx',
  )
  assertEquals(
    resolveDocument(
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'troskovnik.xlsx',
    )?.kind,
    'xlsx',
  )
  assertEquals(resolveDocument('application/vnd.ms-excel', 'stari.xls')?.kind, 'xlsx')
  assertEquals(resolveDocument('text/csv', 'a.csv')?.kind, 'text')
  assertEquals(resolveDocument('text/plain', 'a.txt')?.kind, 'text')
  assertEquals(resolveDocument('application/msword', 'stari.doc')?.kind, 'doc')
})

Deno.test('resolveDocument: normalizes image/jpg to image/jpeg', () => {
  assertEquals(resolveDocument('image/jpg', 'a.jpg'), {
    kind: 'image',
    effectiveMime: 'image/jpeg',
  })
})

Deno.test('resolveDocument: MIME matching is case-insensitive', () => {
  assertEquals(resolveDocument('Application/PDF', 'a.pdf')?.kind, 'pdf')
})

Deno.test('resolveDocument: octet-stream falls back to the filename extension', () => {
  assertEquals(resolveDocument('application/octet-stream', 'racun.xml'), {
    kind: 'xml',
    effectiveMime: 'application/xml',
  })
  assertEquals(resolveDocument('application/octet-stream', 'Ponuda.DOCX'), {
    kind: 'docx',
    effectiveMime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  })
  assertEquals(resolveDocument('application/octet-stream', 'scan.pdf')?.kind, 'pdf')
})

Deno.test('resolveDocument: octet-stream with unknown or missing extension is rejected', () => {
  assertEquals(resolveDocument('application/octet-stream', 'archive.zip'), null)
  assertEquals(resolveDocument('application/octet-stream', 'README'), null)
})

Deno.test('resolveDocument: non-whitelisted MIME is rejected (no extension rescue)', () => {
  assertEquals(resolveDocument('application/zip', 'a.zip'), null)
  // Extension fallback applies ONLY to octet-stream.
  assertEquals(resolveDocument('application/x-foo', 'racun.xml'), null)
})

// ===========================================================================
// truncateText
// ===========================================================================

Deno.test('truncateText: text at or under the cap is untouched', () => {
  const text = 'a'.repeat(EXTRACTED_TEXT_MAX_CHARS)
  assertEquals(truncateText(text), text)
  assertEquals(truncateText('kratko'), 'kratko')
})

Deno.test('truncateText: text over the cap is cut and marked', () => {
  const text = 'a'.repeat(EXTRACTED_TEXT_MAX_CHARS + 1)
  const out = truncateText(text)
  assert(out.endsWith('...[skraćeno]'))
  assertEquals(out.length, EXTRACTED_TEXT_MAX_CHARS + '\n\n...[skraćeno]'.length)
})

// ===========================================================================
// extractText
// ===========================================================================

const enc = (s: string) => new TextEncoder().encode(s)

Deno.test('extractText: xml/text decode UTF-8 verbatim', async () => {
  const xml = '<Invoice><cbc:ID>123</cbc:ID></Invoice>'
  assertEquals(await extractText('xml', enc(xml)), xml)
  assertEquals(await extractText('text', enc('šćčđž; redak')), 'šćčđž; redak')
})

Deno.test('extractText: invalid UTF-8 degrades to null without throwing', async () => {
  assertEquals(await extractText('text', new Uint8Array([0xff, 0xfe, 0x80])), null)
})

Deno.test('extractText: whitespace-only content degrades to null', async () => {
  assertEquals(await extractText('text', enc('  \n\t ')), null)
})

Deno.test('extractText: doc always degrades to null (metadata-only by design)', async () => {
  assertEquals(await extractText('doc', enc('binarni word sadržaj')), null)
})

Deno.test('extractText: xlsx first sheet converts to CSV', async () => {
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.aoa_to_sheet([['stavka', 'iznos'], ['beton', 1200]]),
    'List1',
  )
  // Second sheet must be ignored (first sheet only).
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['ignorirano']]), 'List2')
  const bytes = new Uint8Array(XLSX.write(wb, { type: 'array', bookType: 'xlsx' }))

  const out = await extractText('xlsx', bytes)
  assert(out !== null)
  assert(out.includes('stavka,iznos'))
  assert(out.includes('beton,1200'))
  assertEquals(out.includes('ignorirano'), false)
})

Deno.test('extractText: corrupt xlsx degrades to null', async () => {
  // A truncated ZIP header — SheetJS parses bare text leniently (as CSV), so a
  // genuinely broken container is needed to exercise the failure path.
  const truncatedZip = new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0x01, 0x02, 0x03])
  assertEquals(await extractText('xlsx', truncatedZip), null)
})

// A minimal but valid .docx (one paragraph: "Ugovor o izvođenju radova — projekt
// Zona 31"), base64-encoded — exercises the real mammoth extraction path.
const SAMPLE_DOCX_BASE64 =
  'UEsDBBQAAAAIAPRQzFzohNIN2gAAAE8BAAATAAAAW0NvbnRlbnRfVHlwZXNdLnhtbH2QzU4DMQyE' +
  '7zxFlCvazcIBIdRtD/wcgUN5ACvxbiMSO0rc0r49Xip64MDRnvnGI682x5zMAWuLTKO96QdrkDyH' +
  'SPNoP7Yv3b01TYACJCYc7Qmb3ayvVttTwWYUpjbanUh5cK75HWZoPRckVSauGUTHOrsC/hNmdLfD' +
  'cOc8kyBJJ0uG1bAnnGCfxDwfdX9uorw1j2fjcmu0UEqKHkRlt6hOwTdtXmNA8w5VXiGrzX1xDS6w' +
  '32dF+/9zDhT+tO14mqLHC7+klcoeW9OX5NRflAyRrn+LuJ9/rL8BUEsDBBQAAAAIAPRQzFw/rf76' +
  'rwAAACwBAAALAAAAX3JlbHMvLnJlbHONzzsOwjAMANCdU0TeaVoGhFBDF4TUFZUDRImbVjQfxeHT' +
  '25OBASoGRv+e7bp52ondMdLonYCqKIGhU16Pzgi4dKf1Dhgl6bScvEMBMxI0h1V9xkmmPEPDGIhl' +
  'xJGAIaWw55zUgFZS4QO6XOl9tDLlMBoepLpKg3xTllsePw1YoKzVAmKrK2DdHPAf3Pf9qPDo1c2i' +
  'Sz92LDqyLKPBJODho+b6nS4yCzyfw7+ePLwAUEsDBBQAAAAIAPRQzFyGkwGnxQAAAPkAAAARAAAA' +
  'd29yZC9kb2N1bWVudC54bWxFjkGOwjAMRfdzCit7SAEJoaotuzkBbNiFxlPKNHbkhBZYcQUkjjQn' +
  'mZOQdhazeV+W5fddbK+ugx4ltEylWswzBUg125aaUu13n7ONghANWdMxYaluGNS2+iiG3HJ9cUgR' +
  'koFCPpTqFKPPtQ71CZ0Jc/ZIaffF4kxMozR6YLFeuMYQUoHr9DLL1tqZltTkPLK9VSn9CBkRq33D' +
  'PQswtPeef55I5wuIsdwb+H28IOnO+B3hwGRgtSj0eDNSJvqJf179/3T1BlBLAQIUAxQAAAAIAPRQ' +
  'zFzohNIN2gAAAE8BAAATAAAAAAAAAAAAAACAAQAAAABbQ29udGVudF9UeXBlc10ueG1sUEsBAhQD' +
  'FAAAAAgA9FDMXD+t/vqvAAAALAEAAAsAAAAAAAAAAAAAAIABCwEAAF9yZWxzLy5yZWxzUEsBAhQD' +
  'FAAAAAgA9FDMXIaTAafFAAAA+QAAABEAAAAAAAAAAAAAAIAB4wEAAHdvcmQvZG9jdW1lbnQueG1s' +
  'UEsFBgAAAAADAAMAuQAAANcCAAAAAA=='

Deno.test('extractText: valid docx extracts text via mammoth', async () => {
  const bytes = Uint8Array.from(atob(SAMPLE_DOCX_BASE64), c => c.charCodeAt(0))
  const out = await extractText('docx', bytes)
  assert(out !== null)
  assert(out.includes('Ugovor o izvođenju radova'))
  assert(out.includes('Zona 31'))
})

Deno.test('extractText: corrupt docx degrades to null', async () => {
  assertEquals(await extractText('docx', enc('this is not a zip archive')), null)
})

Deno.test('extractText: oversized content is truncated', async () => {
  const big = 'x'.repeat(EXTRACTED_TEXT_MAX_CHARS + 100)
  const out = await extractText('text', enc(big))
  assert(out !== null)
  assert(out.endsWith('...[skraćeno]'))
})
