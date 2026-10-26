// The conversation the voice agent sends, turned into Anthropic messages
// (plan §7). The agent owns the call's history and sends all of it every turn;
// it is caller-influenced input, so it is bounded and cleaned here:
//
//   - every `system` message is dropped: our system prompt is built
//     server-side and cannot be negotiated;
//   - only user and assistant text is kept (the agent never sees our tool
//     calls), consecutive messages of one role are merged;
//   - at most MAX_MESSAGES are kept, cut so the first is a user turn (the API
//     requires it; it also drops the agent's greeting);
//   - the last message must be the user's, or there is nothing to answer.

import type { InMemoryMessage } from '../_shared/orchestrator.ts'

export const MAX_MESSAGES = 20

export interface OpenAiMessage {
  role?: unknown
  content?: unknown
}

function textOf(content: unknown): string {
  if (typeof content === 'string') return content
  if (Array.isArray(content)) {
    return content
      .map((p) => (p && typeof p === 'object' && (p as { type?: unknown }).type === 'text'
        ? String((p as { text?: unknown }).text ?? '')
        : ''))
      .join('')
  }
  return ''
}

/** Anthropic messages for the loop, or null when there is no user turn to answer. */
export function toAnthropicMessages(input: unknown): InMemoryMessage[] | null {
  if (!Array.isArray(input)) return null
  const merged: Array<{ role: 'user' | 'assistant'; text: string }> = []
  for (const m of input as OpenAiMessage[]) {
    if (m?.role !== 'user' && m?.role !== 'assistant') continue
    const text = textOf(m.content).trim()
    if (!text) continue
    const last = merged[merged.length - 1]
    if (last && last.role === m.role) last.text += `\n${text}`
    else merged.push({ role: m.role, text })
  }
  let kept = merged.slice(-MAX_MESSAGES)
  const firstUser = kept.findIndex((m) => m.role === 'user')
  if (firstUser === -1) return null
  kept = kept.slice(firstUser)
  if (kept[kept.length - 1].role !== 'user') return null
  return kept.map((m) => ({ role: m.role, content: [{ type: 'text', text: m.text }] }))
}
