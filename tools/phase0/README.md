# Phase 0 — Croatian STT test harness

Tooling for the phase 0 go/no-go gate in
[`docs/voice/02-voice-implementation-plan.md`](../../docs/voice/02-voice-implementation-plan.md) (§10):
record the frozen script, add a controlled noise condition, stream every take to Google Cloud
Speech-to-Text v2 and Azure Speech (both `hr-HR`), and score the results against the frozen gates.

This is standalone tooling. It imports nothing from the app or the edge functions, and it never
touches Supabase.

| File | What it is |
|---|---|
| `sentences.csv` | **The frozen script**: 30 terms × 3 carrier sentences = 90 rows |
| `record.html` | Local recorder page: one sentence at a time, 16 kHz mono WAV per take, plus `manifest.csv` |
| `mix_noise.py` | Makes `noisy/` from `clean/` at a fixed SNR (default 15 dB), deterministically |
| `run_stt.py` | Streams every take, clean and noisy, to both vendors in real time → `transcripts.csv` |
| `score.py` | Scores `transcripts.csv` against the script → `results.md` |
| `selftest.py` | Offline checks of all of the above (no microphone, no cloud) |

## Run order

Everything runs from this directory, `tools/phase0/`, with Python 3.11+.

```bash
python3 -m pip install -r requirements.txt
python3 selftest.py                     # must end with "all checks passed"
```

**1. Freeze the script.** Have a native speaker check `sentences.csv` and a second one confirm it
(the plan's protocol), and commit any corrections **before the first recording**. After that, the
file does not change: scores are only comparable across speakers and vendors while it stays fixed.
Carrier rules: C1 puts the term in the nominative inside a question, C2 in an oblique case
mid-sentence, and C3 makes the term the last word. `target_form` is the exact form in the sentence.

**2. Record** (six speakers: at least two women and two men, from three regions; ideally real users).

```bash
python3 -m http.server 8000 --bind 127.0.0.1
# open http://127.0.0.1:8000/record.html in Chrome or Edge
```

Enter the speaker ID (`s01`–`s06`), load `sentences.csv`, choose `tools/phase0/clean/` as the
output folder, and start. Hold **Space** while reading and release when done. After playback,
press **Enter** to keep the take or **R** to redo it. Use a laptop microphone in a quiet room: that
is the device class of the v1 in-app call. Notes:

- localhost counts as a secure context, so the microphone works without HTTPS, and nothing leaves
  the machine.
- The browser's echo cancellation, noise suppression and automatic gain control are **off**. The
  noisy condition is added later, under control.
- 300 ms before the key press and 300 ms after the release are kept, so a speaker releasing early
  does not clip the sentence-final term of carrier 3.
- Sentence order is shuffled with the speaker ID as the seed. Reopening the page resumes, skipping
  takes already in the folder.
- Takes are saved as `{speaker}_{term_id}_c{carrier}.wav` (for example `s03_t25_c3.wav`), and each
  kept take upserts a line in `clean/manifest.csv`.
- Without a folder picker (Firefox, Safari), each take downloads instead, and a
  `manifest_{speaker}.csv` downloads at the end. Move them into `clean/`.
- If speakers record on different machines, pass every manifest to `run_stt.py --manifest a.csv b.csv`.

**3. Add noise.** Get the fixed construction-site noise track, convert it to 16 kHz mono 16-bit, and mix:

```bash
ffmpeg -i site-noise.mp3 -ac 1 -ar 16000 -sample_fmt s16 noise.wav
python3 mix_noise.py --clean clean --noise noise.wav --out noisy          # --snr-db 15 by default
```

Speech RMS is measured over active frames only, so pre-/post-roll silence doesn't count. The noise
segment for each take is chosen from a hash of its file name, and `noisy/mix_log.csv` records the
offset, gain and achieved SNR for each take. Re-running gives byte-identical files.

**4. Transcribe.**

```bash
export GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json   # project read from it, or GOOGLE_CLOUD_PROJECT
export AZURE_SPEECH_KEY=...  AZURE_SPEECH_REGION=westeurope
python3 run_stt.py --dry-run            # shows how many streams are pending
python3 run_stt.py --limit 4            # smoke test: 4 real streams
python3 run_stt.py                      # everything; re-run after any failure to resume
```

- Each take streams in 100 ms chunks on a real-time clock, followed by 1.5 s of silence, so the
  vendor's endpointing has to finalize the result by itself.
- `time_to_final_ms` is the arrival of the last final result minus the end of the take's audio.
  The take ends with 300 ms of post-roll, so small negative values are possible and mean the
  vendor finalized within that tail.
- Budget the wall-clock time: six speakers × 90 takes × 2 conditions × 2 vendors ≈ 2,200 streams
  of about 5 s each. That's about 3 hours at the default `--concurrency 4`.
- Google's model and location are flags (`--google-model long --google-location global`). Check the
  Speech-to-Text v2 language table for `hr-HR` streaming support in your location before the full run.

**5. Score.**

```bash
python3 score.py                        # writes results.md
```

The headline is **strict**: lowercase, punctuation deleted, and diacritics must match. The
diacritics-relaxed figure is reported alongside. Per vendor, `results.md` gives:

- overall accuracy with a 95 % Wilson interval, and the verdict;
- per-term and per-speaker tables, with the floors flagged;
- clean vs noisy, and carrier 3 (term-final) vs carriers 1–2;
- time-to-final percentiles.

Verdicts use the frozen gates: overall ≥ 90 % pass, 80–90 % review, < 80 % no-go; no term below
70 %; no speaker below 80 %; each critical term ≥ 85 %, and any critical term below 70 % is a no-go.

## Where this harness differs from the plan's phase 0 protocol

Decide these before the first recording. After that they cannot change without re-scoring.

1. **SNR: 15 dB here, 10 dB in the plan.** This harness follows the tooling brief (`--snr-db 15`).
   Pick one and align the plan.
2. **Strict diacritics is the headline here; the plan made the relaxed figure pass/fail, with
   strict as secondary.** Strict is the harder bar.
3. **Only the 90 term sentences are covered.** The plan's full script also has 20 entity names,
   15 amounts, 5 dates and 10 full questions per speaker, with their own gates (entity exact
   ≥ 80 % and recoverable ≥ 95 %, amounts ≥ 95 %, WER ≤ 15 %). Those are not recorded or scored
   here, and recoverability needs the real search tools, which this harness deliberately does not
   touch.
4. **Engines, not platforms.** The plan replays the audio through each voice platform's web call
   (Vapi / Retell). This harness streams straight to the Google and Azure speech APIs. That is a
   clean comparison of the engines, but it skips the platforms' own audio processing and endpointing
   settings, and it does not include Deepgram (a common default engine on both platforms).
5. **The carrier sentences are machine-drafted.** The plan requires a native speaker to write them
   and a second to check them before freezing (step 1 above).

Known fragile targets under strict matching, which are worth a look in the per-term table:

- **TIC** may be transcribed as spoken ("tik").
- **R1 račun** may come out as "R 1" or "er jedan".
- **PDV-a / OIB-a / IBAN-a / TIC-u / TIC-a** depend on the hyphenated suffix staying attached.

Punctuation is deleted, not replaced by a space, so "PDV-a" and "pdva" both match.
