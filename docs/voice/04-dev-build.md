# Voice assistant — the dev build

What runs on LandmarkDev since 2026-10-26, how to run and test it without speaking, what it
measured, and what is still missing before it can ship. The design is
[`02-voice-implementation-plan.md`](./02-voice-implementation-plan.md); section numbers below are
that plan's.

## What it is

```
Cognilion (call button) ─ voice-session/start ─┬─ ai_sessions (channel 'voice') + voice_calls (JWT, by token hash)
        │                                      └─ LiveKit Cloud: room + agent dispatch (call token in the metadata)
        └─ LiveKit room ── agent worker (tools/voice-prototype/src/agent.ts, AGENT_NAME=cognilion-voice)
                            ├─ STT: Soniox stt-rt-v5, EU
                            ├─ LLM: voice-llm edge function (OpenAI-compatible) → the shared loop → tools as the caller
                            └─ TTS: ElevenLabs eleven_v4_turbo, Karlo
```

| Piece | Where | Notes |
|---|---|---|
| Shared agent loop | `supabase/functions/_shared/orchestrator.ts` | Extracted from `ai-chat` (§4.1). Streams the model call, runs a turn's tools concurrently (§3.1, §3.2). Chat and voice differ only in an EventSink, a MessageStore and the settings |
| Voice tools | `_shared/tools.ts` `TOOL_ALLOWLIST.voice` | 12 read-only tools, default-deny, checked at load and again at dispatch (§5). Sales gets 7 |
| Voice prompt | `_shared/prompts.ts` | `DOMAIN_RULES_HR` shared verbatim with chat; chat's prompt is byte-identical to before (§6) |
| `voice-llm` | `supabase/functions/voice-llm/` | Shared secret + opaque call token + room; identity from the stored JWT, re-read each request; rows persisted after the answer (§4.3, §7). Filler sentence on the first tool call, announcements dropped, TIC/OIB/IBAN spoken as words. `/warm` writes the prompt cache for the caller's settings (`max_tokens: 0`) |
| `voice-session` | `supabase/functions/voice-session/` | `start`, `refresh`, `end` (§4.4). The call token goes to the agent through a server-side dispatch, never to the browser. One live call per user |
| Migration | `supabase/migrations/20261026100000_voice_calls.sql` | `voice_calls`, `ai_sessions.channel` / `external_call_id`, the sweep |
| Call button | `src/components/AiChat/components/VoiceCallButton.tsx`, `hooks/useVoiceCall.ts`, `services/voiceCallService.ts` | In the AI chat header. `livekit-client` loads on the first call only. Chat history lists `channel = 'chat'` only |
| Agent worker | `tools/voice-prototype/src/agent.ts` | Still the prototype's worker: with a dispatched call token it answers through `voice-llm`, otherwise through the stub. Synthesises each paragraph as its own TTS stream, so the filler is heard at once. Calls `voice-llm/warm` as the call starts, while the greeting plays (logged to `logs/warm.jsonl`) |

## State of LandmarkDev (2026-10-26)

- **Migration applied by running its SQL directly**, not recorded in `schema_migrations`, so other
  branches can still `db push`. It is idempotent; the push after this branch merges applies it
  again harmlessly.
- **pg_cron is not enabled on LandmarkDev**, so `voice-calls-sweep` is not scheduled. Expired
  calls are still refused at lookup; their rows are just not deleted.
- **Deployed:** `voice-llm` (from `feature/voice-latency` since 2026-10-27: Sonnet 5.5, `/warm`)
  and `voice-session`. **`ai-chat` on dev is still the old version**
  (no streaming, sequential tools); this branch's `ai-chat` is not deployed.
- **Secrets:** `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`, `VOICE_LLM_SECRET`.
- **Voice model: `claude-sonnet-5-5`** (since 2026-10-27), with thinking off
  (`thinking: {type: "between_tools"}`), effort `low` and the server-side fallback
  (`fallbacks: "default"`, beta `server-side-fallback-2026-07-01`). `AI_CHAT_VOICE_MODEL` and
  `AI_CHAT_VOICE_EFFORT` override them; another model gets none of the Sonnet 5.5 settings. Voice
  no longer follows `AI_CHAT_MODEL`. Chat is still on `claude-sonnet-4-6`.
- **Test user:** `voice-test@cognilion.test`, a Director, with its password in
  `~/.config/cognilion-voice/dev-user.env` (outside the repo).

## Running it

The keys are in `~/.config/cognilion-voice/stt.env` (Soniox, ElevenLabs, LiveKit Cloud,
`VOICE_LLM_SECRET`) and `dev-user.env` (`SUPABASE_URL`, `SUPABASE_ANON_KEY`, `VOICE_LLM_URL`, the
test user). From `tools/voice-prototype/`:

```bash
set -a; source ~/.config/cognilion-voice/stt.env; source ~/.config/cognilion-voice/dev-user.env; set +a
AGENT_NAME=cognilion-voice npm run agent        # the worker, on LiveKit Cloud
```

Then the app (`npm run dev` at the repo root, pointed at LandmarkDev, with `VOICE_CALLS_ENABLED`
set to `true` locally): open the AI assistant and press the phone icon.

**The feature is off: `VOICE_CALLS_ENABLED = false`** in `src/lib/featureFlags.ts`, a compile-time
constant like the other flags there, so no deployment can switch it on without its backend. Off,
the call button is hidden and the chat history does not filter on `ai_sessions.channel`, so a
build of `development` works on a database without the voice migration. To try voice against
LandmarkDev, set it to `true` locally and do not commit it.

## Testing without speaking

- **Scripted call through Cognilion's own start path** — signs in as the test user, calls
  `voice-session/start`, plays recorded questions, and logs what the agent heard and said:

  ```bash
  node src/call-test.ts ask /mnt/c/phase0/clean/s02_q01.wav /mnt/c/phase0/clean/s02_q02.wav
  ```

- **The call button in a real browser, with a WAV file as the microphone** — headless Chromium
  with `--use-file-for-fake-audio-capture`; a Playwright script logs in, presses the button and
  hangs up. Then check the session's rows on dev. On 2026-10-26: live 3.3 s after the press, the
  agent's audio playing, the question and a two-tool answer persisted and chained, the credential
  deleted on hang-up, and the voice session absent from the chat history.
- **The model alone, without speech** — `node src/llm-bench.ts 3` in `tools/voice-prototype/`
  asks the ten phase 0 questions and two small-talk lines, three times each, straight against
  `voice-llm`, and reports the time to the first text, to the whole answer, the model rounds and
  the prompt-cache hits (the script's header says how to set it up). `node src/llm-bench.ts first
  [warm]` times one call's first question only, optionally after a warm-up.
- **Unit and function tests** — `npm run test:functions`, `npm test`.

## Measured (2026-10-26, s02, LiveKit Cloud, dev)

- **To the first audio after a question: 2.5–3.8 s** (5 questions), most of it the filler.
- **Inside `voice-llm`, warm:** call lookup and identity 0.2–0.3 s; the model's first event
  1.0–1.2 s after the call (Sonnet, ~9k-token prompt); tools 0.06–0.2 s; each further model round
  0.8–1.0 s. A data question takes three rounds, so the whole answer takes 5–8 s. A cold function
  adds ~1.5 s to its first request.
- Before two fixes the same day, the first audio took 6.8–7.4 s: ElevenLabs held the filler back
  until the answer arrived, and the model's own "let me look that up" sentence was spoken on top
  of the filler.

### The voice model (2026-10-27, `llm-bench.ts`, 36 questions per row)

| | Sonnet 4.6 | Sonnet 5.5, `medium` | Sonnet 5.5, `low` (chosen) |
|---|---|---|---|
| First text, p50 / p95 | 2.10 / 6.61 s | 2.23 / 3.81 s | 2.21 / 4.48 s |
| Whole answer, p50 / p95 | 6.84 / 15.25 s | 7.32 / 13.23 s | **4.52** / 11.89 s |
| Model's first output per call, p50 / p90 | **1.01** / 1.85 s | 1.49 / 3.57 s | 1.35 / 3.45 s |
| Model rounds per question | 1.92 | 2.25 | **1.89** |
| Prompt cache hit on the first call | 35/36 | 35/36 | 36/36 |

Sonnet 5.5 is not faster per call than 4.6; at `low` it answers in fewer rounds, so the whole
answer is faster, and it is cheaper ($2/$10 against $3/$15 per million tokens). With thinking off,
it says more of its reasoning aloud between tool calls ("Prvo ću dohvatiti…"); the sink drops only
a single sentence before a tool call.

## Latency: where it stands, and the plan

**Targets:** the caller hears something within **1.5 s** of finishing a question, and a question
about one project is answered within **4 s**.

**Where the time goes** (2026-10-26/27, warm function, Sonnet 5.5 at `low`):

| Stage | Time |
|---|---|
| Soniox decides the caller has finished | ~0.35 s (one take 2.6 s) |
| `voice-llm`: call lookup and identity | ~0.24 s |
| The model's first output | ~1.2–1.35 s per call (p90 ~3.4 s) |
| Filler to the agent, ElevenLabs starts | ~0.3 s |
| **First sound** | **~2.2 s** from the request, ~2.5–3 s from the end of speech |
| **Whole answer** | **p50 4.5 s**, p95 12 s (1.9 model rounds on average) |
| A cold function, the first time | +~1.5 s |

**Done on `feature/voice-latency`:**
- **Sonnet 5.5 at effort `low`** for voice (the table above): the whole answer went from a p50 of
  6.8 s to 4.5 s, in fewer rounds. It is not faster *per call* than Sonnet 4.6 (1.35 s against
  1.01 s to the first output), so the first sound did not move.
- **The warm-up** (`/warm`): one sample right after a deploy (a cold function and an empty cache)
  took 3.35 s, which the greeting (~3 s) mostly covers; it wrote 7,474 tokens to the prompt cache
  and the first question read all of them. Not yet measured against a call without it (step 1).
- **`llm-bench.ts`**, which times the model side without speech, and token and cache usage in
  `voice-llm`'s timing line.

**Next, in order.** Each step is measured with `llm-bench.ts` before and after, and confirmed in
audio with `call-test.ts ask`.

1. **Measure the warm-up** (½ hour of waiting). Alternate, at least three times each: redeploy
   `voice-llm` (a cold function), wait 6 minutes (the 5-minute cache expires), then
   `llm-bench.ts first` against `llm-bench.ts first warm`. Expected: the first question of a call
   ~1.5 s sooner after idle time.
2. **Fewer model rounds** (1 day). A question about a project takes a round to find it before the
   round that reads it. Give voice the caller's project list (name and id) in the per-user part of
   the system prompt: the same query as `search_projects` (`projects`, through the caller's own
   client, so RLS applies), held for a minute per call in the function. Dev has 14 projects;
   count production's first (if it is much larger, list only active ones). Subcontractors (136 on
   dev) stay a search. Expected: one round fewer, ~1.3 s, on project questions.
3. **Stop the model thinking aloud between tool calls** (½ day). With thinking off, Sonnet 5.5
   says its reasoning ("Prvo ću dohvatiti…"); the sink drops only one sentence before a tool call.
   Try a prompt line first; otherwise hold every sentence of a model call until it is clear
   whether a tool call follows, and measure what that costs direct answers.
4. **Faster identity** (½ day, plan §3.5). `authorize` runs the call lookup, the user lookup and,
   for Supervision, the project assignments one after another (~0.24 s). Keep the caller's
   identity for a minute per call in the function, or run the reads in parallel. Expected:
   0.1–0.2 s per question.
5. **An earlier first sound** (½ day, a decision). If the first sound is still over 1.5 s: let
   `voice-llm` send the filler whenever the model has produced nothing for ~0.5 s, not only when a
   tool call starts. Small talk would then sometimes hear "Samo trenutak…" first.
6. **Revisit the model if still short.** Claude Haiku 5.5 is not measured; run `llm-bench.ts`
   with `AI_CHAT_VOICE_MODEL=claude-haiku-5-5` on dev and check the answers as well as the
   times. Sonnet 4.6 was fastest per call but needs more rounds.

Expected after steps 1–4, to be checked: the first sound ~1.5–2 s after the end of speech, a whole
project answer ~3–4 s. Step 5 is for whatever remains.

## Not done yet

Before the button can be shown to users:

1. **Latency.** See "Latency: where it stands, and the plan" above.
2. **The agent worker needs a home.** It runs on a developer machine. Choose LiveKit Cloud's agent
   hosting (EU) or our own server, and move it out of `tools/voice-prototype/`.
3. **Rate limits (§7)** — none for voice yet: turns per call, calls per user per day, concurrent
   calls. Chat's own limit still counts voice turns, because it counts every user message in the
   user's sessions; scope it to `channel = 'chat'` (now possible).
4. **Plan §3.3 and §3.5** — the bounded history read and the concurrent pre-stream reads in
   `ai-chat` — and the decided **OQ-1 and OQ-2** fixes (§4.7). OQ-2 shows on calls: the model
   cannot tell whether a project has a TIC, so it hedges ("ako tic nije ažuriran…").
5. **Clamp list results for voice** (`list_contracts`, `list_unpaid_invoices`,
   `list_payments_for_subcontractor`) and make `search_help` return titles and a summary (§5).
6. **What the panel shows during a call** — nothing yet: no transcript, no answer text. And
   whether calls appear in the history at all (§11, question 7).
7. **Answers are sometimes long or think aloud** ("dakle tražim situacije izdane u rujnu…"), and
   the model slipped once in Croatian ("Napomenujem"). The prompt needs the native-speaker review
   (§11, question 9).
8. **"Kasnimo li s rokovima na nekom projektu?"** has no tool that answers it across all projects;
   the model says so and points to the app.
9. **The flag is all-or-nothing** (`VOICE_CALLS_ENABLED`). For a trial with a few users on
   production, it needs to be per user or per role.
10. **Help article and release note** for the call button (`/help-article`, `ai-chat-widget.md`),
    when it ships.
11. **The pgTAP test** `supabase/tests/database/voice_calls.test.sql` has not been run: Docker was
    not running. Run `supabase start && npm run test:db`.
12. **Production:** the migration, pg_cron for the sweep, the two functions and the secrets — and
    the DPO questions in §8 and §11 (ElevenLabs processes in the US).
13. **Soniox end of turn** took about 2.6 s on one take (`s02_q05`, "…u Osijeku?") against ~1.3 s
    for the others. Watch it with more speakers.
