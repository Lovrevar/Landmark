// Lexical scoring for the help knowledge base.
//
// This replaced OpenAI embeddings. Anthropic — the only model provider this project uses — has no
// embeddings endpoint, so keeping semantic search would have meant a second vendor for one
// feature, plus a build step that silently rotted whenever someone edited a markdown file without
// re-running it. That build step had in fact been stale since May.
//
// What makes lexical retrieval workable here rather than a downgrade in practice:
//   * the corpus is 66 short articles, not a document warehouse;
//   * every entry carries hand-written `keywords` frontmatter listing the phrasings users
//     actually type, including inflected ones ("budžet nije postavljen", "ne mogu upisati
//     budžet");
//   * the query is written by Claude, from the user's question, in the same domain vocabulary the
//     articles use — it is not a raw user string.
//
// Scoring is BM25-flavoured: IDF-weighted term overlap over three fields with different weights,
// plus a bonus when the query appears verbatim. Pure and dependency-free so it can be tested
// without network or database.

/** Lowercase, fold Croatian diacritics, collapse whitespace. Mirrors sort-document/classifier.ts. */
export function normalizeHr(input: string): string {
  return input
    .toLowerCase()
    .replace(/đ/g, 'd')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

// Croatian function words plus the English ones that leak in through UI labels. These carry no
// retrieval signal and would otherwise dominate the overlap on short queries.
const STOPWORDS = new Set([
  'a', 'ako', 'ali', 'bez', 'bi', 'bih', 'bilo', 'biti', 'ce', 'cemo', 'ces', 'da', 'do', 'i',
  'iz', 'ili', 'ima', 'imam', 'je', 'jer', 'jos', 'kad', 'kada', 'kako', 'kao', 'koje', 'koji',
  'koju', 'li', 'me', 'mi', 'mogu', 'na', 'nas', 'ne', 'nego', 'neka', 'nema', 'ni', 'nije',
  'o', 'od', 'oko', 'on', 'ona', 'ono', 'pa', 'po', 'pod', 'pri', 'sa', 'se', 'si', 'smo', 'st',
  'su', 'sto', 'ta', 'taj', 'te', 'ti', 'to', 'tu', 'u', 'uz', 'va', 'vam', 'vas', 've', 'vi',
  'za', 'sam', 'sto',
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'by', 'can', 'for', 'from', 'how', 'in', 'is', 'it',
  'of', 'on', 'or', 'that', 'the', 'to', 'what', 'when', 'where', 'why', 'with',
])

const MIN_TOKEN_LENGTH = 3
/**
 * Croatian inflects by suffix, so a prefix is a serviceable stem: budžet / budžeta / budžetu /
 * budžetom all share the first six characters. Six is the shortest length that keeps distinct
 * domain words apart — five would merge "faza" with "fazon" and, worse, "klasifikacija" with
 * nothing useful. Words shorter than this are already their own stem.
 */
const STEM_LENGTH = 6

export function tokenize(text: string): string[] {
  return normalizeHr(text)
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length >= MIN_TOKEN_LENGTH && !STOPWORDS.has(t))
    .map((t) => t.slice(0, STEM_LENGTH))
}

export interface ScorableEntry {
  id: string
  title: string
  keywords: string[]
  body: string
}

interface IndexedEntry {
  id: string
  /** Stem -> occurrences, per field. */
  title: Map<string, number>
  keywords: Map<string, number>
  body: Map<string, number>
  bodyLength: number
  /** Normalized haystack for the verbatim-phrase bonus. */
  haystack: string
}

export interface ScoringIndex {
  entries: IndexedEntry[]
  /** Stem -> number of entries containing it, for IDF. */
  documentFrequency: Map<string, number>
  averageBodyLength: number
}

function countTokens(text: string): Map<string, number> {
  const counts = new Map<string, number>()
  for (const token of tokenize(text)) counts.set(token, (counts.get(token) ?? 0) + 1)
  return counts
}

/** Build the scoring index once at module load; it never changes at runtime. */
export function buildIndex(entries: ScorableEntry[]): ScoringIndex {
  const indexed: IndexedEntry[] = entries.map((e) => ({
    id: e.id,
    title: countTokens(e.title),
    keywords: countTokens(e.keywords.join(' ')),
    body: countTokens(e.body),
    bodyLength: tokenize(e.body).length,
    haystack: normalizeHr(`${e.title} ${e.keywords.join(' ')} ${e.body}`),
  }))

  const documentFrequency = new Map<string, number>()
  for (const entry of indexed) {
    const seen = new Set([...entry.title.keys(), ...entry.keywords.keys(), ...entry.body.keys()])
    for (const stem of seen) documentFrequency.set(stem, (documentFrequency.get(stem) ?? 0) + 1)
  }

  const totalLength = indexed.reduce((sum, e) => sum + e.bodyLength, 0)
  return {
    entries: indexed,
    documentFrequency,
    averageBodyLength: indexed.length > 0 ? totalLength / indexed.length : 0,
  }
}

// A hit in the title or the hand-written keywords says far more about relevance than one in the
// body, where a term can appear in passing.
const FIELD_WEIGHTS = { title: 3, keywords: 3, body: 1 }
// BM25 saturation and length normalisation, at their conventional defaults.
const K1 = 1.2
const B = 0.75
/** Share of the remaining headroom awarded when the whole normalized query appears verbatim. */
const PHRASE_BONUS = 0.35

function idf(stem: string, index: ScoringIndex): number {
  const df = index.documentFrequency.get(stem) ?? 0
  const n = index.entries.length
  // Standard BM25 IDF, floored at zero so a stem present in every entry cannot score negatively.
  return Math.max(0, Math.log(1 + (n - df + 0.5) / (df + 0.5)))
}

/**
 * Relevance of one entry to one query, normalized to roughly 0..1 so a single threshold can be
 * applied the way the cosine threshold was.
 */
export function scoreEntry(query: string, entryId: string, index: ScoringIndex): number {
  const entry = index.entries.find((e) => e.id === entryId)
  if (!entry) return 0
  return scoreIndexed(query, entry, index)
}

function scoreIndexed(query: string, entry: IndexedEntry, index: ScoringIndex): number {
  const queryTokens = tokenize(query)
  if (queryTokens.length === 0) return 0

  let score = 0
  let maxPossible = 0

  for (const stem of new Set(queryTokens)) {
    const weight = idf(stem, index)
    maxPossible += weight

    const inTitle = entry.title.get(stem) ?? 0
    const inKeywords = entry.keywords.get(stem) ?? 0
    const inBody = entry.body.get(stem) ?? 0
    if (inTitle === 0 && inKeywords === 0 && inBody === 0) continue

    // Field frequencies are combined before saturation so a term in two fields beats one in a
    // single field, without letting a term repeated 40 times in a long body run away with it.
    const tf =
      inTitle * FIELD_WEIGHTS.title +
      inKeywords * FIELD_WEIGHTS.keywords +
      inBody * FIELD_WEIGHTS.body
    const lengthNorm =
      index.averageBodyLength > 0
        ? 1 - B + B * (entry.bodyLength / index.averageBodyLength)
        : 1
    // Saturation deliberately omits BM25's (k1+1) numerator so it stays within (0,1). That keeps
    // the final figure an IDF-weighted *fraction of the query that matched*, which is what makes a
    // single fixed threshold meaningful. With the textbook numerator a query matching one term of
    // four could score 0.55, and unrelated questions sailed past the floor.
    score += weight * (tf / (tf + K1 * lengthNorm))
  }

  const normalized = maxPossible > 0 ? score / maxPossible : 0
  // Applied as a fraction of the headroom rather than a flat addition: clamping `normalized +
  // 0.35` at 1 collapsed every strong match to exactly 1.0, which threw away the ranking between
  // them just when it mattered most.
  return entry.haystack.includes(normalizeHr(query))
    ? normalized + (1 - normalized) * PHRASE_BONUS
    : normalized
}

export interface RankedEntry {
  id: string
  score: number
}

/** Every entry scored against the query, best first. Re-ranking is the caller's job. */
export function rankEntries(query: string, index: ScoringIndex): RankedEntry[] {
  return index.entries
    .map((entry) => ({ id: entry.id, score: scoreIndexed(query, entry, index) }))
    .sort((a, b) => b.score - a.score)
}
