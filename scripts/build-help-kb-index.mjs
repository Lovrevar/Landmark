#!/usr/bin/env node
// Bundles help-kb/*.md into supabase/functions/_shared/help-kb-index.json, the artifact
// search_help reads at runtime.
//
// No API key and no network: retrieval is lexical (see _shared/help-score.ts), so this is a pure
// file transform. That is the point — the previous embedding build needed an OpenAI key, and when
// the key stopped working the artifact silently kept serving months-old text.
//
// Usage:
//   npm run kb:build

import { promises as fs } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = path.resolve(__dirname, '..')
const KB_DIR = path.join(REPO_ROOT, 'help-kb')
const OUT_FILE = path.join(REPO_ROOT, 'supabase/functions/_shared/help-kb-index.json')

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

const files = (await fs.readdir(KB_DIR)).filter((f) => f.endsWith('.md') && f !== 'INDEX.md').sort()
if (files.length === 0) {
  console.error('No KB entries found in help-kb/. Aborting.')
  process.exit(1)
}

const entries = []
for (const file of files) {
  const { frontmatter, body } = parseFrontmatter(await fs.readFile(path.join(KB_DIR, file), 'utf8'))
  const id = frontmatter.id || file.replace(/\.md$/, '')
  if (!body.trim()) {
    console.error(`${file}: empty body. Aborting.`)
    process.exit(1)
  }
  entries.push({
    id,
    title: frontmatter.title || id,
    keywords: Array.isArray(frontmatter.keywords) ? frontmatter.keywords : [],
    routes: Array.isArray(frontmatter.routes) ? frontmatter.routes : [],
    roles: Array.isArray(frontmatter.roles) ? frontmatter.roles : [],
    body,
  })
}

const duplicates = entries.map((e) => e.id).filter((id, i, all) => all.indexOf(id) !== i)
if (duplicates.length > 0) {
  console.error(`Duplicate entry ids: ${[...new Set(duplicates)].join(', ')}. Aborting.`)
  process.exit(1)
}

await fs.mkdir(path.dirname(OUT_FILE), { recursive: true })
await fs.writeFile(
  OUT_FILE,
  JSON.stringify({ generated_at: new Date().toISOString(), entries }, null, 0) + '\n',
  'utf8',
)
console.log(`Wrote ${path.relative(REPO_ROOT, OUT_FILE)} (${entries.length} entries)`)
