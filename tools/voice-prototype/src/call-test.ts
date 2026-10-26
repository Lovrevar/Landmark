// Scripted caller: joins a room as a participant, plays recorded questions into it as its
// "microphone", and timestamps the agent's audio as it arrives. Measures from the caller's
// side, transport included:
//   latency  = end of the question's speech -> first audible agent audio
//   barge-in = start of an interrupting question -> agent audio goes quiet
//
//   node src/call-test.ts latency  <wav> [<wav> ...]    16 kHz mono 16-bit, e.g. phase 0 takes
//   node src/call-test.ts bargein  <wav> [<wav> ...]    needs the stub LLM started with STUB_ANSWER=long
//   node src/call-test.ts ask      <wav> [<wav> ...]    asks each question, logs what the agent heard and said
//
// With COGNILION_EMAIL and COGNILION_PASSWORD (plus SUPABASE_URL and SUPABASE_ANON_KEY) the caller goes
// through Cognilion's own start path, as the call button does: it signs in as that user, calls
// voice-session/start, joins the room it returns, and calls voice-session/end afterwards. The agent then
// answers through voice-llm, on that user's data. Otherwise it joins a local room of its own.
//
// Results go to logs/calltest.jsonl and the console, tagged with LABEL if set (e.g. LABEL=stt for the
// agent's INTERRUPT_ON, which the caller can't see). "Start" and "end" of a take's speech come from
// src/speech-span.ts (Silero, offline), not from its loudness: until 2026-10-23 a 10 %-of-peak
// threshold counted breath and room noise as speech, which put the barge-in clock 0.4-0.8 s early
// and the latency clock up to 0.8 s late.

import {
  AudioFrame, AudioSource, AudioStream, LocalAudioTrack, type RemoteTrack, Room, RoomEvent, TrackKind,
  TrackPublishOptions, TrackSource,
} from '@livekit/rtc-node'
import { AccessToken } from 'livekit-server-sdk'
import { appendFileSync, mkdirSync, readFileSync } from 'node:fs'
import { basename, dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { speechSpanMs } from './speech-span.ts'

const LOGS = join(dirname(fileURLToPath(import.meta.url)), '..', 'logs')
const RATE = 16000
const FRAME = 160 // 10 ms
const LOUD = 600 // int16 RMS above which an agent frame counts as speech
// This much quiet means the agent stopped. Its own pauses between phrases run past 300 ms, and once
// interrupted it stays quiet until it answers the interrupting take, 2 s or more later.
const QUIET_MS = 1000

function readWav(path: string): Int16Array {
  const buf = readFileSync(path)
  if (buf.toString('ascii', 0, 4) !== 'RIFF') throw new Error(`${path}: not a WAV file`)
  let off = 12
  let fmtOk = false
  while (off + 8 <= buf.length) {
    const id = buf.toString('ascii', off, off + 4)
    const size = buf.readUInt32LE(off + 4)
    if (id === 'fmt ') fmtOk = buf.readUInt16LE(off + 10) === 1 && buf.readUInt32LE(off + 12) === RATE && buf.readUInt16LE(off + 22) === 16
    if (id === 'data') {
      if (!fmtOk) throw new Error(`${path}: expected 16 kHz mono 16-bit`)
      return new Int16Array(buf.buffer.slice(buf.byteOffset + off + 8, buf.byteOffset + off + 8 + size))
    }
    off += 8 + size + (size % 2)
  }
  throw new Error(`${path}: no data chunk`)
}

const rms = (x: Int16Array) => Math.sqrt(x.reduce((s, v) => s + v * v, 0) / Math.max(1, x.length))

type Take = { name: string; pcm: Int16Array; speechMs: [number, number] }

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
const log = (entry: Record<string, unknown>) => {
  mkdirSync(LOGS, { recursive: true })
  appendFileSync(join(LOGS, 'calltest.jsonl'), JSON.stringify({ at: new Date().toISOString(), label: process.env.LABEL ?? null, ...entry }) + '\n')
  console.log(JSON.stringify(entry))
}

async function main() {
  const [mode, ...wavs] = process.argv.slice(2)
  if (!['latency', 'bargein', 'ask'].includes(mode) || !wavs.length) {
    console.error('usage: node src/call-test.ts latency|bargein|ask <wav> [<wav> ...]')
    process.exit(2)
  }
  const takes: Take[] = []
  for (const wav of wavs) {
    const pcm = readWav(wav)
    takes.push({ name: basename(wav), pcm, speechMs: await speechSpanMs(pcm) })
  }
  const conn = await connection()
  const roomName = conn.room

  // Agent audio: the time of the latest loud frame, and of its first loud frame after a mark.
  let lastLoudAt = 0
  const loudTimes: number[] = [] // every loud agent frame, for the barge-in timeline
  let firstLoudAfter: { mark: number; at: number | null } = { mark: Infinity, at: null }
  const room = new Room()
  // What the agent heard (the caller's speech, transcribed) and what it said, as LiveKit publishes them.
  const transcripts: Array<{ from: 'caller' | 'agent'; text: string }> = []
  room.registerTextStreamHandler('lk.transcription', (reader, sender) => {
    void reader.readAll().then((text) => {
      const own = sender.identity === room.localParticipant?.identity
      const trackOwnerIsCaller = reader.info.attributes?.['lk.transcribed_track_id'] !== undefined &&
        room.localParticipant?.trackPublications.has(reader.info.attributes['lk.transcribed_track_id'])
      const from = own || trackOwnerIsCaller ? 'caller' : 'agent'
      // Each interim version of the caller's speech is its own stream; only the final one counts.
      // (The agent's text comes as one stream per segment, not marked final.)
      if (from === 'caller' && reader.info.attributes?.['lk.transcription_final'] === 'false') return
      if (text.trim()) transcripts.push({ from, text: text.trim() })
    })
  })
  room.on(RoomEvent.TrackSubscribed, async (track: RemoteTrack) => {
    if (track.kind !== TrackKind.KIND_AUDIO) return
    for await (const frame of new AudioStream(track, RATE, 1)) {
      if (rms(frame.data) > LOUD) {
        const now = performance.now()
        lastLoudAt = now
        loudTimes.push(now)
        if (firstLoudAfter.at === null && now > firstLoudAfter.mark) firstLoudAfter.at = now
      }
    }
  })
  await room.connect(conn.url, conn.token, { autoSubscribe: true, dynacast: false })

  // The "microphone": real-time 10 ms frames, silence whenever no take is playing.
  // A 50 ms queue, not the default 1000 ms: captureFrame() returns when a frame is queued, so a
  // long queue would put every "sent" timestamp up to a second ahead of the real audio.
  const source = new AudioSource(RATE, 1, 50)
  await room.localParticipant!.publishTrack(LocalAudioTrack.createAudioTrack('mic', source),
    new TrackPublishOptions({ source: TrackSource.SOURCE_MICROPHONE }))
  let queue: Int16Array[] = []
  // Set by play() from outside this scope; the cast keeps TypeScript from narrowing it to null.
  let onFrameSent = null as ((i: number) => void) | null
  let lastStartWall = 0 // Date.now() of the latest take's speech start, comparable with the agent's log
  let playing = false
  const silence = new Int16Array(FRAME)
  void (async () => {
    for (;;) {
      const f = queue.shift()
      if (f) playing = true
      await source.captureFrame(new AudioFrame(f ?? silence, RATE, 1, FRAME))
      if (f) onFrameSent?.(queue.length)
      if (!queue.length) playing = false
    }
  })()

  // Play a take; resolve with the performance.now() of its first frame and its speech start and end frames.
  function play({ pcm, speechMs }: Take): Promise<{ played: number; start: number; end: number }> {
    const s = Math.floor(speechMs[0] / 10)
    const e = Math.min(Math.ceil(speechMs[1] / 10), Math.floor(pcm.length / FRAME)) - 1
    const frames = Array.from({ length: Math.floor(pcm.length / FRAME) }, (_, i) => pcm.slice(i * FRAME, (i + 1) * FRAME))
    const total = frames.length
    return new Promise((resolve) => {
      let played = 0
      let start = 0
      onFrameSent = (left) => {
        const idx = total - 1 - left
        if (idx === 0) played = performance.now()
        if (idx === s) { start = performance.now(); lastStartWall = Date.now() }
        if (idx === e) { onFrameSent = null; resolve({ played, start, end: performance.now() }) }
      }
      queue = frames
    })
  }
  async function untilAgentQuiet(maxMs = 30000, quietMs = 1500) {
    const t0 = performance.now()
    while (performance.now() - t0 < maxMs) {
      if (lastLoudAt && performance.now() - lastLoudAt > quietMs && !playing) return
      await sleep(50)
    }
  }

  console.log(`room ${roomName}: waiting for the agent's greeting...`)
  const t0 = performance.now()
  while (!lastLoudAt && performance.now() - t0 < 20000) await sleep(50)
  if (!lastLoudAt) throw new Error('no agent audio within 20 s: is the agent worker running?')
  await untilAgentQuiet()

  for (const take of takes) {
    const speech_ms = take.speechMs.map(Math.round)
    if (mode === 'ask') {
      // A real answer can pause after its filler sentence while tools run, so "done" is 4 s of quiet.
      const mark = transcripts.length
      firstLoudAfter = { mark: Infinity, at: null }
      const { end } = await play(take)
      firstLoudAfter.mark = end
      const tWait = performance.now()
      while (firstLoudAfter.at === null && performance.now() - tWait < 20000) await sleep(10)
      await untilAgentQuiet(60000, 4000)
      await sleep(500) // the last transcript segment lands after the audio
      const since = transcripts.slice(mark)
      log({
        mode, take: take.name, speech_ms,
        latency_ms: firstLoudAfter.at === null ? null : Math.round(firstLoudAfter.at - end),
        heard: since.filter((t) => t.from === 'caller').map((t) => t.text).join(' '),
        said: since.filter((t) => t.from === 'agent').map((t) => t.text).join(' '),
      })
    } else if (mode === 'latency') {
      firstLoudAfter = { mark: Infinity, at: null }
      const { end } = await play(take)
      firstLoudAfter.mark = end
      const tWait = performance.now()
      while (firstLoudAfter.at === null && performance.now() - tWait < 10000) await sleep(10)
      log({ mode, take: take.name, speech_ms, latency_ms: firstLoudAfter.at === null ? null : Math.round(firstLoudAfter.at - end) })
      await untilAgentQuiet()
    } else {
      // Ask for the long answer with this take, then interrupt it 2 s into the agent's speech with the same take.
      firstLoudAfter = { mark: Infinity, at: null }
      const { end } = await play(take)
      firstLoudAfter.mark = end
      const tWait = performance.now()
      while (firstLoudAfter.at === null && performance.now() - tWait < 10000) await sleep(10)
      if (firstLoudAfter.at === null) { log({ mode, take: take.name, speech_ms, error: 'no answer to interrupt' }); continue }
      await sleep(2000)
      const { played, start, end: interruptEnd } = await play(take)
      firstLoudAfter = { mark: interruptEnd, at: null } // the agent's answer to the interruption, waited for below
      // Stop time: the first moment the agent's audio stays quiet for QUIET_MS after the take began playing.
      // Timeline: loud/quiet runs of the agent's audio from 1 s before to 4 s after the interruption.
      await sleep(Math.max(0, start + 4000 - performance.now()))
      const runs: string[] = []
      let runStart: number | null = null
      let prev = -Infinity
      for (const t of loudTimes.filter((t) => t >= start - 1000 && t <= start + 4000)) {
        if (runStart === null) runStart = t
        else if (t - prev > 60) { runs.push(`${Math.round(runStart - start)}..${Math.round(prev - start)}`); runStart = t }
        prev = t
      }
      if (runStart !== null) runs.push(`${Math.round(runStart - start)}..${Math.round(prev - start)}`)
      // Stop = the end of the loud stretch the agent was in when the take began playing: the last loud
      // frame before QUIET_MS of quiet. Taken from the timeline, not while waiting, so the agent's next
      // answer can't count. It is followed from the take's first frame, not its first word, because Silero
      // can fire on the breath before the word (2026-10-26); such a stop comes out negative.
      const before = loudTimes.filter((t) => t < played)
      let stopped: number = before.length ? before[before.length - 1] : played
      for (const t of loudTimes.filter((t) => t >= played)) {
        if (t - stopped >= QUIET_MS) break
        stopped = t
      }
      // A try only counts if the agent was talking when the take began; otherwise there was nothing to stop.
      if (!loudTimes.some((t) => t >= played - 300 && t < played)) {
        log({ mode, take: take.name, speech_ms, start_wall: lastStartWall, error: 'agent not speaking when the interruption began', loud_runs_ms: runs.join(' ') })
      } else {
        log({ mode, take: take.name, speech_ms, start_wall: lastStartWall, stop_ms: Math.round(stopped - start), loud_runs_ms: runs.join(' ') })
      }
      // The agent answers the interrupting take, sometimes only after the 4 s window: wait for that answer
      // to start and finish, or the next question lands on top of it.
      const tAnswer = performance.now()
      while (firstLoudAfter.at === null && performance.now() - tAnswer < 10000) await sleep(10)
      await untilAgentQuiet()
    }
  }
  await room.disconnect()
  await conn.end()
  process.exit(0)
}

/** Where to join: through Cognilion's voice-session (as the call button does), or a local room. */
async function connection(): Promise<{ url: string; token: string; room: string; end: () => Promise<void> }> {
  const email = process.env.COGNILION_EMAIL
  if (!email) {
    const at = new AccessToken(process.env.LIVEKIT_API_KEY ?? 'devkey', process.env.LIVEKIT_API_SECRET ?? 'secret',
      { identity: 'call-test', ttl: '15m' })
    const room = `calltest-${Date.now().toString(36)}`
    at.addGrant({ roomJoin: true, room, canPublish: true, canSubscribe: true })
    return { url: process.env.LIVEKIT_URL ?? 'ws://localhost:7880', token: await at.toJwt(), room, end: async () => {} }
  }
  const supabaseUrl = process.env.SUPABASE_URL
  const anonKey = process.env.SUPABASE_ANON_KEY
  if (!supabaseUrl || !anonKey) throw new Error('COGNILION_EMAIL needs SUPABASE_URL and SUPABASE_ANON_KEY')
  const login = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: anonKey, 'content-type': 'application/json' },
    body: JSON.stringify({ email, password: process.env.COGNILION_PASSWORD }),
  })
  if (!login.ok) throw new Error(`sign-in failed: ${login.status}`)
  const jwt = (await login.json()).access_token as string
  const call = (path: string, body: unknown) => fetch(`${supabaseUrl}/functions/v1/voice-session/${path}`, {
    method: 'POST',
    headers: { apikey: anonKey, authorization: `Bearer ${jwt}`, 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
  const started = await call('start', {})
  if (!started.ok) throw new Error(`voice-session/start failed: ${started.status} ${await started.text()}`)
  const s = await started.json() as { url: string; token: string; room: string; session_id: string }
  return { url: s.url, token: s.token, room: s.room, end: async () => void await call('end', { session_id: s.session_id }) }
}

main().catch((e) => { console.error(e); process.exit(1) })
