#!/usr/bin/env node
// Embeds every entry in help-kb/ with OpenAI text-embedding-3-small and
// writes the artifact at supabase/functions/_shared/help-kb-embeddings.json.
// The edge function imports that file at runtime; rebuild after any KB edit.
//
// Usage:
//   OPENAI_API_KEY=sk-... node scripts/build-help-kb-embeddings.mjs
//   npm run kb:embed
//
// The artifact shape is documented in supabase/functions/_shared/tool-handlers.ts.

import { promises as fs } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = path.resolve(__dirname, '..')
const KB_DIR = path.join(REPO_ROOT, 'help-kb')
const OUT_FILE = path.join(REPO_ROOT, 'supabase/functions/_shared/help-kb-embeddings.json')
const EMBEDDING_MODEL = 'text-embedding-3-small'

const apiKey = process.env.OPENAI_API_KEY
if (!apiKey) {
  console.error('OPENAI_API_KEY is not set. Aborting.')
  process.exit(1)
}

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
    const key = m[1]
    let val = m[2].trim()
    if (val.startsWith('[') && val.endsWith(']')) {
      val = val
        .slice(1, -1)
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
    }
    fm[key] = val
  }
  return { frontmatter: fm, body }
}

async function embedBatch(texts) {
  const res = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ model: EMBEDDING_MODEL, input: texts }),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`OpenAI embeddings call failed: ${res.status} ${text}`)
  }
  const json = await res.json()
  return json.data.map((d) => d.embedding)
}

async function main() {
  const files = (await fs.readdir(KB_DIR))
    .filter((f) => f.endsWith('.md') && f !== 'INDEX.md')
    .sort()
  if (files.length === 0) {
    console.error('No KB entries found in help-kb/. Aborting.')
    process.exit(1)
  }

  const entries = []
  for (const file of files) {
    const raw = await fs.readFile(path.join(KB_DIR, file), 'utf8')
    const { frontmatter, body } = parseFrontmatter(raw)
    const id = frontmatter.id || file.replace(/\.md$/, '')
    const title = frontmatter.title || id
    const keywords = Array.isArray(frontmatter.keywords) ? frontmatter.keywords : []
    const routes = Array.isArray(frontmatter.routes) ? frontmatter.routes : []
    const roles = Array.isArray(frontmatter.roles) ? frontmatter.roles : []
    const embedInput = `${title}\n${keywords.join(', ')}\n${body}`
    entries.push({ id, title, keywords, routes, roles, body, embedInput })
  }

  console.log(`Embedding ${entries.length} entries with ${EMBEDDING_MODEL}...`)
  const BATCH = 64
  const vectors = []
  for (let i = 0; i < entries.length; i += BATCH) {
    const batch = entries.slice(i, i + BATCH).map((e) => e.embedInput)
    const got = await embedBatch(batch)
    vectors.push(...got)
    process.stdout.write(`  ${Math.min(i + BATCH, entries.length)}/${entries.length}\r`)
  }
  console.log('')

  const artifact = {
    model: EMBEDDING_MODEL,
    generated_at: new Date().toISOString(),
    dim: vectors[0]?.length ?? 0,
    entries: entries.map((e, i) => ({
      id: e.id,
      title: e.title,
      routes: e.routes,
      roles: e.roles,
      body: e.body,
      embedding: vectors[i],
    })),
  }

  await fs.mkdir(path.dirname(OUT_FILE), { recursive: true })
  await fs.writeFile(OUT_FILE, JSON.stringify(artifact, null, 0) + '\n', 'utf8')
  console.log(`Wrote ${OUT_FILE} (${artifact.entries.length} entries, dim=${artifact.dim})`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
