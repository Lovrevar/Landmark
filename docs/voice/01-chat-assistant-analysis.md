# Voice access — Phase 1: analysis of the existing chat assistant

Written 2026-09-23. This is a read-only survey of the AI chat feature as it exists today,
produced to decide how a voice-agent platform (Vapi / Retell) can talk to the same brain.
It records what the code does, not what [`docs/AI_CHAT.md`](../AI_CHAT.md) says it does —
where the two disagree, this document notes the drift and the code wins.

Companion: [`02-voice-implementation-plan.md`](./02-voice-implementation-plan.md).

## TL;DR for the voice decision

| Question | Answer |
|---|---|
| Is there an endpoint we can point a voice platform at? | Yes, one: the `ai-chat` edge function. |
| Is it OpenAI-compatible? | No. Custom request body, custom SSE event taxonomy. |
| Does it stream tokens? | **No.** It uses `anthropic.messages.create` — the whole model turn is awaited, then emitted as one event. |
| Are the tools reusable independently? | **Yes.** Clean `TOOLS` registry, handlers take `(input, ctx, extras)` and know nothing about chat. |
| Can it authenticate a caller without a browser JWT? | Not today. `verify_jwt = true`, and the RLS client is built from the user's JWT. |
| Is there a phone number on a user record? | **No.** `public.users` has no phone column. |
| Is the output voice-safe? | No — Markdown, download cards, written-form numbers and dates. |

The blocking finding is the second row. Everything else is additive work; that one is a
refactor of the hot path. It is detailed in [§2](#2-streaming).

---

## 1. Entry point & API shape

One Supabase Edge Function, one file: [`supabase/functions/ai-chat/index.ts`](../../supabase/functions/ai-chat/index.ts)
(1789 lines), plus seven modules under [`supabase/functions/_shared/`](../../supabase/functions/_shared/).

- **Route**: `POST {SUPABASE_URL}/functions/v1/ai-chat`. `OPTIONS` is handled for CORS; every
  other method returns 405.
- **JWT gate**: `verify_jwt = true` in [`supabase/config.toml`](../../supabase/config.toml#L18-L19),
  *and* re-validated inside the function. Two layers.
- **Two request shapes** dispatched on body content:

```jsonc
// 1. Chat
{
  "session_id":          "uuid | null",
  "message":             "string, 1..4000 chars",
  "edit_message_id":     "uuid | null",   // fork a prior user turn
  "parent_message_id":   "uuid | null",   // client's current active leaf
  "current_route":       "string | null", // location.pathname, for route context
  "attachments":         "AttachmentInput[] | null",
  "proposed_session_id": "uuid | null"
}

// 2. Debug — Director only, gated behind AI_CHAT_DEBUG_ENABLED === 'true', else 404
{ "debug_tool": "string", "input": {} }
```

- **Response**: `200 text/event-stream; charset=utf-8`. Six event types, all carrying `type`
  as the discriminant ([`src/types/aiChat.ts`](../../src/types/aiChat.ts#L47-L54)):

```ts
{ type: 'session';     session_id: string }
{ type: 'turn';        role: 'assistant'; text: string }
{ type: 'tool_call';   tool: string; input: unknown; tool_use_id: string }
{ type: 'tool_result'; tool: string; output: unknown; tool_use_id: string; is_error: boolean }
{ type: 'done';        stop_reason: string; usage: { input_tokens, output_tokens } }
{ type: 'error';       code: string; message: string }
```

Plus SSE comment frames: `: ready` once on open, `: keepalive` every 15 s idle.

- **Pre-stream failures** (auth, validation, rate limit, session-not-found) return a flat JSON
  envelope `{ error: { code, message } }` with a real HTTP status. Once the stream is open the
  status is already 200, so **mid-stream failures arrive as `error` events**, never as 5xx.

**Not OpenAI-compatible in any respect.** Different request fields, different event names,
different payload shapes, no `choices[]`, no `delta`, no `data: [DONE]` sentinel. An adapter is
required no matter which integration strategy we pick.

## 2. Streaming

**The assistant does not stream tokens.** This is the single most important finding in this
document.

[`index.ts:1225`](../../supabase/functions/ai-chat/index.ts#L1225) calls
`anthropic.messages.create(...)` — the non-streaming method. The orchestration loop awaits the
**entire** model turn, persists it to `ai_messages`, and only then walks `response.content` and
emits one `turn` event per text block with the complete block text.

So "streaming" here means *per-orchestration-step progress*, not token deltas. The user sees
tool chips light up live; they do not see text appear word by word. For a chat UI that is a
defensible trade (and the doc argues it well). For voice it is the whole problem: Vapi and
Retell in Custom LLM mode begin TTS on the first sentence boundary in the delta stream, so
with this design the caller hears nothing until the model has finished thinking.

### Time-to-first-token contributors

Everything below is **sequential** and happens before the first byte of assistant text.

**Stage A — pre-stream (`handleChat`, [lines 707–1091](../../supabase/functions/ai-chat/index.ts#L707-L1091)).**
Seven to nine round trips to Supabase, none of them parallelised:

| # | Step | Round trips | Notes |
|---|---|---|---|
| 1 | `authenticate()` | 2–3 | `auth.getUser()` (network call to GoTrue), then `public.users`, then `project_managers` for Supervision users |
| 2 | `checkRateLimit()` | 1 | two `count` queries, issued in parallel |
| 3 | Session resolve | 1–2 | insert, or lookup; +1 if `proposed_session_id` is present |
| 4 | Parent validation | 1 | skipped on a brand-new session |
| 5 | History load | 1 | `SELECT` of **every** row in the session — no limit, full `content` JSONB including base64 attachment bytes |
| 6 | Session meta | 1 | `context_summary`, `summary_through_message_id` |
| 7 | Attachment bytes | 0–4 | storage downloads + base64 encode, only when attachments are present |
| 8 | User row insert | 1 | + a bulk insert for the attachment side-table |

Context-window management (`selectKeptChain`, `enforceHardCeiling`, `stripOldAttachments`,
`injectSummaryBanner`) runs between 6 and 8 but is pure in-memory work on already-fetched rows —
negligible.

**Stage B — first flush.** `: ready` and the `session` event go out here. This is fast, and it is
why the troubleshooting guide says a healthy stream shows `: ready` within ~1 s. **It is not
first token** — no assistant text has been generated yet.

**Stage C — the model.** `messages.create`, `max_tokens: 8192`, model `claude-sonnet-4-6`.
Full turn latency. Prompt caching is properly set up (three `cache_control` breakpoints: static
system prompt, last tool schema, and a sliding one on the last message), which cuts input cost
and TTFT on the cached prefix but does nothing about output generation time.

**Stage D — persist, then emit.** The assistant row is inserted *before* any wire event, by
design ("the DB row is the contract, the SSE frame is its projection"). One more round trip
between generation finishing and the user seeing anything.

**Stage E — the tool loop.** Any question that touches data takes at least two passes:

```
turn 1 (full generation, usually tool_use only, no text)
  → insert  → dispatch tools SEQUENTIALLY, 15 s timeout each  → insert tool_result row
turn 2 (full generation)  → insert  → first text the user sees
```

So a typical data question costs **two complete non-streamed model turns, one or more tool
executions, and ~10 sequential DB round trips**. The guardrails tell you what the designers
expected: `REQUEST_TIMEOUT_MS = 90_000`, `MAX_ITERATIONS = 10`, 15 s per tool. A conversational
voice turn needs first audio inside roughly a second.

**Stage F — after `done`.** `maybeCompactSession` may fire *another* Anthropic call (the
summarisation) while the SSE connection is still open. Off the user's critical path in chat;
on a phone call it would hold the HTTP request open past the point the caller has hung up.

### What is already right

The SSE plumbing itself is good and reusable: `SSEWriter` handles framing, idle heartbeats, and
write-failure detection; there is a per-request `AbortController` with three abort sources; and
the DB-backed cancel beacon works around Supabase Edge runtime not surfacing client disconnect.

## 3. Orchestration

- **Provider**: Anthropic, `npm:@anthropic-ai/sdk@0.97.0`, deliberately pinned.
- **Model**: `AI_CHAT_MODEL`, defaulting to `claude-sonnet-4-6`
  ([index.ts:1113](../../supabase/functions/ai-chat/index.ts#L1113)). Summarisation uses
  `AI_CHAT_SUMMARY_MODEL`, falling back to the same.
  *Aside*: `claude-sonnet-4-6` is now previous-generation and is priced **above** the current
  `claude-sonnet-5` ($3/$15 vs $2/$10 per MTok). Switching is an env-var change and is worth
  doing independently of this project.
- **Shape**: a hand-written agent loop, not the SDK tool runner. Up to 10 iterations. Tools
  within one turn are dispatched **sequentially**, not in parallel — a turn that calls three
  tools pays all three latencies end to end.
- **No vector RAG.** `search_help` is lexical BM25-flavoured scoring over
  `_shared/help-kb-index.json`, a build-time artifact bundled into the function and indexed once
  per isolate. No network, no API key, a few ms. (It used OpenAI embeddings until September 2026;
  telemetry shows it has never actually been called in production.)
- **Pre-processing that adds latency before the first token**: the eight-step Stage A list above.
  The expensive ones are `auth.getUser()` (a real network hop) and the unbounded history
  `SELECT`. Everything else is a fast indexed query, but they are serialised.

## 4. Tools and DB access

**15 tools** — note [`docs/AI_CHAT.md`](../AI_CHAT.md) says 14; `list_cost_classifications` was
added since. Defined in [`_shared/tools.ts`](../../supabase/functions/_shared/tools.ts),
implemented in [`_shared/tool-handlers.ts`](../../supabase/functions/_shared/tool-handlers.ts)
and [`_shared/help-search.ts`](../../supabase/functions/_shared/help-search.ts).

| Tool | Roles | Returns | Voice-suitable? |
|---|---|---|---|
| `search_projects` | all | `{id, name, location, status}[]`, limit ≤100 | yes |
| `get_project_details` | all | project row + phase/contract/milestone counts | yes |
| `list_project_phases` | all | phases by `phase_number`; omits `budget_used` | yes, if capped |
| `search_subcontractors` | all | `{id, name, contact, active_contracts_count}[]` | yes |
| `list_cost_classifications` | all | TIC cost-classification list | yes |
| `list_contracts` | all | contracts + joined subcontractor/phase/project | verbose, cap it |
| `get_subcontractor_payment_status` | Dir, Acc | contracted / invoiced / paid / outstanding | yes — ideal voice answer |
| `list_unpaid_invoices` | Dir, Acc, Sup | UNPAID + PARTIALLY_PAID invoices | verbose, cap it |
| `list_payments_for_subcontractor` | Dir, Acc | payment records, incl. `is_cesija` | verbose, cap it |
| `get_invoice_summary` | Dir, Acc | aggregates via `get_invoice_statistics` RPC | yes |
| `get_project_financial_summary` | Dir, Acc | budget / committed / spent / remaining rollup | yes — ideal voice answer |
| `search_help` | all | up to 5 **full KB articles** concatenated as Markdown | needs a voice variant |
| `list_documents_for_entity` | all | document rows | marginal |
| `get_document_download_link` | all | storage path for the client to sign | **no** |
| `create_document` | all | validates a model-authored PDF/xlsx/Markdown spec | **no** |

**Separation is clean.** The contract is:

```ts
interface ToolDefinition<I, O> {
  name: string
  description: string
  input_schema: Record<string, unknown>   // JSON Schema, Anthropic tools-API shaped
  requiredRoles: Role[]
  handler: (input: I, ctx: AuthContext, extras: ToolHandlerExtras) => Promise<O>
}
```

Dispatch is a one-liner: `TOOLS.find(t => t.name === name).handler(input, ctx, extras)`.
Handlers import nothing from `ai-chat/index.ts`. Their only dependencies are:

1. **`AuthContext`** — `{ userId, authUserId, role, email, assignedProjects, userClient, serviceClient }`.
   `userClient` is the RLS-respecting client and is what every handler reads through.
2. **`extras.helpSearch`** — `{ currentRoutePattern, currentRouteRaw }`, used only by `search_help`
   for its route boost and telemetry. Trivially nullable for voice.

**So yes — the tools could be exposed independently.** Two notes if we ever do:

- `input_schema` is already JSON Schema, so converting to OpenAI function-calling format is a
  mechanical wrap: `{ type: 'function', function: { name, description, parameters: input_schema } }`.
- For much of what the tools read, the **role gating is the security boundary**, not RLS.
  Checked against the migrations on 2026-09-23: `subcontractors`, `contracts`,
  `project_milestones`, `documents` and `document_associations` have `USING(true)` SELECT
  policies that gate nothing (on `documents`, UPDATE and DELETE are open too), and
  `accounting_companies` is open for SELECT (only its writes are role-gated). The `documents` /
  `contract-documents` storage buckets have no `storage.objects` policies at all. Access control
  for those lives in `selectAvailableTools(ctx)` and in `probeParentEntity()` inside the two
  document handlers. Any new surface that exposes these tools **must** re-implement both gates.
  (`accounting_payments` *is* role-gated at the database since
  [`20260526084700_tighten_cashflow_rls.sql`](../../supabase/migrations/20260526084700_tighten_cashflow_rls.sql)
  — `docs/AI_CHAT.md` still lists it as open; see the appendix.)

### Data-model landmines encoded in the tools

Carried here because they constrain any voice prompt too: `accounting_invoices.supplier_id` FKs
to `subcontractors` (there is no suppliers table); `project_phases` ≠ `project_milestones`;
phase ≠ cost classification (two different axes, and most projects have one phase);
`project_phases.budget_used` is stale and deliberately never returned; TIC is the only source of
planned budget, so a project without a TIC has *no* budget rather than the legacy
`projects.budget` value; status casing differs per table (Title Case / lowercase /
SHOUTING_SNAKE_CASE); `is_cesija` payments are normal and must be called out when present.

## 5. System prompt

[`_shared/prompts.ts`](../../supabase/functions/_shared/prompts.ts), 113 lines, Croatian,
assembled per request into a **two-element `system` array**:

1. `buildStaticSystemPrompt()` — byte-identical for every user, carries the
   `cache_control: ephemeral` breakpoint so it is a cross-user cache prefix.
2. `buildUserContext(ctx)` — `"## Korisnik\nKorisnik: {email}, uloga: {role}."` plus a
   Supervision-only RLS scope note. Sits after the breakpoint, uncached.

*Drift*: [`docs/AI_CHAT.md`](../AI_CHAT.md#system-prompt) refers to a single `buildSystemPrompt`.
That function does not exist.

The prompt is pure and deterministic given `AuthContext` — no clock, no environment reads. Its
sections: identity & scope, tools, document generation, help & navigation, attachments,
out-of-scope refusals, data-model landmines, domain flags, number/currency/date formats, tone,
and off-domain questions.

**It is written for a Markdown chat channel throughout.** Concretely voice-hostile pieces:

- Eleven `##` Markdown headings in the prompt itself — harmless, but the register it sets is
  written, not spoken.
- A whole section on `create_document` ending in *"kratko javite korisniku da je dokument spreman
  za preuzimanje"* — a download that cannot exist on a phone call.
- A section on attachments (images, PDFs, Excel) — irrelevant on a call.
- *"UI prikazuje pozive alata zasebno, vaš tekst neka bude odgovor, a ne najava"* — explicitly
  tells the model **not** to announce what it is doing, because chips do that. On a call, silence
  during a 15-second tool run is dead air; voice needs the opposite instruction.
- Route context: *"Korisnikova trenutna ruta navedena je u kontekstu svake poruke"* — there is no
  route on a phone call.
- Number and date formats are the **written** Croatian conventions: `1.234,56`, `1.234,56 EUR`,
  `dd.MM.yyyy.`. TTS reads these badly or literally.
- *"Prilagodite duljinu odgovora pitanju"* is the only length control, and there is no cap.

## 6. Auth and sessions

**Authentication.** [`_shared/auth.ts`](../../supabase/functions/_shared/auth.ts). Reads
`Authorization: Bearer <jwt>`, validates via `userClient.auth.getUser()`, then resolves the app
profile from `public.users` by `auth_user_id`, then (Supervision only) `project_managers`.
Role and project assignments are re-read on **every** request rather than trusted from the token,
deliberately, so a role downgrade takes effect immediately.

**Dual-client pattern.** `AuthContext` carries both:

- `userClient` — anon key + the user's JWT. RLS evaluates `auth.uid()`. **Every tool handler reads
  through this.**
- `serviceClient` — service role, bypasses RLS. Used for `ai_sessions` / `ai_messages`
  persistence, always with an explicit `.eq('user_id', ctx.userId)` / `.eq('session_id', …)`.
  The function layer *is* the authorisation for those writes.

This is the crux for voice: **there is no JWT on an inbound phone call**, and `userClient` cannot
be constructed without one. Dropping to `serviceClient` for tool reads would silently remove the
RLS backstop that scopes Supervision users to their assigned projects.

There is precedent for non-JWT callers, though. [`sort-document`](../../supabase/functions/sort-document/index.ts)
and [`import-erp`](../../supabase/functions/import-erp/index.ts) both run `verify_jwt = false`
and authenticate in-function against a shared secret (`x-doc-sort-secret`, `x-erp-import-secret`)
with a constant-time compare; `import-erp` accepts a JWT *or* a secret on the same endpoint.

**Sessions.** `ai_sessions` (owner, title, `cancel_requested_at`, `context_summary`,
`summary_through_message_id`) and `ai_messages`. History is a **tree**, not a chain:
`ai_messages.parent_id` self-references, siblings are edit/regenerate branches, and the active
branch is derived implicitly as "walk parents back from the row with the largest `created_at`".
All three tables (plus `ai_message_attachments`) have owner-scoped RLS on all four verbs.

**Rate limiting.** [`_shared/rateLimit.ts`](../../supabase/functions/_shared/rateLimit.ts):
20 user messages / 5 min burst, 200 / 24 h daily, counted as `ai_messages` rows. Fails **open** on
a count-query error. Known benign race under concurrency.

**No phone number exists anywhere on a user.** `public.users` is
`(id, auth_user_id, email, username, role, created_at)`. `phone` / `contact_phone` columns exist
on `partners`, `banks`, `customers`, `retail_customers`, `retail_suppliers` and `erp_partners` —
all counterparties, none of them app users. Caller-ID mapping needs new schema; there is nothing
to reuse.

## 7. What is voice-hostile

Ordered roughly by how much work each one implies.

1. **No token streaming** ([§2](#2-streaming)). The blocker.
2. **Markdown output.** The model is prompted into, and the UI renders, Markdown
   ([`AiChatMessage.tsx:178`](../../src/components/AiChat/AiChatMessage.tsx#L178) →
   `MarkdownView`). Headings, bullets, bold and tables read aloud as punctuation noise.
3. **Written-form numbers, currencies and dates.** `1.234,56 EUR` and `15.03.2026.` are prompt
   requirements today. TTS needs `tisuću dvjesto trideset četiri eura i pedeset šest centi`, or at
   minimum an aggressively rounded spoken form.
4. **UI-dependent tool results.** `create_document` renders a download card;
   `get_document_download_link` returns a storage path the client is expected to sign and link.
   Both are meaningless over a phone and must be removed from the voice tool set.
5. **Unbounded response length.** No cap exists. A financial rollup or an unpaid-invoice list
   becomes a minutes-long monologue the caller cannot skim or interrupt usefully.
6. **`search_help` returns up to five full KB articles** as concatenated Markdown — a large tool
   result the model then has to compress, adding both latency and a temptation to over-answer.
7. **"Do not announce what you are doing."** Correct for chat, wrong for voice, where a filler
   phrase is what keeps the line from sounding dead during a tool call.
8. **Route context injection.** `[Kontekst: korisnik je trenutno na /projekti]` has no analogue on
   a call; it must be suppressed rather than sent empty.
9. **Attachments.** Upload, base64 replay, stripping — all dead weight on the voice path.
10. **Timeouts sized for a text UI.** 90 s request, 15 s per tool, 10 iterations. Each needs a much
    tighter voice-channel value.
11. **Error messages are written Croatian** aimed at a toast/inline row
    (`ERROR_LABELS_HR`), not at being spoken.

## Appendix — drift found between docs and code

Audited 2026-09-23 against the code and migrations on `development` at `97d87deb`. Items 1 and 2
are **fixed** on the `feature/voice-assistant` branch; the rest are **logged, not fixed**, so each
can be picked up deliberately.

| # | Where | Doc says | Code / schema says | Status |
|---|---|---|---|---|
| 1 | `AI_CHAT.md` → System Prompt | A single `buildSystemPrompt`; "tool names are deliberately not repeated"; file work listed as out of scope | `buildStaticSystemPrompt()` + `buildUserContext(ctx)` in a two-block `system` array; the prompt names `create_document` and `search_help`; document generation is explicitly *not* out of scope; landmines now include phase-vs-classification and TIC | **Fixed** on this branch |
| 2 | `AI_CHAT.md` → Overview, Tool Catalog (intro, role table, "What each tool returns"), Security §4 tier list | 14 tools; `list_contracts` filters by project / phase / subcontractor / status; the `ALL_ROLES` tier listed five tools | 15 — `list_cost_classifications` (all roles) was missing everywhere; `list_contracts` also filters by and joins `classification`; the `ALL_ROLES` tier also omitted `search_help` and the three document tools | **Fixed** on this branch (with `CODEBASE_INDEX.md`) |
| 3 | `AI_CHAT.md` → Security §3 | `accounting_payments` and `accounting_companies` have `USING(true)` RLS | `accounting_payments` is role-gated since `20260526084700` (Director/Accounting full access, Sales a scoped SELECT). `accounting_companies` SELECT is still `USING(true)`; only its writes are gated. The doc predates the migration | Logged |
| 4 | `CLAUDE.md` → Key Domain Concepts, "Cashflow profile" | `accounting_companies` is RLS-gated to Director/Accounting | Only INSERT/UPDATE/DELETE are gated; any authenticated user can SELECT | Logged |
| 5 | `AI_CHAT.md` → Data Model | "Three tables back the feature" | Four — `ai_help_searches` (search telemetry, `20260520120000`) is not documented there | Logged |
| 6 | `AI_CHAT.md` → Deployment → Type generation; Known Limitations | After `db:types`, copy the file to `_shared/database.ts` by hand; the two must be "kept in sync by hand" | `npm run db:types` now does the copy itself and generates both the `public` and `erp` schemas (and, per `CLAUDE.md`, drops the ERP types while ERP is on hold) | Logged |
| 7 | `AI_CHAT.md` → Known Limitations | "No automated test coverage" | `_shared/help-score.test.ts` covers `search_help` retrieval (`npm run test:functions`). The orchestration loop, the tool handlers and the frontend still have none, and that matters for the voice plan | Logged — the edge function is now covered by phase 1's characterisation suite ([`03-characterisation-tests.md`](./03-characterisation-tests.md)); the frontend still is not |
| 8 | `AI_CHAT.md` → Known Limitations | "221 of 223 migrations" unregistered on Landmark-Test | The counts are stale (347 migrations as of 2026-09-14). Whether the desync still exists was not checked | Logged |
| 9 | `ai-chat/index.ts` header comment (lines 31–39) | *(code comment)* Client disconnect aborts `req.signal`, which cancels the loop | `AI_CHAT.md` → Cancellation is the accurate one: `req.signal` is a no-op in the Edge runtime, and the DB cancel beacon is the real mechanism. The header comment is stale | Logged |
| 10 | `_shared/tools.ts` header comment | *(code comment)* "defines the 12 tools"; "each handler is currently a stub that echoes its input back" | 15 tools, all with real handlers in `tool-handlers.ts` / `help-search.ts` | Logged |
