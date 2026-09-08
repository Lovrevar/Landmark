// Retrieval quality tests for the lexical help search.
//
// These run against the REAL help-kb index artifact rather than fixtures. That is deliberate: the
// question this change has to answer is not "does BM25 arithmetic work" but "does asking a
// realistic Croatian question surface the right article out of the actual 66". A fixture corpus
// would answer neither.
//
// Run: `deno test _shared/help-score.test.ts` from supabase/functions/.

import { assert, assertEquals } from 'jsr:@std/assert@1'
import indexArtifact from './help-kb-index.json' with { type: 'json' }
import { buildIndex, normalizeHr, rankEntries, tokenize, type ScorableEntry } from './help-score.ts'

const ARTIFACT = indexArtifact as { entries: ScorableEntry[] }
const INDEX = buildIndex(ARTIFACT.entries)

/** Mirrors SCORE_THRESHOLD in help-search.ts; a hit below it is never returned. */
const SCORE_THRESHOLD = 0.12

function topIds(query: string, n = 5): string[] {
  return rankEntries(query, INDEX)
    .filter((r) => r.score >= SCORE_THRESHOLD)
    .slice(0, n)
    .map((r) => r.id)
}

Deno.test('normalizeHr folds Croatian diacritics', () => {
  assertEquals(normalizeHr('Budžet Nije Postavljen'), 'budzet nije postavljen')
  assertEquals(normalizeHr('Nepredviđeni troškovi'), 'nepredvideni troskovi')
  assertEquals(normalizeHr('  Faza   1  '), 'faza 1')
})

Deno.test('tokenize drops stopwords and short tokens, and stems by prefix', () => {
  // "ne" and "mogu" are stopwords; "upisati" and "budzet" survive.
  assertEquals(tokenize('ne mogu upisati budžet'), ['upisat', 'budzet'])
  // Croatian inflects by suffix, so declined forms collapse onto one stem.
  assertEquals(tokenize('budžeta budžetu budžetom'), ['budzet', 'budzet', 'budzet'])
  assertEquals(tokenize('klasifikacija klasifikacije'), ['klasif', 'klasif'])
})

Deno.test('the corpus is indexed', () => {
  assert(INDEX.entries.length >= 60, `expected the real corpus, got ${INDEX.entries.length}`)
  assert(INDEX.averageBodyLength > 0)
})

// --- retrieval: each query must surface the article a person asking it needs ----------------

const EXPECTATIONS: Array<{ query: string; expect: string; label: string }> = [
  { query: 'zašto ne mogu upisati budžet projekta', expect: 'term-budzet-iz-tic', label: 'the read-only budget question' },
  { query: 'budžet nije postavljen', expect: 'term-budzet-iz-tic', label: 'the literal empty-budget message' },
  { query: 'što je TIC', expect: 'term-tic', label: 'the acronym' },
  { query: 'kako uvesti TIC iz Excela', expect: 'tic', label: 'the TIC page itself' },
  { query: 'razlika između faze i prekretnice', expect: 'term-faza-vs-prekretnica', label: 'phase vs milestone' },
  { query: 'klasifikacija troška na ugovoru', expect: 'term-faza-vs-prekretnica', label: 'cost classification' },
  { query: 'upravljanje gradilištem faze podugovaratelji', expect: 'site-management', label: 'site management' },
  { query: 'CPI SPI kontrola proračuna', expect: 'budget-control', label: 'EVM' },
  { query: 'cesija', expect: 'term-cesija', label: 'a domain term' },
  { query: 'kompenzacija', expect: 'term-kompenzacija', label: 'another domain term' },
  { query: 'radni dnevnik', expect: 'work-logs', label: 'work logs' },
  { query: 'kako promijeniti jezik sučelja', expect: 'language-and-theme', label: 'language switch' },
]

for (const { query, expect, label } of EXPECTATIONS) {
  Deno.test(`retrieval: ${label} — "${query}"`, () => {
    const ids = topIds(query)
    assert(
      ids.includes(expect),
      `expected "${expect}" in the top 5 for "${query}", got [${ids.join(', ')}]`,
    )
  })
}

Deno.test('the best hit for a direct question is ranked first', () => {
  assertEquals(topIds('budžet nije postavljen', 1), ['term-budzet-iz-tic'])
  assertEquals(topIds('što znači kratica TIC', 1), ['term-tic'])
})

Deno.test('an unrelated question returns nothing rather than the least-bad article', () => {
  // The threshold has to actually refuse; a lexical scorer that always returns its top 5 would
  // feed the model irrelevant context and invite a confidently wrong answer.
  assertEquals(topIds('kakvo je vrijeme u Zagrebu sutra'), [])
  assertEquals(topIds('recept za sarmu'), [])
})

Deno.test('an empty or stopword-only query scores nothing', () => {
  assertEquals(topIds(''), [])
  assertEquals(topIds('i na za'), [])
})
