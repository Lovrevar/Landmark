# Phase 0 — live voice prototype

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
- **Barge-in is driven by Silero voice detection.**
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
node src/call-test.ts bargein /mnt/c/phase0/clean/s02_q01.wav     # with STUB_ANSWER=long
npm run report                                                      # the agent-side logs against the gates
```

## Settings (agent)

| Variable | Default | What it does |
|---|---|---|
| `VOICE` | `martin` | `martin`, `karlo`, or any ElevenLabs voice id |
| `ENDPOINT_LATENCY_LEVEL` | 3 | Soniox v5 endpoint latency adjustment, 0–3. At 3, latency dropped from about 1.55 to 1.27 s |
| `TURN_MIN_DELAY_MS` | 100 | LiveKit's wait *after* Soniox's end-of-turn signal. LiveKit's default of 500 ms is added on top of Soniox's own, so it is pure waiting |
| `ENDPOINT_DELAY_MS` | 500 | Soniox's maximum end-of-turn delay (500–3000). Lowering it from 1000 made no difference |
| `INTERRUPT_MIN_MS` | 50 | Speech needed before the agent stops talking |
| `OUTPUT_QUEUE_MS` | 50 | Agent audio queued ahead of playout, cleared on an interruption |
| `VAD_THRESHOLD`, `VAD_MIN_SPEECH_MS` | 0.3, 30 | Silero's sensitivity (its own defaults are 0.5, 50) |

## Results so far

From 2026-10-23: the local server, the scripted caller with Lovre's (`s02`) recorded questions, and
Martin's voice.

**Latency: within the gate on this setup.**
- From the caller's side: **0.76–1.47 s, median 1.27 s**, over 5 questions. That's within 1.5 s.
- From the agent's side: about 0.90 s, made up of the turn ending (about 0.35 s), the stub LLM (0.41 s)
  and ElevenLabs' first audio (0.13 s).
- All 5 questions were transcribed word for word.
- **Not yet the gate's measurement.** The gate wants 10 live questions × 2 speakers, over a real
  network. A local server flatters transport, and a real LLM is slower than the stub's 0.4 s.

**Barge-in: not within the gate yet.**
- The caller hears the agent stop **0.64–1.05 s** after starting to speak, against 0.5 s.
- Once the agent notices, it stops fast: about 30 ms to change state, and 60–90 ms until the audio is
  gone.
- **The time goes into noticing:** Silero takes 0.52–0.93 s to decide that the caller is speaking. It
  varies with how the sentence starts.
- Lowering the interruption threshold and the output queue didn't help. A more sensitive Silero (0.3 / 30)
  helped a little.

**Next to try for barge-in:**
1. A live browser test with a real microphone. The scripted caller counts from the very first sound of a
   take, which is strict.
2. Interrupting on Soniox's first non-final words, rather than on Silero.
3. Running the same test over LiveKit Cloud, to see the real network's share.

The ElevenLabs plugin needs `@livekit/agents` 1.9.3, released 2026-10-15. 1.9.1 sends `eleven_v4_turbo`
to an endpoint that rejects it with HTTP 400. That's an exception to pinning versions at least two weeks
old, acceptable for a prototype.
