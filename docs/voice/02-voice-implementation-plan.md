# Voice access — Phase 2: implementation plan

Written 2026-09-23. Builds directly on
[`01-chat-assistant-analysis.md`](./01-chat-assistant-analysis.md); every recommendation here
cites a finding there rather than re-deriving it.

Goal: a user calls a phone number and talks, in Croatian, to the same assistant that answers in
the app. Later, the same backend serves WhatsApp calling and an in-app call button.

Standing constraints, restated because they shape every decision below:

- One shared backend. No forked assistant.
- Minimal change to existing chat behaviour; voice adaptations sit behind a channel flag.
- Incrementally executable — **every phase leaves chat working**.

---

## 1. Integration strategy

> **Recommendation: (a) Custom LLM mode** — wrap the existing assistant in an OpenAI-compatible
> streaming endpoint that Vapi/Retell calls — **conditional on doing the token-streaming refactor
> first.** That refactor is a prerequisite, not a nice-to-have.

### Why not (b), platform-native LLM + our tools as an API

It looks like the low-latency option and is not. Three reasons:

1. **It forks the brain, which is the one thing we said we would not do.** The Croatian system
   prompt is not a thin wrapper: it carries the data-model landmines that make answers *correct*
   — `supplier_id` points at `subcontractors`, phase ≠ cost classification, `budget_used` is
   stale, TIC is the only source of planned budget, `is_cesija` must be surfaced
   (analysis §4, §5). A platform-side LLM needs all of it too, in a second place, drifting.
2. **The latency win is smaller than it looks.** Our slow path is not "the LLM is on the wrong
   side of the network" — it is two full non-streamed model turns plus sequential tool
   dispatch (analysis §2). A platform LLM calling our tools over HTTP still pays the tool
   latency, and adds a network hop per call. It fixes the symptom we can fix ourselves and keeps
   the ones we can't.
3. **Role gating is the security boundary, not RLS** (analysis §4). Exposing tools as a public
   HTTP API means re-implementing `selectAvailableTools` and `probeParentEntity` on a second
   surface, over tables with `USING(true)` policies. That is exactly the kind of duplication that
   produces a leak.

### Why (a) works — with the prerequisite stated plainly

Custom LLM mode gives us one brain, one prompt lineage, one tool registry, one role gate. The
adapter is genuinely thin, because the shapes line up better than they look:

| Ours | OpenAI chunk |
|---|---|
| assistant text delta | `choices[0].delta.content` |
| `done` | `choices[0].finish_reason: "stop"` then `data: [DONE]` |
| `tool_call` / `tool_result` | not forwarded — see below |

**The voice platform never sees our tool calls.** Our endpoint runs the whole agent loop
internally and streams only the final natural-language text. The alternative — proxying tool
calls up to the platform in OpenAI format — buys nothing (the platform cannot execute our tools)
and costs a great deal.

But this only works if we stream tokens. Today `anthropic.messages.create` means the caller hears
silence until the model has finished the entire turn (analysis §2). With
`anthropic.messages.stream` the first sentence reaches TTS while the rest is still generating —
which is the whole conversational budget. That refactor is §2.1 below, it ships before any voice
code, and **chat gets visibly better from it too**: today the chat UI also waits for the complete
turn before rendering text.

If the team decides not to do the streaming refactor, do not build voice on (a). Revisit (b) and
accept the forked prompt as a known cost.

---

## 2. Required backend changes

Ordered as they should be built. Items marked **[shared]** are the anti-duplication points — the
places where doing it twice would be the real failure of this project.

### 2.1 Token streaming in the existing loop **[shared]**

`supabase/functions/ai-chat/index.ts` — the `messages.create` call at line 1225 becomes
`messages.stream`. The SDK's `finalMessage()` returns the same complete `Message` object the
current code persists, so **the persistence contract does not change at all**:

```ts
const stream = anthropic.messages.stream({ model, max_tokens, system, tools, messages }, { signal })
for await (const ev of stream) {
  if (ev.type === 'content_block_delta' && ev.delta.type === 'text_delta') {
    await sink.textDelta(ev.delta.text)      // new — the voice channel's lifeline
  }
}
const response = await stream.finalMessage() // identical shape to today's `response`
// ...everything downstream (persist, emit `turn`, tool loop) is unchanged
```

Chat keeps receiving the existing `turn` event exactly as now (emitted after persistence, from
`finalMessage()`), so **the frontend needs no change in this phase**. The deltas are additive.
A later, optional chat improvement can consume them.

One caveat from the SDK docs worth writing into the code: leave `eager_input_streaming` **off**.
It streams tool-call inputs before the server has validated them, which means handling truncated
JSON — no benefit here, since we do not surface tool inputs to the caller.

### 2.2 Extract the orchestrator to `_shared/` **[shared]**

This is the largest and riskiest refactor, and the one that makes "one backend" true rather than
aspirational. Move out of `ai-chat/index.ts`, behaviour unchanged:

| To | What |
|---|---|
| `_shared/orchestrator.ts` | `runOrchestrationLoop`, `dispatchTool`, `dispatchToolWithTimeout`, `mapAnthropicError` |
| `_shared/event-sink.ts` | the `EventSink` interface + `SseEventSink` (today's taxonomy) |
| `_shared/sse.ts` | `SSEWriter` verbatim — framing, heartbeat, write-failure detection |

`runOrchestrationLoop` currently writes straight to `SSEWriter` with our event names. Invert that
behind an interface so a second channel can render the same events differently:

```ts
export interface EventSink {
  textDelta(text: string): Promise<void>
  textBlock(text: string): Promise<void>          // whole block, post-persist (chat's `turn`)
  toolCall(tool: string, input: unknown, id: string): Promise<void>
  toolResult(tool: string, output: unknown, id: string, isError: boolean): Promise<void>
  done(stopReason: string, usage: Usage): Promise<void>
  error(code: string, message: string): Promise<void>
}
```

`SseEventSink` emits today's six events. `OpenAiChunkSink` (§2.4) emits `chat.completion.chunk`
frames: `textDelta` → a content delta, `done` → `finish_reason` + `[DONE]`, and `toolCall` /
`toolResult` / `textBlock` are **no-ops** on the voice side.

`ai-chat/index.ts` shrinks to: parse → auth → `handleChat` prep → `SseEventSink` → call the
shared loop. Its externally observable behaviour is identical.

> **Risk, stated up front.** `docs/AI_CHAT.md` lists "No automated test coverage" as a known
> limitation, and this is a 1789-line file handling money questions. Write characterisation tests
> against the SSE wire format *before* moving anything — see §7.

### 2.3 The channel flag **[shared]**

```ts
export type Channel = 'chat' | 'voice'
```

Threaded through prep into the orchestrator, selecting:

| Knob | chat | voice | why |
|---|---|---|---|
| system prompt variant | `CHAT_PRESENTATION_HR` | `VOICE_PRESENTATION_HR` | §3 |
| `max_tokens` | 8192 | **384** | 8192 exists to fit an authored document; a spoken answer is three sentences |
| `MAX_ITERATIONS` | 10 | **4** | a caller will not wait out ten passes |
| tool timeout | 15 s | **6 s** | dead air budget |
| request timeout | 90 s | **25 s** | |
| tool set | all 15 | filtered, §2.5 | |
| route context injection | on | **off** | there is no route on a call |
| `maybeCompactSession` | on | **off** | calls are short; it would hold the connection open past hangup |
| history source | DB tree walk | request body | §5 |
| model | `AI_CHAT_MODEL` | `AI_CHAT_VOICE_MODEL` | §2.7 |

### 2.4 New edge function: `voice-llm`

`supabase/functions/voice-llm/index.ts`, `verify_jwt = false` in `config.toml`, following the
`sort-document` / `import-erp` precedent (analysis §6): shared-secret auth in-function with a
constant-time compare against `VOICE_LLM_SECRET`.

```
POST /functions/v1/voice-llm/chat/completions
x-voice-secret: <VOICE_LLM_SECRET>
{ "model": "cognilion-voice", "messages": [...], "stream": true, ...call metadata... }
```

It does five things and nothing else:

1. Verify the shared secret; reject otherwise.
2. Extract the caller's phone number and the platform's call id from the request envelope,
   and resolve them to an `AuthContext` (§4). **The envelope shape differs between Vapi and
   Retell and must be read from whichever platform we pick** — isolate it in a single
   `parseCallMetadata()` so swapping platforms is a one-function change.
3. Build prep from the `messages` array the platform sent (§5) — no DB history walk.
4. Run the **shared** orchestrator with `channel: 'voice'` and an `OpenAiChunkSink`.
5. Persist the turn fire-and-forget after the response completes (§5).

Non-streaming (`stream: false`) should also be supported — it is a one-line buffer of the sink —
because it makes the endpoint testable with plain `curl`.

### 2.5 Per-channel tool filtering **[shared]**

Add to `ToolDefinition` in `_shared/tools.ts`:

```ts
channels: Channel[]   // default ['chat', 'voice']
```

and widen the existing filter — role gating is unchanged, this composes with it:

```ts
export function selectAvailableTools(ctx: AuthContext, channel: Channel) {
  return TOOLS.filter(t => t.requiredRoles.includes(ctx.role) && t.channels.includes(channel))
}
```

Excluded from voice: `create_document` and `get_document_download_link` (both produce UI cards —
analysis §7), and `list_documents_for_entity` (a list of filenames is not a useful spoken answer).
`search_help` stays but needs a voice-shaped result — return titles and a one-line summary rather
than five full articles (analysis §4). Add `max_items` clamping on the three list-shaped tools so
a voice turn cannot pull 100 rows it will never read out.

### 2.6 What must **not** be duplicated

Listed explicitly so a reviewer can check for it:

- The agent loop. One `runOrchestrationLoop`, two sinks.
- The tool registry and both access gates (`requiredRoles`, `probeParentEntity`).
- The domain-rules block of the system prompt (§3).
- `AuthContext` construction semantics — the voice resolver must produce the *same* shape,
  including a real RLS-scoped `userClient` (§4).
- Error mapping (`mapAnthropicError`) and the SSE framing helpers.

### 2.7 Model selection (independent quick win)

The code defaults to `claude-sonnet-4-6`. That is now previous-generation and priced **above**
the current `claude-sonnet-5` ($3/$15 vs $2/$10 per MTok). Switching `AI_CHAT_MODEL` is an
env-var change that makes chat cheaper today. For voice, add `AI_CHAT_VOICE_MODEL` so the
channels can diverge: start on the same model, and evaluate `claude-haiku-4-5` ($1/$5) for voice
only if latency measurements demand it — the domain landmines are exactly the kind of reasoning a
smaller model gets wrong, so this is a measured trade, not a default.

---

## 3. Voice system prompt

Split `_shared/prompts.ts` into three constants and one builder, so the correctness rules
physically cannot drift between channels:

```
DOMAIN_RULES_HR        ← landmines, TIC, cesija, status casing, refusals.  SHARED VERBATIM.
CHAT_PRESENTATION_HR   ← markdown, written number/date formats, documents, attachments, route
VOICE_PRESENTATION_HR  ← below
buildSystemPrompt(channel) = IDENTITY + DOMAIN_RULES_HR + (channel === 'voice' ? VOICE : CHAT)
```

`buildStaticSystemPrompt()` keeps its current contract: pure, deterministic, byte-identical per
channel, so it stays a `cache_control` prefix. `buildUserContext(ctx)` is unchanged.

Draft `VOICE_PRESENTATION_HR` — **needs native-speaker review before it ships** (open question 9;
this respects the project rule on not shipping unreviewed Croatian):

```
Vi ste glasovni asistent platforme Cognilion. Razgovarate s korisnikom telefonom, uživo.

## Kako govorite
- Odgovarajte na hrvatskom, u govornom registru — kao da osobi odgovarate preko telefona.
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
- Ako dohvaćanje podataka traje, prvo kratko najavite: "Trenutak, provjeravam." Zatim odgovorite.
- Ako je pitanje nejasno ili ste ime čuli nesigurno, pitajte za potvrdu prije dohvaćanja.
  Govor se često krivo prepozna — bolje pitati nego pogoditi.
- Nakon odgovora ponudite sljedeći korak umjesto da nabrajate sve:
  "Želite li i koliko je od toga plaćeno?"
- Dokument, izvještaj, PDF ili Excel: recite da to ne možete poslati telefonom i da je
  dostupno u aplikaciji.
- Zahtjev za izmjenom podataka: "Telefonom mogu samo odgovarati na pitanja o podacima."
- Ako podaci ne postoje ili uloga nema pristup, recite to u jednoj rečenici, bez isprike.
```

Note the third bullet under *Tijek razgovora* deliberately **reverses** the chat rule
*"Bez uvodnih najava poput 'Pretražujem...'"* (analysis §7). In chat a tool chip covers the wait;
on a call, silence is the failure.

---

## 4. Caller identification

### The honest framing first

**Caller ID (ANI) is not authentication.** It is trivially spoofable on the PSTN. Phone-number
matching is an *identification* convenience; anything that gates financial data needs a second
factor. This is the single most important security decision in the project, and it is why
`pin_hash` below is not optional for finance roles.

### Schema

New migration. Nothing existing can be reused — `public.users` has no phone column, and the
`phone` columns that do exist are all on counterparties (analysis §6).

```sql
create table public.voice_caller_identities (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references public.users(id) on delete cascade,
  phone_e164          text not null,
  label               text,                        -- 'mobitel', 'ured'
  pin_hash            text,                        -- null = no PIN; required for Director/Accounting
  pin_failed_attempts integer not null default 0,
  pin_locked_until    timestamptz,
  active              boolean not null default true,
  created_at          timestamptz not null default now(),
  created_by          uuid references public.users(id)
);

create unique index voice_caller_identities_phone_active_idx
  on public.voice_caller_identities (phone_e164) where active;
create index voice_caller_identities_user_id_idx
  on public.voice_caller_identities (user_id);
```

RLS: enabled, Director-only for all four verbs; the edge function reads via the service role.
Enrolment happens in the app (a small admin screen under settings), **never over the phone**.

Also on `ai_sessions`:

```sql
alter table public.ai_sessions
  add column channel          text not null default 'chat'
    check (channel in ('chat', 'voice')),
  add column external_call_id text,
  add column caller_phone     text;

create unique index ai_sessions_external_call_id_idx
  on public.ai_sessions (external_call_id) where external_call_id is not null;
```

Every mutation on `voice_caller_identities` goes through `logActivity()` per the project rule:
`voice_caller_identity.create` / `.update` / `.delete`, severity `high` (it grants data access),
`entity_name` = the label, and a new entry in `ENTITY_ROUTE_MAP`.

### Resolution flow

`_shared/voice-identity.ts`:

1. Normalise the inbound number to E.164 (Croatian `+385`; strip leading `0`, handle `00385`).
2. Look up an `active` row. **No match, or caller ID withheld → refuse before the model sees
   anything**: a fixed Croatian line, call ends, attempt logged. Do not reveal whether the number
   is known, and do not offer enrolment.
3. Match → load `public.users` and `project_managers` exactly as `authenticate()` does.
4. Build a genuine RLS-scoped `userClient` (below).
5. If `pin_hash` is set, the call is not authorised until the PIN is verified.

### Building `userClient` without a browser JWT

This is the one genuinely new piece of auth engineering. Tool handlers read through an
RLS-respecting client, and RLS evaluates `auth.uid()` from a JWT (analysis §6).

- **Recommended: mint a short-lived JWT server-side.** Sign `{ sub: <auth_user_id>,
  aud: 'authenticated', role: 'authenticated', exp: now + 15 min }` with the project's JWT secret
  (`npm:jose` in Deno), then build the client with that token in the `Authorization` header.
  `auth.uid()` reads `sub`, so **every existing RLS policy applies unchanged**. Mint once per
  call and cache it for the call's duration.
- **Fallback if the project uses asymmetric JWT signing keys** and the HS256 secret is
  unavailable: `auth.admin.generateLink({ type: 'magiclink' })` → `verifyOtp({ token_hash })` to
  obtain a real session. Works without the secret, but costs two extra network round trips on the
  critical path and consumes a one-time token per call. Which of these applies is
  **open question 1** and should be settled before Phase 4 starts.
- **Rejected: run tool handlers on `serviceClient`.** It would silently delete the RLS backstop
  that scopes Supervision users to their assigned projects, leaving role gating as the only
  control. Not acceptable on a channel we have just established is spoofable.

### PIN

- 4–6 digits, **collected as DTMF, not speech.** Digit STT is unreliable in Croatian, and DTMF
  keeps the PIN out of the transcript. Both platforms support DTMF capture.
- Verified at call start when `pin_hash is not null`. Mandatory for `Director` and `Accounting`
  — enforce it at enrolment time (reject a finance-role identity with a null `pin_hash`) so it
  cannot be forgotten.
- Argon2id or bcrypt. Three failures → `pin_locked_until = now() + 15 min`, call ends, log it.
- Cost: roughly 5 seconds of dialogue at the start of a finance call. Acceptable.

---

## 5. Session handling

**One call = one session.** `ai_sessions` row with `channel = 'voice'`, `external_call_id` = the
platform's call id, `caller_phone` = the resolved E.164 number. The unique index makes the
insert idempotent if the platform retries.

**History comes from the request, not the database.** In Custom LLM mode the platform sends the
full `messages` array on every turn — it owns conversation state for the duration of the call.
That lets the voice path skip the parent-chain walk, the unbounded history `SELECT`, the session
meta read, and all of context-window management (analysis §2, Stage A steps 4–6). It is the
single largest latency saving available, and it comes free.

Guard rails, since the array is now caller-supplied input:
- Cap it: last 20 messages, and reject a request whose serialised `messages` exceed a fixed byte
  budget. Truncate on turn boundaries.
- Treat every `role: 'system'` entry in the inbound array as untrusted and **drop it** — our
  system prompt is built server-side and is not negotiable by the caller.

**Persistence is off the critical path.** After the response completes, write the user turn and
assistant turn to `ai_messages` with the same `parent_id` chaining, fire-and-forget. If it fails,
log and move on — unlike chat, the DB is not the source of truth here, the call is. Compaction
(`maybeCompactSession`) is disabled for voice.

**Rate limiting needs a separate budget.** The existing 20-messages-per-5-minutes burst limit
would kill a normal three-minute call outright. Scope the existing counter to
`channel = 'chat'`, and give voice its own:

| Limit | Value | Enforced |
|---|---|---|
| turns per call | 50 | in the orchestrator, per session |
| calls per number per day | 20 | on `ai_sessions` by `caller_phone` |
| concurrent calls | 3 | global, cost guard |

**UI impact.** The chat history dropdown reads `ai_sessions` for the user. Filter it to
`channel = 'chat'` or voice calls will appear as mystery threads. A separate "Pozivi" view is a
reasonable later addition (open question 7).

---

## 6. Security review

### What the voice channel can expose

The same 15 tools, minus three (§2.5) — which for a Director or Accounting caller means full
project financial rollups, unpaid invoice lists and payment histories, read aloud, possibly on
speakerphone in a public place. That is a materially different exposure profile from a screen,
even though the data is identical. Controls: mandatory PIN for finance roles, the reduced tool
set, and short spoken answers that summarise rather than enumerate.

### Caller ID spoofing

Covered in §4 and repeated here because it is the top risk. PSTN caller ID is not an
authentication factor. Mitigations, in order: mandatory DTMF PIN for finance roles; refuse
unknown and withheld numbers outright; log every call with its resolved identity; alert on
repeated failed PIN attempts. Note that **WhatsApp calling and the in-app button are both
cryptographically bound to an account** and do not have this weakness — see §7.

### Prompt injection via transcribed speech

Lower risk than an open channel, since callers are enrolled employees, but not zero:

- An enrolled caller could try to talk the model out of its role gating. The gate holds
  regardless: tools the role cannot use are **never advertised to the model** — there is nothing
  to talk it into.
- The more interesting vector is **injection via database content**: a subcontractor or project
  name containing instruction-shaped text arrives in a tool result. This risk already exists in
  chat and is unchanged by voice; worth a note in the backlog either way.
- Inbound `role: 'system'` messages in the platform's `messages` array are dropped (§5).

### Rate limiting and cost

Every voice turn is a full model call, and voice turns arrive far faster than typed ones. The
three limits in §5 are cost controls as much as abuse controls. Add per-call cost telemetry —
`ai_messages` already carries `input_tokens` / `output_tokens` per assistant row, so a per-call
rollup is a group-by on `session_id`.

### Endpoint hardening

Shared secret with constant-time compare (reuse the helper in `sort-document`); rotate it;
IP-allowlist the platform's egress ranges if they publish them; verify webhook signatures if the
chosen platform offers them. Keep the existing logging discipline — the current function logs no
message content and truncates error strings at 200 chars. **Do not log transcripts.**

### GDPR (Croatia / EU)

- **Recommendation: disable call recording at the platform level.** Keep transcripts only. It
  removes an entire category of exposure and of consent obligation for a feature nobody has asked
  for. If recording is later wanted, it needs a lawful basis and an announcement at call start
  (ZEK plus GDPR), and the announcement has to be in Croatian.
- **New sub-processors.** Voice adds the platform (Vapi or Retell) plus their STT and TTS vendors
  to a chain that currently ends at Anthropic. Each needs a DPA, each goes in the records of
  processing (*evidencija aktivnosti obrade*), and transfers outside the EEA need SCCs. Check
  whether the chosen vendor offers EU data residency — this may decide Vapi vs Retell on its own.
- **Transcripts are personal and financial data.** They live on the platform and in
  `ai_messages`. Define a retention period for `channel = 'voice'` rows and implement the sweep;
  do not leave it implicit.
- **Caller phone numbers** are personal data. `voice_caller_identities` needs to be covered by
  the same retention and subject-access handling as the rest of `public.users`.

---

## 7. Testing and rollout

### Step 0 — Croatian STT/TTS prototype (before any backend work)

A throwaway agent in the Vapi and Retell dashboards, their default LLM, a two-line prompt. The
point is not the assistant; it is to find out whether Croatian speech recognition can handle this
domain at all.

Test vocabulary — build a fixed script and run it through both platforms:

- **Construction / contracting**: izvođač, podizvođač, troškovnik, situacija, okončana situacija,
  građevinska dozvola, uporabna dozvola, nadzor, faza, ugovor, aneks.
- **Finance**: cesija, kompenzacija, PDV, R1 račun, avans, OIB, IBAN, dospijeće.
- **Cognilion-specific**: TIC, klasifikacija troška, faza projekta.
- **Real entity names** from the production data — project names and subcontractor company names
  with `d.o.o.`, `j.d.o.o.`, `obrt`. These are what break first.
- **Amounts and dates spoken naturally**: "milijun dvjesto tisuća eura", "tristo pedeset tisuća",
  "petnaesti ožujka dvije tisuće dvadeset šeste".
- **TTS quality** for Croatian output, which is the known weak spot. Compare at minimum
  ElevenLabs multilingual against Azure's native `hr-HR` voices (Gabrijela, Srećko).
- **Turn-taking and barge-in** with Croatian sentence rhythm.

**This is a gate, not a formality.** If STT cannot reliably transcribe subcontractor names and
domain terms, the feature is not viable and no backend work should start. Deliverable: a scored
comparison, a recorded demo, and a Vapi-vs-Retell decision.

### Phases

Each leaves chat fully working.

| Phase | Work | Exit criterion |
|---|---|---|
| **0** | STT/TTS prototype (above) | Go/no-go + platform chosen |
| **1** | Characterisation tests over the current SSE wire format | A test suite that fails if any event shape changes |
| **2** | Token-streaming refactor (§2.1) | Chat behaves identically; deltas observable via `curl -N` |
| **3** | Extract orchestrator + `EventSink` (§2.2) | Phase 1 tests still green, no behaviour change |
| **4** | `voice-llm` endpoint, channel flag, voice prompt, tool filter (§2.3–2.5) | `curl` against the OpenAI contract returns valid chunks; a Vapi test agent with a **hardcoded** test user holds a conversation |
| **5** | Caller identity, PIN, session mapping, voice rate limits (§4, §5) | Internal test number, 3–5 staff enrolled, one week of real use |
| **6** | Production number, GDPR notice, monitoring, cost dashboards | Live |
| **7** | *Later*: WhatsApp calling, in-app call button | — |

Phase 1 is not optional padding. Phases 2 and 3 move the code that answers financial questions,
in a file with no existing test coverage.

**A note on ordering.** The in-app call button (phase 7) is the *easiest and safest* channel, not
the hardest: the browser already has a Supabase session, so §4 disappears entirely and there is
no spoofable caller ID. If the team is uncomfortable putting finance data on the PSTN, a
defensible alternative plan is to ship the in-app button first and treat the phone number as the
later, PIN-gated addition. Worth deciding deliberately rather than by default.

---

## 8. Estimate and open questions

### Effort

Dev-days for one developer already familiar with the codebase. Excludes step 0 calendar time
waiting on vendor accounts, and excludes legal/DPO review.

| Phase | Days | Notes |
|---|---|---|
| 0 — STT/TTS prototype | 2–3 | Mostly hands-on dashboard work; run both vendors |
| 1 — characterisation tests | 2–3 | Pure investment; pays for phases 2–3 |
| 2 — token streaming | 3–4 | Contained; `finalMessage()` keeps persistence identical |
| 3 — orchestrator extraction | 3–5 | **Widest variance.** 1789-line file, no prior coverage |
| 4 — `voice-llm` endpoint | 4–6 | Includes the OpenAI chunk adapter and platform-envelope parsing |
| 5 — caller identity + PIN | 3–4 | Includes the migration, the admin screen, and JWT minting |
| 6 — rollout, GDPR, monitoring | 2–3 | Plus external legal time |
| **Total** | **19–28** | ≈ 4–6 weeks for one developer |

Phase 7 (WhatsApp + in-app) is deliberately not estimated — scope it after phase 6 measures real
usage.

### Open questions for the team

1. **Which JWT signing scheme does the Supabase project use** — legacy HS256 secret, or
   asymmetric signing keys? Decides the §4 minting approach. *Blocks phase 5; nothing earlier.*
2. **Vapi or Retell** — and does either offer EU data residency and an EU DPA? Step 0 answers the
   quality half; procurement answers this half.
3. **Record calls, yes or no?** Recommendation is no. Needs a decision before phase 6.
4. **Who gets enrolled, and may finance data go over the PSTN at all?** If the answer to the
   second part is no, §4's PIN becomes moot and the in-app button moves up the plan.
5. **Is a DTMF PIN acceptable UX** for Director and Accounting callers, or should PSTN be
   restricted to non-finance roles?
6. **Cost ceiling.** Platform per-minute + STT + TTS + model tokens. What is the monthly budget,
   and what should the concurrency cap be?
7. **Should voice calls appear in the user's chat history UI**, or in a separate "Pozivi" view?
8. **Voice model**: stay on the chat model, or evaluate `claude-haiku-4-5` for latency? Only
   worth doing with measurements from phase 4 in hand.
9. **Native-speaker review of `VOICE_PRESENTATION_HR`** (§3). The draft is unreviewed, per the
   project rule on not shipping guessed Croatian.
10. **ERP phase 5 interaction.** That work locks invoice/payment writes to the service role. The
    assistant is read-only, so there is no conflict — but confirm nobody expects voice to
    authorise anything.
