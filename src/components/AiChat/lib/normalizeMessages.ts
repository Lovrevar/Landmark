import type {
  AiAttachmentRow,
  AiChatEvent,
  AiMessageRow,
  DocumentSheet,
  DocumentSpec,
} from '../../../types/aiChat'

// Branch metadata attached to user RenderMessages that sit at a fork in the
// tree (i.e. their underlying row has siblings sharing the same parent_id).
// The store uses prev/nextSiblingLeafId to switch the active branch — both
// are pre-computed as the most-recent leaf of the chosen sibling's subtree.
export interface BranchInfo {
  siblingIndex: number  // 0-based among siblings sorted by created_at asc
  siblingCount: number
  prevSiblingLeafId: string | null
  nextSiblingLeafId: string | null
}

export type RenderMessage =
  | {
      kind: 'user'
      id: string
      rowId: string
      text: string
      createdAt: string
      branch?: BranchInfo
      // Populated from the ai_message_attachments side-table on history
      // reload. Live optimistic rows leave this undefined; canonical rows
      // after reload have an array (possibly empty when none were sent).
      attachments?: AiAttachmentRow[]
    }
  | { kind: 'assistant'; id: string; rowId: string; text: string; createdAt: string }
  | {
      kind: 'tool'
      id: string
      rowId: string
      tool: string
      toolUseId: string
      status: 'pending' | 'done' | 'error'
      createdAt: string
    }
  // A `create_document` tool call. Distinct from 'tool' because the UI
  // renders a download card from the agent-authored spec carried in the
  // tool_use input. status mirrors the tool lifecycle (pending → done/error).
  | {
      kind: 'document'
      id: string
      rowId: string
      toolUseId: string
      status: 'pending' | 'done' | 'error'
      spec: DocumentSpec
      createdAt: string
    }
  | { kind: 'error'; id: string; rowId: string; code: string; message: string; createdAt: string }
  // User-initiated cancel. Appended client-side by stopStreaming(); never
  // persisted server-side, so it disappears on session reload. Distinct from
  // 'error' so the UI can render it neutrally rather than in red.
  | { kind: 'interrupted'; id: string; rowId: string; createdAt: string }

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

// Strictly parse a `create_document` tool_use input into a DocumentSpec.
// Returns null on ANY malformed/unexpected shape — the caller then falls
// back to a plain `tool` message, so a buggy model turn can never crash
// rendering. This is the client-side mirror of the edge function's
// handleCreateDocument validation; never trust the wire.
export function parseDocumentSpec(input: unknown): DocumentSpec | null {
  if (typeof input !== 'object' || input === null) return null
  const o = input as Record<string, unknown>

  const title = typeof o.title === 'string' ? o.title.trim() : ''
  if (!title) return null

  const format = o.format
  if (format !== 'pdf' && format !== 'xlsx' && format !== 'markdown') return null

  if (format === 'xlsx') {
    if (!Array.isArray(o.sheets) || o.sheets.length === 0) return null
    const sheets: DocumentSheet[] = []
    for (const raw of o.sheets) {
      if (typeof raw !== 'object' || raw === null) return null
      const s = raw as Record<string, unknown>
      const name = typeof s.name === 'string' ? s.name : ''
      if (!name) return null
      if (!Array.isArray(s.columns) || !s.columns.every((c) => typeof c === 'string')) {
        return null
      }
      if (!Array.isArray(s.rows)) return null
      const rows: DocumentSheet['rows'] = []
      for (const r of s.rows) {
        if (!Array.isArray(r)) return null
        rows.push(
          r.map((cell) =>
            cell === null ||
            typeof cell === 'string' ||
            typeof cell === 'number' ||
            typeof cell === 'boolean'
              ? cell
              : String(cell),
          ),
        )
      }
      sheets.push({ name, columns: s.columns as string[], rows })
    }
    return { title, format, sheets }
  }

  // pdf | markdown
  const markdown = typeof o.markdown === 'string' ? o.markdown : ''
  if (!markdown.trim()) return null
  return { title, format, markdown }
}

// ---------------------------------------------------------------------------
// Tree helpers
// ---------------------------------------------------------------------------

interface TreeIndex {
  byId: Map<string, AiMessageRow>
  childrenByParent: Map<string, AiMessageRow[]>  // key '' for parent_id=null roots
}

function indexTree(rows: AiMessageRow[]): TreeIndex {
  const byId = new Map<string, AiMessageRow>()
  const childrenByParent = new Map<string, AiMessageRow[]>()
  for (const r of rows) {
    byId.set(r.id, r)
    const key = r.parent_id ?? ''
    const list = childrenByParent.get(key) ?? []
    list.push(r)
    childrenByParent.set(key, list)
  }
  // Sort each sibling list by created_at asc so sibling index is stable.
  for (const list of childrenByParent.values()) {
    list.sort((a, b) => a.created_at.localeCompare(b.created_at))
  }
  return { byId, childrenByParent }
}

// Greatest created_at among `rootId` and all its descendants. Used to pick
// the active leaf when switching to a sibling subtree.
export function findLatestLeafInSubtree(rows: AiMessageRow[], rootId: string): string | null {
  const { byId, childrenByParent } = indexTree(rows)
  const root = byId.get(rootId)
  if (!root) return null
  let bestId = root.id
  let bestAt = root.created_at
  const stack: AiMessageRow[] = [root]
  while (stack.length) {
    const node = stack.pop()!
    if (node.created_at > bestAt) {
      bestAt = node.created_at
      bestId = node.id
    }
    const kids = childrenByParent.get(node.id) ?? []
    for (const k of kids) stack.push(k)
  }
  return bestId
}

// Pick the row in `rows` with the largest created_at — the implicit active
// leaf for a freshly loaded session. Returns null when rows is empty.
export function computeMostRecentLeaf(rows: AiMessageRow[]): string | null {
  if (rows.length === 0) return null
  let best = rows[0]
  for (const r of rows) {
    if (r.created_at > best.created_at) best = r
  }
  return best.id
}

// Walk parent_id pointers from `leafId` to a root, returning the path in
// root→leaf order. Returns [] if leafId is missing or the chain is broken.
export function walkActivePath(rows: AiMessageRow[], leafId: string | null): AiMessageRow[] {
  if (!leafId) return []
  const { byId } = indexTree(rows)
  const path: AiMessageRow[] = []
  let cursor: string | null = leafId
  const seen = new Set<string>()
  while (cursor) {
    if (seen.has(cursor)) break
    seen.add(cursor)
    const row = byId.get(cursor)
    if (!row) break
    path.unshift(row)
    cursor = row.parent_id
  }
  return path
}

// ---------------------------------------------------------------------------
// Active-branch normalisation: rows + chosen leaf → RenderMessage[] with
// branch metadata on user rows that have siblings.
// ---------------------------------------------------------------------------

export function deriveActiveBranch(
  rows: AiMessageRow[],
  activeLeafId: string | null,
): RenderMessage[] {
  if (rows.length === 0 || activeLeafId === null) return []

  const { childrenByParent } = indexTree(rows)
  const path = walkActivePath(rows, activeLeafId)
  if (path.length === 0) return []

  // Pre-compute branch info per row on the path.
  const branchByRowId = new Map<string, BranchInfo>()
  for (const r of path) {
    const key = r.parent_id ?? ''
    const siblings = childrenByParent.get(key) ?? []
    if (siblings.length > 1) {
      const idx = siblings.findIndex((s) => s.id === r.id)
      const prevSib = idx > 0 ? siblings[idx - 1] : null
      const nextSib = idx < siblings.length - 1 ? siblings[idx + 1] : null
      branchByRowId.set(r.id, {
        siblingIndex: idx,
        siblingCount: siblings.length,
        prevSiblingLeafId: prevSib ? findLatestLeafInSubtree(rows, prevSib.id) : null,
        nextSiblingLeafId: nextSib ? findLatestLeafInSubtree(rows, nextSib.id) : null,
      })
    }
  }

  const out: RenderMessage[] = []

  for (const row of path) {
    const blocks = (Array.isArray(row.content) ? row.content : []) as ContentBlock[]

    if (row.role === 'user') {
      // The user content is now a mixed array: optional image/document
      // blocks followed by a single text block (see edge function
      // buildUserContentBlocks). The text block is what we render in the
      // bubble; attachments come from the side-table on the row, not from
      // the JSONB blocks themselves.
      const textBlock = blocks.find(isTextBlock)
      if (textBlock) {
        const branch = branchByRowId.get(row.id)
        out.push({
          kind: 'user',
          id: `${row.id}:0`,
          rowId: row.id,
          text: textBlock.text,
          createdAt: row.created_at,
          ...(branch ? { branch } : {}),
          ...(row.attachments && row.attachments.length > 0
            ? { attachments: row.attachments }
            : {}),
        })
        continue
      }

      // tool_result-only row: update the matching tool message in place.
      for (const block of blocks) {
        if (!isToolResultBlock(block)) continue
        const target = out.find(
          (m) =>
            (m.kind === 'tool' || m.kind === 'document') &&
            m.toolUseId === block.tool_use_id,
        ) as Extract<RenderMessage, { kind: 'tool' | 'document' }> | undefined
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

    // role === 'assistant'
    blocks.forEach((block, blockIndex) => {
      if (isTextBlock(block)) {
        out.push({
          kind: 'assistant',
          id: `${row.id}:${blockIndex}`,
          rowId: row.id,
          text: block.text,
          createdAt: row.created_at,
        })
      } else if (isToolUseBlock(block)) {
        if (block.name === 'create_document') {
          const spec = parseDocumentSpec(block.input)
          if (spec) {
            out.push({
              kind: 'document',
              id: `${row.id}:${blockIndex}`,
              rowId: row.id,
              toolUseId: block.id,
              status: 'pending',
              spec,
              createdAt: row.created_at,
            })
            return
          }
        }
        out.push({
          kind: 'tool',
          id: `${row.id}:${blockIndex}`,
          rowId: row.id,
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

// ---------------------------------------------------------------------------
// Live-stream reducer. Called from useAiChatStore as each SSE event arrives.
// Optimistically appended RenderMessages have synthetic ids (no `:blockIndex`
// suffix) and no rowId yet — that's fine, the post-stream loadSession reload
// replaces them with canonical rows.
// ---------------------------------------------------------------------------

export function applyEventToMessages(
  messages: RenderMessage[],
  event: AiChatEvent,
  generateId: () => string,
): RenderMessage[] {
  switch (event.type) {
    case 'session':
    case 'done':
      return messages

    case 'turn': {
      const id = generateId()
      return [
        ...messages,
        {
          kind: 'assistant',
          id,
          rowId: id,
          text: event.text,
          createdAt: new Date().toISOString(),
        },
      ]
    }

    case 'tool_call': {
      const id = generateId()
      if (event.tool === 'create_document') {
        const spec = parseDocumentSpec(event.input)
        if (spec) {
          return [
            ...messages,
            {
              kind: 'document',
              id,
              rowId: id,
              toolUseId: event.tool_use_id,
              status: 'pending',
              spec,
              createdAt: new Date().toISOString(),
            },
          ]
        }
      }
      return [
        ...messages,
        {
          kind: 'tool',
          id,
          rowId: id,
          tool: event.tool,
          toolUseId: event.tool_use_id,
          status: 'pending',
          createdAt: new Date().toISOString(),
        },
      ]
    }

    case 'tool_result': {
      const idx = messages.findIndex(
        (m) =>
          (m.kind === 'tool' || m.kind === 'document') &&
          m.toolUseId === event.tool_use_id,
      )
      if (idx === -1) {
        console.warn(
          '[normalizeMessages] tool_result event with no matching tool_call:',
          event.tool_use_id,
        )
        return messages
      }
      const next = messages.slice()
      const existing = next[idx] as Extract<RenderMessage, { kind: 'tool' | 'document' }>
      next[idx] = { ...existing, status: event.is_error ? 'error' : 'done' }
      return next
    }

    case 'error': {
      const id = generateId()
      return [
        ...messages,
        {
          kind: 'error',
          id,
          rowId: id,
          code: event.code,
          message: event.message,
          createdAt: new Date().toISOString(),
        },
      ]
    }
  }
}
