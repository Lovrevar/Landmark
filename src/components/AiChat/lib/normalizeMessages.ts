import type { AiChatEvent, AiMessageRow } from '../../../types/aiChat'

export type RenderMessage =
  | { kind: 'user'; id: string; text: string; createdAt: string }
  | { kind: 'assistant'; id: string; text: string; createdAt: string }
  | {
      kind: 'tool'
      id: string
      tool: string
      toolUseId: string
      status: 'pending' | 'done' | 'error'
      createdAt: string
    }
  | { kind: 'error'; id: string; code: string; message: string; createdAt: string }

// Anthropic Messages API content block shapes. The AiMessageRow.content column
// is Json in the DB; we narrow per-block via the `type` discriminator.
interface TextBlock {
  type: 'text'
  text: string
}
interface ToolUseBlock {
  type: 'tool_use'
  id: string
  name: string
  input: unknown
}
interface ToolResultBlock {
  type: 'tool_result'
  tool_use_id: string
  content: unknown
  is_error?: boolean
}
type ContentBlock = TextBlock | ToolUseBlock | ToolResultBlock | { type: string }

function isToolResultBlock(b: ContentBlock): b is ToolResultBlock {
  return b.type === 'tool_result'
}
function isTextBlock(b: ContentBlock): b is TextBlock {
  return b.type === 'text'
}
function isToolUseBlock(b: ContentBlock): b is ToolUseBlock {
  return b.type === 'tool_use'
}

export function normalizeFromPersistedRows(rows: AiMessageRow[]): RenderMessage[] {
  const out: RenderMessage[] = []

  for (const row of rows) {
    const blocks = (Array.isArray(row.content) ? row.content : []) as ContentBlock[]

    if (row.role === 'user') {
      const first = blocks[0]
      if (first && isTextBlock(first)) {
        out.push({
          kind: 'user',
          id: `${row.id}:0`,
          text: first.text,
          createdAt: row.created_at,
        })
        continue
      }

      // Otherwise treat as a tool_result-only row: locate matching tool rows
      // emitted from earlier assistant rows and update their status in place.
      for (const block of blocks) {
        if (!isToolResultBlock(block)) continue
        const target = out.find(
          (m) => m.kind === 'tool' && m.toolUseId === block.tool_use_id,
        ) as Extract<RenderMessage, { kind: 'tool' }> | undefined
        if (!target) {
          console.warn(
            '[normalizeMessages] tool_result with no matching tool_use:',
            block.tool_use_id,
          )
          continue
        }
        target.status = block.is_error ? 'error' : 'done'
      }
      continue
    }

    // role === 'assistant' — iterate content blocks in order. Text blocks
    // emit assistant rows; tool_use blocks emit pending tool rows. Other
    // block types (e.g. thinking, future) are silently skipped.
    blocks.forEach((block, blockIndex) => {
      if (isTextBlock(block)) {
        out.push({
          kind: 'assistant',
          id: `${row.id}:${blockIndex}`,
          text: block.text,
          createdAt: row.created_at,
        })
      } else if (isToolUseBlock(block)) {
        out.push({
          kind: 'tool',
          id: `${row.id}:${blockIndex}`,
          tool: block.name,
          toolUseId: block.id,
          status: 'pending',
          createdAt: row.created_at,
        })
      }
    })
  }

  return out
}

export function applyEventToMessages(
  messages: RenderMessage[],
  event: AiChatEvent,
  generateId: () => string,
): RenderMessage[] {
  switch (event.type) {
    case 'session':
    case 'done':
      return messages

    case 'turn':
      return [
        ...messages,
        {
          kind: 'assistant',
          id: generateId(),
          text: event.text,
          createdAt: new Date().toISOString(),
        },
      ]

    case 'tool_call':
      return [
        ...messages,
        {
          kind: 'tool',
          id: generateId(),
          tool: event.tool,
          toolUseId: event.tool_use_id,
          status: 'pending',
          createdAt: new Date().toISOString(),
        },
      ]

    case 'tool_result': {
      const idx = messages.findIndex(
        (m) => m.kind === 'tool' && m.toolUseId === event.tool_use_id,
      )
      if (idx === -1) {
        console.warn(
          '[normalizeMessages] tool_result event with no matching tool_call:',
          event.tool_use_id,
        )
        return messages
      }
      const next = messages.slice()
      const existing = next[idx] as Extract<RenderMessage, { kind: 'tool' }>
      next[idx] = { ...existing, status: event.is_error ? 'error' : 'done' }
      return next
    }

    case 'error':
      return [
        ...messages,
        {
          kind: 'error',
          id: generateId(),
          code: event.code,
          message: event.message,
          createdAt: new Date().toISOString(),
        },
      ]
  }
}
