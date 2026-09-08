#!/usr/bin/env node
// Refreshes the TEXT of supabase/functions/_shared/help-kb-embeddings.json from help-kb/*.md
// while keeping each entry's existing vector.
//
// This is a stopgap, not a substitute for `npm run kb:embed`. It exists because the help text the
// assistant serves comes from this artifact rather than from the markdown, so an artifact built
// before a KB edit keeps answering with the old wording — which is worse than slightly stale
// retrieval ranking. After running this, entries carry current text scored by vectors computed
// from their previous text, and an entry added since the last real build has no vector at all and
// so cannot be retrieved. Both facts are recorded in the artifact under `stale_vectors`.
//
// Run `npm run kb:embed` with a working OPENAI_API_KEY as soon as one is available; that
// regenerates everything and clears the marker.
//
// Usage: node scripts/refresh-help-kb-bodies.mjs

import { promises as fs } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = path.resolve(__dirname, '..')
const KB_DIR = path.join(REPO_ROOT, 'help-kb')
const OUT_FILE = path.join(REPO_ROOT, 'supabase/functions/_shared/help-kb-embeddings.json')

function parseFrontmatter(raw) {
  if (!raw.startsWith('---\n')) return { frontmatter: {}, body: raw }
  const end = raw.indexOf('\n---\n', 4)
  if (end === -1) return { frontmatter: {}, body: raw }
  const header = raw.slice(4, end)
  const body = raw.slice(end + 5).trim()
  const fm = {}
  for (const line of header.split('\n')) {
    const m = line.match(/^([a-zA-Z_]+):\s*(.*)$/)
    if (!m) continue
    let val = m[2].trim()
    if (val.startsWith('[') && val.endsWith(']')) {
      val = val.slice(1, -1).split(',').map((s) => s.trim()).filter(Boolean)
    }
    fm[m[1]] = val
  }
  return { frontmatter: fm, body }
}

const artifact = JSON.parse(await fs.readFile(OUT_FILE, 'utf8'))
const vectorById = new Map(artifact.entries.map((e) => [e.id, e.embedding]))

const files = (await fs.readdir(KB_DIR)).filter((f) => f.endsWith('.md') && f !== 'INDEX.md').sort()

const entries = []
const changed = []
const missingVector = []

for (const file of files) {
  const { frontmatter, body } = parseFrontmatter(await fs.readFile(path.join(KB_DIR, file), 'utf8'))
  const id = frontmatter.id || file.replace(/\.md$/, '')
  const embedding = vectorById.get(id)
  if (!embedding) {
    missingVector.push(id)
    continue
  }
  const previous = artifact.entries.find((e) => e.id === id)
  if (previous.body !== body || previous.title !== (frontmatter.title || id)) changed.push(id)
  entries.push({
    id,
    title: frontmatter.title || id,
    routes: Array.isArray(frontmatter.routes) ? frontmatter.routes : [],
    roles: Array.isArray(frontmatter.roles) ? frontmatter.roles : [],
    body,
    embedding,
  })
}

const dropped = artifact.entries.filter((e) => !entries.some((n) => n.id === e.id)).map((e) => e.id)

await fs.writeFile(
  OUT_FILE,
  JSON.stringify(
    {
      model: artifact.model,
      generated_at: artifact.generated_at,
      dim: artifact.dim,
      stale_vectors: {
        refreshed_at: new Date().toISOString(),
        note:
          'Bodies were refreshed from help-kb/*.md without re-embedding. Vectors still reflect the ' +
          'text as of generated_at. Run `npm run kb:embed` with a valid OPENAI_API_KEY to fix.',
        text_changed_since_embedding: changed,
        entries_without_vector: missingVector,
      },
      entries,
    },
    null,
    0,
  ) + '\n',
)

console.log(`refreshed ${entries.length} entries`)
console.log(`  text changed since embedding: ${changed.length ? changed.join(', ') : 'none'}`)
console.log(`  NOT retrievable (no vector):  ${missingVector.length ? missingVector.join(', ') : 'none'}`)
console.log(`  dropped (file removed):       ${dropped.length ? dropped.join(', ') : 'none'}`)
