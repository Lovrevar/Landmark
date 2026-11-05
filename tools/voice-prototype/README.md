# Phase 0 — live voice prototype

> **Since 2026-10-26 this worker is also what answers Cognilion's call button on LandmarkDev**, through
> the `voice-llm` edge function. How that is set up and tested is in
> [`docs/voice/04-dev-build.md`](../../docs/voice/04-dev-build.md). The `ask` mode of the scripted
> caller plays questions through Cognilion's own start path and logs what the agent heard and said.

This is the last part of phase 0 in
[`docs/voice/02-voice-implementation-plan.md`](../../docs/voice/02-voice-implementation-plan.md) (§10).
It measures the two gates that the offline harnesses in [`tools/phase0/`](../phase0/) can't:

- **Barge-in:** the voice stops within 0.5 s of the caller starting to speak, in at least 18 of 20 tries.
- **Latency:** from the end of the caller's speech to the first audio, median 1.5 s or less.

## The chain

```
browser (or src/call-test.ts) ── LiveKit room ── agent worker (src/agent.ts)
                                                 ├─ STT: Soniox stt-rt-v5, EU host, Croatian, phase 0 hints
                                                 ├─ LLM: src/stub-llm.ts, fixed answers, first token after 400 ms
                                                 └─ TTS: ElevenLabs eleven_v4_turbo, VOICE=martin|karlo
```

- **The LLM is a stub, on purpose.** The plan's latency gate is defined with a stand-in, not our
  assistant. Real answers come with `voice-llm` (phase 4), and tool calls will add time; the plan's
  filler speech is there to cover that.
- **The turn ends on Soniox's own end-of-turn signal** (`turnDetection: 'stt'`). LiveKit's
  turn-detection models don't cover Croatian.
- **Barge-in is driven by Silero voice detection**, Soniox's first words, or both (`INTERRUPT_ON`).
- **Nothing here uses LiveKit Cloud.** The settings that would quietly enable LiveKit's hosted models
  (the default turn detector, "adaptive" interruption) are switched off explicitly.

## Running it

It needs Node 24 and the local LiveKit server binary: v1.13.10, from LiveKit's GitHub release, unpacked
in `~/.local/opt/livekit-1.13.10`, with the checksum verified. The keys come from
`~/.config/cognilion-voice/stt.env` (`SONIOX_API_KEY` from the EU project, `ELEVENLABS_API_KEY`).

Run each in its own terminal, from this folder:

```bash
npm install
npm run livekit                                    # local server, dev keys devkey/secret
npm run stub-llm                                   # STUB_ANSWER=long for barge-in runs
set -a; source ~/.config/cognilion-voice/stt.env; set +a
LIVEKIT_URL=ws://localhost:7880 LIVEKIT_API_KEY=devkey LIVEKIT_API_SECRET=secret npm run agent
npm run web                                        # http://127.0.0.1:8090, the call button
```

`npm run typecheck` type-checks the sources. They run directly on Node 24, with no build step.

To use a LiveKit Cloud project, set `LIVEKIT_URL` / `LIVEKIT_API_KEY` / `LIVEKIT_API_SECRET` to its
values for both `agent` and `web`, and skip `npm run livekit`.

**Scripted caller.** `src/call-test.ts` plays recorded questions into the room, for example Lovre's
phase 0 takes, and timestamps the agent's audio as it arrives. That makes the measurement repeatable and
includes transport.

```bash
node src/call-test.ts latency /mnt/c/phase0/clean/s02_q01.wav /mnt/c/phase0/clean/s02_q02.wav
node src/call-test.ts ask /mnt/c/phase0/clean/s02_q01.wav      # what the agent heard and said; with COGNILION_EMAIL set, via voice-session
node src/llm-bench.ts 3                                         # voice-llm alone, no speech: the phase 0 questions × 3 (see its header)
LABEL=vad node src/call-test.ts bargein /mnt/c/phase0/clean/s02_q01.wav   # STUB_ANSWER=long; LABEL = the agent's INTERRUPT_ON
npm run report                                                      # the logs against the gates, barge-in per LABEL
```

## Settings (agent)

| Variable | Default | What it does |
|---|---|---|
| `VOICE` | `karlo` | `karlo` (chosen 2026-10-26), `martin`, or any ElevenLabs voice id |
| `AGENT_NAME` | unset | `cognilion-voice` makes the worker take only calls dispatched by `voice-session/start`; unset, it joins every room (the phase 0 set-up) |
| `VOICE_LLM_URL`, `VOICE_LLM_SECRET` | — | The `voice-llm` endpoint and its secret, for dispatched calls. A dispatched call answers through Cognilion's assistant; any other through the stub |
| `ENDPOINT_LATENCY_LEVEL` | 3 | Soniox v5 endpoint latency adjustment, 0–3. At 3, latency dropped from about 1.55 to 1.27 s |
| `TURN_MIN_DELAY_MS` | 100 | LiveKit's wait *after* Soniox's end-of-turn signal. LiveKit's default of 500 ms is added on top of Soniox's own, so it is pure waiting |
| `ENDPOINT_DELAY_MS` | 500 | Soniox's maximum end-of-turn delay (500–3000). Lowering it from 1000 made no difference |
| `INTERRUPT_MIN_MS` | 50 | Speech needed before the agent stops talking |
| `OUTPUT_QUEUE_MS` | 50 | Agent audio queued ahead of playout, cleared on an interruption |
| `VAD_THRESHOLD`, `VAD_MIN_SPEECH_MS` | 0.3, 30 | Silero's sensitivity (its own defaults are 0.5, 50) |
| `INTERRUPT_ON` | `vad` | `vad`: Silero. `stt`: no Silero, so LiveKit interrupts on Soniox's first interim words. `both`: Silero, and also stop on Soniox's first words |

## Results so far

From 2026-10-26: the local server, the scripted caller with Lovre's (`s02`) five recorded questions,
Martin's voice, and the stub LLM. `npm run report` prints these figures.

**Latency: within the gate, but only just.**
- From the caller's side: **1.16–1.61 s, median 1.32 s, p95 1.61 s**, over 10 answers (each question
  twice). The gate is a 1.5 s median.
- From the agent's side: about 0.90 s, of which the stub LLM takes 0.41 s and ElevenLabs' first audio
  0.13 s. The other ~0.4 s passes before the agent decides that the caller has stopped.
- **Not yet the gate's measurement.** The gate wants 10 live questions × 2 speakers, over a real
  network. A local server flatters transport, and a real LLM is slower than the stub's 0.4 s. With
  0.18 s of margin, both could push it over.

**Barge-in: within the gate, with either detector.** How long after the caller's first word the caller
hears the agent stop, over 20 tries each:

| `INTERRUPT_ON` | Within 0.5 s | Median | Slowest |
|---|---|---|---|
| `stt` (Soniox's first words) | 20 / 20 | 0.30 s | 0.38 s |
| `vad` (Silero, 0.3 / 30) | 20 / 20 | 0.25 s | 0.29 s |

- Once the agent notices, it stops within about 0.1 s.
- **Silero also reacts to breath.** In 2 of 40 tries it stopped the agent about 0.22 s *before* the
  first word, on the breath in the take's pre-roll. The caller counts that as a stop, as a negative
  `stop_ms`. It is harmless here, but on a building site it may mean stopping for noise. Soniox stops
  only on words, about 0.05 s later. Which to keep is open until the
  noisy condition is tested.

**Earlier figures were wrong.** Until 2026-10-23 the scripted caller took anything above 10 % of a
take's peak loudness as speech, and s02's takes have 0.4–0.8 s of breath and room noise above that
before the first word. Barge-in looked like it failed (0.64–1.05 s), because it was timed from too
early. Latency was timed from up to 0.8 s too late, although on these five takes the median moved only
from 1.27 to 1.32 s.
- `src/speech-span.ts` now finds the speech with Silero, offline. The end comes from a pass over the
  reversed take, because Silero lags 150–300 ms at the end of speech.
- The caller logs the span as `speech_ms`, and the report skips rows without it.
- The old logs are in `logs/old-clock/`.

**Next:**
1. A live browser test with a real microphone.
2. The same tests over LiveKit Cloud, to see the real network's share.
3. More speakers, the noisy condition, and the choice between `stt` and `vad`.

The ElevenLabs plugin needs `@livekit/agents` 1.9.3, released 2026-10-15. 1.9.1 sends `eleven_v4_turbo`
to an endpoint that rejects it with HTTP 400. That's an exception to pinning versions at least two weeks
old, acceptable for a prototype.
