// Context-window management for the AI chat orchestration loop.
//
// Problem: every chat turn replays the full ancestor chain (root → leaf) to
// Anthropic. A user who keeps one thread open indefinitely would eventually
// produce a chain that exceeds the model's context window, at which point
// every call fails. This module bounds the replayed history three ways:
//
//   1. Summarisation — turns older than a recent window are folded into a
//      running natural-language summary stored on `ai_sessions`. On each
//      send we replay [summary] + [recent turns] instead of the whole chain.
//   2. Attachment stripping — base64 image/PDF bytes are the single biggest
//      per-message cost; we keep them only on the most recent few history
//      messages and swap older ones for a short text placeholder.
//   3. Hard ceiling — a backstop that drops whole oldest turns if, despite
//      the above, the assembled history is still dangerously large (e.g. a
//      pre-existing long thread on the first turn after this ships).
//
// Everything here is pure except `applyMessageCacheBreakpoint` (mutates in
// place by design). The actual Anthropic summarisation call lives in the
// edge function — this module only decides *what* to summarise and *how* to
// render it.
//
// Token figures are deliberately rough estimates (chars / 4, with flat costs
// for image/document blocks whose base64 payload would otherwise dwarf every
// real token count). They drive threshold decisions only — never anything
// that must be exact.

// ---------------------------------------------------------------------------
// Tunables
// ---------------------------------------------------------------------------

// Model context window we design against (Claude Sonnet 4.x = 200K). The
// thresholds below leave generous headroom for the system prompt, tool
// schemas, the new user turn, and the response.
//
// Raw (un-summarised) history larger than this estimated-token figure
// triggers a compaction pass after the turn completes.
export const COMPACT_TRIGGER_TOKENS = 60_000

// When compacting, keep the most recent turns whose cumulative estimated
// size fits this budget verbatim; everything older folds into the summary.
export const KEEP_TOKEN_BUDGET = 20_000

// Backstop: if the history assembled for a send still exceeds this, drop
// whole oldest turns until it fits. With compaction running this should
// essentially never fire — it exists for the first turn on a thread that
// was already long before compaction shipped.
export const HARD_CEILING_TOKENS = 130_000

// History messages within the most recent N keep their image/PDF blocks;
// older messages have those blocks replaced with a short text placeholder.
// The just-sent user turn is appended by the caller AFTER stripping, so its
// own attachments are always preserved — this window covers roughly the
// last three prior turns on top of that.
export const ATTACHMENT_KEEP_RECENT = 6

// Flat token estimates for multimodal blocks. Real image cost is
// (w*h)/750 capped ~1600; without dimensions we assume the cap. Using the
// base64 string length here would massively over-count and wrongly trip
// compaction, so these blocks are special-cased everywhere.
const IMAGE_TOKEN_ESTIMATE = 1_600
const DOCUMENT_TOKEN_ESTIMATE = 3_000

const IMAGE_PLACEHOLDER =
  '[Slika je bila priložena ranije u ovom razgovoru; uklonjena je iz konteksta radi uštede prostora.]'
const DOCUMENT_PLACEHOLDER =
  '[PDF dokument je bio priložen ranije u ovom razgovoru; uklonjen je iz konteksta radi uštede prostora.]'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

// A loose mirror of an Anthropic content block — we only ever read `type`
// and a few well-known fields, so an open record is enough.
export interface ContentBlock {
  type: string
  [k: string]: unknown
}

// One row of the conversation tree, normalised: `id` lets us anchor the
// summary boundary to a specific message, `content` is always a block array.
export interface ChainMessage {
  id: string
  role: 'user' | 'assistant'
  content: ContentBlock[]
}

// The shape the orchestration loop sends to Anthropic. Structurally
// identical to the edge function's local `InMemoryMessage`.
export interface WireMessage {
  role: 'user' | 'assistant'
  content: unknown
}

// ---------------------------------------------------------------------------
// Token estimation
// ---------------------------------------------------------------------------

function estimateBlockTokens(block: ContentBlock): number {
  switch (block.type) {
    case 'text':
      return Math.ceil(String(block.text ?? '').length / 4)
    case 'image':
      return IMAGE_TOKEN_ESTIMATE
    case 'document':
      return DOCUMENT_TOKEN_ESTIMATE
    case 'tool_use':
      return Math.ceil(JSON.stringify(block.input ?? {}).length / 4) + 10
    case 'tool_result': {
      const c = block.content
      const s = typeof c === 'string' ? c : JSON.stringify(c ?? '')
      return Math.ceil(s.length / 4) + 10
    }
    default:
      return Math.ceil(JSON.stringify(block).length / 4)
  }
}

/** Rough estimated token count for one message's content. */
export function estimateMessageTokens(content: unknown): number {
  if (!Array.isArray(content)) {
    return Math.ceil(JSON.stringify(content ?? '').length / 4)
  }
  return (content as ContentBlock[])
    .reduce((sum, b) => sum + estimateBlockTokens(b), 0) + 4
}

function estimateChainTokens(chain: ChainMessage[]): number {
  return chain.reduce((sum, m) => sum + estimateMessageTokens(m.content), 0)
}

// ---------------------------------------------------------------------------
// Turn grouping
// ---------------------------------------------------------------------------

// A user message is a "real" turn boundary unless it is a tool_result
// envelope (role 'user', first block tool_result) — those belong to the
// assistant turn that triggered the tool call.
function isToolResultMessage(m: ChainMessage): boolean {
  return m.content.length > 0 && m.content[0]?.type === 'tool_result'
}

/**
 * Group a chain into turns. A turn starts at a real user message and runs
 * until the next one — so an assistant turn plus all its tool_use /
 * tool_result rows stay together as one atomic unit. Trimming on turn
 * boundaries is what guarantees we never split a tool_use from its
 * tool_result (which Anthropic rejects).
 */
export function splitTurns(chain: ChainMessage[]): ChainMessage[][] {
  const turns: ChainMessage[][] = []
  for (const m of chain) {
    if ((m.role === 'user' && !isToolResultMessage(m)) || turns.length === 0) {
      turns.push([m])
    } else {
      turns[turns.length - 1].push(m)
    }
  }
  return turns
}

// ---------------------------------------------------------------------------
// Send-time: apply an existing summary
// ---------------------------------------------------------------------------

/**
 * Decide which slice of the chain to replay verbatim, given a stored summary.
 *
 * The summary is branch-scoped: it is valid only if its boundary message id
 * is an ancestor in *this* chain. If the user branched (edit/regenerate)
 * before the boundary, the id won't be found and the summary is ignored —
 * the post-turn compaction step will rebuild one for the new branch.
 */
export function selectKeptChain(
  chain: ChainMessage[],
  summary: string | null,
  summaryThroughId: string | null,
): { keptChain: ChainMessage[]; summaryText: string | null } {
  if (summary && summaryThroughId) {
    const idx = chain.findIndex((m) => m.id === summaryThroughId)
    if (idx >= 0 && idx < chain.length - 1) {
      // The compaction step always sets the boundary to the last message of
      // a complete turn, so chain[idx + 1] is a real user message.
      return { keptChain: chain.slice(idx + 1), summaryText: summary }
    }
  }
  return { keptChain: chain, summaryText: null }
}

/**
 * Backstop trim: drop whole oldest turns until the chain fits the hard
 * ceiling. The result still starts with a real user message and ends with
 * an assistant message, so it stays a valid Anthropic transcript.
 */
export function enforceHardCeiling(chain: ChainMessage[]): ChainMessage[] {
  if (estimateChainTokens(chain) <= HARD_CEILING_TOKENS) return chain
  const turns = splitTurns(chain)
  let total = estimateChainTokens(chain)
  while (turns.length > 1 && total > HARD_CEILING_TOKENS) {
    const dropped = turns.shift()!
    total -= estimateChainTokens(dropped)
  }
  return turns.flat()
}

/**
 * Replace image/document blocks with a text placeholder on every history
 * message except the most recent `keepRecent`. Mutates the array in place
 * (replacing elements, not the blocks themselves). Caller must run this
 * BEFORE appending the new user turn so fresh attachments survive.
 */
export function stripOldAttachments(messages: WireMessage[], keepRecent: number): void {
  const boundary = messages.length - keepRecent
  for (let i = 0; i < boundary; i++) {
    const content = messages[i].content
    if (!Array.isArray(content)) continue
    let changed = false
    const next = (content as ContentBlock[]).map((b) => {
      if (b?.type === 'image') {
        changed = true
        return { type: 'text', text: IMAGE_PLACEHOLDER }
      }
      if (b?.type === 'document') {
        changed = true
        return { type: 'text', text: DOCUMENT_PLACEHOLDER }
      }
      return b
    })
    if (changed) messages[i] = { role: messages[i].role, content: next }
  }
}

/**
 * Fold the running summary into the oldest surviving message as plain text
 * context — the same in-memory-only trick the route-context line uses. The
 * persisted `ai_messages` rows are never rewritten.
 */
export function injectSummaryBanner(message: WireMessage, summaryText: string): void {
  const banner =
    '[Sažetak ranijeg dijela ovog razgovora — koristi ga kao kontekst za nastavak; ' +
    'ne spominji sam sažetak korisniku osim ako izričito pita:]\n\n' +
    summaryText +
    '\n\n[Kraj sažetka. Slijedi nastavak razgovora.]\n\n'

  if (!Array.isArray(message.content)) {
    message.content = [{ type: 'text', text: banner }]
    return
  }
  const blocks = (message.content as ContentBlock[]).slice()
  const idx = blocks.findIndex((b) => b.type === 'text')
  if (idx >= 0) {
    blocks[idx] = { ...blocks[idx], type: 'text', text: banner + String(blocks[idx].text ?? '') }
  } else {
    blocks.unshift({ type: 'text', text: banner })
  }
  message.content = blocks
}

// ---------------------------------------------------------------------------
// Post-turn: plan a compaction
// ---------------------------------------------------------------------------

export interface CompactionPlan {
  // Older turns to fold into the summary, oldest first.
  summarizeTurns: ChainMessage[][]
  // The summary currently covering everything before these turns, or null
  // for a from-scratch summary (no prior summary, or the branch diverged).
  priorSummary: string | null
  // ai_messages.id of the last message of the last summarised turn — the
  // new `summary_through_message_id`.
  newBoundaryId: string
}

/**
 * Decide whether the conversation needs compacting and, if so, which turns
 * to summarise. Returns null when no compaction is warranted.
 *
 * Incremental by design: when a prior summary exists, only the turns added
 * since its boundary are newly summarised, and the prior summary is passed
 * through so the caller can fold both into one updated summary.
 */
export function planCompaction(
  chain: ChainMessage[],
  priorSummary: string | null,
  priorBoundaryId: string | null,
): CompactionPlan | null {
  // Raw portion = everything not yet covered by the prior summary.
  let rawChain = chain
  let effectivePrior: string | null = null
  if (priorSummary && priorBoundaryId) {
    const idx = chain.findIndex((m) => m.id === priorBoundaryId)
    if (idx >= 0 && idx < chain.length - 1) {
      rawChain = chain.slice(idx + 1)
      effectivePrior = priorSummary
    }
    // Boundary not in this branch → branch diverged; summarise the whole
    // chain afresh (rawChain stays = chain, effectivePrior stays null).
  }

  if (estimateChainTokens(rawChain) <= COMPACT_TRIGGER_TOKENS) return null

  const turns = splitTurns(rawChain)
  if (turns.length < 2) return null // need ≥1 turn to keep AND ≥1 to summarise

  // Keep the most recent turns within the verbatim budget, always ≥1.
  let kept = 0
  let acc = 0
  for (let i = turns.length - 1; i >= 0; i--) {
    const t = estimateChainTokens(turns[i])
    if (kept > 0 && acc + t > KEEP_TOKEN_BUDGET) break
    acc += t
    kept++
  }
  const summarizeCount = turns.length - kept
  if (summarizeCount <= 0) return null

  const summarizeTurns = turns.slice(0, summarizeCount)
  const lastTurn = summarizeTurns[summarizeTurns.length - 1]
  return {
    summarizeTurns,
    priorSummary: effectivePrior,
    newBoundaryId: lastTurn[lastTurn.length - 1].id,
  }
}

// ---------------------------------------------------------------------------
// Post-turn: render turns + build the summarisation prompt
// ---------------------------------------------------------------------------

export const SUMMARY_SYSTEM_PROMPT =
  `Ti si sustav za sažimanje razgovora unutar poslovne aplikacije za upravljanje ` +
  `nekretninama i gradnjom. Tvoj zadatak je sažeti dio razgovora između korisnika ` +
  `i AI asistenta tako da se razgovor može nastaviti bez gubitka konteksta.\n\n` +
  `Pravila:\n` +
  `- Zadrži sve konkretne činjenice: imena projekata, faza, izvođača, iznose, ` +
  `datume, brojeve računa, odluke i zaključke.\n` +
  `- Zadrži otvorena pitanja i zadatke koji još nisu dovršeni.\n` +
  `- Izostavi puste ljubaznosti i nebitne digresije.\n` +
  `- Piši na hrvatskom, sažeto, u natuknicama.\n` +
  `- Vrati isključivo sažetak, bez uvoda i bez komentara.`

/** Flatten turns into a compact plain-text transcript for the summariser. */
export function renderTurnsForSummary(turns: ChainMessage[][]): string {
  const lines: string[] = []
  for (const turn of turns) {
    for (const msg of turn) {
      const label =
        msg.role === 'assistant'
          ? '[ASISTENT]'
          : isToolResultMessage(msg)
            ? '[REZULTAT ALATA]'
            : '[KORISNIK]'
      const parts: string[] = []
      for (const b of msg.content) {
        if (b.type === 'text') {
          parts.push(String(b.text ?? ''))
        } else if (b.type === 'tool_use') {
          parts.push(`(poziv alata: ${String(b.name ?? '?')})`)
        } else if (b.type === 'tool_result') {
          const c = b.content
          const s = typeof c === 'string' ? c : JSON.stringify(c ?? '')
          parts.push(`(rezultat: ${s.slice(0, 600)})`)
        } else if (b.type === 'image') {
          parts.push('(slika)')
        } else if (b.type === 'document') {
          parts.push('(PDF dokument)')
        }
      }
      const text = parts.join(' ').trim()
      if (text) lines.push(`${label}: ${text}`)
    }
  }
  return lines.join('\n')
}

/** Build the user-message text for the summarisation call. */
export function buildSummaryUserText(priorSummary: string | null, rendered: string): string {
  if (priorSummary) {
    return (
      `Postojeći sažetak ranijeg dijela razgovora:\n\n${priorSummary}\n\n` +
      `Novi dio razgovora koji treba integrirati u sažetak:\n\n${rendered}\n\n` +
      `Vrati JEDAN ažurirani sažetak koji objedinjuje postojeći sažetak i novi dio.`
    )
  }
  return `Dio razgovora koji treba sažeti:\n\n${rendered}`
}

// ---------------------------------------------------------------------------
// Prompt caching
// ---------------------------------------------------------------------------

/**
 * Move the message-array cache breakpoint to the last block of the last
 * message. Called before every Anthropic request: the growing prefix
 * (system + tools + conversation-so-far) is then served from cache on the
 * next call instead of being re-billed at full rate.
 *
 * Mutates `messages` in place. Only ever stamps `cache_control` onto a
 * fresh copy of the target block, and clears any breakpoint it previously
 * set, so at most one message-array breakpoint exists at a time.
 */
export function applyMessageCacheBreakpoint(messages: WireMessage[]): void {
  for (const m of messages) {
    if (!Array.isArray(m.content)) continue
    for (const b of m.content as ContentBlock[]) {
      if (b && typeof b === 'object' && 'cache_control' in b) {
        delete (b as Record<string, unknown>).cache_control
      }
    }
  }
  const last = messages[messages.length - 1]
  if (last && Array.isArray(last.content) && last.content.length > 0) {
    const blocks = last.content as ContentBlock[]
    blocks[blocks.length - 1] = {
      ...blocks[blocks.length - 1],
      cache_control: { type: 'ephemeral' },
    }
  }
}
