// Classification engine for the sort-document edge function.
//
// Two passes keep token cost flat regardless of how many projects / suppliers /
// contracts exist in the database:
//
//   Pass 1 — one Claude call. Claude sees the document (base64 PDF/image), the
//            email subject + body, and the FULL category tree (small, bounded).
//            It returns, via a forced tool call, a strict JSON classification:
//            { category_id, confidence, description, entity_hints[] }.
//            entity_hints are free-text names Claude read in the document — NOT
//            database ids.
//
//   Pass 2 — entity resolution, done IN CODE. Each hint's search terms are
//            fuzzy-matched against the relevant entity table. Only when a hint
//            is ambiguous (several candidates) do we make a narrow second Claude
//            call passing just those few rows. The big tables never reach the
//            model.

import Anthropic from 'npm:@anthropic-ai/sdk@0.97.0'
import type { SupabaseClient } from 'npm:@supabase/supabase-js@2'
import type { Database } from '../_shared/database.ts'

type ServiceClient = SupabaseClient<Database>

// document_associations.entity_type CHECK values.
export const ENTITY_TYPES = [
  'project',
  'phase',
  'subcontractor',
  'contract',
  'unit',
  'customer',
  'credit',
  'company',
] as const
export type EntityType = (typeof ENTITY_TYPES)[number]

// Below this, the document is filed uncategorized (category_id = null).
export const CONFIDENCE_THRESHOLD = 0.6

const CLASSIFY_TOOL_NAME = 'classify_document'
const PICK_TOOL_NAME = 'pick_entity'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CategoryRow {
  id: string
  code: string
  name_hr: string
  path: string
  parent_id: string | null
}

// One candidate row from an entity table, flattened for matching.
export interface EntityCandidate {
  id: string
  entity_type: EntityType
  label: string // human-readable, shown to Claude during disambiguation
  haystack: string // normalized searchable text
}

export interface EntityHint {
  entity_type: EntityType
  search_terms: string[]
}

export interface ClassificationResult {
  categoryId: string | null
  confidence: number
  description: string
  associations: { entity_type: EntityType; entity_id: string }[]
}

export interface DocumentInput {
  fileName: string
  mimeType: string
  base64: string // file bytes, base64-encoded
}

export interface EmailContext {
  subject: string
  body: string
  from: string
}

// ---------------------------------------------------------------------------
// Text normalization (Croatian-aware)
// ---------------------------------------------------------------------------

// Lowercase, strip diacritics (š č ć ž decompose via NFD; đ handled manually),
// collapse whitespace. Used on both sides of every match comparison.
export function normalize(input: string): string {
  return input
    .toLowerCase()
    .replace(/đ/g, 'd')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

// ---------------------------------------------------------------------------
// Entity loading
// ---------------------------------------------------------------------------

// Fetches every entity a document can be linked to and flattens them into a
// single candidate list. Matching happens in code, so loading all rows here
// costs database time but zero model tokens.
export async function loadEntityCandidates(
  client: ServiceClient,
): Promise<EntityCandidate[]> {
  const out: EntityCandidate[] = []
  const push = (entity_type: EntityType, id: string, label: string, ...keys: (string | null)[]) => {
    const haystack = normalize(keys.filter(Boolean).join(' '))
    if (haystack) out.push({ id, entity_type, label, haystack })
  }

  const [
    projects,
    phases,
    subcontractors,
    companies,
    contracts,
    customers,
    credits,
    apartments,
    garages,
    repositories,
  ] = await Promise.all([
    client.from('projects').select('id, name, location').limit(10000),
    client.from('project_phases').select('id, phase_name, phase_number').limit(10000),
    client.from('subcontractors').select('id, name').limit(10000),
    client.from('accounting_companies').select('id, name, oib').limit(10000),
    client.from('contracts').select('id, contract_number, job_description').limit(10000),
    client.from('customers').select('id, name, surname').limit(10000),
    client.from('bank_credits').select('id, credit_name').limit(10000),
    client.from('apartments').select('id, number').limit(10000),
    client.from('garages').select('id, number').limit(10000),
    client.from('repositories').select('id, number').limit(10000),
  ])

  for (const p of projects.data ?? []) {
    push('project', p.id, p.name ?? '(bez naziva)', p.name, p.location)
  }
  for (const ph of phases.data ?? []) {
    push('phase', ph.id, ph.phase_name ?? `Faza ${ph.phase_number}`, ph.phase_name)
  }
  for (const s of subcontractors.data ?? []) {
    push('subcontractor', s.id, s.name ?? '(bez naziva)', s.name)
  }
  for (const c of companies.data ?? []) {
    push('company', c.id, c.name ?? '(bez naziva)', c.name, c.oib)
  }
  for (const c of contracts.data ?? []) {
    const label = c.contract_number ?? c.job_description ?? '(bez broja)'
    push('contract', c.id, label, c.contract_number, c.job_description)
  }
  for (const c of customers.data ?? []) {
    const label = [c.name, c.surname].filter(Boolean).join(' ') || '(bez imena)'
    push('customer', c.id, label, c.name, c.surname)
  }
  for (const c of credits.data ?? []) {
    push('credit', c.id, c.credit_name ?? '(bez naziva)', c.credit_name)
  }
  for (const a of apartments.data ?? []) {
    push('unit', a.id, `Stan ${a.number}`, a.number)
  }
  for (const g of garages.data ?? []) {
    push('unit', g.id, `Garaža ${g.number}`, g.number)
  }
  for (const r of repositories.data ?? []) {
    push('unit', r.id, `Spremište ${r.number}`, r.number)
  }

  return out
}

// ---------------------------------------------------------------------------
// Category tree rendering
// ---------------------------------------------------------------------------

// Renders the active categories as an indented tree so Claude understands the
// hierarchy. Each line is "<indent>- <name_hr> [id: <uuid>]".
function renderCategoryTree(categories: CategoryRow[]): string {
  const childrenOf = new Map<string | null, CategoryRow[]>()
  for (const c of categories) {
    const list = childrenOf.get(c.parent_id) ?? []
    list.push(c)
    childrenOf.set(c.parent_id, list)
  }

  const lines: string[] = []
  const walk = (parentId: string | null, depth: number) => {
    for (const c of childrenOf.get(parentId) ?? []) {
      lines.push(`${'  '.repeat(depth)}- ${c.name_hr} [id: ${c.id}]`)
      walk(c.id, depth + 1)
    }
  }
  walk(null, 0)
  return lines.join('\n')
}

// ---------------------------------------------------------------------------
// Claude — Pass 1: classification
// ---------------------------------------------------------------------------

const SYSTEM_PROMPT =
  'Ti si sustav za klasifikaciju dokumenata u platformi za upravljanje ' +
  'nekretninskim i građevinskim projektima. Dobivaš jedan dokument ' +
  '(PDF ili slika) te predmet i tekst e-pošte kojom je dokument poslan. ' +
  'Tvoj zadatak je:\n' +
  '1. Svrstati dokument u TOČNO JEDNU kategoriju iz priloženog stabla ' +
  'kategorija. Ako nisi siguran, postavi category_id na null.\n' +
  '2. Prepoznati na koje se konkretne entitete dokument odnosi ' +
  '(projekti, podizvođači, ugovori, tvrtke, kupci, krediti, jedinice) i ' +
  'navesti ih kao entity_hints — koristi nazive/brojeve točno onako kako ' +
  'su napisani u dokumentu.\n' +
  '3. Uvijek popuniti polje description: kratak opis (na hrvatskom) što je ' +
  'dokument i zašto je tako klasificiran. Ako je sigurnost niska, u ' +
  'description objasni svoju najbolju pretpostavku.\n' +
  'confidence je broj 0-1 koji izražava koliko si siguran u kategoriju.'

const CLASSIFY_TOOL = {
  name: CLASSIFY_TOOL_NAME,
  description:
    'Vrati strukturiranu klasifikaciju dokumenta. Mora se pozvati točno jednom.',
  input_schema: {
    type: 'object',
    properties: {
      category_id: {
        type: ['string', 'null'],
        description:
          'UUID kategorije iz stabla, ili null ako nijedna ne odgovara pouzdano.',
      },
      confidence: {
        type: 'number',
        description: 'Pouzdanost klasifikacije kategorije, 0-1.',
      },
      description: {
        type: 'string',
        description: 'Kratak opis dokumenta i obrazloženje klasifikacije (hrvatski).',
      },
      entity_hints: {
        type: 'array',
        description: 'Entiteti spomenuti u dokumentu, kao slobodni tekst.',
        items: {
          type: 'object',
          properties: {
            entity_type: { type: 'string', enum: [...ENTITY_TYPES] },
            search_terms: {
              type: 'array',
              items: { type: 'string' },
              description:
                'Nazivi/brojevi entiteta točno kako se pojavljuju u dokumentu.',
            },
          },
          required: ['entity_type', 'search_terms'],
        },
      },
    },
    required: ['category_id', 'confidence', 'description', 'entity_hints'],
  },
} as const

interface ClassifyToolOutput {
  category_id: string | null
  confidence: number
  description: string
  entity_hints: EntityHint[]
}

// Builds the document content block in the shape the Anthropic API expects.
// PDFs go in a `document` block, images in an `image` block.
function buildDocumentBlock(doc: DocumentInput): Record<string, unknown> {
  if (doc.mimeType === 'application/pdf') {
    return {
      type: 'document',
      source: { type: 'base64', media_type: 'application/pdf', data: doc.base64 },
    }
  }
  return {
    type: 'image',
    source: { type: 'base64', media_type: doc.mimeType, data: doc.base64 },
  }
}

async function runClassification(
  anthropic: Anthropic,
  model: string,
  doc: DocumentInput,
  email: EmailContext,
  categories: CategoryRow[],
): Promise<ClassifyToolOutput> {
  const contextText =
    `Stablo kategorija:\n${renderCategoryTree(categories)}\n\n` +
    `E-pošta — pošiljatelj: ${email.from}\n` +
    `E-pošta — predmet: ${email.subject}\n` +
    `E-pošta — tekst:\n${email.body}\n\n` +
    `Naziv datoteke: ${doc.fileName}\n\n` +
    'Klasificiraj priloženi dokument pozivom alata classify_document.'

  const response = await anthropic.messages.create({
    model,
    max_tokens: 2048,
    // Static system prompt — cached across invocations.
    system: [
      { type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } },
    ],
    // Tool schema is static too — extend the cached prefix.
    tools: [{ ...CLASSIFY_TOOL, cache_control: { type: 'ephemeral' } }],
    tool_choice: { type: 'tool', name: CLASSIFY_TOOL_NAME },
    messages: [
      {
        role: 'user',
        content: [buildDocumentBlock(doc), { type: 'text', text: contextText }],
      },
    ],
  } as unknown as Parameters<typeof anthropic.messages.create>[0]) as Anthropic.Message

  const toolBlock = response.content.find(
    (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use' && b.name === CLASSIFY_TOOL_NAME,
  )
  if (!toolBlock) {
    throw new Error('classification_no_tool_call')
  }
  return toolBlock.input as ClassifyToolOutput
}

// ---------------------------------------------------------------------------
// Claude — disambiguation: pick one entity from a small candidate set
// ---------------------------------------------------------------------------

const PICK_TOOL = {
  name: PICK_TOOL_NAME,
  description: 'Odaberi entitet koji najbolje odgovara, ili null ako nijedan.',
  input_schema: {
    type: 'object',
    properties: {
      entity_id: {
        type: ['string', 'null'],
        description: 'UUID odabranog entiteta, ili null ako nijedan ne odgovara.',
      },
    },
    required: ['entity_id'],
  },
} as const

async function disambiguate(
  anthropic: Anthropic,
  model: string,
  email: EmailContext,
  searchTerms: string[],
  candidates: EntityCandidate[],
): Promise<string | null> {
  const list = candidates.map(c => `- ${c.label} [id: ${c.id}]`).join('\n')
  const prompt =
    `Dokument spominje: ${searchTerms.join(', ')}\n` +
    `Predmet e-pošte: ${email.subject}\n\n` +
    `Kandidati:\n${list}\n\n` +
    'Odaberi entitet koji najbolje odgovara pozivom alata pick_entity.'

  const response = await anthropic.messages.create({
    model,
    max_tokens: 256,
    tools: [PICK_TOOL],
    tool_choice: { type: 'tool', name: PICK_TOOL_NAME },
    messages: [{ role: 'user', content: prompt }],
  } as unknown as Parameters<typeof anthropic.messages.create>[0]) as Anthropic.Message

  const toolBlock = response.content.find(
    (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use' && b.name === PICK_TOOL_NAME,
  )
  const picked = (toolBlock?.input as { entity_id: string | null } | undefined)?.entity_id ?? null
  // Guard against a hallucinated id.
  return candidates.some(c => c.id === picked) ? picked : null
}

// ---------------------------------------------------------------------------
// Pass 2: resolve entity hints to ids
// ---------------------------------------------------------------------------

// A candidate matches a search term when either string contains the other
// (normalized). Terms shorter than 3 chars are ignored — too noisy.
export function matchesTerm(candidate: EntityCandidate, normTerm: string): boolean {
  if (normTerm.length < 3) return false
  return candidate.haystack.includes(normTerm) || normTerm.includes(candidate.haystack)
}

export async function resolveHints(
  anthropic: Anthropic,
  model: string,
  email: EmailContext,
  hints: EntityHint[],
  candidates: EntityCandidate[],
): Promise<{ entity_type: EntityType; entity_id: string }[]> {
  const resolved = new Map<string, { entity_type: EntityType; entity_id: string }>()

  for (const hint of hints) {
    if (!ENTITY_TYPES.includes(hint.entity_type)) continue
    const pool = candidates.filter(c => c.entity_type === hint.entity_type)
    const normTerms = hint.search_terms.map(normalize).filter(t => t.length >= 3)
    if (normTerms.length === 0) continue

    const matched = pool.filter(c => normTerms.some(t => matchesTerm(c, t)))
    if (matched.length === 0) continue

    let chosenId: string | null
    if (matched.length === 1) {
      chosenId = matched[0].id
    } else {
      // Ambiguous — let Claude pick from just these few rows.
      chosenId = await disambiguate(anthropic, model, email, hint.search_terms, matched.slice(0, 10))
    }
    if (chosenId) {
      resolved.set(`${hint.entity_type}:${chosenId}`, {
        entity_type: hint.entity_type,
        entity_id: chosenId,
      })
    }
  }

  return [...resolved.values()]
}

// ---------------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------------

// Classifies a document end-to-end: Pass 1 (Claude) + Pass 2 (code + optional
// narrow Claude calls). Returns a ready-to-persist result. A low confidence or
// unknown category collapses categoryId to null (uncategorized inbox); entity
// associations are kept regardless.
export async function classifyDocument(
  anthropic: Anthropic,
  model: string,
  doc: DocumentInput,
  email: EmailContext,
  categories: CategoryRow[],
  candidates: EntityCandidate[],
): Promise<ClassificationResult> {
  const pass1 = await runClassification(anthropic, model, doc, email, categories)

  const validId = pass1.category_id !== null && categories.some(c => c.id === pass1.category_id)
  const confident = typeof pass1.confidence === 'number' && pass1.confidence >= CONFIDENCE_THRESHOLD
  const categoryId = validId && confident ? pass1.category_id : null

  const associations = await resolveHints(
    anthropic,
    model,
    email,
    Array.isArray(pass1.entity_hints) ? pass1.entity_hints : [],
    candidates,
  )

  return {
    categoryId,
    confidence: typeof pass1.confidence === 'number' ? pass1.confidence : 0,
    description: pass1.description ?? '',
    associations,
  }
}
