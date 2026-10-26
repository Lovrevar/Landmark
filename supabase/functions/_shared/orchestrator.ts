// The assistant's agent loop, shared by every channel (plan §4.1): one loop,
// one tool registry, one role gate. What differs per channel comes in through
// three seams:
//
//   - an EventSink, which turns the loop's events into a wire format (chat's SSE
//     events today, OpenAI chunks for voice);
//   - a MessageStore, which persists the rows the loop produces;
//   - LoopHooks, for cancellation and for work after a finished answer.
//
// Persistence order, per iteration:
//   1. stream the model call; text deltas and tool starts go to the sink as they arrive
//   2. persist the assistant row (the durable record comes before the wire frame)
//   3. emit text -> textBlock / tool_use -> toolCall in content-block order
//   4. if tool_use: dispatch the tools concurrently, emit their results, then
//      persist the user-role tool_result row
//   5. otherwise emit done, run onComplete, return

// Pinned to a known-good release with stable AbortSignal support on
// messages.stream. Bump deliberately; do not float on `latest`.
import Anthropic from 'npm:@anthropic-ai/sdk@0.97.0'

import type { AuthContext } from './auth.ts'
import type { Json } from './database.ts'
import { type Channel, findAvailableTool, TOOLS, type ToolHandlerExtras } from './tools.ts'
import { applyMessageCacheBreakpoint } from './context-window.ts'

export const anthropic = new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY') })

// Loose mirror of Anthropic's content-block shapes. Defined locally so we
// don't depend on internal SDK type paths that can shift between versions.
export interface TextBlock { type: 'text'; text: string }
export interface ToolUseBlock { type: 'tool_use'; id: string; name: string; input: unknown }
export type AnthropicBlock =
  | TextBlock
  | ToolUseBlock
  | { type: string; [k: string]: unknown }

export interface ToolResultBlock {
  type: 'tool_result'
  tool_use_id: string
  content: string
  is_error: boolean
}

export interface InMemoryMessage {
  role: 'user' | 'assistant'
  content: unknown
}

export interface Usage { input_tokens: number; output_tokens: number }

/** Where the loop's events go. Chat's sink writes today's SSE events; voice's
 * speaks only the text. Every method may be a no-op for a channel. */
export interface EventSink {
  textDelta(text: string): Promise<void>
  toolStarting(): Promise<void>
  textBlock(text: string): Promise<void>
  toolCall(tool: string, input: unknown, id: string): Promise<void>
  toolResult(tool: string, output: unknown, id: string, isError: boolean): Promise<void>
  done(stopReason: string, usage: Usage): Promise<void>
  error(code: string, message: string): Promise<void>
}

/** One ai_messages row, without its session (the store knows it). */
export interface MessageRow {
  role: 'user' | 'assistant'
  content: Json
  parent_id: string
  model?: string
  input_tokens?: number | null
  output_tokens?: number | null
  stop_reason?: string | null
}

export interface MessageStore {
  /** Persist a row; the new id, or null with the error code on failure. */
  insert(row: MessageRow): Promise<{ id: string | null; code?: string }>
}

export interface LoopHooks {
  /** Checked before each model call and after each round of tools. */
  isCancelled(): Promise<boolean>
  /** After a terminal answer (not after an error or a cancel). */
  onComplete(): Promise<void>
  /** Optional timing marks: model_call, first_event, tools_start, tools_done. */
  mark?(event: string): void
  /** Optional: each model call's token usage, including what the prompt cache served. */
  usage?(usage: { input: number; output: number; cacheRead: number; cacheWrite: number }): void
}

export interface LoopConfig {
  channel: Channel
  model: string
  maxTokens: number
  maxIterations: number
  toolTimeoutMs: number
  system: Array<Record<string, unknown>>
  tools: Array<Record<string, unknown>>
  /** Prefix of every log line, e.g. "[ai-chat]". */
  logTag: string
  /** Further request fields for this channel's model (thinking, output_config, fallbacks). */
  extra?: Record<string, unknown>
  /** Beta headers; when set, the call goes through the beta Messages endpoint. */
  betas?: string[]
}

export interface LoopInput {
  sessionId: string
  messages: InMemoryMessage[]
  /** The row the next one chains off: the user turn just persisted. */
  lastInsertedId: string
  extras: ToolHandlerExtras
}

// ---------------------------------------------------------------------------
// Tool dispatch — used by the loop and by ai-chat's debug branch.
// ---------------------------------------------------------------------------

export async function dispatchTool(
  name: string,
  input: unknown,
  ctx: AuthContext,
  extras: ToolHandlerExtras,
  channel: Channel = 'chat',
): Promise<unknown> {
  // Role and channel gate at dispatch, not just at advertisement: the name
  // comes from the model's response, so it is checked again here against what
  // this role may invoke on this channel. A refusal surfaces to the model as an
  // is_error tool_result via dispatchToolWithTimeout.
  const tool = findAvailableTool(ctx, name, channel)
  if (!tool) {
    const exists = TOOLS.some((t) => t.name === name)
    const forRole = exists && findAvailableTool(ctx, name) !== undefined
    const reason = !exists ? 'unknown_tool' : forRole ? 'not_permitted_on_channel' : 'not_permitted_for_role'
    console.warn(`[${channel === 'voice' ? 'voice-llm' : 'ai-chat'}] tool refused at dispatch`, {
      userId: ctx.userId,
      role: ctx.role,
      tool: name,
      reason,
    })
    throw new Error(
      reason === 'unknown_tool' ? `unknown tool: ${name}`
        : reason === 'not_permitted_on_channel' ? `tool not permitted on ${channel}: ${name}`
        : `tool not permitted for role: ${name}`,
    )
  }
  return await tool.handler(input as Record<string, unknown>, ctx, extras)
}

// Race the tool handler against a timeout (15 s for chat) and normalise failure modes
// into a single envelope shape. Handlers also signal failure via a returned
// { error: '...' } object without throwing — we treat that as is_error too.
export async function dispatchToolWithTimeout(
  name: string,
  input: unknown,
  ctx: AuthContext,
  extras: ToolHandlerExtras,
  timeoutMs = 15000,
  channel: Channel = 'chat',
): Promise<{ output: unknown; isError: boolean }> {
  try {
    const output = await Promise.race([
      dispatchTool(name, input, ctx, extras, channel),
      new Promise<never>((_, rej) =>
        setTimeout(() => rej(new Error('tool_timeout')), timeoutMs),
      ),
    ])
    // Intentional: domain 'not found' surfaces as is_error to the model in v1; revisit if it causes retry loops.
    const isErrorEnvelope =
      output !== null &&
      typeof output === 'object' &&
      'error' in (output as Record<string, unknown>)
    return { output, isError: isErrorEnvelope }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return { output: { error: `tool execution failed: ${message}` }, isError: true }
  }
}

// Map an Anthropic SDK error to a user-facing event code + Croatian message,
// plus a flag telling the caller whether to log loudly. `shouldLog: true`
// covers (a) our-fault errors (bad request shape, bad API key) and (b) the
// unknown-error fall-through so we never silently swallow a class we haven't
// mapped yet. Rate-limit / timeout / unreachable are expected operational
// states and don't pollute the log.
//
// APIConnectionTimeoutError must be checked before APIConnectionError —
// it's a subclass.
export function mapAnthropicError(err: unknown): { code: string; message: string; shouldLog: boolean } {
  if (err instanceof Anthropic.RateLimitError) {
    return {
      code: 'model_rate_limited',
      message: 'Model je trenutno preopterećen. Pokušajte ponovno za nekoliko trenutaka.',
      shouldLog: false,
    }
  }
  if (err instanceof Anthropic.APIConnectionTimeoutError) {
    return {
      code: 'model_timeout',
      message: 'Model nije odgovorio na vrijeme. Pokušajte ponovno.',
      shouldLog: false,
    }
  }
  if (err instanceof Anthropic.APIConnectionError) {
    return {
      code: 'model_unreachable',
      message: 'Greška u komunikaciji s modelom. Pokušajte ponovno.',
      shouldLog: false,
    }
  }
  if (err instanceof Anthropic.BadRequestError) {
    return {
      code: 'model_bad_request',
      message: 'Interna greška pri pripremi upita. Prijavite ovo administratoru.',
      shouldLog: true,
    }
  }
  if (err instanceof Anthropic.AuthenticationError) {
    return {
      code: 'model_auth_failed',
      message: 'Greška u autentikaciji s modelom. Prijavite ovo administratoru.',
      shouldLog: true,
    }
  }
  return {
    code: 'model_error',
    message: 'Greška pri pozivu modela. Pokušajte ponovno.',
    shouldLog: true,
  }
}

// ---------------------------------------------------------------------------
// The loop
// ---------------------------------------------------------------------------

export async function runOrchestrationLoop(
  ctx: AuthContext,
  config: LoopConfig,
  input: LoopInput,
  sink: EventSink,
  store: MessageStore,
  hooks: LoopHooks,
  signal: AbortSignal,
): Promise<void> {
  const { sessionId, messages, extras } = input
  const { model, logTag } = config
  let lastInsertedId: string = input.lastInsertedId
  let lastUsage: Usage = { input_tokens: 0, output_tokens: 0 }

  for (let iteration = 0; iteration < config.maxIterations; iteration++) {
    // Iteration boundary: bail before issuing the next Anthropic call.
    if (await hooks.isCancelled()) return

    // Slide the prompt-cache breakpoint onto the current last message so the
    // whole conversation-so-far becomes a cacheable prefix for the next call.
    applyMessageCacheBreakpoint(messages)

    // Streamed, so text can be passed on as it arrives (voice, §3.1 of the plan).
    // finalMessage() is the same complete Message that messages.create returned,
    // so persistence and the events below are unchanged.
    let response: Awaited<ReturnType<ReturnType<typeof anthropic.messages.stream>['finalMessage']>>
    hooks.mark?.('model_call')
    let firstEvent = true
    try {
      const params = {
        model,
        max_tokens: config.maxTokens,
        system: config.system as unknown as Parameters<typeof anthropic.messages.create>[0]['system'],
        tools: config.tools as unknown as Parameters<typeof anthropic.messages.create>[0]['tools'],
        messages: messages as unknown as Parameters<typeof anthropic.messages.create>[0]['messages'],
        ...config.extra,
      }
      // The beta endpoint streams the same events and final message; only its
      // types are wider, so it is read through the stable stream's type.
      const stream = config.betas?.length
        ? anthropic.beta.messages.stream({ ...params, betas: config.betas } as never, { signal }) as unknown as ReturnType<typeof anthropic.messages.stream>
        : anthropic.messages.stream(params, { signal })
      for await (const ev of stream) {
        if (firstEvent && (ev.type === 'content_block_start' || ev.type === 'content_block_delta')) {
          firstEvent = false
          hooks.mark?.('first_event')
        }
        if (ev.type === 'content_block_delta' && ev.delta.type === 'text_delta') {
          await sink.textDelta(ev.delta.text)
        } else if (ev.type === 'content_block_start' && ev.content_block.type === 'tool_use') {
          await sink.toolStarting()
        }
      }
      response = await stream.finalMessage()
      hooks.usage?.({
        input: response.usage?.input_tokens ?? 0,
        output: response.usage?.output_tokens ?? 0,
        cacheRead: response.usage?.cache_read_input_tokens ?? 0,
        cacheWrite: response.usage?.cache_creation_input_tokens ?? 0,
      })
    } catch (err) {
      // If the abort fired, the SDK's thrown error is a consequence — swallow
      // it. Caller decides whether to log a 'client_disconnect' line or emit
      // the 'request_timeout' error event based on which source aborted us.
      if (signal.aborted) {
        console.log(`${logTag} anthropic call aborted`, {
          userId: ctx.userId,
          sessionId,
          iteration,
        })
        return
      }
      const mapped = mapAnthropicError(err)
      if (mapped.shouldLog) {
        const errorClass = err instanceof Error ? err.constructor.name : typeof err
        const errorMessage = err instanceof Error ? err.message : String(err)
        console.error(`${logTag} anthropic call failed`, {
          userId: ctx.userId,
          sessionId,
          iteration,
          errorClass,
          // Truncate to keep accidental content out of logs. No request body,
          // no system prompt, no message content is logged anywhere on this path.
          errorMessage: errorMessage.slice(0, 200),
        })
      }
      await sink.error(mapped.code, mapped.message)
      return
    }

    lastUsage = {
      input_tokens: response.usage?.input_tokens ?? 0,
      output_tokens: response.usage?.output_tokens ?? 0,
    }

    // Persist assistant row BEFORE emitting any of its events. The DB row is
    // the durable contract; the wire is a projection of it. parent_id chains
    // off whatever row was inserted last on this request — initially the
    // user turn, then assistant ↔ tool_result alternation through the loop.
    const assistantRow = await store.insert({
      role: 'assistant',
      content: response.content as unknown as Json,
      model: response.model ?? model,
      input_tokens: response.usage?.input_tokens ?? null,
      output_tokens: response.usage?.output_tokens ?? null,
      stop_reason: response.stop_reason ?? null,
      parent_id: lastInsertedId,
    })

    if (!assistantRow.id) {
      console.error(`${logTag} assistant message insert failed`, {
        userId: ctx.userId,
        sessionId,
        iteration,
        code: assistantRow.code,
      })
      await sink.error('persistence_error', 'Greška pri spremanju odgovora.')
      return
    }

    lastInsertedId = assistantRow.id
    messages.push({ role: 'assistant', content: response.content })

    // Emit events in content-block order: text -> textBlock, tool_use -> toolCall.
    const toolUses: ToolUseBlock[] = []
    for (const block of response.content as AnthropicBlock[]) {
      if (block.type === 'text') {
        await sink.textBlock((block as TextBlock).text)
      } else if (block.type === 'tool_use') {
        const t = block as ToolUseBlock
        toolUses.push(t)
        await sink.toolCall(t.name, t.input, t.id)
      }
      // Unknown block types (e.g. thinking) are silently skipped — they are
      // still persisted in the assistant row above for fidelity.
    }

    const stopReason = response.stop_reason ?? 'end_turn'

    // Defensive guard: if the SDK reports stop_reason='tool_use' but no
    // tool_use blocks were emitted in this turn, there's nothing to dispatch.
    // Treat as terminal so we don't persist an empty tool_result row or
    // re-loop into the model with no new information.
    if (stopReason === 'tool_use' && toolUses.length === 0) {
      await sink.done(stopReason, lastUsage)
      await hooks.onComplete()
      return
    }

    if (stopReason === 'tool_use') {
      // The tools the model asked for in one turn are independent (a call that
      // needs another's output can only come in a later turn), so they run
      // concurrently, each with its own timeout (plan §3.2). Results go back in
      // tool_use order, as events and in a single tool_result row.
      hooks.mark?.('tools_start')
      const results = await Promise.all(
        toolUses.map((tu) => dispatchToolWithTimeout(tu.name, tu.input, ctx, extras, config.toolTimeoutMs, config.channel)),
      )
      hooks.mark?.('tools_done')
      // After-dispatch boundary: if the user cancelled while the tools ran,
      // drop the results on the floor — no event, no DB row.
      if (await hooks.isCancelled()) return
      const toolResultBlocks: ToolResultBlock[] = []
      for (const [i, tu] of toolUses.entries()) {
        const { output, isError } = results[i]
        await sink.toolResult(tu.name, output, tu.id, isError)
        toolResultBlocks.push({
          type: 'tool_result',
          tool_use_id: tu.id,
          // Anthropic's API requires `content` to be a string here.
          content: JSON.stringify(output),
          is_error: isError,
        })
      }

      const toolResultRow = await store.insert({
        role: 'user',
        content: toolResultBlocks as unknown as Json,
        parent_id: lastInsertedId,
      })

      if (!toolResultRow.id) {
        console.error(`${logTag} tool_result insert failed`, {
          userId: ctx.userId,
          sessionId,
          iteration,
          code: toolResultRow.code,
        })
        await sink.error('persistence_error', 'Greška pri spremanju rezultata alata.')
        return
      }

      lastInsertedId = toolResultRow.id
      messages.push({ role: 'user', content: toolResultBlocks })
      continue
    }

    // Truncation guard. A terminal stop_reason (almost always 'max_tokens')
    // with tool_use blocks present means the model ran out of output budget
    // MID tool-call — e.g. while authoring a large create_document payload.
    // The tool_call events were already emitted, so the client now has
    // spinners that would never resolve. Close them out: synthesize error
    // tool_results, persist them (so a history reload stays consistent),
    // and tell the user what happened.
    if (toolUses.length > 0) {
      console.warn(`${logTag} response truncated mid tool_use`, {
        userId: ctx.userId,
        sessionId,
        iteration,
        stopReason,
        toolCount: toolUses.length,
      })
      const truncationOutput = { error: 'response truncated before the tool call completed' }
      const toolResultBlocks: ToolResultBlock[] = []
      for (const tu of toolUses) {
        await sink.toolResult(tu.name, truncationOutput, tu.id, true)
        toolResultBlocks.push({
          type: 'tool_result',
          tool_use_id: tu.id,
          content: JSON.stringify(truncationOutput),
          is_error: true,
        })
      }
      const truncResultRow = await store.insert({
        role: 'user',
        content: toolResultBlocks as unknown as Json,
        parent_id: lastInsertedId,
      })

      // The document message only when a document was being written; a voice
      // reply cut off mid tool call is not about a document.
      const truncationText = stopReason === 'max_tokens' && toolUses.some((tu) => tu.name === 'create_document')
        ? 'Dokument je prevelik da bi stao u jedan odgovor. Zatražite kraći dokument ili ga podijelite na više manjih.'
        : 'Odgovor nije dovršen. Pokušajte ponovno.'
      const truncationContent: TextBlock[] = [{ type: 'text', text: truncationText }]
      if (truncResultRow.id) {
        await store.insert({
          role: 'assistant',
          content: truncationContent as unknown as Json,
          model: response.model ?? model,
          stop_reason: stopReason,
          parent_id: truncResultRow.id,
        })
      }
      await sink.textBlock(truncationText)
      await sink.done(stopReason, lastUsage)
      await hooks.onComplete()
      return
    }

    // Terminal stop_reason (end_turn, max_tokens, stop_sequence, or anything
    // else surfaced by the SDK). Emit done with the raw value — don't normalise.
    await sink.done(stopReason, lastUsage)
    await hooks.onComplete()
    return
  }

  // ---- Iteration cap reached without a terminal stop_reason ----
  console.error(`${logTag} tool iteration limit reached`, {
    userId: ctx.userId,
    sessionId,
  })

  const limitMessage = 'Dostignut je limit poziva alata. Pokušajte preformulirati pitanje.'
  const limitContent: TextBlock[] = [{ type: 'text', text: limitMessage }]
  const limitRow = await store.insert({
    role: 'assistant',
    content: limitContent as unknown as Json,
    model,
    input_tokens: lastUsage.input_tokens,
    output_tokens: lastUsage.output_tokens,
    stop_reason: 'tool_limit_reached',
    parent_id: lastInsertedId,
  })
  if (!limitRow.id) {
    console.error(`${logTag} limit message insert failed`, {
      userId: ctx.userId,
      sessionId,
      code: limitRow.code,
    })
  }

  await sink.textBlock(limitMessage)
  await sink.done('tool_limit_reached', lastUsage)
  await hooks.onComplete()
}
