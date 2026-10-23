// Placeholder LLM for the prototype: an OpenAI-compatible chat.completions endpoint that
// streams a fixed Croatian answer. Phase 0's latency gate is defined with a platform default
// LLM, not our assistant, so this stands in for it with a known, configurable first-token delay.
//
//   STUB_FIRST_TOKEN_MS (default 400)  delay before the first token, a typical model's ttft
//   STUB_PORT           (default 8787)
//   STUB_ANSWER         auto (default) | short | long
//
// In auto mode a question gets a short answer, and "pregled" / "duže" / "nastavi" a long one
// (about 15 s of speech), which is what the barge-in test interrupts. src/call-test.ts bargein
// needs STUB_ANSWER=long, since its recorded questions don't say "pregled".

import { createServer } from 'node:http'

const PORT = Number(process.env.STUB_PORT ?? 8787)
const FIRST_TOKEN_MS = Number(process.env.STUB_FIRST_TOKEN_MS ?? 400)

const SHORT = 'Razumijem. Na projektu Tar trenutno imamo trideset dva ugovora, a posljednji račun stigao je šesnaestog veljače.'
const LONG =
  'Evo kratkog pregleda. Na projektu Tar trenutno imamo trideset dva ugovora s ukupno sedamdeset računa. ' +
  'Najveći izvođač je El Roj, a fasada kasni otprilike dva tjedna. Proračun druge faze iznosi milijun dvjesto tisuća eura, ' +
  'od čega je ugovoreno nešto više od polovice. Nadzorni inženjer ovjerio je treću situaciju, a okončana situacija ' +
  'očekuje se nakon primopredaje. Ako želite, mogu vam pročitati i popis neplaćenih računa po izvođačima.'

type Msg = { role: string; content?: string | Array<{ type: string; text?: string }> }

function lastUserText(messages: Msg[]): string {
  const m = [...messages].reverse().find((x) => x.role === 'user')
  if (!m?.content) return ''
  return typeof m.content === 'string' ? m.content : m.content.map((p) => p.text ?? '').join(' ')
}

function chunk(id: string, model: string, delta: Record<string, unknown>, finish: string | null = null) {
  return `data: ${JSON.stringify({ id, object: 'chat.completion.chunk', created: Math.floor(Date.now() / 1000), model,
    choices: [{ index: 0, delta, finish_reason: finish }] })}\n\n`
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

createServer(async (req, res) => {
  if (req.method === 'GET' && req.url?.startsWith('/v1/models')) {
    res.writeHead(200, { 'content-type': 'application/json' })
    res.end(JSON.stringify({ object: 'list', data: [{ id: 'stub', object: 'model', owned_by: 'prototype' }] }))
    return
  }
  if (req.method !== 'POST' || !req.url?.startsWith('/v1/chat/completions')) {
    res.writeHead(404).end()
    return
  }
  let raw = ''
  for await (const part of req) raw += part
  const body = JSON.parse(raw) as { model?: string; messages?: Msg[]; stream?: boolean }
  const asked = lastUserText(body.messages ?? [])
  const mode = process.env.STUB_ANSWER ?? 'auto'
  const answer = mode === 'long' || (mode === 'auto' && /priča|duže|nastavi|pregled/i.test(asked)) ? LONG : SHORT
  const id = `chatcmpl-stub-${Date.now()}`
  const model = body.model ?? 'stub'
  console.log(`[stub-llm] "${asked.slice(0, 80)}" -> ${answer === LONG ? 'long' : 'short'} answer`)

  if (!body.stream) {
    await sleep(FIRST_TOKEN_MS)
    res.writeHead(200, { 'content-type': 'application/json' })
    res.end(JSON.stringify({ id, object: 'chat.completion', model,
      choices: [{ index: 0, message: { role: 'assistant', content: answer }, finish_reason: 'stop' }] }))
    return
  }
  res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache', connection: 'keep-alive' })
  await sleep(FIRST_TOKEN_MS)
  res.write(chunk(id, model, { role: 'assistant', content: '' }))
  for (const word of answer.split(/(?<= )/)) {
    if (res.destroyed) return // the agent cancelled the reply (barge-in)
    res.write(chunk(id, model, { content: word }))
    await sleep(15) // a fast model's token rate; the voice is the bottleneck, not this
  }
  res.write(chunk(id, model, {}, 'stop'))
  res.write(`data: ${JSON.stringify({ id, object: 'chat.completion.chunk', model, choices: [],
    usage: { prompt_tokens: 50, completion_tokens: answer.split(' ').length, total_tokens: 50 + answer.split(' ').length } })}\n\n`)
  res.end('data: [DONE]\n\n')
}).listen(PORT, '127.0.0.1', () => console.log(`[stub-llm] http://127.0.0.1:${PORT}/v1, first token after ${FIRST_TOKEN_MS} ms`))
