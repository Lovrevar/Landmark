// handleSearchHelp — retrieval-augmented help lookup over the help-kb/ corpus.
//
// Approach: hybrid (embedding + frontmatter re-ranking).
//   1. Load the build-time JSON artifact at ./help-kb-embeddings.json. The
//      artifact carries every entry's title, body, routes, roles, and the
//      OpenAI text-embedding-3-small vector for `title + keywords + body`.
//   2. At query time, embed the user's query via the same model.
//   3. Score each entry by cosine similarity.
//   4. Re-rank:
//        - +ROUTE_BOOST for entries whose `routes` list contains the user's
//          current route pattern (passed via ctx).
//        - −ROLE_DOWNRANK for entries whose `roles` list is non-empty and
//          excludes the caller's role. Soft signal only — the model may still
//          legitimately need to explain *why* a user can't see something.
//   5. Return the top-K above SIMILARITY_THRESHOLD, formatted as concatenated
//      markdown (`## title` + body). If nothing crosses the threshold, return
//      a short Croatian "no matches" string so the model can refuse cleanly.
//   6. Log the call to `ai_help_searches` (fire-and-forget, never blocks the
//      response). The DB row records the raw current_route the client sent.

import type { AuthContext } from './auth.ts'
import embeddingsArtifact from './help-kb-embeddings.json' with { type: 'json' }

export interface SearchHelpInput {
  query: string
}

interface KbEntry {
  id: string
  title: string
  routes: string[]
  roles: string[]
  body: string
  embedding: number[]
}

interface KbArtifact {
  model: string
  generated_at: string
  dim: number
  entries: KbEntry[]
}

const ARTIFACT = embeddingsArtifact as KbArtifact

const EMBEDDING_MODEL = 'text-embedding-3-small'
const TOP_K = 5
const SIMILARITY_THRESHOLD = 0.30
const ROUTE_BOOST = 0.05
const ROLE_DOWNRANK = 0.10
const MAX_QUERY_LENGTH = 500

function cosine(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0
  let dot = 0
  let na = 0
  let nb = 0
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i]
    na += a[i] * a[i]
    nb += b[i] * b[i]
  }
  if (na === 0 || nb === 0) return 0
  return dot / (Math.sqrt(na) * Math.sqrt(nb))
}

async function embedQuery(query: string): Promise<number[] | null> {
  const apiKey = Deno.env.get('OPENAI_API_KEY')
  if (!apiKey) {
    console.error('[search_help] OPENAI_API_KEY not set')
    return null
  }
  try {
    const res = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ model: EMBEDDING_MODEL, input: query }),
    })
    if (!res.ok) {
      const text = await res.text()
      console.error('[search_help] OpenAI embeddings call failed', {
        status: res.status,
        body: text.slice(0, 200),
      })
      return null
    }
    const json = await res.json() as { data: Array<{ embedding: number[] }> }
    return json.data[0]?.embedding ?? null
  } catch (err) {
    console.error('[search_help] embedding fetch threw', {
      reason: err instanceof Error ? err.message : String(err),
    })
    return null
  }
}

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

export async function handleSearchHelp(
  input: SearchHelpInput,
  ctx: AuthContext,
  helpCtx: HelpSearchContext,
): Promise<{ markdown: string; matches: number } | { error: string }> {
  const rawQuery = typeof input?.query === 'string' ? input.query.trim() : ''
  if (!rawQuery) {
    return { error: 'query is required and must be a non-empty string' }
  }
  const query = rawQuery.slice(0, MAX_QUERY_LENGTH)

  if (!ARTIFACT.entries || ARTIFACT.entries.length === 0) {
    console.warn('[search_help] artifact is empty — run `npm run kb:embed`')
    logSearch(ctx, helpCtx, query, [], null)
    return {
      markdown: 'Baza znanja trenutno nije dostupna.',
      matches: 0,
    }
  }

  const queryEmbedding = await embedQuery(query)
  if (!queryEmbedding) {
    logSearch(ctx, helpCtx, query, [], null)
    return { error: 'embedding service unavailable' }
  }

  // Score + re-rank.
  const scored = ARTIFACT.entries.map((entry) => {
    const base = cosine(queryEmbedding, entry.embedding)
    const routeBoost =
      helpCtx.currentRoutePattern && entry.routes.includes(helpCtx.currentRoutePattern)
        ? ROUTE_BOOST
        : 0
    const roleDownrank =
      entry.roles.length > 0 && !entry.roles.includes(ctx.role) ? ROLE_DOWNRANK : 0
    return {
      entry,
      baseScore: base,
      finalScore: base + routeBoost - roleDownrank,
    }
  })

  scored.sort((a, b) => b.finalScore - a.finalScore)
  const top = scored.slice(0, TOP_K).filter((s) => s.baseScore >= SIMILARITY_THRESHOLD)
  const topSimilarity = scored[0]?.baseScore ?? 0

  if (top.length === 0) {
    logSearch(ctx, helpCtx, query, [], topSimilarity)
    return {
      markdown:
        'Nema dovoljno relevantnih unosa u bazi znanja za ovaj upit. Razmislite ponavlja li korisnik pitanje drugim riječima.',
      matches: 0,
    }
  }

  const returnedIds = top.map((s) => s.entry.id)
  logSearch(ctx, helpCtx, query, returnedIds, topSimilarity)

  const markdown = top
    .map((s) => `## ${s.entry.title}\n\n${s.entry.body}`)
    .join('\n\n---\n\n')

  return { markdown, matches: top.length }
}
