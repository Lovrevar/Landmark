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
      // deno-lint-ignore no-explicit-any
      create: (params: any) => {
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

// Build a candidate the way loadEntityCandidates does: haystack = normalize(raw).
function cand(
  entity_type: EntityType,
  id: string,
  label: string,
  ...raw: string[]
): EntityCandidate {
  return { id, entity_type, label, haystack: normalize(raw.filter(Boolean).join(' ')) }
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
