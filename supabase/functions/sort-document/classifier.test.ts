// Unit tests for the sort-document classification engine.
//
// These cover the logic-dense, token-free parts of classifier.ts with a fake
// Anthropic client — no network, no database. They pin the behaviour most
// likely to rot silently: Croatian text normalization, fuzzy entity matching,
// the ambiguity / hallucinated-id guards in resolveHints, and the
// confidence/validity collapse in classifyDocument.
//
// Run: `deno test` from supabase/functions/ (or `deno test classifier.test.ts`).

import Anthropic from 'npm:@anthropic-ai/sdk@0.97.0'
import { assert, assertEquals } from 'jsr:@std/assert@1'
import {
  classifyDocument,
  matchesTerm,
  normalize,
  resolveHints,
  type CategoryRow,
  type DocumentInput,
  type EmailContext,
  type EntityCandidate,
  type EntityHint,
  type EntityType,
} from './classifier.ts'

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

// A scripted fake Anthropic. Each queued entry is the tool_use the model will
// "return" for the next messages.create call, in order. classifyDocument calls
// Pass 1 (classify_document) first, then one disambiguate (pick_entity) per
// ambiguous hint — so the queue order mirrors that sequence. Throws if called
// more times than scripted, which lets a test assert "no Claude call happened".
interface ScriptedTool {
  name: string
  input: unknown
}

function fakeAnthropic(responses: ScriptedTool[] = []) {
  let i = 0
  const calls: Array<Record<string, unknown>> = []
  const client = {
    calls,
    messages: {
      create: (params: Record<string, unknown>) => {
        calls.push(params)
        const r = responses[i++]
        if (!r) throw new Error(`fakeAnthropic: unexpected call #${i} (none queued)`)
        return Promise.resolve({
          content: [{ type: 'tool_use', name: r.name, input: r.input }],
        })
      },
    },
  }
  return client as unknown as Anthropic & { calls: typeof calls }
}

// Build a candidate the way loadEntityCandidates does: one primary haystack
// from the joined raw keys, plus one haystack per alias.
function cand(
  entity_type: EntityType,
  id: string,
  label: string,
  raw: string | string[],
  aliases: string[] = [],
): EntityCandidate {
  const keys = Array.isArray(raw) ? raw : [raw]
  const haystacks = [normalize(keys.filter(Boolean).join(' ')), ...aliases.map(normalize)]
    .filter(h => h.length > 0)
  return { id, entity_type, label, haystacks }
}

const EMAIL: EmailContext = { subject: 'Test', body: '', from: 'a@b.hr' }
const MODEL = 'test-model'

// ===========================================================================
// normalize
// ===========================================================================

Deno.test('normalize: strips Croatian diacritics including đ', () => {
  assertEquals(normalize('Đakovačka ŠČĆŽ'), 'dakovacka sccz')
  assertEquals(normalize('Špica'), 'spica')
  assertEquals(normalize('Glavni Trošak'), 'glavni trosak')
})

Deno.test('normalize: lowercases, collapses and trims whitespace', () => {
  assertEquals(normalize('  Pannonia   Rezidencija  '), 'pannonia rezidencija')
  assertEquals(normalize('A\t\nB'), 'a b')
})

// ===========================================================================
// matchesTerm
// ===========================================================================

Deno.test('matchesTerm: candidate haystack contains the term', () => {
  const c = cand('project', 'p1', 'Rezidencija Pannonia', 'Rezidencija Pannonia')
  assert(matchesTerm(c, normalize('pannonia')))
})

Deno.test('matchesTerm: term contains the candidate haystack (reverse containment)', () => {
  const c = cand('project', 'p1', 'Pannonia', 'Pannonia')
  assert(matchesTerm(c, normalize('rezidencija pannonia faza 2')))
})

Deno.test('matchesTerm: rejects terms shorter than 3 chars', () => {
  const c = cand('unit', 'u1', 'Stan 5', '5')
  assertEquals(matchesTerm(c, '5'), false)
})

Deno.test('matchesTerm: no overlap returns false', () => {
  const c = cand('project', 'p1', 'Pannonia', 'Pannonia')
  assertEquals(matchesTerm(c, normalize('garaza')), false)
})

Deno.test('matchesTerm: alias haystack matches', () => {
  const c = cand('project', 'p1', 'Zona 31', ['Zona 31', 'Vukovarska'], ['Osijek'])
  assert(matchesTerm(c, normalize('Osijek')))
  assert(matchesTerm(c, normalize('projekt osijek, faza 1')))
})

Deno.test('matchesTerm: term spanning the name/alias boundary does not match', () => {
  const c = cand('project', 'p1', 'Zona 31', ['Zona 31', 'Vukovarska'], ['Osijek'])
  // "vukovarska osi" is a substring of "…vukovarska osijek" only when name and
  // alias are concatenated into one haystack — must NOT match when separate.
  assertEquals(matchesTerm(c, normalize('vukovarska osi')), false)
  // But a term containing the full alias is a legitimate reverse-containment hit.
  assert(matchesTerm(c, normalize('vukovarska osijek')))
})

// ===========================================================================
// resolveHints
// ===========================================================================

Deno.test('resolveHints: exactly one match resolves with no Claude call', async () => {
  const candidates = [
    cand('project', 'p1', 'Rezidencija Pannonia', 'Rezidencija Pannonia'),
    cand('project', 'p2', 'Naselje Dunav', 'Naselje Dunav'),
  ]
  const hints: EntityHint[] = [{ entity_type: 'project', search_terms: ['Pannonia'] }]
  const fake = fakeAnthropic() // no responses queued — must not be called
  const out = await resolveHints(fake, MODEL, EMAIL, hints, candidates)
  assertEquals(out, [{ entity_type: 'project', entity_id: 'p1' }])
  assertEquals(fake.calls.length, 0)
})

Deno.test('resolveHints: ambiguous match triggers disambiguation', async () => {
  const candidates = [
    cand('project', 'p1', 'Pannonia Faza 1', 'Pannonia Faza 1'),
    cand('project', 'p2', 'Pannonia Faza 2', 'Pannonia Faza 2'),
  ]
  const hints: EntityHint[] = [{ entity_type: 'project', search_terms: ['Pannonia'] }]
  const fake = fakeAnthropic([{ name: 'pick_entity', input: { entity_id: 'p2' } }])
  const out = await resolveHints(fake, MODEL, EMAIL, hints, candidates)
  assertEquals(out, [{ entity_type: 'project', entity_id: 'p2' }])
  assertEquals(fake.calls.length, 1) // one disambiguation call
})

Deno.test('resolveHints: hallucinated id from disambiguation is dropped', async () => {
  const candidates = [
    cand('project', 'p1', 'Pannonia Faza 1', 'Pannonia Faza 1'),
    cand('project', 'p2', 'Pannonia Faza 2', 'Pannonia Faza 2'),
  ]
  const hints: EntityHint[] = [{ entity_type: 'project', search_terms: ['Pannonia'] }]
  // Model returns an id that isn't among the candidates → guard rejects it.
  const fake = fakeAnthropic([{ name: 'pick_entity', input: { entity_id: 'ghost' } }])
  const out = await resolveHints(fake, MODEL, EMAIL, hints, candidates)
  assertEquals(out, [])
})

Deno.test('resolveHints: no match drops the hint, no Claude call', async () => {
  const candidates = [cand('project', 'p1', 'Pannonia', 'Pannonia')]
  const hints: EntityHint[] = [{ entity_type: 'project', search_terms: ['Nepostojeci'] }]
  const fake = fakeAnthropic()
  const out = await resolveHints(fake, MODEL, EMAIL, hints, candidates)
  assertEquals(out, [])
  assertEquals(fake.calls.length, 0)
})

Deno.test('resolveHints: terms shorter than 3 chars are ignored', async () => {
  const candidates = [cand('unit', 'u1', 'Stan 5', '5')]
  const hints: EntityHint[] = [{ entity_type: 'unit', search_terms: ['5'] }]
  const fake = fakeAnthropic()
  const out = await resolveHints(fake, MODEL, EMAIL, hints, candidates)
  assertEquals(out, [])
})

Deno.test('resolveHints: unknown entity_type is skipped', async () => {
  const candidates = [cand('project', 'p1', 'Pannonia', 'Pannonia')]
  const hints = [{ entity_type: 'bogus', search_terms: ['Pannonia'] }] as unknown as EntityHint[]
  const fake = fakeAnthropic()
  const out = await resolveHints(fake, MODEL, EMAIL, hints, candidates)
  assertEquals(out, [])
})

Deno.test('resolveHints: duplicate resolutions are de-duplicated', async () => {
  const candidates = [cand('project', 'p1', 'Pannonia', 'Pannonia')]
  // Two hints that both resolve to the same project.
  const hints: EntityHint[] = [
    { entity_type: 'project', search_terms: ['Pannonia'] },
    { entity_type: 'project', search_terms: ['pannonia'] },
  ]
  const fake = fakeAnthropic()
  const out = await resolveHints(fake, MODEL, EMAIL, hints, candidates)
  assertEquals(out, [{ entity_type: 'project', entity_id: 'p1' }])
})

Deno.test('resolveHints: alias-only hint resolves with no Claude call', async () => {
  const candidates = [
    cand('project', 'p1', 'Zona 31', ['Zona 31', 'Vukovarska'], ['Osijek']),
    cand('project', 'p2', 'Naselje Dunav', 'Naselje Dunav'),
  ]
  const hints: EntityHint[] = [{ entity_type: 'project', search_terms: ['Osijek'] }]
  const fake = fakeAnthropic()
  const out = await resolveHints(fake, MODEL, EMAIL, hints, candidates)
  assertEquals(out, [{ entity_type: 'project', entity_id: 'p1' }])
  assertEquals(fake.calls.length, 0)
})

Deno.test('resolveHints: term matching both name and alias of the same project skips disambiguation', async () => {
  // "zona 31 osijek" hits the primary haystack AND the alias of the same
  // candidate — must count as ONE match, not trigger a Claude call.
  const candidates = [cand('project', 'p1', 'Zona 31', ['Zona 31', 'Osijek'], ['Zona 31 Osijek'])]
  const hints: EntityHint[] = [{ entity_type: 'project', search_terms: ['Zona 31'] }]
  const fake = fakeAnthropic()
  const out = await resolveHints(fake, MODEL, EMAIL, hints, candidates)
  assertEquals(out, [{ entity_type: 'project', entity_id: 'p1' }])
  assertEquals(fake.calls.length, 0)
})

Deno.test('resolveHints: diacritic-insensitive match (đ and accents)', async () => {
  const candidates = [cand('subcontractor', 's1', 'Đuro Đaković', 'Đuro Đaković')]
  const hints: EntityHint[] = [{ entity_type: 'subcontractor', search_terms: ['Duro Dakovic'] }]
  const fake = fakeAnthropic()
  const out = await resolveHints(fake, MODEL, EMAIL, hints, candidates)
  assertEquals(out, [{ entity_type: 'subcontractor', entity_id: 's1' }])
})

// ===========================================================================
// classifyDocument — confidence / validity collapse
// ===========================================================================

const CATEGORIES: CategoryRow[] = [
  { id: 'cat-invoice', code: 'INV', name_hr: 'Računi', path: 'racuni', parent_id: null },
  { id: 'cat-contract', code: 'CON', name_hr: 'Ugovori', path: 'ugovori', parent_id: null },
]
const DOC: DocumentInput = { fileName: 't.pdf', mimeType: 'application/pdf', base64: 'x' }

function classifyResp(input: Record<string, unknown>): ScriptedTool {
  return { name: 'classify_document', input }
}

Deno.test('classifyDocument: valid category above threshold is kept', async () => {
  const fake = fakeAnthropic([
    classifyResp({
      category_id: 'cat-invoice',
      confidence: 0.9,
      description: 'Račun',
      entity_hints: [],
    }),
  ])
  const r = await classifyDocument(fake, MODEL, DOC, EMAIL, CATEGORIES, [])
  assertEquals(r.categoryId, 'cat-invoice')
  assertEquals(r.confidence, 0.9)
  assertEquals(r.description, 'Račun')
})

Deno.test('classifyDocument: confidence below threshold collapses to null', async () => {
  const fake = fakeAnthropic([
    classifyResp({
      category_id: 'cat-invoice',
      confidence: 0.3,
      description: 'Možda račun',
      entity_hints: [],
    }),
  ])
  const r = await classifyDocument(fake, MODEL, DOC, EMAIL, CATEGORIES, [])
  assertEquals(r.categoryId, null)
  // description is preserved even when uncategorized.
  assertEquals(r.description, 'Možda račun')
})

Deno.test('classifyDocument: unknown category id collapses to null even if confident', async () => {
  const fake = fakeAnthropic([
    classifyResp({
      category_id: 'cat-ghost',
      confidence: 0.99,
      description: 'x',
      entity_hints: [],
    }),
  ])
  const r = await classifyDocument(fake, MODEL, DOC, EMAIL, CATEGORIES, [])
  assertEquals(r.categoryId, null)
})

Deno.test('classifyDocument: non-numeric confidence defaults to 0 and uncategorizes', async () => {
  const fake = fakeAnthropic([
    classifyResp({
      category_id: 'cat-invoice',
      confidence: 'high',
      description: 'x',
      entity_hints: [],
    }),
  ])
  const r = await classifyDocument(fake, MODEL, DOC, EMAIL, CATEGORIES, [])
  assertEquals(r.categoryId, null)
  assertEquals(r.confidence, 0)
})

Deno.test('classifyDocument: associations are kept even when uncategorized', async () => {
  const candidates = [cand('project', 'p1', 'Pannonia', 'Pannonia')]
  const fake = fakeAnthropic([
    classifyResp({
      category_id: null,
      confidence: 0.2,
      description: 'Nejasno',
      entity_hints: [{ entity_type: 'project', search_terms: ['Pannonia'] }],
    }),
  ])
  const r = await classifyDocument(fake, MODEL, DOC, EMAIL, CATEGORIES, candidates)
  assertEquals(r.categoryId, null)
  assertEquals(r.associations, [{ entity_type: 'project', entity_id: 'p1' }])
})

// ===========================================================================
// classifyDocument — Pass-1 content block shapes
// ===========================================================================

// The user content of the Pass-1 (classify_document) request.
function pass1Content(fake: { calls: Array<Record<string, unknown>> }): Array<Record<string, unknown>> {
  const messages = fake.calls[0].messages as Array<{ content: Array<Record<string, unknown>> }>
  return messages[0].content
}

const NOOP_CLASSIFY = classifyResp({
  category_id: null,
  confidence: 0,
  description: 'x',
  entity_hints: [],
})

Deno.test('classifyDocument: PDF input is sent as a base64 document block', async () => {
  const fake = fakeAnthropic([NOOP_CLASSIFY])
  await classifyDocument(fake, MODEL, DOC, EMAIL, CATEGORIES, [])
  const content = pass1Content(fake)
  assertEquals(content.length, 2)
  assertEquals(content[0], {
    type: 'document',
    source: { type: 'base64', media_type: 'application/pdf', data: 'x' },
  })
  assertEquals(content[1].type, 'text')
})

Deno.test('classifyDocument: image input is sent as an image block', async () => {
  const doc: DocumentInput = { fileName: 's.png', mimeType: 'image/png', base64: 'img' }
  const fake = fakeAnthropic([NOOP_CLASSIFY])
  await classifyDocument(fake, MODEL, doc, EMAIL, CATEGORIES, [])
  assertEquals(pass1Content(fake)[0], {
    type: 'image',
    source: { type: 'base64', media_type: 'image/png', data: 'img' },
  })
})

Deno.test('classifyDocument: extracted text is sent as a plain-text document block', async () => {
  const doc: DocumentInput = {
    fileName: 'racun.xml',
    mimeType: 'application/xml',
    text: '<Invoice><ID>2026-17</ID></Invoice>',
  }
  const fake = fakeAnthropic([NOOP_CLASSIFY])
  await classifyDocument(fake, MODEL, doc, EMAIL, CATEGORIES, [])
  const content = pass1Content(fake)
  assertEquals(content[0], {
    type: 'document',
    source: { type: 'text', media_type: 'text/plain', data: '<Invoice><ID>2026-17</ID></Invoice>' },
    title: 'racun.xml',
  })
})

Deno.test('classifyDocument: no content (legacy .doc) sends a single text block with the metadata-only note', async () => {
  const doc: DocumentInput = { fileName: 'stari.doc', mimeType: 'application/msword' }
  const fake = fakeAnthropic([NOOP_CLASSIFY])
  await classifyDocument(fake, MODEL, doc, EMAIL, CATEGORIES, [])
  const content = pass1Content(fake)
  assertEquals(content.length, 1)
  assertEquals(content[0].type, 'text')
  assert((content[0].text as string).includes('Sadržaj dokumenta nije dostupan'))
  assert((content[0].text as string).includes('stari.doc'))
})

// ===========================================================================
// classifyDocument — forced project-pick fallback
// ===========================================================================

const PROJECT_POOL = [
  cand('project', 'p1', 'Zona 31', ['Zona 31', 'Vukovarska']),
  cand('project', 'p2', 'Naselje Dunav', ['Naselje Dunav', 'Vukovar']),
  cand('subcontractor', 's1', 'Kopko d.o.o.', 'Kopko d.o.o.'),
]

Deno.test('classifyDocument: unmatched project hint triggers fallback pick over full project pool', async () => {
  const fake = fakeAnthropic([
    classifyResp({
      category_id: 'cat-contract',
      confidence: 0.9,
      description: 'Ugovor',
      // "Osijek" matches no candidate (no alias configured yet).
      entity_hints: [{ entity_type: 'project', search_terms: ['Osijek'] }],
    }),
    { name: 'pick_entity', input: { entity_id: 'p1' } },
  ])
  const r = await classifyDocument(fake, MODEL, DOC, EMAIL, CATEGORIES, PROJECT_POOL)
  assertEquals(r.associations, [{ entity_type: 'project', entity_id: 'p1' }])
  assertEquals(fake.calls.length, 2)
  // The pick prompt carries the document's own terms and the FULL project pool.
  const prompt = (fake.calls[1].messages as Array<{ content: string }>)[0].content
  assert(prompt.includes('Osijek'))
  assert(prompt.includes('Zona 31'))
  assert(prompt.includes('Naselje Dunav'))
  assertEquals(prompt.includes('Kopko'), false) // non-projects excluded
})

Deno.test('classifyDocument: fallback null / hallucinated id leaves project unset', async () => {
  const fake = fakeAnthropic([
    classifyResp({ category_id: null, confidence: 0.1, description: 'x', entity_hints: [] }),
    { name: 'pick_entity', input: { entity_id: 'ghost' } },
  ])
  const r = await classifyDocument(fake, MODEL, DOC, EMAIL, CATEGORIES, PROJECT_POOL)
  assertEquals(r.associations, [])
})

Deno.test('classifyDocument: resolved project skips the fallback call', async () => {
  const fake = fakeAnthropic([
    classifyResp({
      category_id: null,
      confidence: 0.2,
      description: 'x',
      entity_hints: [{ entity_type: 'project', search_terms: ['Zona 31'] }],
    }),
    // nothing else queued — a fallback call would throw
  ])
  const r = await classifyDocument(fake, MODEL, DOC, EMAIL, CATEGORIES, PROJECT_POOL)
  assertEquals(r.associations, [{ entity_type: 'project', entity_id: 'p1' }])
  assertEquals(fake.calls.length, 1)
})

Deno.test('classifyDocument: fallback without project hints uses subject and filename', async () => {
  const fake = fakeAnthropic([
    classifyResp({ category_id: null, confidence: 0.5, description: 'x', entity_hints: [] }),
    { name: 'pick_entity', input: { entity_id: 'p2' } },
  ])
  const email: EmailContext = { subject: 'Ugovor Vukovar', body: '', from: 'a@b.hr' }
  const r = await classifyDocument(fake, MODEL, DOC, email, CATEGORIES, PROJECT_POOL)
  assertEquals(r.associations, [{ entity_type: 'project', entity_id: 'p2' }])
  const prompt = (fake.calls[1].messages as Array<{ content: string }>)[0].content
  assert(prompt.includes('Ugovor Vukovar'))
  assert(prompt.includes(DOC.fileName))
})

Deno.test('classifyDocument: empty project pool skips the fallback call', async () => {
  const fake = fakeAnthropic([
    classifyResp({ category_id: null, confidence: 0.5, description: 'x', entity_hints: [] }),
    // nothing else queued — a fallback call would throw
  ])
  const r = await classifyDocument(fake, MODEL, DOC, EMAIL, CATEGORIES, [])
  assertEquals(r.associations, [])
  assertEquals(fake.calls.length, 1)
})
