// Sums up logs/turns.jsonl and logs/bargein.jsonl against the plan's live phase 0 gates:
//   latency:  user stopped speaking -> agent's first audio, p50 <= 1.5 s (10 questions per speaker)
//   barge-in: the agent stops within 0.5 s of the user starting to speak, in >= 18 of 20 tries
// Latency is the agent's own figure (network and playout not included, which on a local server is
// small) and, when there are any, the scripted caller's. Barge-in is the scripted caller's: the agent
// can only count from the moment its detector noticed the caller, which leaves out the noticing.
// Caller rows from before the speech-span fix (no speech_ms) are skipped: their clock was wrong.

import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const LOGS = join(dirname(fileURLToPath(import.meta.url)), '..', 'logs')

function read(name: string): Record<string, unknown>[] {
  const p = join(LOGS, name)
  return existsSync(p) ? readFileSync(p, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)) : []
}

function pct(values: number[], p: number): number {
  const s = [...values].sort((a, b) => a - b)
  return s[Math.min(s.length - 1, Math.floor((p / 100) * s.length))]
}

const fmt = (ms: number | undefined) => (ms === undefined ? '—' : `${(ms / 1000).toFixed(2)} s`)

const turns = read('turns.jsonl').filter((t) => typeof t.e2e_ms === 'number') // the greeting has no user turn
const byVoice = new Map<string, Record<string, unknown>[]>()
for (const t of turns) byVoice.set(String(t.voice), [...(byVoice.get(String(t.voice)) ?? []), t])

console.log('Latency: user stopped speaking -> first audio (gate: p50 <= 1.5 s)')
if (!turns.length) console.log('  no answered turns logged yet')
for (const [voiceName, ts] of byVoice) {
  const col = (k: string) => ts.map((t) => t[k]).filter((v): v is number => typeof v === 'number')
  const e2e = col('e2e_ms')
  const p50 = pct(e2e, 50)
  console.log(`  ${voiceName}: ${e2e.length} answers, p50 ${fmt(p50)}, p95 ${fmt(pct(e2e, 95))} -> ${p50 <= 1500 ? 'PASS' : 'FAIL'}` +
    (e2e.length < 10 ? ` (only ${e2e.length} of the 10 the gate needs)` : ''))
  console.log(`    of which (p50): end of turn ${fmt(pct(col('end_of_turn_delay_ms'), 50))}, ` +
    `transcription ${fmt(pct(col('transcription_delay_ms'), 50))}, LLM first token ${fmt(pct(col('llm_ttft_ms'), 50))}, ` +
    `TTS first audio ${fmt(pct(col('tts_ttfb_ms'), 50))}`)
}

const calls = read('calltest.jsonl').filter((c) => Array.isArray(c.speech_ms))
const callLatency = calls.filter((c) => c.mode === 'latency' && typeof c.latency_ms === 'number').map((c) => Number(c.latency_ms))
if (callLatency.length) {
  const p50 = pct(callLatency, 50)
  console.log(`  scripted caller: ${callLatency.length} answers, p50 ${fmt(p50)}, p95 ${fmt(pct(callLatency, 95))} -> ${p50 <= 1500 ? 'PASS' : 'FAIL'}`)
}

const barges = calls.filter((c) => c.mode === 'bargein' && typeof c.stop_ms === 'number')
const skipped = calls.filter((c) => c.mode === 'bargein' && c.error).length
console.log('\nBarge-in: the caller hears the agent stop within 0.5 s (gate: >= 18 of 20)')
if (!barges.length) console.log('  no interruptions by the scripted caller logged yet')
const byLabel = new Map<string, number[]>()
for (const b of barges) byLabel.set(String(b.label ?? 'unlabelled'), [...(byLabel.get(String(b.label ?? 'unlabelled')) ?? []), Number(b.stop_ms)])
for (const [label, all] of byLabel) {
  const last20 = all.slice(-20)
  const ok20 = last20.filter((ms) => ms <= 500).length
  console.log(`  ${label}: last ${last20.length}, ${ok20} within 0.5 s; median ${fmt(pct(last20, 50))}, slowest ${fmt(Math.max(...last20))} -> ` +
    (last20.length < 20 ? 'needs 20 tries' : ok20 >= 18 ? 'PASS' : 'FAIL'))
}
if (skipped) console.log(`  ${skipped} tries not counted: the agent wasn't talking when the caller began`)
