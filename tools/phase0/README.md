# Phase 0 — Croatian STT test harness

Tooling for the phase 0 go/no-go gate in
[`docs/voice/02-voice-implementation-plan.md`](../../docs/voice/02-voice-implementation-plan.md) (§10):
record the frozen script, add a controlled noise condition, stream every take to Google Cloud
Speech-to-Text v2 and Azure Speech (both `hr-HR`), and score the results against the frozen gates.

This is standalone tooling. It imports nothing from the app or the edge functions, and it never
touches Supabase.

| File | What it is | Takes per speaker |
|---|---|---|
| `sentences.csv` | 30 domain terms × 3 carrier sentences, with `accepted_alternates` | 90 |
| `entities.csv` | 20 names (10 projects, 10 subcontractors) × 2 carrier sentences. **Placeholders**: see step 1 | 40 |
| `amounts.csv` | 10 euro amounts, written out in words inside a sentence | 10 |
| `dates.csv` | 10 dates, written out in words inside a sentence | 10 |
| `questions.csv` | 10 full questions a caller would ask | 10 |
| | **Total: one session per speaker** | **160** |
| `record.html` | Local recorder: all 160 takes in one shuffled session, plus `manifest.csv` | |
| `mix_noise.py` | Makes `noisy/` from `clean/` at the frozen 10 dB SNR, deterministically | |
| `run_stt.py` | Streams every take, clean and noisy, to both vendors in real time → `transcripts.csv` | |
| `score.py` | Scores `transcripts.csv` against the five script files → `results.md` | |
| `selftest.py` | Offline checks of all of the above (no microphone, no cloud) | |

This is the plan's design, and its observation counts. Per vendor over six speakers and two
conditions:

| Measure | Composition | Observations | 95 % CI at the gate |
|---|---|---|---|
| Domain terms | 30 × 3 carriers × 6 × 2 | 1,080 | ±1.8 pp at 90 % |
| Entity names | 20 × 2 carriers × 6 × 2 | 480 | ±3.6 pp at 80 % |
| Amounts + dates | (10 + 10) × 6 × 2 | 240 | ±2.8 pp at 95 % |
| Full questions | 10 × 6 × 2 | 120 utterances | — |

## Run order

Everything runs from this directory, `tools/phase0/`, with Python 3.11+.

```bash
python3 -m pip install -r requirements.txt
python3 selftest.py                     # must end with "all checks passed"
```

### 1. Freeze the script

Every row of the five CSVs carries `review_status`, which starts as `draft`. Reviewer 1 corrects the
text; reviewer 2 confirms it and flips the row to `frozen`.

In `entities.csv`, **replace every placeholder name with a real project or subcontractor name**.
Each name has two rows (carrier 1 and carrier 2), and both must change together. Update `name`,
`sentence` and `target_form`, add `accepted_alternates` if the name has a likely alternative
spelling, and set `placeholder` to `n`. Keep the plan's mix: 10 projects and 10 subcontractors; at
least 5 names with a legal form (d.o.o., j.d.o.o., obrt); at least 3 containing a surname; at least 3
with č/ć/đ/š/ž; at least 2 of foreign origin. The placeholders already meet it, so like-for-like
swaps keep it balanced.

**`record.html` refuses to start** while any row is `draft` or any entity is a placeholder. For a
test run, add `?dryrun=1` to the URL: a red banner then marks the session as not counting.
`score.py` also flags an unfrozen script on the report. Commit the frozen files **before the first
real recording**, and don't change them afterwards: scores are only comparable while the script
stays fixed.

Carrier rules:
- **Terms:** C1 puts the term in the nominative inside a question, C2 in an oblique case
  mid-sentence, and C3 makes the term the last word.
- **Entities:** C1 has the name as the subject of a question; C2 has it after an oblique-case word,
  mid-sentence ("Račun od izvođača X stigao je jučer.").
- `target_form` is the exact form as it appears in the sentence.
- `accepted_alternates` (pipe-separated) holds spoken or transcribed variants that also count as
  correct, under both strict and relaxed scoring. It is populated for every acronym, hyphenated and
  code-like target (PDV, R1 račun, OIB, IBAN, TIC). Example: `TIC-u` also accepts
  `tiku|tik-u|ticu|tic u|tik u`.
- Amounts and dates are written out in words, so every speaker says the same thing. Dates use the
  forms people actually say: "petnaesti listopada", "do trećeg svibnja", "dvadeset prvog ožujka dvije
  tisuće dvadeset sedme". Questions contain no numerals.

### 2. Record

Six speakers: at least two women and two men, from three regions; ideally real users. Each records
**160 takes**. That's about **27 minutes of active recording**, estimated from the actual sentences
(7 words on average, read at a careful pace, each take played back, about 10 % redone). Allow
**35–45 minutes per speaker** with the microphone check and one short break. This matches the plan's
estimate.

```bash
python3 -m http.server 8000 --bind 127.0.0.1
# open http://127.0.0.1:8000/record.html in Chrome or Edge
```

Enter the speaker ID (`s01`–`s06`), click **Load script** (it reads all five CSVs), choose
`tools/phase0/clean/` as the output folder, and start. Hold **Space** while reading and release
when done. After playback, press **Enter** to keep the take or **R** to redo it. Use a laptop
microphone in a quiet room: that is the device class of the v1 in-app call. Notes:

- localhost counts as a secure context, so the microphone works without HTTPS, and nothing leaves
  the machine.
- The browser's echo cancellation, noise suppression and automatic gain control are **off**. The
  noisy condition is added later, under control.
- 300 ms before the key press and 300 ms after the release are kept, so a speaker releasing early
  does not clip a sentence-final word.
- The order of all 160 takes is shuffled with the speaker ID as the seed, so sections are
  interleaved and fatigue spreads evenly. Reopening the page resumes, skipping takes already in the
  folder.
- File names:
  - terms: `{speaker}_{term_id}_c{carrier}.wav` (for example `s03_t25_c3.wav`);
  - entities: `{speaker}_{entity_id}_c{carrier}.wav` (for example `s03_e07_c2.wav`);
  - amounts, dates, questions: `{speaker}_{item_id}.wav` (for example `s03_a02.wav`, `s03_d05.wav`,
    `s03_q10.wav`).

  Each kept take upserts a line in `clean/manifest.csv`, tagged with its `section`.
- Without a folder picker (Firefox, Safari), each take downloads instead, and a
  `manifest_{speaker}.csv` downloads at the end. Move them into `clean/`. If speakers record on
  different machines, pass every manifest: `run_stt.py --manifest a.csv b.csv`.

### 3. Add noise

Get the fixed construction-site noise track, convert it to 16 kHz mono 16-bit, and mix at the frozen
10 dB SNR:

```bash
ffmpeg -i site-noise.mp3 -ac 1 -ar 16000 -sample_fmt s16 noise.wav
python3 mix_noise.py --clean clean --noise noise.wav --out noisy
```

Speech RMS is measured over active frames only, so pre-/post-roll silence doesn't count. The noise
segment for each take is chosen from a hash of its file name, and `noisy/mix_log.csv` records the
offset, gain and achieved SNR for each take. Re-running gives byte-identical files.

### 4. Transcribe

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
  Small negative values mean the vendor finalized within the 300 ms post-roll.
- **Google model fallback.** Streaming `hr-HR` is tried first on `--google-model` (default `long`)
  in `--google-location` (default `global`). If Google rejects that configuration (a config error,
  not a transient one), the take is retried on `chirp_2` in `europe-west4`, and the rest of the run
  uses that directly. Both are flags: `--google-fallback-model`, `--google-fallback-location`.
- The `model` column records which model produced each transcript (`google:long@global`,
  `google:chirp_2@europe-west4`, `azure:hr-HR`), and `results.md` summarises it.
- **Volume:** 6 speakers × 160 takes × 2 conditions × 2 vendors = 3,840 streams of about 5.5 s
  each (the take plus trailing silence). That's about 5.9 hours of real-time streaming, so about
  **1.5 hours at the default `--concurrency 4`**. Raise the concurrency only within each vendor's
  concurrent-stream limit, which is low on free tiers.

### 5. Score

```bash
python3 score.py                        # writes results.md
```

**The gate metric is RELAXED**: lowercase, punctuation deleted, diacritics folded. STRICT
(diacritics must match) is reported alongside, and is never a gate. A transcript matching the
target or any accepted alternate counts under both. Per vendor, with clean and noisy pooled:

| Section | Scored as | Gate |
|---|---|---|
| Terms (90) | target or alternate present in the transcript | ≥ 90 % pass, 80–90 % review, < 80 % **no-go**; no term < 70 %; no speaker < 80 %; each critical term ≥ 85 %, any < 70 % **no-go** |
| Entities (20 × 2) | target or alternate present, legal form optional | exact ≥ 80 % |
| Amounts (10) | an amount parsed from the transcript equals `amount_eur`: number words, `1.200.000`, `12.500,50`, `1,2 milijuna`, "… eura i N centi" | pooled with dates: **≥ 95 %** (the plan's single "amounts / dates" gate) |
| Dates (10) | a parsed date has the right day and month: ordinal words in any case ("petnaesti", "petnaestog(a)", "petnaestom"), "15.10.", "15. listopada". When the sentence speaks a year, the parsed year must match too | pooled with amounts, as above |
| Questions (10) | word error rate, pooled | ≤ 15 % |

`results.md` gives the verdict with reasons and then these tables:

- each section by condition (clean vs noisy);
- terms by position (carrier 3 vs carriers 1–2);
- per term and per speaker, with the floors flagged;
- per entity (both carriers pooled), per amount, per date and per question;
- models used, and time-to-final percentiles.

## Where this still differs from the plan's phase 0 protocol

1. **Amounts and dates are split 10 + 10, not the plan's 15 + 5.** The combined gate is the plan's
   own: 20 items, 240 observations, ≥ 95 % pooled. Dates carry more weight than in the plan.
2. **Entity recoverability is not scored.** Checking whether a recognised name finds the right
   entity through the real search tools is a later step, as the plan says. Only exact recognition is
   gated here.
3. **Engines, not platforms.** The plan replays the audio through each voice platform's web call
   (Vapi / Retell). This harness streams straight to the Google and Azure speech APIs. That is a
   clean comparison of the engines, but it skips the platforms' own audio processing and endpointing
   settings, and it does not include Deepgram (a common default engine on both platforms).

Known fragile targets, which are worth a look in the per-term table even with alternates:

- **TIC** may come out as a different word entirely.
- **R1 račun** has many spoken forms.
- The **hyphenated forms** depend on the suffix staying attached to the acronym.

If a new variant turns up repeatedly, add it to `accepted_alternates` **before** freezing, not after
seeing the scores.
