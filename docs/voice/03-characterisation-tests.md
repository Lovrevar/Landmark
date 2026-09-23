# Voice access — Phase 1: characterisation tests for `ai-chat`

Written 2026-09-23. This is phase 1 of [`02-voice-implementation-plan.md`](./02-voice-implementation-plan.md)
(§10): a test suite that pins what the `ai-chat` edge function **does today**, before phase 2
(token streaming, parallel dispatch) and phase 3 (extracting the orchestrator) change the code
that answers money questions.

**Status: green against the current orchestrator.** `supabase/functions/ai-chat/index.ts`
and `_shared/` are **unmodified** by this phase. There are 106 tests in
`supabase/functions/ai-chat/tests/`: 100 scenarios plus 6 tests of the fakes. The full function
suite is 216/216.

Behaviour that looked like a bug was **pinned as-is, not fixed**, and is logged in
[`open-questions.md`](./open-questions.md). The tests carry the matching `[OQ-n]` tags.

## Running

```bash
npm run test:functions                     # everything, as CI runs it (.github/workflows/test.yml)
cd supabase/functions && deno test --allow-net --allow-env ai-chat/tests/   # just this suite, ~5 s
AI_CHAT_TEST_LOGS=1 deno test --allow-net --allow-env --filter L26 ai-chat/tests/   # one scenario, with the function's logs
```

No network access, no Supabase project and no API key are needed. Everything runs in-process.

## How it works

The fakes stand in for the **services**, not the client libraries:

| File | Role |
|---|---|
| `fake-anthropic.ts` | Answers `POST /v1/messages` on `ANTHROPIC_BASE_URL` from a script. It returns a JSON `Message` for `messages.create`, and the same message as an SSE event stream when `stream: true`, which is what `messages.stream` sends. It enforces the real API's conversation-shape rules: first turn is a user turn, and every `tool_use` must be answered by a `tool_result` in the next user turn. |
| `fake-supabase.ts` | Answers GoTrue `/auth/v1/user`, PostgREST `/rest/v1/*` and Storage on `SUPABASE_URL` from in-memory tables. It covers the PostgREST subset that ai-chat and its tool handlers use: embeds, `!inner`, embedded and `or` filters, counts, and `single`/`maybeSingle`. It records every request, tagged with which client sent it (service role or user JWT), and supports fault injection and hangs. |
| `harness.ts` | Routes global `fetch` to the fakes, then imports the **real** `index.ts` while swapping out `Deno.serve`, so its handler is captured instead of bound to a port. Tests call the handler with plain `Request`s and read the SSE stream to its end. |
| `fixtures.ts` | The seeded world. It covers five roles, a TIC project, a no-TIC project with a legacy budget, a project with neither, a single-phase project whose contracts sit in two cost classifications, a phase with a stale `budget_used`, and an invoice that matches the financial summary by both of its paths. |

Why this design:

- **No seam in `index.ts`.** The plan's first draft allowed one change, making the Anthropic client
  injectable. It wasn't needed: the SDK reads `ANTHROPIC_BASE_URL` and uses the global `fetch`.
- **It survives phase 2 unchanged.** Because the fake speaks the wire protocol, switching from
  `messages.create` to `messages.stream` is invisible to it. `fake-anthropic.test.ts` proves, through
  the real SDK, that both calls return an identical message.
- **The real client libraries stay in the loop.** `postgrest-js` and `auth-js` build real requests,
  so the suite pins what the orchestrator actually sends: select lists, filters, which client made
  the call.

Every `scenario(...)` starts from a freshly seeded world. It fails if the function makes a model
call that wasn't scripted, or leaves a scripted turn unused.

## Proof that the suite detects change

Six deliberate mutations of the orchestrator, each applied, run and reverted (all six are caught):

| Mutation | Caught by |
|---|---|
| Parallel tool dispatch (`Promise.all`) | L09 |
| `list_project_phases` also selects `budget_used` | M03 |
| Emit `turn` before persisting the assistant row | L01, L05, L07, L08, L13, L14, L15, L20, L42, L44, L46, L48 |
| Iteration cap 10 → 9 | L19, L47 |
| Drop the route-context line | L32, L33, L34 |
| **The phase 2 refactor itself**: `messages.create` → `messages.stream().finalMessage()` | **L03 only** (the `[PHASE 2]`-tagged `stream` assertion) |

The last row is the important one. A minimal streaming refactor changes exactly one tagged
assertion and nothing else, so parity across phase 2 is checkable.

## Rules for phases 2 and 3

- **Phase 2 (streaming, parallel dispatch)** may change only tests tagged `[PHASE 2]`, and the
  change must appear in the PR diff:
  - **L03** asserts `body.stream === undefined`. It flips to `true`.
  - **L09** pins sequential dispatch. Rewrite it to pin concurrent dispatch.
  - **L08** asserts `tool_result` **events** in `tool_use` order. The plan allows completion order
    for events (plan §3.2), so the event half of L08 may change. The persisted row must keep
    `tool_use` order.

  New assertions for the delta events are additions, not changes.
- **Phase 3 (extraction)** may change **no test at all**. The PR links a green run on the commit
  before the extraction and on the commit after it (plan §4.1).
- **An `[OQ-n]` test changes only when that open question is decided.** Such a change goes in its
  own commit, never inside a refactor.

## Coverage of the orchestration paths

Every branch in `ai-chat/index.ts`, mapped to its scenarios. "—" marks a path that isn't
reached; the reasons are in the next section.

| Area | Branch | Scenarios |
|---|---|---|
| **Entry** | CORS preflight, non-POST | P01, P02 |
| | auth: no header, rejected token, no profile, missing env | P03, P04, P05, P31 |
| | invalid JSON body | P08 |
| | debug branch: env gate, role gate, unknown tool, success | P29, P30 |
| | debug branch: handler throws → 500 `tool_error` | — |
| | outer catch → 500 | P31 |
| **Pre-stream** | message missing / empty / too long | P09, P10 |
| | attachment validation; edit + attachments | P22, P23 |
| | rate limit: pass, burst, daily, fail-open, query shape, tool-result counting | P11–P16 |
| | new session: proposed id free / taken / invalid; probe failure; insert failure | P18, P32, P25 |
| | existing session: not found, foreign, lookup failure | P17, P32 |
| | edit: new session, unknown target, assistant target, lookup failure | P20, P33 |
| | parent: not found, lookup failure | P19, P33 |
| | history: load failure, cycle | P26, P21 |
| | context window: summary applied / ignored, hard ceiling, attachment stripping | L38, L39, L41, L40 |
| | user content: text attachment, image, download failure | L34, L35, P28 |
| | user-row insert failure; side-table failure with rollback | P24, P27 |
| | route resolution: known, unknown, malformed | L32, L33 |
| **Stream** | `: ready`, then `session` first | L01 |
| | 90 s request timeout, with keepalives | L30 |
| | DB cancel beacon: at a boundary, after dispatch, during the model call; stale beacon; read failure | L24, L25, L27, L28, L29 |
| | post-turn compaction: runs, model override, failure, persist failure, skipped when short | L42, L43, L44, L48, L45 |
| | client disconnect via `req.signal` / `writer.closed` / write failure | — (deliberately not pinned) |
| | worker catch-all → `internal_error` event | — |
| **Loop** | request shape: model, `max_tokens`, system blocks, tool filtering, cache breakpoints | L03, L04, L06 |
| | Anthropic error mapping (429/401/400/500/529, connection) | L22, L23 |
| | `model_timeout` | — |
| | assistant-row insert failure | L20 |
| | events in content-block order; thinking skipped | L07, L13 |
| | `stop_reason: tool_use` with no block | L14 |
| | dispatch: success, `{error}` envelope, role refusal, unknown tool, timeout | L05, L10, L11, L12, L31 |
| | several tools per turn; sequential dispatch | L08, L09 |
| | `tool_result` insert failure | L21 |
| | truncation guard: `max_tokens`, other stop reason, insert failure | L16, L17, L18 |
| | terminal stop reasons | L01, L15 |
| | iteration cap; cap-row insert failure | L19, L47 |
| | title backfill: new session, existing session, failure | L02, L36, L46 |
| | follow-ups and edits replay the correct ancestor chain | L36, L37 |
| | a stuck branch after a mid-tool stop | L26 |
| **Tools** (through the loop) | budget / spend / phase / classification rules; scoping; statuses; cesija; rollups | M01–M19 |
| | tool reads use the user's JWT; persistence uses the service role | L02, L05, P06, P15 |

## Paths not reached, and why

| Path | Why | What would reach it |
|---|---|---|
| Client disconnect via `req.signal`, `writer.closed`, SSE write failure | Reachable in-process, but **deliberately not pinned**. The Supabase Edge runtime does not deliver these signals (`docs/AI_CHAT.md` → Cancellation), so a test would characterise Deno, not production. | Nothing needed. Revisit if the runtime starts delivering them. |
| Worker catch-all (`stream worker error` → `internal_error`) | Needs an exception to escape the loop's own catches, for example a tool output that `JSON.stringify` rejects. No current handler produces one. | Changing a handler, which is out of scope for characterisation. |
| `model_timeout` (SDK connection timeout) | The SDK's timeout is 10 minutes. The 90 s request timeout always fires first. | Changing a timeout constant (a refactor). |
| Request timeout firing *during tool dispatch* | With one hung tool, the 15 s tool timeout always fires first. It would take 7+ hung tools in one turn. From the code, it takes the same after-dispatch exit as OQ-1. | The phase 3 extraction, if timeouts become parameters. |
| Debug branch: handler throws → 500 `tool_error` | No handler throws on any input the debug body can carry. | Changing a handler. |
| **What RLS actually returns** | The fake does not evaluate Postgres policies. The suite pins *which client* made each call and the explicit filters the code adds (M12, M13), but not the rows RLS would hide. | A real database (`supabase start`). It's worth doing before voice, because Supervision scoping of invoices relies on RLS alone (OQ-10). |
| What the model *chooses* to do | Scripted by design. The suite pins what the model is **told** (M01, M02) and what it is **given** (every M scenario), not how it reasons. | An eval set. Out of scope here. |

## Scenario list

### Pre-stream (`prestream.test.ts`)

| Id | Scenario |
|---|---|
| P01 | OPTIONS preflight returns 200 with CORS headers |
| P02 | non-POST is rejected with 405 method_not_allowed |
| P03 | missing Authorization header is 401, before any DB or model access |
| P04 | a token GoTrue rejects is 401 unauthorized |
| P05 | a valid auth user with no public.users profile is 403 no_profile |
| P06 | role and Supervision project assignments are re-read from the DB with the service role on every request |
| P07 | non-Supervision roles do not query project_managers |
| P08 | a malformed JSON body is 400 bad_request |
| P09 | missing, empty and whitespace-only messages are 400 bad_request |
| P10 | the 4000-character cap counts the raw string: 4000 passes, 4001 is message_too_long |
| P11 | burst limit: 19 user rows in the last 5 minutes pass, 20 are 429 rate_limited |
| P12 | daily limit: 200 user rows older than the burst window are 429 |
| P13 | a rate-limited request creates no session and writes nothing |
| P14 | [OQ-3] tool_result rows count toward the per-user message limits |
| P15 | the limiter counts through ai_sessions!inner with the service role, filtered to this user |
| P16 | a failing count query fails OPEN: the request proceeds and the failure is logged |
| P17 | an unknown session_id, or another user's session, is 404 session_not_found |
| P18 | proposed_session_id: honoured when free, replaced when taken, ignored when not a UUID |
| P19 | a parent_message_id outside the session is 404 not_found |
| P20 | edits: rejected on a new session, on an unknown target, and on an assistant row |
| P21 | a cycle in the parent chain is 500 "Conversation tree is corrupted." |
| P22 | attachment validation rejects each malformed shape, before the rate limiter runs |
| P23 | attachments combined with an edit are 400 edit_with_attachments_unsupported |
| P24 | [OQ-7] a failed user-row insert is 500, and leaves the just-created session behind, empty |
| P25 | a failed session insert is 500 "Failed to create session" |
| P26 | a failed history load is 500 "Failed to load history" |
| P27 | a failed attachment side-table insert rolls back the user row and removes the stored files |
| P28 | an image that cannot be downloaded is 500 attachment_processing_failed |
| P29 | debug branch: 404 while AI_CHAT_DEBUG_ENABLED is anything but the literal "true" |
| P30 | debug branch, enabled: Director-only, 404 for unknown tools, runs the handler directly |
| P31 | a missing Supabase secret is 500 "Server misconfigured"; an unusable URL reaches the outer catch |
| P32 | session-resolution query failures are 500s with distinct messages |
| P33 | edit-target and parent lookup failures are 500s |

### Orchestration loop (`loop.test.ts`)

| Id | Scenario |
|---|---|
| L01 | wire format: ": ready" first, then session; every event: line equals its data.type |
| L02 | a plain answer persists session, user row and assistant row, all through the service role |
| L03 | the model request: default model, max_tokens 8192, two-block system, role-filtered tools, cache breakpoints |
| L04 | AI_CHAT_MODEL overrides the model |
| L05 | one tool round trip: events, four chained rows, JSON-string tool_result, tool read through the user JWT |
| L06 | the prompt-cache breakpoint slides to the last block of the last message on every call |
| L07 | text and tool_use in one turn are emitted in content-block order |
| L08 | two tools in one turn: one tool_result row, blocks in tool_use order |
| L09 | [PHASE 2] tools within a turn are dispatched sequentially: the second starts after the first finishes |
| L10 | a handler that returns { error } becomes an is_error tool_result, and the loop continues |
| L11 | a tool the role may not use is not advertised, and is refused at dispatch if named anyway |
| L12 | an unknown tool name is refused at dispatch as unknown_tool |
| L13 | thinking blocks are persisted in the assistant row but never emitted as events |
| L14 | stop_reason tool_use with no tool_use block ends the turn: done, no dispatch, no tool_result row |
| L15 | a terminal max_tokens on a plain answer passes the raw stop_reason through, with no synthetic text |
| L16 | truncation mid tool_use (max_tokens): error tool_result, persisted, then a Croatian explanation |
| L17 | truncation with any other terminal stop_reason uses the generic message |
| L18 | [OQ-4] truncation guard: if the synthetic tool_result insert fails, the explanation is still emitted, unpersisted |
| L19 | the 10-iteration cap: 10 model calls, then a synthetic tool_limit_reached answer chained off the last tool_result |
| L20 | a failed assistant insert emits persistence_error and nothing for that turn; no title backfill |
| L21 | [OQ-5] a failed tool_result insert: the tool_result EVENT was already sent, the row never exists |
| L22 | Anthropic errors map to a mid-stream error event with a fixed code and Croatian message |
| L23 | a connection failure is retried twice by the SDK, then maps to model_unreachable |
| L24 | a cancel beacon seen at an iteration boundary ends the stream silently; rows so far stay |
| L25 | [OQ-1] a cancel during tool dispatch drops the result and leaves an unanswered tool_use row |
| L26 | [OQ-1] after that cancel, every follow-up on the branch is rejected by the model API |
| L27 | [OQ-1] a cancel requested during the model call still runs the tool, then drops its result |
| L28 | a beacon older than the request does not cancel it |
| L29 | a failing beacon read fails open: the turn completes and the failure is logged |
| L30 | the 90 s request timeout: keepalives every 15 s, then a request_timeout error event |
| L31 | the 15 s per-tool timeout becomes an is_error tool_result and the loop continues |
| L32 | route context is prepended to the latest user message in memory only, never persisted |
| L33 | unknown or malformed routes add no context line; history turns never carry it |
| L34 | [OQ-8] with a text attachment, the route line lands on the attachment block, not the typed message |
| L35 | an image attachment is downloaded, base64-encoded before the text, and persisted in the user row |
| L36 | a follow-up replays the ancestor chain root → parent and chains the new user row off the parent |
| L37 | an edit inserts a sibling under the target's parent and replays only the chain above it |
| L38 | a stored summary whose boundary is on this branch replaces the turns up to it, as a banner |
| L39 | a summary whose boundary is not on this branch is ignored |
| L40 | image/PDF blocks older than the 6 most recent history messages are replaced by placeholders |
| L41 | the 130K-token hard ceiling drops whole oldest turns |
| L42 | past 60K estimated tokens, a summary call runs after done and stores the summary and boundary |
| L43 | AI_CHAT_SUMMARY_MODEL overrides the summarisation model only |
| L44 | a failed compaction is silent to the user and leaves the session unchanged |
| L45 | short threads are never compacted: one model call per plain turn |
| L46 | a failed title backfill is logged and does not affect the stream |
| L47 | [OQ-4] if the iteration-cap row fails to insert, the limit message is still emitted (logged) |
| L48 | a failed summary write after compaction is logged; the stream is unaffected |

### Money-question rules (`money.test.ts`)

| Id | Scenario |
|---|---|
| M01 | the cached system prompt carries the money rules, byte-identical across users |
| M02 | the tool descriptions repeat the budget rules where the model chooses tools |
| M03 | list_project_phases never selects or returns budget_used, even when the row holds a value |
| M04 | financial summary (TIC project): spent = Σ contracts.budget_realized; invoices deduped across both paths |
| M05 | [OQ-2] no TIC but a legacy projects.budget: the stale number is returned as the budget, unflagged |
| M06 | [OQ-2] no TIC and no budget: budget reads 0, remaining goes negative, and over_budget is true |
| M07 | [OQ-2] get_project_details returns every projects column, legacy budget included, and no TIC indicator |
| M08 | a malformed project_id is refused before any query (the .or() filter-injection guard) |
| M09 | list_contracts by classification returns only that category, with the classification embedded |
| M10 | on a single-phase project, filtering by phase returns every contract: phase does not separate spend |
| M11 | list_cost_classifications: active ones by sort_order; include_inactive adds retired ones |
| M12 | Supervision: list_contracts adds an explicit project scope; with no assignments it skips the query |
| M13 | list_unpaid_invoices: raw SHOUTING_SNAKE statuses, due date first; Supervision scoping is left to RLS |
| M14 | list_payments_for_subcontractor joins through invoices on supplier_id and passes is_cesija through |
| M15 | get_subcontractor_payment_status: "paid" comes from invoices, next to a different contract-realized figure |
| M16 | [OQ-6] a subcontractor with contracts but no invoices yet is reported is_fully_paid: true |
| M17 | get_invoice_summary coerces the RPC's string numerics and accepts a row or a one-row array |
| M18 | search_projects retries with a Croatian stem when the inflected form misses |
| M19 | search_projects escapes % and _ so user input cannot widen the match |

### The fakes themselves (`fake-anthropic.test.ts`)

`create` and `stream` return the same message (text, thinking, tool_use); `stream` delivers
incremental text deltas; scripted API errors surface as the SDK's typed errors without retries; the
fake rejects an unanswered `tool_use`, an orphan `tool_result` and a non-user first turn; and it
accepts a well-formed tool round trip.

## Adding a scenario

```ts
scenario('L49 what it pins, in one line', async () => {
  const tu = toolUse('search_projects', { query: 'Funtana' })
  anthropic.script(callTools(tu), answer('…'))                  // what the model "says", turn by turn
  db.fault((r) => r.table === 'ai_messages' && r.method === 'POST', { status: 500 })  // optional
  const sse = await chat({ session_id: null, message: 'Nađi Funtanu' })
  assertEquals(sse.types, ['session', 'tool_call', 'tool_result', 'turn', 'done'])
  // then: db.rows(...), db.requestsTo(...), anthropic.calls[n].body, logs
})
```

Assert on the wire output, the rows, and the requests the function sent: never on internals. If
the new behaviour looks wrong, pin it anyway, tag the test `[OQ-n]` and add the entry to
`open-questions.md`.
