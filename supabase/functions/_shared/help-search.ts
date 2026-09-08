// handleSearchHelp — retrieval-augmented help lookup over the help-kb/ corpus.
//
// Approach: lexical (BM25-flavoured) scoring + frontmatter re-ranking.
//   1. Load the build-time JSON artifact at ./help-kb-index.json. The artifact carries every
//      entry's title, keywords, routes, roles and body — no vectors, no API key, so it is a pure
//      file transform that cannot drift out of date without someone noticing.
//   2. Score each entry against the query with ./help-score.ts.
//   3. Re-rank:
//        - +ROUTE_BOOST for entries whose `routes` list contains the user's
//          current route pattern (passed via ctx).
//        - −ROLE_DOWNRANK for entries whose `roles` list is non-empty and
//          excludes the caller's role. Soft signal only — the model may still
//          legitimately need to explain *why* a user can't see something.
//   4. Return the top-K above SCORE_THRESHOLD, formatted as concatenated
//      markdown (`## title` + body). If nothing crosses the threshold, return
//      a short Croatian "no matches" string so the model can refuse cleanly.
//   5. Log the call to `ai_help_searches` (fire-and-forget, never blocks the
//      response). The DB row records the raw current_route the client sent.
//
// This used OpenAI text-embedding-3-small until September 2026. Anthropic has no embeddings
// endpoint, and adding a second model vendor for one feature was not worth it against a corpus of
// 66 short, keyword-tagged articles queried by Claude in the articles' own vocabulary. The
// `ai_help_searches.top_similarity` column now records a lexical score rather than a cosine one;
// the two are not comparable, so historical rows should be read with the cutover date in mind.

import type { AuthContext } from './auth.ts'
import indexArtifact from './help-kb-index.json' with { type: 'json' }
import { buildIndex, rankEntries, type ScorableEntry } from './help-score.ts'

export interface SearchHelpInput {
  query: string
}

interface KbEntry {
  id: string
  title: string
  keywords: string[]
  routes: string[]
  roles: string[]
  body: string
}

interface KbArtifact {
  generated_at: string
  entries: KbEntry[]
}

const ARTIFACT = indexArtifact as KbArtifact
const ENTRY_BY_ID = new Map(ARTIFACT.entries.map((e) => [e.id, e]))
// Built once per isolate: tokenising 66 articles costs a few milliseconds and is then reused for
// every query the isolate serves.
const INDEX = buildIndex(ARTIFACT.entries as ScorableEntry[])

const TOP_K = 5
/**
 * Tuned against the corpus rather than inherited: a lexical score is not a cosine, and the old
 * 0.30 cosine floor would have passed almost everything. At 0.12 a query sharing one distinctive
 * domain term with an entry survives, while an unrelated question returns nothing.
 */
const SCORE_THRESHOLD = 0.12
const ROUTE_BOOST = 0.05
const ROLE_DOWNRANK = 0.10
const MAX_QUERY_LENGTH = 500

/**
 * Pass-through context for the help search: the route pattern resolved by
 * routeLabels.describeRoute (used for boost) and the raw client-supplied path
 * (used in the telemetry row only). Both may be null.
 */
export interface HelpSearchContext {
  currentRoutePattern: string | null
  currentRouteRaw: string | null
}

function logSearch(
  ctx: AuthContext,
  helpCtx: HelpSearchContext,
  query: string,
  returnedIds: string[],
  topSimilarity: number | null,
): void {
  // Fire-and-forget; failures are logged but never propagated to the caller.
  void ctx.serviceClient
    .from('ai_help_searches')
    .insert({
      user_id: ctx.userId,
      current_route: helpCtx.currentRouteRaw,
      query,
      returned_ids: returnedIds,
      top_similarity: topSimilarity,
    })
    .then(({ error }) => {
      if (error) {
        console.error('[search_help] telemetry insert failed', {
          code: error.code,
          message: error.message,
        })
      }
    })
}

// Synchronous since retrieval stopped calling an embeddings API, but the return type stays a
// Promise: every tool handler in tools.ts is dispatched as one, and the caller awaits it.
export function handleSearchHelp(
  input: SearchHelpInput,
  ctx: AuthContext,
  helpCtx: HelpSearchContext,
): Promise<{ markdown: string; matches: number } | { error: string }> {
  const rawQuery = typeof input?.query === 'string' ? input.query.trim() : ''
  if (!rawQuery) {
    return Promise.resolve({ error: 'query is required and must be a non-empty string' })
  }
  const query = rawQuery.slice(0, MAX_QUERY_LENGTH)

  if (!ARTIFACT.entries || ARTIFACT.entries.length === 0) {
    console.warn('[search_help] artifact is empty — run `npm run kb:build`')
    logSearch(ctx, helpCtx, query, [], null)
    return Promise.resolve({
      markdown: 'Baza znanja trenutno nije dostupna.',
      matches: 0,
    })
  }

  // Score + re-rank.
  const scored = rankEntries(query, INDEX).map((ranked) => {
    const entry = ENTRY_BY_ID.get(ranked.id)!
    const routeBoost =
      helpCtx.currentRoutePattern && entry.routes.includes(helpCtx.currentRoutePattern)
        ? ROUTE_BOOST
        : 0
    const roleDownrank =
      entry.roles.length > 0 && !entry.roles.includes(ctx.role) ? ROLE_DOWNRANK : 0
    return {
      entry,
      baseScore: ranked.score,
      finalScore: ranked.score + routeBoost - roleDownrank,
    }
  })

  scored.sort((a, b) => b.finalScore - a.finalScore)
  const top = scored.slice(0, TOP_K).filter((s) => s.baseScore >= SCORE_THRESHOLD)
  const topSimilarity = scored[0]?.baseScore ?? 0

  if (top.length === 0) {
    logSearch(ctx, helpCtx, query, [], topSimilarity)
    return Promise.resolve({
      markdown:
        'Nema dovoljno relevantnih unosa u bazi znanja za ovaj upit. Razmislite ponavlja li korisnik pitanje drugim riječima.',
      matches: 0,
    })
  }

  const returnedIds = top.map((s) => s.entry.id)
  logSearch(ctx, helpCtx, query, returnedIds, topSimilarity)

  const markdown = top
    .map((s) => `## ${s.entry.title}\n\n${s.entry.body}`)
    .join('\n\n---\n\n')

  return Promise.resolve({ markdown, matches: top.length })
}
