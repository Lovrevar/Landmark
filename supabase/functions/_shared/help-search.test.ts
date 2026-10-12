// What search_help hands the model, and which articles it may link to on the Help page.
//
// Like help-score.test.ts this runs against the real index artifact: the link rules only matter
// for the articles that actually exist.
//
// Run: `deno test _shared/help-search.test.ts` from supabase/functions/.

import { assert, assertEquals } from 'jsr:@std/assert@1'
import type { AuthContext } from './auth.ts'
import indexArtifact from './help-kb-index.json' with { type: 'json' }
import { formatHelpEntry, handleSearchHelp, helpLinkFor } from './help-search.ts'

interface Entry {
  id: string
  title: string
  keywords: string[]
  routes: string[]
  roles: string[]
  assistant_only?: boolean
  body: string
}

const ENTRIES = (indexArtifact as { entries: Entry[] }).entries

/** Enough of an AuthContext for the handler: a role, and a telemetry insert that records its row. */
function contextFor(role: string, logged: unknown[] = []): AuthContext {
  const serviceClient = {
    from: () => ({
      insert: (row: unknown) => {
        logged.push(row)
        return Promise.resolve({ error: null })
      },
    }),
  }
  return { userId: 'user-1', role, serviceClient } as unknown as AuthContext
}

const NO_ROUTE = { currentRoutePattern: null, currentRouteRaw: null }

Deno.test('an article for everyone links to its Help page', () => {
  assertEquals(helpLinkFor({ id: 'term-cesija', roles: [], assistant_only: false }, 'Sales'), '/help/term-cesija')
})

Deno.test('an article written for other roles gets no link', () => {
  const entry = { id: 'cashflow-banks', roles: ['Director', 'Accounting'], assistant_only: false }
  assertEquals(helpLinkFor(entry, 'Accounting'), '/help/cashflow-banks')
  assertEquals(helpLinkFor(entry, 'Sales'), null)
})

Deno.test('an assistant-only article gets no link for any role', () => {
  assertEquals(helpLinkFor({ id: 'term-status-casing', roles: [], assistant_only: true }, 'Director'), null)
})

Deno.test('the index marks the assistant-only article', () => {
  const flagged = ENTRIES.filter((entry) => entry.assistant_only).map((entry) => entry.id)
  assertEquals(flagged, ['term-status-casing'])
})

Deno.test('a formatted entry carries title, link line and body, in that order', () => {
  const entry: Entry = { id: 'tic', title: 'TIC', keywords: [], routes: [], roles: [], body: 'Tekst.' }
  assertEquals(formatHelpEntry(entry, 'Director'), '## TIC\n\nČlanak u Pomoći: /help/tic\n\nTekst.')
  assertEquals(formatHelpEntry({ ...entry, assistant_only: true }, 'Director'), '## TIC\n\nTekst.')
})

Deno.test('search_help returns link lines only for articles the role can open', async () => {
  const logged: unknown[] = []
  const result = await handleSearchHelp({ query: 'što je cesija' }, contextFor('Director', logged), NO_ROUTE)
  assert('markdown' in result)
  assert(result.matches > 0)
  assert(result.markdown.includes('Članak u Pomoći: /help/term-cesija'), result.markdown.slice(0, 200))

  // Every link in the result is one helpLinkFor would give this role.
  const allowed = new Set(ENTRIES.map((entry) => helpLinkFor(entry, 'Director')).filter(Boolean))
  for (const match of result.markdown.matchAll(/^Članak u Pomoći: (\S+)$/gm)) {
    assert(allowed.has(match[1]), match[1])
  }
  assertEquals(logged.length, 1)
})

Deno.test('search_help says so when nothing matches', async () => {
  const result = await handleSearchHelp({ query: 'recept za sarmu' }, contextFor('Sales'), NO_ROUTE)
  assert('markdown' in result)
  assertEquals(result.matches, 0)
  assert(!result.markdown.includes('/help/'))
})
