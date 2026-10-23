// Sums up logs/turns.jsonl and logs/bargein.jsonl against the plan's live phase 0 gates:
//   latency:  user stopped speaking -> agent's first audio, p50 <= 1.5 s (10 questions per speaker)
//   barge-in: the agent stops within 0.5 s of the user starting to speak, in >= 18 of 20 tries
// Agent-side figures: network and browser playout are not included, which on a local server is small.

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

const barges = read('bargein.jsonl').map((b) => Number(b.stop_ms))
console.log('\nBarge-in: agent stops within 0.5 s (gate: >= 18 of 20)')
if (!barges.length) console.log('  no interruptions logged yet')
else {
  const ok = barges.filter((ms) => ms <= 500).length
  const last20 = barges.slice(-20)
  const ok20 = last20.filter((ms) => ms <= 500).length
  console.log(`  ${barges.length} interruptions, ${ok} stopped within 0.5 s; median stop ${fmt(pct(barges, 50))}, slowest ${fmt(Math.max(...barges))}`)
  console.log(`  last ${last20.length}: ${ok20} within 0.5 s -> ${last20.length < 20 ? `needs 20 tries` : ok20 >= 18 ? 'PASS' : 'FAIL'}`)
}
