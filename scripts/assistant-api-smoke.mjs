/**
 * Smoke test for a deployed assistant-api, run before telling the assistant
 * team it is live (docs/ASSISTANT_API.md).
 *
 *   read -rs ASSISTANT_API_SECRET && export ASSISTANT_API_SECRET
 *   ASSISTANT_API_EMAIL=<pilot's email> npm run assistant:smoke
 *
 * `read -rs` keeps the secret out of the shell history and off the screen.
 * ASSISTANT_API_URL defaults to the dev project's function; production is
 * refused.
 *
 * It signs assertions the way the assistant does (HS256, 60 s at most) and
 * checks what the assistant relies on: the manifest and its stable version,
 * that the pilot email maps to a Director with the twelve tools, a real read
 * on the voice channel, search_projects with no query, search_help's answer,
 * five parallel calls for one user (the session cache), and three refusals.
 * The times show the first call minting a session and the later ones reusing
 * it. Nothing is written. The secret,
 * the assertions and the email are never printed.
 */
import { createHmac, randomUUID } from 'node:crypto'

const URL = process.env.ASSISTANT_API_URL ?? 'https://nxvbglegqcgxlxvyfuht.supabase.co/functions/v1/assistant-api'
const SECRET = process.env.ASSISTANT_API_SECRET
const EMAIL = process.env.ASSISTANT_API_EMAIL

if (!SECRET) throw new Error('ASSISTANT_API_SECRET is not set: `read -rs ASSISTANT_API_SECRET && export ASSISTANT_API_SECRET`')
if (!EMAIL) throw new Error('ASSISTANT_API_EMAIL is not set: the pilot Director\'s email')
if (/xhlgviunhitdgzkeucxc/.test(URL)) throw new Error('refusing to run against production')

const b64url = (value) => Buffer.from(typeof value === 'string' ? value : JSON.stringify(value)).toString('base64url')

/** An assertion as the assistant signs it; `secret` only to test a bad signature. */
function assertion({ sub = EMAIL, secret = SECRET } = {}) {
  const iat = Math.floor(Date.now() / 1000)
  const head = `${b64url({ alg: 'HS256', typ: 'JWT' })}.${b64url({ iss: 'va', aud: 'landmark-assistant-api', sub, iat, exp: iat + 30, jti: randomUUID() })}`
  return `${head}.${createHmac('sha256', secret).update(head).digest('base64url')}`
}

async function post(path, body = {}, token = assertion()) {
  const t0 = performance.now()
  const res = await fetch(`${URL}${path}`, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
  const text = await res.text()
  let json = null
  try {
    json = JSON.parse(text)
  } catch {
    // reported below as an unexpected body
  }
  return { status: res.status, json, ms: Math.round(performance.now() - t0) }
}

let failed = 0
function check(name, ok, detail = '') {
  if (!ok) failed++
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`)
}

console.log(`assistant-api smoke test against ${URL}\n`)

// The manifest needs only a valid assertion.
const m1 = await post('/manifest')
const tools = m1.json?.tools ?? []
check('/manifest answers', m1.status === 200, `${m1.status}, ${m1.ms} ms`)
check('/manifest lists the twelve tools', tools.length === 12, `${tools.length} tools`)
const m2 = await post('/manifest')
check('/manifest version is stable', Boolean(m1.json?.version) && m1.json.version === m2.json?.version, `version ${m1.json?.version ?? '-'}`)

// The pilot user.
const me = await post('/me')
if (me.status === 403) console.log('      403 means the email is not mapped: no single public.users row with a login on this project')
check('/me maps the pilot email', me.status === 200, `${me.status}, ${me.ms} ms`)
check('/me role is Director', me.json?.role === 'Director', `role ${me.json?.role ?? '-'}`)
check('/me lists twelve voice tools', me.json?.tools?.voice?.length === 12, `${me.json?.tools?.voice?.length ?? '-'} on voice`)

// A real read, as the user, on the voice channel.
const read = await post('/tools/list_cost_classifications', { input: {}, channel: 'voice' })
const classifications = read.json?.data?.data?.classifications
check('a voice tool call reads data', read.status === 200 && Array.isArray(classifications), `${read.status}, ${read.ms} ms, ${classifications?.length ?? '-'} classifications`)

// Listing projects: search_projects with no query (2026-11-12).
const list = await post('/tools/search_projects', { input: {}, channel: 'voice' })
const projects = list.json?.data?.data?.projects
check('search_projects without a query lists projects', list.status === 200 && Array.isArray(projects) && projects.length > 0, `${list.status}, ${list.ms} ms, ${projects?.length ?? '-'} shown${list.json?.data?.data?.total ? ` of ${list.json.data.data.total}` : ''}`)

// search_help answers { markdown, matches } directly under data, with no inner data.
const help = await post('/tools/search_help', { input: { query: 'TIC budžet' }, channel: 'chat' })
check('search_help answers with markdown, not an error', help.status === 200 && typeof help.json?.data?.markdown === 'string' && !help.json?.data?.error, `${help.status}, ${help.ms} ms, ${help.json?.data?.matches ?? '-'} matches`)

// Session reuse: parallel calls for one user share a session and all answer.
// A call before the reuse was 500 when two minted at once.
const parallel = await Promise.all([1, 2, 3, 4, 5].map(() => post('/tools/list_cost_classifications', { input: {}, channel: 'voice' })))
check('five parallel calls for one user all answer', parallel.every((r) => r.status === 200), `${parallel.map((r) => r.status).join(' ')}; ${parallel.map((r) => r.ms).join(', ')} ms`)

// Refusals.
const token = assertion()
await post('/me', {}, token)
const replay = await post('/me', {}, token)
check('a replayed assertion is refused', replay.status === 401 && replay.json?.error?.code === 'bad_assertion', `${replay.status}`)
const forged = await post('/me', {}, assertion({ secret: `${SECRET}-wrong` }))
check('a wrong signature is refused', forged.status === 401 && forged.json?.error?.code === 'bad_assertion', `${forged.status}`)
const unknown = await post('/tools/create_document', { input: {}, channel: 'chat' })
check('an unexposed tool is refused', unknown.status === 404 && unknown.json?.error?.code === 'unknown_tool', `${unknown.status}`)

console.log(failed ? `\n${failed} check(s) failed` : '\nAll checks passed. Send the assistant team the URL and the manifest version above.')
process.exitCode = failed ? 1 : 0
