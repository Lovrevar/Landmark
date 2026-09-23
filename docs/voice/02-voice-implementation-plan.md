# Voice access — Phase 2: implementation plan

> **⚠️ Pending stakeholder decision — channel order.** This plan assumes the **in-app call
> button is v1** and the **phone number (PSTN) is v2**. It was drafted the other way round. The
> reorder moves caller-ID schema, token minting, spoofing defences and the DTMF PIN flow out of
> v1 (see [§2](#2-channels-v1-in-app-v2-pstn)). The PSTN work is still fully specified, as v2, in
> [§9](#9-v2-pstn-caller-identification). If stakeholders keep PSTN first, §9 moves into v1 and the
> [§11 estimate](#11-estimate-and-open-questions) changes accordingly.

Written 2026-09-23, amended the same day after team review. Builds directly on
[`01-chat-assistant-analysis.md`](./01-chat-assistant-analysis.md); every recommendation here
cites a finding there rather than re-deriving it.

**What this revision changed:** channels reordered (in-app = v1, PSTN = v2); latency work
promoted to its own critical-path section, with parallel tool dispatch, a bounded history read
and day-one filler speech; the voice tool set became an explicit default-deny allowlist keyed
by channel; the Croatian STT/TTS prototype became a parallel phase 0 with pass criteria;
characterisation tests now gate the extraction PR with a before/after parity requirement; the
estimate was re-cut into v1 and v2.

Goal: a user talks, in Croatian, to the same assistant that answers in the app — first from an
in-app call button, then from a phone number, later over WhatsApp.

Standing constraints:

- One shared backend. No forked assistant.
- Minimal change to existing chat behaviour; voice adaptations sit behind a channel flag.
- Incrementally executable — **every phase leaves chat working**.

---

## 1. Integration strategy

> **Recommendation: (a) Custom LLM mode** — wrap the existing assistant in an OpenAI-compatible
> streaming endpoint that Vapi/Retell calls. It depends on the latency work in §3, which is a
> prerequisite, not a nice-to-have.

### Why not (b), platform-native LLM + our tools as an API

1. **It forks the brain, which is the one thing we said we would not do.** The Croatian system
   prompt carries the data-model landmines that make answers *correct*: `supplier_id` points at
   `subcontractors`, phase ≠ cost classification, `budget_used` is stale, TIC is the only source
   of planned budget, and `is_cesija` must be surfaced (analysis §4, §5). A platform-side LLM
   would need all of that too, kept in a second place where it drifts.
2. **The latency win is smaller than it looks.** Our slow path is two full non-streamed model
   turns plus sequential tool dispatch (analysis §2). A platform LLM calling our tools over HTTP
   still pays the tool latency and adds a network hop per call.
3. **The access gates would have to be re-implemented on a public surface** (analysis §4), over
   tables whose SELECT policies are `USING(true)`. That kind of duplication is what produces a
   leak.

### How (a) works

One brain, one prompt lineage, one tool registry, one role gate. **The voice platform never sees
our tool calls**: our endpoint runs the whole agent loop internally and streams only
natural-language text as OpenAI `chat.completion.chunk` deltas. Proxying tool calls up to the
platform would buy nothing, since it cannot execute our tools.

If the team decides not to do the latency work in §3, do not build voice on (a). Revisit (b) and
accept the forked prompt as a known cost.

---

## 2. Channels: v1 in-app, v2 PSTN

| | **v1 — in-app call button** | **v2 — phone number (PSTN)** |
|---|---|---|
| Transport | Browser WebRTC through the platform's web SDK | Platform-provisioned phone number |
| Identity | The signed-in user's existing Supabase session | Caller ID → enrolled identity → user |
| Auth strength | Same as chat | Caller ID is spoofable, so a **mandatory DTMF PIN** for finance roles |
| RLS client | The user's own JWT, handed off server-side (§4.4) | A server-minted short-lived JWT (§9) |
| New schema | `ai_sessions` channel columns, `voice_calls` | + `voice_caller_identities`, `ai_sessions.caller_phone` |
| Spoofing / PIN / enrolment | Not applicable | Required |

Why this order: v1 inherits chat's authentication wholesale, so the hardest security problems in
the project (spoofable identity, token minting, a second factor) are deferred until the shared
backend is proven. v1 is also where `search_help` and navigation questions make the most sense,
because the caller is looking at the app while talking.

**One premise needs care.** "The in-app call runs on the existing JWT" is true in substance, but
the voice platform — not the browser — calls our LLM endpoint, so the JWT does not arrive there
by itself. §4.4 hands it off **server-side**, keyed by an opaque call token, so the user's bearer
token never reaches the vendor. This matters because a leaked user JWT works directly against
PostgREST, **bypassing the tool allowlist entirely**. With `USING(true)` policies (on
`documents`, even UPDATE and DELETE are open), a user-level token is worth far more than the
twelve tools voice can call.

---

## 3. Latency: the critical path

Streaming is necessary but **not sufficient**. Even with token streaming, the caller on a data
question sits through a full turn 1, then every tool call, before turn 2's first delta. Each item
below is on the critical path for v1, not a backlog item.

### 3.1 Token streaming in the shared loop

`ai-chat/index.ts:1225` — `messages.create` becomes `messages.stream`. The SDK's `finalMessage()`
returns the same complete `Message` the code persists today, so **the persistence contract does
not change**:

```ts
const stream = anthropic.messages.stream({ model, max_tokens, system, tools, messages }, { signal })
for await (const ev of stream) {
  if (ev.type === 'content_block_delta' && ev.delta.type === 'text_delta') {
    await sink.textDelta(ev.delta.text)
  } else if (ev.type === 'content_block_start' && ev.content_block.type === 'tool_use') {
    await sink.toolStarting()                      // drives the filler, §3.4
  }
}
const response = await stream.finalMessage()       // identical shape to today's `response`
```

Chat keeps receiving its existing `turn` event, emitted after persistence from
`finalMessage()`, so **the chat frontend needs no change**. Leave `eager_input_streaming`
**off**: it streams unvalidated tool inputs, and we never surface tool inputs to the caller.

### 3.2 Parallel dispatch of independent tool calls

Today every `tool_use` block in a turn is dispatched **sequentially**
(`index.ts`, the `for (const tu of toolUses)` loop), so a turn with three calls pays all three
latencies end to end. Dispatch them concurrently:

```ts
const results = await Promise.all(
  toolUses.map(tu => dispatchToolWithTimeout(tu.name, tu.input, ctx, extras, channelTimeout)),
)
```

- **Safe by construction.** Calls that the model emits together in one turn are independent: a
  call that needs another call's output can only be issued in a later turn, after that output
  exists. Every current handler is a read.
- **Order is preserved where it matters.** `tool_result` blocks go back in the original
  `tool_use` order, in a **single** user message. Splitting them across messages teaches the model
  to stop making parallel calls. SSE `tool_result` events may be emitted in completion order,
  since the frontend keys them by `tool_use_id`.
- Check cancellation once, after `Promise.all`. Each call keeps its own timeout.
- Benefits chat too, and ships in the same phase as streaming.

### 3.3 Bound the session-history read

`handleChat` loads **every** row of the session — full `content` JSONB including base64
attachment bytes — only to walk the parent chain in memory (analysis §2, Stage A step 5). The
cost grows with the thread, not with what gets replayed.

Replace it with one bounded round trip: a SQL function that walks `parent_id` from the leaf in a
recursive CTE and returns at most *N* rows, stopping early at the session's
`summary_through_message_id`. The boundary row is included so `selectKeptChain` can still verify
that the summary applies to this branch. Then:

- Cut on **turn boundaries** only, as `context-window.ts` already does, so a `tool_use` never
  loses its `tool_result`.
- If *N* is reached before the boundary (a long thread that has never been compacted),
  `enforceHardCeiling` remains the backstop, exactly as today.
- Fold the session-meta read (analysis §2, step 6) into the same call.

The steady-state voice path reads history from the request body and skips this read (§7). It is
still on the critical path for three reasons. It is the shared prep that chat uses, and chat's
time to first token becomes visible once chat streams. It is the path voice falls back to when a
call resumes. And it is the one pre-stream cost that grows without limit.

### 3.4 Filler speech from the moment tool calls start — day one

Silence while tools run is what makes a voice agent feel broken, and fixing it is day-one
configuration, not polish. Mechanism:

- **Primary — emitted by our endpoint.** In Custom LLM mode the platform cannot see our tool
  calls (§1), so platform settings cannot be keyed to "a tool call started". Our endpoint can: on
  the first `content_block_start` of type `tool_use` in a user turn, `OpenAiChunkSink` emits one
  filler sentence as a content delta, before the tool runs. Rotate a few variants so it doesn't
  sound canned:
  *"Samo trenutak, provjeravam."* · *"Trenutak, gledam podatke."* · *"Samo malo, dohvaćam to."*
  (Write them without an ellipsis — some TTS engines read "…" literally or pause oddly. Native
  review, open question 9.)
- **Backstop — platform configuration.** Enable the platform's latency-triggered filler or
  backchannel setting, for delays where no tool is involved (for example, a slow first token).
  Setting names differ between Vapi and Retell; confirm them in phase 0.
- Emit **once per user turn**, never per tool call. Because the server owns the filler, the voice
  prompt tells the model **not** to announce lookups itself (§6); otherwise the caller hears it
  twice.

### 3.5 Other savings that ride along

- **Voice history comes from the request** (§7) — no tree walk, no summary lookup, no
  context-window management.
- **Persistence moves off the critical path** for voice (§7).
- Voice uses `max_tokens: 384` instead of 8192 (§4.2); the model stops sooner and TTS starts
  sooner.
- The three pre-stream lookups (rate limit, session, session meta) are independent and can run
  concurrently with `Promise.all`. This is cheap, and it applies to both channels.

### What to measure

Phase 2 (§10) records **end of caller speech → first audio byte** at p50 and p95, for a
no-tool question and for a single-tool question, before and after each change above. Phase 0
records the platform's own floor, using its default LLM. The difference between the two is the
latency our backend adds, and it is the number to drive down.

---

## 4. Required backend changes

Items marked **[shared]** are the anti-duplication points — doing them twice would be the real
failure of this project. §3 already covered the latency changes.

### 4.1 Extract the orchestrator to `_shared/` **[shared]**

Move out of `ai-chat/index.ts`, behaviour unchanged:

| To | What |
|---|---|
| `_shared/orchestrator.ts` | `runOrchestrationLoop`, `dispatchTool`, `dispatchToolWithTimeout`, `mapAnthropicError` |
| `_shared/event-sink.ts` | the `EventSink` interface + `SseEventSink` (today's six events) |
| `_shared/sse.ts` | `SSEWriter` verbatim |

```ts
export interface EventSink {
  textDelta(text: string): Promise<void>
  toolStarting(): Promise<void>                   // filler hook, §3.4; a no-op for chat
  textBlock(text: string): Promise<void>          // whole block, post-persist (chat's `turn`)
  toolCall(tool: string, input: unknown, id: string): Promise<void>
  toolResult(tool: string, output: unknown, id: string, isError: boolean): Promise<void>
  done(stopReason: string, usage: Usage): Promise<void>
  error(code: string, message: string): Promise<void>
}
```

`SseEventSink` emits today's events. `OpenAiChunkSink` turns `textDelta` into content deltas,
`toolStarting` into the filler, and `done` into `finish_reason` followed by `data: [DONE]`.
`toolCall`, `toolResult` and `textBlock` are no-ops on the voice side.

**The extraction PR must show characterisation-test parity**: the same suite, green on the commit
before the extraction and on the commit after it, with both runs linked in the PR description
(§10, phase 1).

### 4.2 The channel flag **[shared]**

```ts
export type Channel = 'chat' | 'voice'
```

| Knob | chat | voice |
|---|---|---|
| system prompt | `CHAT_PRESENTATION_HR` | `VOICE_PRESENTATION_HR` (§6) |
| tools | `TOOL_ALLOWLIST.chat` (all, unchanged) | `TOOL_ALLOWLIST.voice` (§5) |
| `max_tokens` | 8192 | 384 |
| `MAX_ITERATIONS` | 10 | 4 |
| tool timeout | 15 s | 6 s |
| request timeout | 90 s | 25 s |
| route-context injection | on | off (in-app could supply it at call start — revisit after v1) |
| `maybeCompactSession` | on | off |
| history source | DB, bounded (§3.3) | request body (§7) |
| model | `AI_CHAT_MODEL` | `AI_CHAT_VOICE_MODEL` (§4.6) |

### 4.3 New edge function: `voice-llm`

`supabase/functions/voice-llm/index.ts`, with `verify_jwt = false`. The platform is the caller,
so there is no user JWT on the request.

```
POST /functions/v1/voice-llm/chat/completions
x-voice-secret: <VOICE_LLM_SECRET>
{ "model": "cognilion-voice", "messages": [...], "stream": true, ...call metadata... }
```

1. Verify the shared secret with a constant-time compare, reusing the `sort-document` helper.
2. Read the call metadata in a single `parseCallMetadata()`. The envelope differs between Vapi and
   Retell, so switching platforms is a one-function change.
3. Resolve identity. **v1**: the opaque call token → `voice_calls` → the user's JWT (§4.4).
   **v2**: caller ID → enrolled identity → minted JWT, plus PIN state (§9).
4. Build prep from the inbound `messages` (§7) and run the **shared** orchestrator with
   `channel: 'voice'` and an `OpenAiChunkSink`.
5. Persist the turn fire-and-forget after the response completes (§7).

Also support `stream: false`, a one-line buffer over the sink, so the endpoint can be tested with
plain `curl`.

### 4.4 v1: in-app call start and the JWT handoff

New edge function `voice-session`, with `verify_jwt = true`. The browser calls it with its normal
session, exactly as it calls `ai-chat`.

**`POST /voice-session/start`**

1. `authenticate(req)`, the existing code, then the voice rate-limit check (§7).
2. Create an `ai_sessions` row with `channel = 'voice'`.
3. Generate an opaque call token (32 random bytes). Insert a `voice_calls` row holding its
   SHA-256 hash, the caller's current access token, and
   `expires_at = min(token expiry, now + 15 min)`.
4. Register the web call with the platform **server-side**, passing only the opaque token as call
   metadata — **never the JWT** (§2 explains why).
5. Return the platform's client credential. The browser starts WebRTC with the platform's web SDK.

**`POST /voice-session/refresh`** — supabase-js raises `TOKEN_REFRESHED` while the call is live,
and the browser posts the new token. The endpoint authenticates with that token and checks that
the caller owns the session. The browser is present and signed in for the whole of an in-app
call, which is exactly what makes v1 simpler than PSTN.

**`POST /voice-session/end`**, plus the platform's end-of-call webhook: delete the `voice_calls`
row. A TTL sweep deletes rows past `expires_at` as a backstop.

In `voice-llm`, the opaque token resolves to the stored JWT, and identity is built by the **same
code** as chat. Split `authenticate(req)` into `authenticateToken(jwt)` plus a thin `Request`
wrapper, so role and `assignedProjects` are still re-read on every request.

```sql
create table public.voice_calls (
  id               uuid primary key default gen_random_uuid(),
  session_id       uuid not null references public.ai_sessions(id) on delete cascade,
  user_id          uuid not null references public.users(id) on delete cascade,
  call_token_hash  text not null unique,
  access_token     text not null,           -- short-lived; deleted on call end
  platform_call_id text,
  expires_at       timestamptz not null,
  created_at       timestamptz not null default now()
);
alter table public.voice_calls enable row level security;   -- no policies: service role only

alter table public.ai_sessions
  add column channel          text not null default 'chat' check (channel in ('chat', 'voice')),
  add column external_call_id text;
create unique index ai_sessions_external_call_id_idx
  on public.ai_sessions (external_call_id) where external_call_id is not null;
```

Encrypting `access_token` at rest (Supabase Vault) is optional hardening: the token lives for
minutes and the table has no RLS policies.

**Frontend.** A call button in the AI chat panel header, built from the platform web SDK and the
shared UI library, with connecting / live / muted / ended states. The frontend logs
`voice_call.start` via `logActivity()`, and the entity is registered in `ENTITY_ROUTE_MAP` with
labels under `activity_log.actions`. New strings follow the i18n rules: ask before translating,
and Croatian domain terms stay literal.

### 4.5 What must **not** be duplicated

- The agent loop — one `runOrchestrationLoop`, two sinks.
- The tool registry, the role gate and `probeParentEntity`. The channel allowlist *composes* with
  them (§5); it does not replace them.
- The domain-rules block of the system prompt (§6).
- Identity construction. v1 reuses `authenticateToken`, and v2's minted token goes through the
  same function.
- Error mapping and SSE framing.

### 4.6 Model selection (independent quick win)

The code defaults to `claude-sonnet-4-6`. That model is now previous-generation and costs
**more** than the current `claude-sonnet-5` ($3/$15 vs $2/$10 per MTok). Switching
`AI_CHAT_MODEL` makes chat cheaper today. Add `AI_CHAT_VOICE_MODEL` so the two channels can
diverge. Evaluate `claude-haiku-4-5` for voice only if §3's measurements demand it: the domain
landmines are exactly the kind of reasoning a smaller model gets wrong.

---

## 5. Voice tool allowlist

**v1 rule: the voice channel gets a read-only subset of the registry — nothing that mutates
financial data or documents — enforced in code, below the prompt layer.**

Why below the prompt layer: speech-to-text output is a **new injection surface**. Whatever a
caller says, or whatever the recogniser mishears, becomes model input. The prompt is not a
security boundary. Several tables the tools can reach have `USING(true)` policies
(`subcontractors`, `contracts`, `project_milestones`, `documents`, `document_associations`, and
`accounting_companies` for reads; on `documents`, UPDATE and DELETE as well), so RLS will not
catch what the prompt lets through. The blast radius has to be capped by what the model can
*call*.

### Registry change

An explicit allowlist keyed by channel in `_shared/tools.ts`. **Default-deny**: a tool added to
`TOOLS` reaches chat automatically, as today, but reaches voice only when someone adds its name
here, in a reviewed diff.

```ts
export type Channel = 'chat' | 'voice'

const VOICE_V1_TOOLS = [
  'search_projects', 'get_project_details', 'list_project_phases',
  'search_subcontractors', 'list_cost_classifications', 'list_contracts',
  'get_subcontractor_payment_status', 'list_unpaid_invoices',
  'list_payments_for_subcontractor', 'get_invoice_summary',
  'get_project_financial_summary', 'search_help',
] as const satisfies readonly ToolName[]

export const TOOL_ALLOWLIST: Record<Channel, readonly ToolName[]> = {
  chat:  TOOLS.map(t => t.name),        // unchanged behaviour
  voice: VOICE_V1_TOOLS,
}

export function selectAvailableTools(ctx: AuthContext, channel: Channel) {
  const allowed = new Set(TOOL_ALLOWLIST[channel])
  return TOOLS.filter(t => t.requiredRoles.includes(ctx.role) && allowed.has(t.name))
}
```

Two further locks:

- **A `readOnly: true` declaration on `ToolDefinition`**, and an assertion — at module load and
  in a unit test — that every name in `TOOL_ALLOWLIST.voice` exists in `TOOLS` and is declared
  read-only. A future write tool cannot reach voice by an allowlist typo.
- **Enforce at dispatch as well as at advertisement.** `dispatchTool` today looks a name up in
  the full `TOOLS` array with no role or channel check. The only gate is which tools are
  advertised to the model. Add the same `selectAvailableTools` check in `dispatchTool`, so that an
  unadvertised name is refused even if the model emits one. It costs a few lines, and it closes
  the gap on chat too.

### v1 voice tool list

| Tool | Available to | Note |
|---|---|---|
| `search_projects` | all roles | |
| `get_project_details` | all roles | |
| `list_project_phases` | all roles | |
| `search_subcontractors` | all roles | |
| `list_cost_classifications` | all roles | |
| `list_contracts` | all roles | clamp results for voice |
| `get_subcontractor_payment_status` | Director, Accounting | a single rollup — the ideal spoken answer |
| `list_unpaid_invoices` | Director, Accounting, Supervision | clamp results for voice |
| `list_payments_for_subcontractor` | Director, Accounting | clamp results for voice |
| `get_invoice_summary` | Director, Accounting | |
| `get_project_financial_summary` | Director, Accounting | a single rollup — the ideal spoken answer |
| `search_help` | all roles | returns titles and a one-line summary on voice, not five full articles |

**Excluded in v1:** `create_document` (it authors a document artefact), and
`list_documents_for_entity` / `get_document_download_link` (the document surface sits on tables
with open UPDATE/DELETE RLS, and the results are UI cards that mean nothing on a call). The role
gate still applies on top: a Sales caller gets six of the twelve.

---

## 6. Voice system prompt

Split `_shared/prompts.ts` so the correctness rules physically cannot drift between channels:

```
DOMAIN_RULES_HR        ← landmines, TIC, cesija, status casing, refusals.  SHARED VERBATIM.
CHAT_PRESENTATION_HR   ← markdown, written number/date formats, documents, attachments, route
VOICE_PRESENTATION_HR  ← below
buildStaticSystemPrompt(channel) = IDENTITY + DOMAIN_RULES_HR + presentation block for channel
```

The builder stays pure and byte-identical per channel, so it keeps its `cache_control` prefix.
`buildUserContext(ctx)` is unchanged.

Draft `VOICE_PRESENTATION_HR` — **needs native-speaker review before it ships** (open question 9):

```
Vi ste glasovni asistent platforme Cognilion. Razgovarate s korisnikom uživo, glasom.

## Kako govorite
- Odgovarajte na hrvatskom, u govornom registru — kao da osobi odgovarate uživo.
- Odgovor je 1 do 3 rečenice. Duže samo ako korisnik izričito zatraži detalje.
- Bez Markdowna: bez zvjezdica, crtica, natuknica, naslova, tablica i emotikona. Samo rečenice.
- Nabrajajte najviše tri stavke. Ako ih ima više, recite koliko ih je ukupno, navedite prve tri
  i ponudite ostatak: "Ima ih jedanaest. Prva tri su... Želite li ostale?"
- Bez uvodnih fraza i bez ponavljanja pitanja.

## Brojevi, iznosi i datumi
Alati vraćaju sirove brojeve i ISO datume. Vi ih izgovarate, ne pišete.
- Iznose zaokružite: 1.234.567,89 → "oko milijun dvjesto trideset pet tisuća eura".
  Točan iznos recite samo ako ga korisnik izričito traži.
- Nikada ne pišite "EUR" ni znak valute — recite "eura".
- Postotke izgovorite: "otprilike dvanaest posto".
- Datume izgovorite: 2026-03-15 → "petnaesti ožujka". Godinu dodajte samo ako nije tekuća.
- OIB, IBAN i brojeve ugovora ne izgovarajte osim na izričit zahtjev; tada znamenku po znamenku.

## Tijek razgovora
- Ne najavljujte dohvaćanje podataka — sustav to čini umjesto vas. Odmah dajte odgovor.
- Ako je pitanje nejasno ili ste ime čuli nesigurno, pitajte za potvrdu prije dohvaćanja.
  Govor se često krivo prepozna — bolje pitati nego pogoditi.
- Nakon odgovora ponudite sljedeći korak umjesto da nabrajate sve:
  "Želite li i koliko je od toga plaćeno?"
- Dokument, izvještaj, PDF ili Excel: recite da to ne možete izraditi u glasovnom razgovoru i
  da je dostupno u aplikaciji.
- Zahtjev za izmjenom podataka: "U glasovnom razgovoru mogu samo odgovarati na pitanja o podacima."
- Ako podaci ne postoje ili uloga nema pristup, recite to u jednoj rečenici, bez isprike.
```

The first bullet under *Tijek razgovora* keeps the chat rule against announcing lookups, for a
different reason: in chat a tool chip covers the wait; on a call, the server-side filler does
(§3.4). The wording is channel-neutral ("glasom", "u glasovnom razgovoru") so the same block
serves in-app and PSTN.

---

## 7. Session handling

**One call = one session.** An `ai_sessions` row with `channel = 'voice'` and
`external_call_id` = the platform call id. The unique index makes the insert idempotent under
retries. v1 creates the row in `voice-session/start`; v2 creates it on the first `voice-llm`
request.

**History comes from the request.** In Custom LLM mode the platform sends the full `messages`
array every turn and owns conversation state for the call. That skips the tree walk, the summary
lookup and all context-window management. The inbound array is caller-influenced input, so:

- Keep the last 20 messages, cut on turn boundaries, and reject a payload over a fixed byte
  budget.
- **Drop every inbound `role: 'system'` message.** Our system prompt is built server-side and
  cannot be negotiated.

**Persistence is off the critical path.** After the response completes, write the user and
assistant turns to `ai_messages` with the usual `parent_id` chaining, fire-and-forget. On failure,
log and move on: the call, not the DB, is the source of truth here. Compaction stays off for voice.

**Rate limits are a separate budget.** Chat's burst limit of 20 messages per 5 minutes would kill
an ordinary three-minute call. Scope the existing counter to `channel = 'chat'` and add:

| Limit | Value | Keyed on |
|---|---|---|
| turns per call | 50 | session, enforced in the orchestrator |
| calls per user per day | 20 | `ai_sessions.user_id` (v2 adds a per-`caller_phone` cap) |
| concurrent calls | 3 | global — a cost guard |

**UI impact.** Filter the chat history dropdown to `channel = 'chat'`, so voice calls don't show
up as mystery threads (open question 7).

---

## 8. Security review

### v1 — in-app

- **Authentication**: identical in strength to chat — the user's own Supabase session, with role
  re-read every request.
- **Token exposure**: the JWT stays in our infrastructure (`voice_calls`, service-role only,
  deleted at call end). The vendor sees only an opaque, hashed-at-rest call token.
- **Injection via speech**: capped by the allowlist and the dispatch-time check (§5), not by the
  prompt. A caller cannot talk the model into a tool it was never given. The older vector —
  instruction-shaped text in database content, such as a subcontractor name, reaching the model
  through a tool result — is unchanged by voice and applies equally to chat.
- **Exposure profile**: financial rollups spoken aloud, possibly on speaker. Short spoken answers
  that summarise rather than enumerate are also a privacy control.
- **Endpoint hardening**: shared secret on `voice-llm`, rotated; IP-allowlist the platform's
  egress ranges if they are published; verify webhook signatures if offered. Keep the existing
  logging discipline — no message content in logs — and **never log transcripts**.

### v2 — PSTN (additional)

**Caller ID is not authentication**; it is trivially spoofed on the PSTN. Mitigations are in
§9: a mandatory DTMF PIN for finance roles, unknown and withheld numbers refused before the model
sees anything, lockout after failed PINs, and alerting on repeated failures.

### GDPR (Croatia / EU) — both versions

- **Recommendation: disable audio recording at the platform level**, and keep transcripts only.
  If recording is ever wanted, it needs a lawful basis and a Croatian-language announcement (ZEK
  plus GDPR).
- **New sub-processors**: the platform plus its STT and TTS vendors join a chain that currently
  ends at Anthropic. Each one needs a DPA, an entry in the records of processing
  (*evidencija aktivnosti obrade*), and SCCs for transfers outside the EEA. EU data residency may
  decide the choice of vendor by itself.
- **Retention**: define it for `channel = 'voice'` rows in `ai_messages`, and implement the sweep.
- v2 adds phone numbers as personal data in `voice_caller_identities`, covered by the same
  retention and subject-access handling as `public.users`.

---

## 9. v2: PSTN caller identification

Fully specified here so v2 can start without re-planning. Nothing in this section is built in v1.

### Schema

```sql
create table public.voice_caller_identities (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references public.users(id) on delete cascade,
  phone_e164          text not null,
  label               text,                        -- 'mobitel', 'ured'
  pin_hash            text,                        -- required for Director/Accounting
  pin_failed_attempts integer not null default 0,
  pin_locked_until    timestamptz,
  active              boolean not null default true,
  created_at          timestamptz not null default now(),
  created_by          uuid references public.users(id)
);
create unique index voice_caller_identities_phone_active_idx
  on public.voice_caller_identities (phone_e164) where active;
create index voice_caller_identities_user_id_idx on public.voice_caller_identities (user_id);

alter table public.ai_sessions add column caller_phone text;
```

RLS: Director-only on all four verbs; the edge function reads through the service role.
Enrolment happens in an in-app admin screen, **never over the phone**. Every mutation is logged
with `logActivity()`: `voice_caller_identity.create` / `.update` / `.delete`, severity `high`
(each one grants data access), with `ENTITY_ROUTE_MAP` and i18n entries.

### Resolution

1. Normalise the inbound number to E.164 (`+385`; handle a leading `0` and `00385`).
2. **No match, or caller ID withheld → refuse before the model sees anything**: one fixed Croatian
   line, hang up, log the attempt. Do not reveal whether the number is known, and do not offer
   enrolment.
3. Match → mint the RLS token (below) → `authenticateToken()`, the same function v1 uses.
4. If `pin_hash` is set, the call stays unauthorised until the PIN is verified.

### Building the RLS client without a browser

- **Recommended: mint a short-lived JWT** — `{ sub: auth_user_id, aud: 'authenticated',
  role: 'authenticated', exp: now + 15 min }`, signed with the project JWT secret (`npm:jose`).
  `auth.uid()` reads `sub`, so every RLS policy applies unchanged. Mint once per call.
- **Fallback if the project uses asymmetric signing keys**: `auth.admin.generateLink({ type:
  'magiclink' })` then `verifyOtp({ token_hash })`. This needs no secret, but costs two extra round
  trips per call. Open question 1.
- **Rejected: running tool handlers on `serviceClient`.** That would delete the RLS backstop that
  scopes Supervision users to their projects, on the one channel known to be spoofable.

### PIN — mandatory for finance roles

- 4–6 digits, **collected as DTMF, not speech**: Croatian digit recognition is unreliable, and
  DTMF keeps the PIN out of the transcript.
- **Mandatory for `Director` and `Accounting`**: enrolment rejects a finance-role identity with a
  null `pin_hash`, so the PIN cannot be forgotten.
- Hash with Argon2id or bcrypt. Three failures → `pin_locked_until = now() + 15 min`, hang up,
  log the event and alert.
- Cost: about five seconds at the start of a finance call.

---

## 10. Testing and rollout

### Phase 0 — Croatian STT/TTS prototype (parallel track, go/no-go gate)

Phase 0 runs **in parallel with backend planning**, not before it. It is the gate before any
implementation days are spent. It needs no backend: a dashboard-level agent on Vapi and on
Retell, with the platform's default LLM and a two-line Croatian prompt. It is tested through the
**web call** path, since v1 is in-app.

**Test script.** Roughly 60 fixed utterances, each read by at least three staff with different
voices and regional accents, recorded in a quiet office and again with background noise (a site,
a car):

- **Construction**: građevinska dozvola, uporabna dozvola, izvođač, podizvođač, troškovnik,
  situacija, okončana situacija, nadzor, aneks ugovora, rokovi, rok izvođenja.
- **Finance**: proračun, cesija, kompenzacija, PDV, R1 račun, avans, dospijeće, OIB, IBAN.
- **Cognilion**: TIC, klasifikacija troška, faza projekta.
- **Real entity names** from production — project names, and subcontractor names with `d.o.o.`,
  `j.d.o.o.` and `obrt`.
- **Spoken amounts and dates**: "milijun dvjesto tisuća eura", "tristo pedeset tisuća",
  "petnaesti ožujka dvije tisuće dvadeset šeste".
- **Ten full questions** in the form users will ask them ("Koliko smo platili izvođaču X na
  projektu Y?").

**Pass criteria** (proposed thresholds — the team should adjust them before phase 0 starts, not
after):

| Area | Metric | Pass |
|---|---|---|
| Domain terms | recognised correctly (any valid inflection) | ≥ 90 % |
| Entity names | exact | ≥ 80 % |
| Entity names | *recoverable* — the stem is right, so `search_projects`' substring match would find it | ≥ 95 % |
| Amounts | numerically correct in the transcript | ≥ 95 % |
| Full questions | word error rate | ≤ 15 % |
| TTS | native-speaker panel (≥ 3) naturalness, 1–5 scale | mean ≥ 3.5 |
| TTS | mispronounced amounts/dates in a 20-sentence numeric script | 0 |
| Turn-taking | barge-in stops TTS | reliably, within ~0.5 s |
| Latency floor | end of speech → first audio, platform default LLM | p50 ≤ 1.5 s |

**Hard no-go:** on the best vendor + STT + TTS combination, domain terms below 80 % *or*
recoverable entity names below 85 %. Anything between the no-go line and the pass line is a team
call, informed by the recordings. TTS candidates to compare at minimum: ElevenLabs multilingual
and Azure's native `hr-HR` voices. Deliverable: a scoring sheet, the recordings, and a recommended
vendor / STT / TTS combination.

If the gate fails, phases 1–3 still stand on their own merit for chat (a test suite, token
streaming, parallel dispatch, a bounded history read) — worth knowing when deciding what to fund.

### Phase 1 — characterisation tests (non-optional)

Phase 1 is its own phase, and it gates the orchestrator extraction. The loop that answers
financial questions has **no test coverage today** (`help-score.test.ts` covers only `search_help`
retrieval — analysis appendix, item 7).

- **What**: Deno tests that drive `ai-chat` end to end and assert on the **SSE wire output** (event
  order and shapes) and on the **DB writes** (rows, roles, `parent_id` chaining).
- **Scenarios**: plain answer; single tool; multi-tool turn; tool error; tool timeout; iteration
  cap; `max_tokens` truncation mid-`tool_use`; cancel beacon; request timeout; persistence
  failure; edit/branch parent chaining; the pre-stream 400 / 404 / 429 responses.
- **Seam**: a scripted fake Anthropic client that implements both `create` and `stream`, so the
  same suite survives phase 2's switch to streaming. Making the client injectable is the one code
  change phase 1 allows.
- **Parity rule**: phases 2 and 3 must each show the suite green before and after. Phase 2 may add
  delta events; phase 3 may change nothing observable. **The extraction PR links both runs.**

### Phases

Every phase leaves chat fully working. v2 starts only after v1 has run in production.

| Phase | | Work | Exit criterion |
|---|---|---|---|
| **0** | v1 | STT/TTS prototype — parallel track | Go/no-go against the pass criteria; platform chosen |
| **1** | v1 | Characterisation tests | Suite green on current `development` |
| **2** | v1 | Latency critical path: streaming, parallel dispatch, bounded history, concurrent pre-stream reads (§3) | Suite parity; latency before/after recorded |
| **3** | v1 | Orchestrator extraction + `EventSink` (§4.1) | **Suite parity before/after, linked in the PR** |
| **4** | v1 | `voice-llm`, channel flag, allowlist + dispatch check, voice prompt, server filler (§4.2, 4.3, 5, 6, 3.4) | `curl` returns valid OpenAI chunks; a platform test agent holds a Croatian conversation for a hardcoded test user |
| **5** | v1 | `voice-session` + JWT handoff, `voice_calls`, `ai_sessions` columns, call button, voice rate limits (§4.4, 7) | Internal users make in-app calls for a week |
| **6** | v1 | v1 rollout: DPAs, retention sweep, monitoring, cost dashboard | **v1 live** |
| **7** | v2 | Caller-identity schema + enrolment screen (§9) | Identities enrollable, with activity logging |
| **8** | v2 | Token minting, PSTN number, DTMF PIN + lockout (§9) | Internal test number; 3–5 staff enrolled |
| **9** | v2 | PSTN rollout: monitoring, spoofing/PIN alerting | **v2 live** |
| — | later | WhatsApp calling | scoped after v2 |

---

## 11. Estimate and open questions

### Effort (dev-days, one developer familiar with the codebase)

Excludes calendar time waiting on vendor accounts, and legal/DPO review.

| Phase | | Days | Notes |
|---|---|---|---|
| 0 — STT/TTS prototype | v1 | 2–3 | Runs in parallel with planning, so it is off the critical path of calendar time |
| 1 — characterisation tests | v1 | 2–3 | Includes making the Anthropic client injectable |
| 2 — latency critical path | v1 | 5–7 | Streaming 3–4, parallel dispatch ~1, bounded-history SQL function 1–2 |
| 3 — orchestrator extraction | v1 | 3–5 | **Widest variance**: a 1789-line file |
| 4 — `voice-llm` + allowlist + prompt + filler | v1 | 5–7 | The old 4–6, plus the allowlist, the dispatch check and the filler sink |
| 5 — `voice-session`, handoff, call button | v1 | 4–6 | New in this revision — the in-app button was unestimated before |
| 6 — v1 rollout | v1 | 2–3 | Plus external legal time |
| **v1 total (in-app only)** | | **23–34** | ≈ 5–7 weeks; **21–31** excluding phase 0 |
| 7 — caller identity + enrolment | v2 | 2–3 | |
| 8 — minting, PSTN, DTMF PIN | v2 | 3–4 | |
| 9 — PSTN rollout | v2 | 1–2 | |
| **v2 total** | | **6–9** | |
| **v1 + v2 total** | | **29–43** | ≈ 6–9 weeks |

**Against the first draft (19–28, PSTN-first):** the total rises because three things are now
counted that weren't before — the promoted latency work (≈ +2–3), the in-app button (+4–6,
previously deferred to "later" and unestimated), and the allowlist, dispatch check and filler
(≈ +1). The PSTN-specific work (identity, minting, PIN), about 5–7 days that the draft spread
across its phases 4–6, has moved to v2. v1 alone is therefore larger than the old PSTN-first
path, but it carries none of the spoofing risk.

### Open questions for the team

0. **Channel order** — confirm in-app = v1, PSTN = v2 (the banner at the top). *Blocks final
   phasing.*
1. **JWT signing scheme** — the legacy HS256 secret or asymmetric keys? It decides §9's minting
   approach. *Blocks phase 8 only.*
2. **Vapi or Retell** — which has the better Croatian result in phase 0, EU data residency and an
   EU DPA, and which web SDK and server-side web-call registration fit §4.4?
3. **Recording** — the recommendation is no. Decide before phase 6.
4. **May finance data go over the PSTN at all** in v2? If not, v2 is non-finance roles only and the
   PIN becomes moot.
5. **Is a DTMF PIN acceptable UX** for Director and Accounting callers in v2?
6. **Cost ceiling** — platform per-minute + STT + TTS + model tokens. What is the monthly budget,
   and what should the concurrency cap be?
7. **Voice calls in history** — in the chat history dropdown, or a separate "Pozivi" view?
8. **Voice model** — keep the chat model, or evaluate `claude-haiku-4-5`? Decide with phase 2's
   measurements in hand.
9. **Native-speaker review** of `VOICE_PRESENTATION_HR` (§6) and the filler variants (§3.4).
10. **Phase 0 thresholds** — adjust the pass criteria before phase 0 starts.
11. **ERP phase 5** — it locks invoice and payment writes to the service role. Voice is read-only by
    construction (§5), so there is no conflict; confirm that nobody expects voice to authorise
    anything.
