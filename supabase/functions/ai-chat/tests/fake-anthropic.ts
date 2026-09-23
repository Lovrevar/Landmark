// Scripted stand-in for the Anthropic Messages API (`POST /v1/messages`).
//
// It fakes the API, not the SDK. The function under test keeps its real
// `@anthropic-ai/sdk` client; ANTHROPIC_BASE_URL points it here. That is why
// one fake serves both call styles the orchestrator will go through:
//
//   - `messages.create`  (today)  → a JSON `Message` body
//   - `messages.stream`  (after the phase-2 refactor) → the same message as an
//     SSE event stream (message_start, content_block_*, message_delta,
//     message_stop), which the SDK reassembles into an identical `finalMessage()`
//
// The characterisation suite must survive that refactor unchanged, and this is
// what makes it possible. `fake-anthropic.test.ts` proves both paths yield the
// same message.
//
// It also enforces the real API's conversation-shape rules (see
// `validateConversation`), so a history the orchestrator builds that the real
// API would reject is rejected here too, not silently accepted.

export type Block =
  | { type: 'text'; text: string }
  | { type: 'tool_use'; id: string; name: string; input: unknown }
  | { type: 'thinking'; thinking: string; signature: string }

export interface ScriptedTurn {
  content: Block[]
  stop_reason: string
  usage?: { input_tokens: number; output_tokens: number }
  model?: string
}

export type Scripted =
  | ScriptedTurn
  | { error: { status: number; type: string; message: string } }
  | { hangUntilAborted: true }
  | { connectionError: true }
  | ((req: CapturedCall) => Scripted)

export interface CapturedCall {
  body: {
    model: string
    max_tokens: number
    stream?: boolean
    system?: unknown
    tools?: Array<{ name: string; description: string; cache_control?: unknown }>
    messages: Array<{ role: string; content: unknown }>
  }
  headers: Headers
}

let toolIdCounter = 0
export function toolUse(name: string, input: unknown): Extract<Block, { type: 'tool_use' }> {
  return { type: 'tool_use', id: `toolu_fake_${++toolIdCounter}`, name, input }
}
export function text(t: string): Extract<Block, { type: 'text' }> {
  return { type: 'text', text: t }
}
export function answer(t: string, usage = { input_tokens: 100, output_tokens: 20 }): ScriptedTurn {
  return { content: [text(t)], stop_reason: 'end_turn', usage }
}
export function callTools(...blocks: Block[]): ScriptedTurn {
  return { content: blocks, stop_reason: 'tool_use', usage: { input_tokens: 120, output_tokens: 30 } }
}

export class FakeAnthropic {
  private queue: Scripted[] = []
  calls: CapturedCall[] = []
  /** Calls that arrived with nothing scripted. A test should end with zero. */
  unexpectedCalls = 0
  /** Why each request was refused by the conversation-shape rules, in order. */
  rejections: string[] = []
  validate = true
  private msgCounter = 0

  reset(): void {
    this.queue = []
    this.calls = []
    this.unexpectedCalls = 0
    this.rejections = []
    this.validate = true
  }

  script(...turns: Scripted[]): void {
    this.queue.push(...turns)
  }

  get remaining(): number {
    return this.queue.length
  }

  async handle(req: Request): Promise<Response> {
    if (new URL(req.url).pathname !== '/v1/messages') {
      return apiError(404, 'not_found_error', 'fake-anthropic: only /v1/messages is implemented')
    }
    const body = JSON.parse(await req.text()) as CapturedCall['body']
    const call: CapturedCall = { body, headers: req.headers }
    this.calls.push(call)

    if (this.validate) {
      const problem = validateConversation(body.messages)
      if (problem) {
        this.rejections.push(problem)
        return apiError(400, 'invalid_request_error', problem)
      }
    }

    const queued = this.queue.shift()
    if (queued === undefined) {
      this.unexpectedCalls++
      return apiError(400, 'invalid_request_error', 'fake-anthropic: no scripted response left')
    }
    const next = resolve(queued, call)
    if ('error' in next) return apiError(next.error.status, next.error.type, next.error.message)
    if ('connectionError' in next) throw new TypeError('fake-anthropic: connection refused')
    if ('hangUntilAborted' in next) {
      return await new Promise<Response>((_, reject) => {
        const abort = () => reject(new DOMException('The operation was aborted.', 'AbortError'))
        if (req.signal.aborted) abort()
        req.signal.addEventListener('abort', abort, { once: true })
      })
    }

    const message = {
      id: `msg_fake_${++this.msgCounter}`,
      type: 'message',
      role: 'assistant',
      model: next.model ?? body.model,
      content: next.content,
      stop_reason: next.stop_reason,
      stop_sequence: null,
      usage: {
        input_tokens: next.usage?.input_tokens ?? 100,
        output_tokens: next.usage?.output_tokens ?? 20,
        cache_creation_input_tokens: 0,
        cache_read_input_tokens: 0,
      },
    }
    if (!body.stream) {
      return new Response(JSON.stringify(message), { status: 200, headers: { 'content-type': 'application/json' } })
    }
    return new Response(sseFor(message), { status: 200, headers: { 'content-type': 'text/event-stream' } })
  }
}

type Resolved = Exclude<Scripted, (req: CapturedCall) => Scripted>
function resolve(s: Scripted, call: CapturedCall): Resolved {
  let cur = s
  while (typeof cur === 'function') cur = cur(call)
  return cur as Resolved
}

function apiError(status: number, type: string, message: string): Response {
  return new Response(JSON.stringify({ type: 'error', error: { type, message } }), {
    status,
    // Stop the SDK's automatic retries (2 by default for 408/409/429/5xx) so a
    // scripted error surfaces on the first call.
    headers: { 'content-type': 'application/json', 'x-should-retry': 'false' },
  })
}

/**
 * The shape rules of the real Messages API that an orchestrator can break:
 * the conversation must start with a user turn, and every `tool_use` in an
 * assistant turn must be answered by a `tool_result` with the same id in the
 * immediately following user turn, which must not answer anything else. The
 * real API returns 400 invalid_request_error for each.
 */
export function validateConversation(messages: Array<{ role: string; content: unknown }>): string | null {
  if (!messages?.length) return 'messages: at least one message is required'
  if (messages[0].role !== 'user') return 'messages: first message must use the "user" role'
  const blocks = (m: { content: unknown }) =>
    Array.isArray(m.content) ? (m.content as Array<{ type: string; id?: string; tool_use_id?: string }>) : []
  for (let i = 0; i < messages.length; i++) {
    const m = messages[i]
    const next = messages[i + 1]
    const uses = m.role === 'assistant' ? blocks(m).filter((b) => b.type === 'tool_use').map((b) => b.id) : []
    if (uses.length > 0) {
      const results = next && next.role === 'user'
        ? blocks(next).filter((b) => b.type === 'tool_result').map((b) => b.tool_use_id)
        : []
      const missing = uses.filter((id) => !results.includes(id))
      if (missing.length > 0) {
        return `messages.${i + 1}: \`tool_use\` ids were found without \`tool_result\` blocks immediately after: ${missing.join(', ')}`
      }
    }
    if (m.role === 'user') {
      const prev = messages[i - 1]
      const prevUses = prev && prev.role === 'assistant'
        ? blocks(prev).filter((b) => b.type === 'tool_use').map((b) => b.id)
        : []
      const orphan = blocks(m).filter((b) => b.type === 'tool_result' && !prevUses.includes(b.tool_use_id))
      if (orphan.length > 0) {
        return `messages.${i}: unexpected \`tool_use_id\` found in \`tool_result\` blocks: ${orphan[0].tool_use_id}`
      }
    }
  }
  return null
}

function sseFor(message: { content: Block[]; stop_reason: string; usage: { output_tokens: number } } & Record<string, unknown>): ReadableStream<Uint8Array> {
  const enc = new TextEncoder()
  const frames: string[] = []
  const emit = (event: string, data: unknown) => frames.push(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
  emit('message_start', {
    type: 'message_start',
    message: { ...message, content: [], stop_reason: null, usage: { ...message.usage, output_tokens: 1 } },
  })
  message.content.forEach((block, index) => {
    if (block.type === 'text') {
      emit('content_block_start', { type: 'content_block_start', index, content_block: { type: 'text', text: '' } })
      for (const chunk of chunks(block.text, 8)) {
        emit('content_block_delta', { type: 'content_block_delta', index, delta: { type: 'text_delta', text: chunk } })
      }
    } else if (block.type === 'tool_use') {
      emit('content_block_start', {
        type: 'content_block_start',
        index,
        content_block: { type: 'tool_use', id: block.id, name: block.name, input: {} },
      })
      for (const chunk of chunks(JSON.stringify(block.input), 12)) {
        emit('content_block_delta', { type: 'content_block_delta', index, delta: { type: 'input_json_delta', partial_json: chunk } })
      }
    } else {
      emit('content_block_start', {
        type: 'content_block_start',
        index,
        content_block: { type: 'thinking', thinking: '', signature: '' },
      })
      emit('content_block_delta', { type: 'content_block_delta', index, delta: { type: 'thinking_delta', thinking: block.thinking } })
      emit('content_block_delta', { type: 'content_block_delta', index, delta: { type: 'signature_delta', signature: block.signature } })
    }
    emit('content_block_stop', { type: 'content_block_stop', index })
  })
  emit('message_delta', {
    type: 'message_delta',
    delta: { stop_reason: message.stop_reason, stop_sequence: null },
    usage: { output_tokens: message.usage.output_tokens },
  })
  emit('message_stop', { type: 'message_stop' })
  return new ReadableStream({
    start(controller) {
      for (const f of frames) controller.enqueue(enc.encode(f))
      controller.close()
    },
  })
}

function chunks(s: string, size: number): string[] {
  if (s.length === 0) return ['']
  const out: string[] = []
  for (let i = 0; i < s.length; i += size) out.push(s.slice(i, i + size))
  return out
}
