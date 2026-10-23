// Phase 0 live prototype: the voice agent worker.
//
// Soniox stt-rt-v5 (EU host, Croatian, the phase 0 vocabulary hints) -> stub LLM -> ElevenLabs
// eleven_v4_turbo, in a LiveKit room. Turns end on Soniox's own endpointing (LiveKit's turn
// detector has no Croatian); barge-in is Silero VAD. Every reply and every interruption is
// logged to logs/turns.jsonl and logs/bargein.jsonl for src/report.ts.
//
//   VOICE                martin (default) | karlo | an ElevenLabs voice id
//   INTERRUPT_MIN_MS     speech needed before the agent stops talking (default 50; LiveKit's own is 500)
//   OUTPUT_QUEUE_MS      agent audio queued ahead of playout, cleared on interruption (default 50; LiveKit's own is 200)
//   VAD_THRESHOLD, VAD_MIN_SPEECH_MS  Silero's activation threshold and minimum speech (default 0.3 and 30;
//                        Silero's own are 0.5 and 50). Barge-in is limited by how fast this notices speech.
//   ENDPOINT_DELAY_MS    Soniox max_endpoint_delay_ms, 500-3000 (default 500)
//   TURN_MIN_DELAY_MS    LiveKit's wait after Soniox's end of turn (default 100; LiveKit's own is 500)
//   ENDPOINT_LATENCY_LEVEL  Soniox v5 endpoint_latency_adjustment_level, 0-3 (default 3, the fastest)
//   STUB_LLM_URL         default http://127.0.0.1:8787/v1
//   SONIOX_API_KEY, ELEVENLABS_API_KEY, LIVEKIT_URL / LIVEKIT_API_KEY / LIVEKIT_API_SECRET

import { type JobContext, type JobProcess, ServerOptions, cli, defineAgent, voice } from '@livekit/agents'
import * as elevenlabs from '@livekit/agents-plugin-elevenlabs'
import * as openai from '@livekit/agents-plugin-openai'
import * as silero from '@livekit/agents-plugin-silero'
import * as soniox from '@livekit/agents-plugin-soniox'
import { appendFileSync, mkdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const LOGS = join(HERE, '..', 'logs')
const PHASE0 = join(HERE, '..', '..', 'phase0')

const VOICES: Record<string, string> = { martin: 'CgDf4YS1Sotf0h6n2vtV', karlo: 'pTD8166KADi6ZFJ5FEXi' }
const voiceName = (process.env.VOICE ?? 'martin').toLowerCase()
const voiceId = VOICES[voiceName] ?? voiceName
const interruptMinMs = Number(process.env.INTERRUPT_MIN_MS ?? 50)
const outputQueueMs = Number(process.env.OUTPUT_QUEUE_MS ?? 50)
const vadThreshold = Number(process.env.VAD_THRESHOLD ?? 0.3)
const vadMinSpeechMs = Number(process.env.VAD_MIN_SPEECH_MS ?? 30)
const endpointDelayMs = Number(process.env.ENDPOINT_DELAY_MS ?? 500)
const turnMinDelayMs = Number(process.env.TURN_MIN_DELAY_MS ?? 100)
const endpointLatencyLevel = Number(process.env.ENDPOINT_LATENCY_LEVEL ?? 3)

const GREETING = 'Dobar dan, ovdje probni glasovni asistent. Pitajte me nešto o projektu, ili recite "daj mi pregled" za duži odgovor.'

function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let quoted = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++ } else if (c === '"') quoted = false
      else field += c
    } else if (c === '"') quoted = true
    else if (c === ',') { row.push(field); field = '' }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++
      row.push(field); field = ''
      if (row.length > 1 || row[0] !== '') rows.push(row)
      row = []
    } else field += c
  }
  if (field || row.length) { row.push(field); rows.push(row) }
  const [head, ...body] = rows
  return body.map((r) => Object.fromEntries(head.map((h, i) => [h, r[i] ?? ''])))
}

// The same hints the phase 0 harness sends (run_stt.py load_hints): the 30 domain terms and the
// 10 project names, never the scripted subcontractor names.
function loadHints(): string[] {
  const terms = parseCsv(readFileSync(join(PHASE0, 'sentences.csv'), 'utf8')).map((r) => r.term)
  const projects = parseCsv(readFileSync(join(PHASE0, 'entities.csv'), 'utf8'))
    .filter((r) => r.entity_type === 'project').map((r) => r.target_form)
  return [...new Set([...terms, ...projects])]
}

function log(file: string, entry: Record<string, unknown>) {
  mkdirSync(LOGS, { recursive: true })
  appendFileSync(join(LOGS, file), JSON.stringify({ at: new Date().toISOString(), voice: voiceName, ...entry }) + '\n')
}

export default defineAgent({
  prewarm: async (proc: JobProcess) => {
    proc.userData.vad = await silero.VAD.load({
      activationThreshold: vadThreshold,
      minSpeechDuration: vadMinSpeechMs,
    })
  },
  entry: async (ctx: JobContext) => {
    const hints = loadHints()
    const session = new voice.AgentSession({
      vad: ctx.proc.userData.vad as silero.VAD,
      stt: new soniox.STT({
        baseUrl: 'wss://stt-rt.eu.soniox.com/transcribe-websocket', // the key comes from the EU project
        model: 'stt-rt-v5', // the Node plugin still defaults to v4
        languageHints: ['hr'],
        languageHintsStrict: true,
        enableLanguageIdentification: false,
        maxEndpointDelayMs: endpointDelayMs,
        endpointLatencyAdjustmentLevel: endpointLatencyLevel,
        context: { terms: hints },
      }),
      llm: new openai.LLM({ baseURL: process.env.STUB_LLM_URL ?? 'http://127.0.0.1:8787/v1', model: 'stub', apiKey: 'stub' }),
      tts: new elevenlabs.TTS({
        apiKey: process.env.ELEVENLABS_API_KEY,
        voiceId,
        model: 'eleven_v4_turbo',
        language: 'hr',
      }),
      turnHandling: {
        turnDetection: 'stt', // Soniox's end-of-turn token; LiveKit's turn detector has no Croatian
        // In 'stt' mode LiveKit adds minDelay after Soniox's end-of-turn token, which already follows
        // the final words, so its 500 ms default is pure waiting.
        endpointing: { minDelay: turnMinDelayMs },
        interruption: { enabled: true, mode: 'vad', minDuration: interruptMinMs },
      },
    })

    // Latency: the framework's own e2e figure, user stopped speaking -> agent's first audio frame.
    session.on(voice.AgentSessionEventTypes.ConversationItemAdded, (ev) => {
      const item = ev.item as { role?: string; interrupted?: boolean; metrics?: Record<string, number>; textContent?: string }
      if (item.role !== 'assistant' || !item.metrics) return
      const m = item.metrics
      log('turns.jsonl', {
        endpoint_delay_ms: endpointDelayMs,
        turn_min_delay_ms: turnMinDelayMs,
        endpoint_latency_level: endpointLatencyLevel,
        e2e_ms: m.e2eLatency !== undefined ? Math.round(m.e2eLatency * 1000) : null,
        transcription_delay_ms: m.transcriptionDelay !== undefined ? Math.round(m.transcriptionDelay * 1000) : null,
        end_of_turn_delay_ms: m.endOfTurnDelay !== undefined ? Math.round(m.endOfTurnDelay * 1000) : null,
        llm_ttft_ms: m.llmNodeTtft !== undefined ? Math.round(m.llmNodeTtft * 1000) : null,
        tts_ttfb_ms: m.ttsNodeTtfb !== undefined ? Math.round(m.ttsNodeTtfb * 1000) : null,
        interrupted: !!item.interrupted,
        text: (item.textContent ?? '').slice(0, 80),
      })
    })

    // Barge-in: the user starts speaking while the agent speaks; how long until the agent stops?
    let agentSpeaking = false
    let userStartedAt: number | null = null
    session.on(voice.AgentSessionEventTypes.UserStateChanged, (ev) => {
      if (ev.newState === 'speaking' && agentSpeaking) userStartedAt = ev.createdAt
    })
    session.on(voice.AgentSessionEventTypes.AgentStateChanged, (ev) => {
      if (ev.newState === 'speaking') agentSpeaking = true
      if (ev.oldState === 'speaking' && ev.newState !== 'speaking') {
        agentSpeaking = false
        if (userStartedAt !== null) {
          log('bargein.jsonl', { user_started_wall: userStartedAt, agent_stopped_wall: ev.createdAt, stop_ms: ev.createdAt - userStartedAt, min_interruption_ms: interruptMinMs, output_queue_ms: outputQueueMs, vad_threshold: vadThreshold, vad_min_speech_ms: vadMinSpeechMs })
          userStartedAt = null
        }
      }
    })

    await session.start({
      agent: new voice.Agent({ instructions: 'Probni asistent.' }),
      room: ctx.room,
      outputOptions: { queueSizeMs: outputQueueMs },
    })
    await ctx.connect()
    session.say(GREETING)
  },
})

cli.runApp(new ServerOptions({ agent: fileURLToPath(import.meta.url) }))
