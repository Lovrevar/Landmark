// Times the voice-llm edge function directly, with no speech in the way: the phase 0 questions
// (tools/phase0/questions.csv, as text) plus small talk, each asked several times on a fresh
// single-turn conversation, on LandmarkDev's data as the voice test user.
//
// It opens a short-lived call of its own (an ai_sessions row and a voice_calls row with a token it
// knows), so it needs the service role key, and deletes both at the end (messages cascade).
//
//   SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, COGNILION_EMAIL, COGNILION_PASSWORD,
//   VOICE_LLM_URL, VOICE_LLM_SECRET
//   node src/llm-bench.ts [repeats=3]        LABEL=… tags the rows in logs/llm-bench.jsonl
//
// The service role key is not stored anywhere; export it for the run:
//   export SUPABASE_SERVICE_ROLE_KEY=$(supabase projects api-keys --project-ref <ref> -o json |
//     node -e "console.log(JSON.parse(require('fs').readFileSync(0)).find(k => k.name === 'service_role').api_key)")

import { createHash, randomBytes } from 'node:crypto'
import { appendFileSync, mkdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const LOGS = join(HERE, '..', 'logs')
const ROOM = `bench-${Date.now().toString(36)}`

function env(name: string): string {
  const v = process.env[name]
  if (!v) throw new Error(`${name} is not set`)
  return v
}

// questions.csv: question_id,sentence,review_status; one sentence is quoted (it has a comma).
function phase0Questions(): Array<{ id: string; text: string }> {
  const lines = readFileSync(join(HERE, '..', '..', 'phase0', 'questions.csv'), 'utf8').trim().split(/\r?\n/).slice(1)
  return lines.map((line) => {
    const m = line.match(/^([^,]+),(?:"((?:[^"]|"")*)"|([^,]*)),/)
    if (!m) throw new Error(`questions.csv: cannot read ${line}`)
    return { id: m[1], text: (m[2] ?? m[3]).replace(/""/g, '"') }
  })
}

const SMALL_TALK = [
  { id: 'hello', text: 'Bok, kako si?' },
  { id: 'thanks', text: 'Hvala, to je sve za sada.' },
]

const median = (xs: number[]) => {
  const s = xs.filter((x) => Number.isFinite(x)).sort((a, b) => a - b)
  return s.length ? s[Math.floor(s.length / 2)] : NaN
}
const pct = (xs: number[], p: number) => {
  const s = xs.filter((x) => Number.isFinite(x)).sort((a, b) => a - b)
  return s.length ? s[Math.min(s.length - 1, Math.floor((p / 100) * s.length))] : NaN
}
const sec = (ms: number) => (Number.isFinite(ms) ? `${(ms / 1000).toFixed(2)} s` : '—')

async function rest(path: string, init: RequestInit & { key: string }) {
  const res = await fetch(`${env('SUPABASE_URL')}/rest/v1/${path}`, {
    ...init,
    headers: { apikey: init.key, authorization: `Bearer ${init.key}`, 'content-type': 'application/json', prefer: 'return=representation', ...(init.headers ?? {}) },
  })
  if (!res.ok) throw new Error(`${init.method ?? 'GET'} ${path}: ${res.status} ${await res.text()}`)
  return res.status === 204 ? null : res.json()
}

async function openCall() {
  const login = await fetch(`${env('SUPABASE_URL')}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: env('SUPABASE_ANON_KEY'), 'content-type': 'application/json' },
    body: JSON.stringify({ email: env('COGNILION_EMAIL'), password: env('COGNILION_PASSWORD') }),
  })
  if (!login.ok) throw new Error(`sign-in failed: ${login.status}`)
  const jwt = (await login.json()).access_token as string
  const key = env('SUPABASE_SERVICE_ROLE_KEY')
  const [user] = await rest(`users?email=eq.${encodeURIComponent(env('COGNILION_EMAIL'))}&select=id`, { key })
  const [session] = await rest('ai_sessions', {
    key, method: 'POST',
    body: JSON.stringify({ user_id: user.id, channel: 'voice', external_call_id: ROOM, title: 'Mjerenje (llm-bench)' }),
  })
  const token = randomBytes(32).toString('base64url')
  await rest('voice_calls', {
    key, method: 'POST',
    body: JSON.stringify({
      session_id: session.id, user_id: user.id, platform_call_id: ROOM, access_token: jwt,
      call_token_hash: createHash('sha256').update(token).digest('hex'),
      expires_at: new Date(Date.now() + 15 * 60_000).toISOString(),
    }),
  })
  return { token, close: () => rest(`ai_sessions?id=eq.${session.id}`, { key, method: 'DELETE' }) }
}

interface Result {
  first_text_ms: number
  total_ms: number
  rounds: number
  cache_read_first: number | null
  timing: string
  text: string
}

async function ask(token: string, question: string): Promise<Result> {
  const t0 = performance.now()
  const res = await fetch(`${env('VOICE_LLM_URL')}/chat/completions`, {
    method: 'POST',
    headers: { 'x-voice-secret': env('VOICE_LLM_SECRET'), 'x-voice-call-id': ROOM, authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify({ stream: true, messages: [{ role: 'user', content: question }] }),
  })
  if (!res.ok || !res.body) throw new Error(`voice-llm: ${res.status} ${await res.text()}`)
  let firstText = NaN
  let text = ''
  let timing = ''
  let buf = ''
  const dec = new TextDecoder()
  for await (const chunk of res.body as unknown as AsyncIterable<Uint8Array>) {
    buf += dec.decode(chunk, { stream: true })
    const lines = buf.split('\n')
    buf = lines.pop() ?? ''
    for (const line of lines) {
      if (line.startsWith(': timing ')) timing = line.slice(9)
      if (!line.startsWith('data: {')) continue
      const content = JSON.parse(line.slice(6)).choices[0]?.delta?.content
      if (content) {
        if (Number.isNaN(firstText)) firstText = performance.now() - t0
        text += content
      }
    }
  }
  const cache = timing.match(/cache_read=(\d+)/)
  return {
    first_text_ms: Math.round(firstText),
    total_ms: Math.round(performance.now() - t0),
    rounds: (timing.match(/model_call=/g) ?? []).length,
    cache_read_first: cache ? Number(cache[1]) : null,
    timing,
    text: text.trim(),
  }
}

const repeats = Number(process.argv[2] ?? 3)
const questions = [...phase0Questions(), ...SMALL_TALK]
const call = await openCall()
const label = process.env.LABEL ?? null
mkdirSync(LOGS, { recursive: true })
const rows: Array<{ id: string; r: Result }> = []
try {
  for (let i = 0; i < repeats; i++) {
    for (const q of questions) {
      const r = await ask(call.token, q.text)
      rows.push({ id: q.id, r })
      appendFileSync(join(LOGS, 'llm-bench.jsonl'), JSON.stringify({ at: new Date().toISOString(), label, run: i, id: q.id, question: q.text, ...r }) + '\n')
      console.log(`${q.id.padEnd(7)} first ${sec(r.first_text_ms)}  total ${sec(r.total_ms)}  rounds ${r.rounds}  cache_read ${r.cache_read_first ?? '—'}`)
    }
  }
} finally {
  await call.close()
}

console.log(`\nper question (median of ${repeats}):`)
for (const q of questions) {
  const rs = rows.filter((x) => x.id === q.id).map((x) => x.r)
  console.log(`  ${q.id.padEnd(7)} first ${sec(median(rs.map((r) => r.first_text_ms)))}  total ${sec(median(rs.map((r) => r.total_ms)))}  rounds ${median(rs.map((r) => r.rounds))}  | ${rs[0].text.slice(0, 90)}`)
}
const all = rows.map((x) => x.r)
console.log(`\nall ${all.length}: first text p50 ${sec(pct(all.map((r) => r.first_text_ms), 50))} p95 ${sec(pct(all.map((r) => r.first_text_ms), 95))}; ` +
  `whole answer p50 ${sec(pct(all.map((r) => r.total_ms), 50))} p95 ${sec(pct(all.map((r) => r.total_ms), 95))}; ` +
  `prompt cache hit on ${all.filter((r) => (r.cache_read_first ?? 0) > 0).length}/${all.length} first calls`)
