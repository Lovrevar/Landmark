// Unit tests for parse.ts — delimiter sniffing, RFC 4180 quoting, encoding
// fallback and file-kind detection.
//
// Run: `deno test` from supabase/functions/ (or `deno test import-erp/`).

import { assertEquals } from 'jsr:@std/assert@1'
import { decodeText, detectFileKind, parseCsv } from './parse.ts'

Deno.test('parseCsv: semicolon-delimited, the Croatian Excel default', () => {
  const { headers, rows } = parseCsv('erp_id;invoice_number;base_amount\nA1;R-1;100.50\n')
  assertEquals(headers, ['erp_id', 'invoice_number', 'base_amount'])
  assertEquals(rows, [{ erp_id: 'A1', invoice_number: 'R-1', base_amount: '100.50' }])
})

Deno.test('parseCsv: sniffs a comma delimiter when that is what the file uses', () => {
  const { rows } = parseCsv('erp_id,name\nA1,ACME d.o.o.\n')
  assertEquals(rows[0], { erp_id: 'A1', name: 'ACME d.o.o.' })
})

Deno.test('parseCsv: quoted fields may contain the delimiter, quotes and newlines', () => {
  const { rows } = parseCsv('erp_id;description\nA1;"a;b ""quoted"" c\nsecond line"\n')
  assertEquals(rows.length, 1)
  assertEquals(rows[0].description, 'a;b "quoted" c\nsecond line')
})

Deno.test('parseCsv: strips a BOM so the first header still matches', () => {
  const { headers } = parseCsv('﻿herp_id;name\nA1;x\n')
  assertEquals(headers[0], 'herp_id')
  const clean = parseCsv('﻿rp_id;name\nA1;x\n')
  assertEquals(clean.headers[0], 'rp_id')
})

Deno.test('parseCsv: header names are normalised for case and spacing', () => {
  const { headers } = parseCsv('ERP Id;Invoice-Number;  base_amount  \nA1;R-1;5\n')
  assertEquals(headers, ['erp_id', 'invoice_number', 'base_amount'])
})

Deno.test('parseCsv: CRLF and a missing trailing newline both parse', () => {
  const { rows } = parseCsv('a;b\r\n1;2\r\n3;4')
  assertEquals(rows, [{ a: '1', b: '2' }, { a: '3', b: '4' }])
})

Deno.test('parseCsv: blank lines are dropped, not turned into empty rows', () => {
  const { rows } = parseCsv('a;b\n1;2\n\n\n3;4\n')
  assertEquals(rows.length, 2)
})

Deno.test('parseCsv: an empty file yields no headers and no rows', () => {
  assertEquals(parseCsv(''), { headers: [], rows: [] })
})

Deno.test('decodeText: valid UTF-8 is decoded as UTF-8', () => {
  const bytes = new TextEncoder().encode('VODOVOD-OSIJEK d.o.o. čćšđž')
  assertEquals(decodeText(bytes), 'VODOVOD-OSIJEK d.o.o. čćšđž')
})

Deno.test('decodeText: falls back to CP1250 rather than mangling Croatian letters', () => {
  // 0x9A / 0x8A are š / Š in CP1250 and invalid as standalone UTF-8.
  const bytes = new Uint8Array([0x9a, 0x8a])
  assertEquals(decodeText(bytes), 'šŠ')
})

Deno.test('detectFileKind: recognises extensions and content types', () => {
  assertEquals(detectFileKind('invoices_20260831.csv', null), 'csv')
  assertEquals(detectFileKind('invoices.XLSX', null), 'xlsx')
  assertEquals(detectFileKind('old.xls', null), 'xlsx')
  assertEquals(detectFileKind('noext', 'text/csv'), 'csv')
  assertEquals(
    detectFileKind('noext', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'),
    'xlsx',
  )
  assertEquals(detectFileKind('mystery.pdf', 'application/pdf'), null)
})
