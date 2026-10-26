// Server-sent events for ai-chat: the writer (framing + idle heartbeat) and the
// chat channel's EventSink, which emits the six events the chat frontend reads.

import type { EventSink, Usage } from './orchestrator.ts'

// SSE keepalive cadence. Proxies and browsers close idle TCP connections
// after ~30–60s; a single slow tool roundtrip easily exceeds that, so we
// emit `: keepalive` comments while the loop is between real events. Resets
// on every real write.
const HEARTBEAT_INTERVAL_MS = 15_000

export type Event =
  | { type: 'session'; session_id: string }
  | { type: 'turn'; role: 'assistant'; text: string }
  | { type: 'tool_call'; tool: string; input: unknown; tool_use_id: string }
  | { type: 'tool_result'; tool: string; output: unknown; tool_use_id: string; is_error: boolean }
  | { type: 'done'; stop_reason: string; usage: { input_tokens: number; output_tokens: number } }
  | { type: 'error'; code: string; message: string }

// ---------------------------------------------------------------------------
// SSE writer: SSE framing + idle-heartbeat in one helper. Owns a single
// heartbeat timer that fires every HEARTBEAT_INTERVAL_MS unless a real write
// (event or comment) resets it. close() is idempotent — safe to call from a
// finally block even if an earlier write already closed the underlying writer.
// ---------------------------------------------------------------------------

export class SSEWriter {
  private readonly writer: WritableStreamDefaultWriter<Uint8Array>
  private readonly encoder = new TextEncoder()
  private heartbeatTimer: number | undefined
  private closed = false
  // Third disconnect-detection source: when any write throws, the underlying
  // socket is dead. Invoked exactly once. Used by ai-chat's streamChatResponse to trip
  // the per-request AbortController even if req.signal and writer.closed both
  // miss the event (which is what we suspect is happening in Supabase's Edge
  // runtime — the BadResource error suggests Deno sees the dead socket but
  // never propagates it as a clean signal to user code).
  private readonly onWriteFailure: (() => void) | undefined
  private writeFailureFired = false

  constructor(
    writer: WritableStreamDefaultWriter<Uint8Array>,
    onWriteFailure?: () => void,
  ) {
    this.writer = writer
    this.onWriteFailure = onWriteFailure
    this.scheduleHeartbeat()
  }

  private notifyWriteFailure(): void {
    if (this.writeFailureFired) return
    this.writeFailureFired = true
    // Mark closed so subsequent writes are silent no-ops.
    this.closed = true
    if (this.heartbeatTimer !== undefined) {
      clearTimeout(this.heartbeatTimer)
      this.heartbeatTimer = undefined
    }
    this.onWriteFailure?.()
  }

  private scheduleHeartbeat(): void {
    if (this.closed) return
    if (this.heartbeatTimer !== undefined) {
      clearTimeout(this.heartbeatTimer)
    }
    this.heartbeatTimer = setTimeout(() => {
      if (this.closed) return
      // Use the heartbeat as a live-connection probe: if the write throws,
      // the socket is gone — notify so the parent can abort the SDK call.
      this.writer.write(this.encoder.encode(': keepalive\n\n'))
        .then(() => this.scheduleHeartbeat())
        .catch(() => this.notifyWriteFailure())
    }, HEARTBEAT_INTERVAL_MS)
  }

  async writeEvent<E extends Event>(name: E['type'], data: E): Promise<void> {
    if (this.closed) return
    try {
      await this.writer.write(
        this.encoder.encode(`event: ${name}\ndata: ${JSON.stringify(data)}\n\n`),
      )
      this.scheduleHeartbeat()
    } catch {
      this.notifyWriteFailure()
    }
  }

  async writeComment(text: string): Promise<void> {
    if (this.closed) return
    try {
      await this.writer.write(this.encoder.encode(`: ${text}\n\n`))
      this.scheduleHeartbeat()
    } catch {
      this.notifyWriteFailure()
    }
  }

  async close(): Promise<void> {
    if (this.closed) return
    this.closed = true
    if (this.heartbeatTimer !== undefined) {
      clearTimeout(this.heartbeatTimer)
      this.heartbeatTimer = undefined
    }
    try {
      await this.writer.close()
    } catch {
      // already closed
    }
  }
}

/** Chat's sink: today's events, one per whole block. Text deltas and tool
 * starts are not sent; the chat frontend renders whole turns. */
export class SseEventSink implements EventSink {
  constructor(private readonly sse: SSEWriter) {}
  async textDelta(_text: string): Promise<void> {}
  async toolStarting(): Promise<void> {}
  async textBlock(text: string): Promise<void> {
    await this.sse.writeEvent('turn', { type: 'turn', role: 'assistant', text })
  }
  async toolCall(tool: string, input: unknown, id: string): Promise<void> {
    await this.sse.writeEvent('tool_call', { type: 'tool_call', tool, input, tool_use_id: id })
  }
  async toolResult(tool: string, output: unknown, id: string, isError: boolean): Promise<void> {
    await this.sse.writeEvent('tool_result', { type: 'tool_result', tool, output, tool_use_id: id, is_error: isError })
  }
  async done(stopReason: string, usage: Usage): Promise<void> {
    await this.sse.writeEvent('done', { type: 'done', stop_reason: stopReason, usage })
  }
  async error(code: string, message: string): Promise<void> {
    await this.sse.writeEvent('error', { type: 'error', code, message })
  }
}
