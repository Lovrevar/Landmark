#!/usr/bin/env node
// Bulk-imports a local NIN folder into the Cognilion unified document store.
// Mirrors the in-app uploadDocument() flow in
// src/components/Documents/services/documentService.ts.
//
// Usage:
//   node scripts/import-nin-docs.mjs --source ~/nin-import/NIN
//   node scripts/import-nin-docs.mjs --source ~/nin-import/NIN --apply
//
// Requires env (read from --env file or process.env):
//   PROD_SUPABASE_URL
//   PROD_SUPABASE_SERVICE_ROLE_KEY

import { createClient } from '@supabase/supabase-js'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import os from 'node:os'

const PROJECT_ID = 'a822883e-b709-435b-81a5-9ddb8d89c843' // Nin-retail
const BUCKET = 'documents'

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

function parseArgs(argv) {
  const out = { apply: false, source: null, report: 'nin-import-report.json', env: '.env.prod' }
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--apply') out.apply = true
    else if (a === '--source') out.source = argv[++i]
    else if (a === '--report') out.report = argv[++i]
    else if (a === '--env')    out.env    = argv[++i]
    else { console.error(`Unknown arg: ${a}`); process.exit(2) }
  }
  if (!out.source) {
    console.error('--source <dir> is required')
    process.exit(2)
  }
  return out
}

async function loadEnv(envPath) {
  try {
    const raw = await fs.readFile(envPath, 'utf8')
    for (const line of raw.split('\n')) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
      if (!m) continue
      const [, k, v] = m
      const val = v.replace(/^["']|["']$/g, '')
      if (!process.env[k]) process.env[k] = val
    }
  } catch {
    // missing env file is OK if vars are in process.env
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sanitizeFilename(name) {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_')
}

const nfc = s => (s ?? '').normalize('NFC')

// Strip diacritics: ć→c, š→s, đ→d, etc. Decompose then drop combining marks,
// and rewrite Croatian special letters that don't decompose.
function stripDiacritics(s) {
  return s
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/đ/g, 'd').replace(/Đ/g, 'D')
    .replace(/ł/g, 'l').replace(/Ł/g, 'L')
}

function tokenize(name) {
  return nfc(name)
    .replace(/[,\-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase()
    .split(' ')
    .filter(Boolean)
}

// Strict key — matches the contracts migration normalizer.
function exactKey(name) {
  return tokenize(name).slice().sort().join(' ')
}

// Diacritic-folded key for the second-pass match.
function foldedKey(name) {
  return tokenize(name).map(stripDiacritics).slice().sort().join(' ')
}

const STOP_KEYWORDS = [
  'kapara', 'predugovor', 'ugovor', 'aneks', 'rjesenje',
  'uknjizba', 'privremeno', 'ugvor',
]

// Extract the leading subcontractor-name portion of a filename by truncating
// at the first stop keyword. Operates on a folded copy so NFD diacritics in
// filenames don't break the keyword search.
function extractSubcontractorName(fileName) {
  const stem = nfc(fileName).replace(/\.[^.]+$/, '')
  const folded = stripDiacritics(stem).toLowerCase()
  let cut = stem.length
  for (const kw of STOP_KEYWORDS) {
    const idx = folded.indexOf(kw)
    if (idx >= 0 && idx < cut) cut = idx
  }
  return stem.slice(0, cut).trim().replace(/[,\s]+$/, '')
}

// Skip rules — system metadata + Office lock files.
function shouldSkipFile(name) {
  if (name === '.DS_Store' || name === 'Thumbs.db') return 'system_file'
  if (name.startsWith('~$')) return 'office_lock_file'
  return null
}

// Determine category code + whether subcontractor linking applies.
// Returns null if the file's location is unknown / out of scope.
function categorize(absPath, fileName, sourceRoot) {
  const rel = path.relative(sourceRoot, absPath)
  const segs = rel.split(path.sep)
  if (segs.length < 2) return null // file at root of NIN/

  const top = segs[0]
  const upperSegs = segs.map(s => s.toUpperCase())

  if (top.toUpperCase().includes('KUPOPRODAJA')) {
    if (upperSegs.includes('PREDUGOVORI') || upperSegs.includes('UGOVORI')) {
      return { category: 'KUPOPRODAJNI_UGOVORI', linkSubcontractor: true }
    }
    if (upperSegs.includes('ARHIVA')) {
      return { category: 'KUPOPRODAJNI_UGOVORI', linkSubcontractor: false }
    }
    return { category: 'PRAVNO', linkSubcontractor: false }
  }

  if (top.toUpperCase().includes('GRUNTOVNICA')) {
    return { category: 'KATASTAR_I_ZEMLJISNA_KNJIGA', linkSubcontractor: false }
  }

  if (top.toUpperCase().includes('PROJEKTNA DOKUMENTACIJA')) {
    if (upperSegs.some(s => s.includes('RENDERI'))) {
      return { category: 'IDEJNI_KONCEPT', linkSubcontractor: false }
    }
    return null
  }

  if (top.toUpperCase().includes('UVJETI')) {
    if (/^HEP/i.test(fileName)) {
      return { category: 'HEP', linkSubcontractor: false }
    }
    return { category: 'RAZNO', linkSubcontractor: false }
  }

  if (top.toUpperCase().includes('PONUDE I UGOVORI')) {
    return { category: 'PRODAJA', linkSubcontractor: false }
  }

  if (top.toUpperCase().includes('DOKUMENTACIJA')) {
    return { category: 'RAZNO', linkSubcontractor: false }
  }

  return null
}

const MIME_BY_EXT = {
  '.pdf':  'application/pdf',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.xls':  'application/vnd.ms-excel',
  '.zip':  'application/zip',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
}

function mimeFromName(name) {
  const ext = path.extname(name).toLowerCase()
  return MIME_BY_EXT[ext] ?? null
}

// ---------------------------------------------------------------------------
// Walking
// ---------------------------------------------------------------------------

async function walk(dir, out = []) {
  const entries = await fs.readdir(dir, { withFileTypes: true })
  for (const e of entries) {
    const full = path.join(dir, e.name)
    if (e.isDirectory()) await walk(full, out)
    else if (e.isFile()) out.push(full)
  }
  return out
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const args = parseArgs(process.argv)
  await loadEnv(args.env)

  const url = process.env.PROD_SUPABASE_URL
  const key = process.env.PROD_SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    console.error(`Missing PROD_SUPABASE_URL or PROD_SUPABASE_SERVICE_ROLE_KEY (looked in ${args.env}).`)
    process.exit(2)
  }

  const sourceRoot = path.resolve(args.source.replace(/^~(?=\/)/, os.homedir()))
  await fs.access(sourceRoot)

  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  // ----- Lookup tables -----
  const { data: cats, error: catErr } = await supabase
    .from('document_categories').select('id, code')
  if (catErr) throw catErr
  const categoryIdByCode = new Map(cats.map(c => [c.code, c.id]))

  const { data: subs, error: subErr } = await supabase
    .from('subcontractors').select('id, name, created_at')
  if (subErr) throw subErr

  const { data: contractRows, error: cErr } = await supabase
    .from('contracts').select('id, subcontractor_id').eq('project_id', PROJECT_ID)
  if (cErr) throw cErr
  const contractsBySub = new Map()
  for (const c of contractRows) {
    const arr = contractsBySub.get(c.subcontractor_id) ?? []
    arr.push(c.id)
    contractsBySub.set(c.subcontractor_id, arr)
  }

  // total contracts per subcontractor (any project) for the JB IVANA tiebreaker
  const { data: allContracts, error: acErr } = await supabase
    .from('contracts').select('subcontractor_id')
  if (acErr) throw acErr
  const totalCountBySub = new Map()
  for (const c of allContracts) {
    totalCountBySub.set(c.subcontractor_id, (totalCountBySub.get(c.subcontractor_id) ?? 0) + 1)
  }

  // Tiebreaker: prefer the subcontractor with most total contracts, then oldest
  // — same as the contracts migration. Used for the JB IVANA dup and for any
  // ambiguous folded-key collisions.
  const preferA = (a, b) => {
    const aCount = totalCountBySub.get(a.id) ?? 0
    const bCount = totalCountBySub.get(b.id) ?? 0
    if (bCount !== aCount) return bCount > aCount
    return b.created_at < a.created_at
  }

  // Pre-compute lookup structures for the three-pass match.
  const subsIndex = subs.map(s => ({
    ...s,
    exactKey:    exactKey(s.name),
    foldedKey:   foldedKey(s.name),
    foldedTokens: new Set(tokenize(s.name).map(stripDiacritics)),
  }))

  const subsByExact = new Map()
  const subsByFolded = new Map()
  for (const s of subsIndex) {
    const ex = subsByExact.get(s.exactKey)
    if (!ex || preferA(s, ex)) subsByExact.set(s.exactKey, s)
    const fd = subsByFolded.get(s.foldedKey)
    if (!fd || preferA(s, fd)) subsByFolded.set(s.foldedKey, s)
  }

  // Returns { sub, mode } when matched; { sub: null, suggestion } otherwise.
  function resolveSubcontractor(supplierPart) {
    const filEx = exactKey(supplierPart)
    const exact = subsByExact.get(filEx)
    if (exact) return { sub: exact, mode: 'exact' }

    const filFd = foldedKey(supplierPart)
    const folded = subsByFolded.get(filFd)
    if (folded) return { sub: folded, mode: 'diacritic_insensitive' }

    // Subset: filename's tokens are a superset of subcontractor's, OR vice
    // versa. Comparison happens on diacritic-folded tokens. Require ≥2 token
    // overlap to keep noise down on short single-word fragments.
    const fileTokens = new Set(tokenize(supplierPart).map(stripDiacritics))
    if (fileTokens.size === 0) return { sub: null }

    let best = null
    let bestSuggestion = null
    let bestSuggestionOverlap = 0
    for (const s of subsIndex) {
      const overlap = [...s.foldedTokens].filter(t => fileTokens.has(t)).length
      if (overlap === 0) continue

      const fileSupersetOfSub = overlap === s.foldedTokens.size
      const subSupersetOfFile = overlap === fileTokens.size

      if (overlap >= 2 && (fileSupersetOfSub || subSupersetOfFile)) {
        const cand = { sub: s, mode: fileSupersetOfSub ? 'subset_file⊇sub' : 'subset_sub⊇file', overlap }
        if (!best || cand.overlap > best.overlap ||
            (cand.overlap === best.overlap && preferA(s, best.sub))) {
          best = cand
        }
      }

      if (overlap > bestSuggestionOverlap) {
        bestSuggestionOverlap = overlap
        bestSuggestion = s
      }
    }

    if (best) return { sub: best.sub, mode: best.mode }
    return { sub: null, suggestion: bestSuggestion?.name ?? null }
  }

  // Existing documents on this project (for idempotency: file_name match).
  const { data: existingAssoc, error: eaErr } = await supabase
    .from('document_associations')
    .select('document_id, documents!inner(file_name)')
    .eq('entity_type', 'project')
    .eq('entity_id', PROJECT_ID)
  if (eaErr) throw eaErr
  const existingFileNames = new Set(
    existingAssoc.map(a => a.documents?.file_name).filter(Boolean),
  )

  // ----- Walk + plan -----
  const allFiles = await walk(sourceRoot)
  const decisions = []

  for (const abs of allFiles) {
    const name = path.basename(abs)
    const stat = await fs.stat(abs)

    const skip = shouldSkipFile(name)
    if (skip) {
      decisions.push({ file: abs, status: `skipped:${skip}` })
      continue
    }

    const cat = categorize(abs, name, sourceRoot)
    if (!cat) {
      decisions.push({ file: abs, status: 'skipped:no_category' })
      continue
    }

    const categoryId = categoryIdByCode.get(cat.category)
    if (!categoryId) {
      decisions.push({ file: abs, status: 'error:unknown_category', category: cat.category })
      continue
    }

    const associations = [{ entityType: 'project', entityId: PROJECT_ID }]
    const warnings = []

    if (cat.linkSubcontractor) {
      const supplierPart = extractSubcontractorName(name)
      const match = resolveSubcontractor(supplierPart)
      if (match.sub) {
        associations.push({ entityType: 'subcontractor', entityId: match.sub.id })
        if (match.mode !== 'exact') {
          warnings.push(`matched subcontractor "${match.sub.name}" via ${match.mode} (file said "${supplierPart}")`)
        }
        const subContracts = contractsBySub.get(match.sub.id) ?? []
        if (subContracts.length === 1) {
          associations.push({ entityType: 'contract', entityId: subContracts[0] })
        } else if (subContracts.length > 1) {
          warnings.push(`subcontractor has ${subContracts.length} contracts on Nin-retail; not auto-linking to a contract`)
        } else {
          warnings.push('subcontractor has no contract on Nin-retail yet; not linking to contract')
        }
      } else {
        const hint = match.suggestion ? ` (closest existing: "${match.suggestion}")` : ''
        warnings.push(`no subcontractor matched for "${supplierPart}"${hint}; project-only`)
      }
    }

    if (existingFileNames.has(name)) {
      decisions.push({
        file: abs,
        status: 'skipped:already_present',
        category: cat.category,
        associations,
        warnings,
      })
      continue
    }

    decisions.push({
      file: abs,
      status: 'planned',
      category: cat.category,
      categoryId,
      associations,
      warnings,
      size: stat.size,
      mime: mimeFromName(name),
    })
  }

  // ----- Print summary -----
  const summary = {}
  for (const d of decisions) summary[d.status] = (summary[d.status] ?? 0) + 1
  console.log('\n=== Plan summary ===')
  for (const [k, v] of Object.entries(summary).sort()) console.log(`  ${k}: ${v}`)

  console.log('\n=== Warnings ===')
  let warnCount = 0
  for (const d of decisions) {
    if (d.warnings?.length) {
      for (const w of d.warnings) {
        console.log(`  ${path.basename(d.file)}: ${w}`)
        warnCount++
      }
    }
  }
  if (!warnCount) console.log('  (none)')

  console.log('\n=== Detail (planned) ===')
  for (const d of decisions) {
    if (d.status !== 'planned') continue
    const assocStr = d.associations.map(a => `${a.entityType}:${a.entityId.slice(0, 8)}`).join(',')
    console.log(`  [${d.category}] ${path.basename(d.file)}  →  {${assocStr}}`)
  }

  // ----- Write report -----
  await fs.writeFile(args.report, JSON.stringify(decisions, null, 2))
  console.log(`\nReport written: ${args.report}`)

  // ----- Apply -----
  if (!args.apply) {
    console.log('\n(Dry run — pass --apply to actually upload.)')
    return
  }

  console.log('\n=== Applying ===')
  let uploaded = 0, failed = 0
  for (const d of decisions) {
    if (d.status !== 'planned') continue
    const fileName = path.basename(d.file)
    try {
      const buf = await fs.readFile(d.file)
      const storagePath = `${crypto.randomUUID()}/${sanitizeFilename(fileName)}`

      const { error: upErr } = await supabase.storage
        .from(BUCKET)
        .upload(storagePath, buf, { contentType: d.mime ?? undefined })
      if (upErr) throw upErr

      const { data: inserted, error: insErr } = await supabase
        .from('documents')
        .insert({
          file_path: storagePath,
          file_name: fileName,
          file_size: d.size,
          mime_type: d.mime,
          category_id: d.categoryId,
          source: 'filesystem_scan',
          uploaded_by: null,
        })
        .select('id')
        .single()

      if (insErr || !inserted) {
        await supabase.storage.from(BUCKET).remove([storagePath])
        throw insErr ?? new Error('document insert returned no row')
      }

      const docId = inserted.id
      if (d.associations.length > 0) {
        const rows = d.associations.map(a => ({
          document_id: docId, entity_type: a.entityType, entity_id: a.entityId,
        }))
        const { error: assocErr } = await supabase
          .from('document_associations').insert(rows)
        if (assocErr) {
          await supabase.from('documents').delete().eq('id', docId)
          await supabase.storage.from(BUCKET).remove([storagePath])
          throw assocErr
        }
      }

      console.log(`  ✓ ${fileName}`)
      uploaded++
    } catch (e) {
      console.error(`  ✗ ${fileName}: ${e.message ?? e}`)
      failed++
    }
  }

  console.log(`\nDone. uploaded=${uploaded} failed=${failed}`)
  if (failed > 0) process.exitCode = 1
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
