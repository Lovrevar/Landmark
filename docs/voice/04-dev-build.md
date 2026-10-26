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
| `voice-llm` | `supabase/functions/voice-llm/` | Shared secret + opaque call token + room; identity from the stored JWT, re-read each request; rows persisted after the answer (§4.3, §7). Filler sentence on the first tool call, announcements dropped, TIC/OIB/IBAN spoken as words |
| `voice-session` | `supabase/functions/voice-session/` | `start`, `refresh`, `end` (§4.4). The call token goes to the agent through a server-side dispatch, never to the browser. One live call per user |
| Migration | `supabase/migrations/20261026100000_voice_calls.sql` | `voice_calls`, `ai_sessions.channel` / `external_call_id`, the sweep |
| Call button | `src/components/AiChat/components/VoiceCallButton.tsx`, `hooks/useVoiceCall.ts`, `services/voiceCallService.ts` | In the AI chat header. `livekit-client` loads on the first call only. Chat history lists `channel = 'chat'` only |
| Agent worker | `tools/voice-prototype/src/agent.ts` | Still the prototype's worker: with a dispatched call token it answers through `voice-llm`, otherwise through the stub. Synthesises each paragraph as its own TTS stream, so the filler is heard at once |

## State of LandmarkDev (2026-10-26)

- **Migration applied by running its SQL directly**, not recorded in `schema_migrations`, so other
  branches can still `db push`. It is idempotent; the push after this branch merges applies it
  again harmlessly.
- **pg_cron is not enabled on LandmarkDev**, so `voice-calls-sweep` is not scheduled. Expired
  calls are still refused at lookup; their rows are just not deleted.
- **Deployed:** `voice-llm` and `voice-session`. **`ai-chat` on dev is still the old version**
  (no streaming, sequential tools); this branch's `ai-chat` is not deployed.
- **Secrets:** `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`, `VOICE_LLM_SECRET`. The
  voice model is `AI_CHAT_VOICE_MODEL`, else `AI_CHAT_MODEL`, else `claude-sonnet-4-6` (dev sets
  neither).
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
- **Unit and function tests** — `npm run test:functions` (253), `npm test`.

## Measured (2026-10-26, s02, LiveKit Cloud, dev)

- **To the first audio after a question: 2.5–3.8 s** (5 questions), most of it the filler.
- **Inside `voice-llm`, warm:** call lookup and identity 0.2–0.3 s; the model's first event
  1.0–1.2 s after the call (Sonnet, ~9k-token prompt); tools 0.06–0.2 s; each further model round
  0.8–1.0 s. A data question takes three rounds, so the whole answer takes 5–8 s. A cold function
  adds ~1.5 s to its first request.
- Before two fixes the same day, the first audio took 6.8–7.4 s: ElevenLabs held the filler back
  until the answer arrived, and the model's own "let me look that up" sentence was spoken on top
  of the filler.

## Not done yet

Before the button can be shown to users:

1. **Latency.** The plan's 1.5 s gate covers the platform with a stand-in model; ours adds the
   model's first response (~1.0–1.2 s) and three rounds per data question. Options:
   - evaluate `AI_CHAT_VOICE_MODEL` = a faster model (§4.6 says only with numbers like these);
   - an earlier, shorter acknowledgement before the model's first event;
   - fewer rounds (a search that returns details).
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
