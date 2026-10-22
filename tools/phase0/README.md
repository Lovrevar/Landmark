# Phase 0 — Croatian STT test harness

Tooling for the phase 0 go/no-go gate in
[`docs/voice/02-voice-implementation-plan.md`](../../docs/voice/02-voice-implementation-plan.md) (§10):
record the frozen script, add a controlled noise condition, stream every take to Croatian
speech-to-text (Soniox, ElevenLabs Scribe and Deepgram Nova-3, each plain and with vocabulary hints;
Google and Azure on request), and score the results against the frozen gates.

This is standalone tooling. It imports nothing from the app or the edge functions, and it never
touches Supabase.

| File | What it is |
|---|---|
| `sentences.csv` | 30 domain terms × 3 carrier sentences = 90 takes, with `accepted_alternates` |
| `entities.csv` | 20 names (10 projects, 10 subcontractors) × 2 carrier sentences = 40 takes |
| `amounts.csv` | 10 euro amounts, written out in words inside a sentence |
| `dates.csv` | 10 dates, written out in words inside a sentence |
| `questions.csv` | 10 full questions a caller would ask |
| `assign.py` → `assignment.csv` | Who records which take (split design, below). Committed; `assign.py --check` verifies it |
| `record.html` | Local recorder. Each speaker sees only their assigned takes; no playback, so it auto-advances |
| `review.html` | Post-hoc spot-check: plays N random takes per speaker and exports the flagged ones |
| `mix_noise.py` | Makes `noisy/` from `clean/` at the frozen 10 dB SNR, deterministically |
| `run_stt.py` | Streams every take, clean and noisy, to each vendor configuration in real time → `transcripts.csv` |
| `score.py` | Scores `transcripts.csv` against the script → `results.md` |
| `tts_sentences.csv`, `tts_voices.csv` | The TTS panel: 30 gate sentences + 20 with numerals, and the voices to compare |
| `tts_panel.py` | Speaks every panel sentence with every voice → loudness-matched clips with opaque names |
| `rate.html` | Blind rating page: naturalness 1–5, number and pronunciation flags → `ratings_<rater>_<block>.csv` |
| `tts_score.py` | Scores the ratings against the TTS gates → `tts_results.md` |
| `selftest.py` | Offline checks of all of the above (no microphone, no cloud) |

## The split design

The script has 160 takes. To keep every session **under 15 minutes**, no speaker records all of
them:

- The **5 critical terms** (građevinska dozvola, izvođač, rokovi, proračun, TIC), with all 3
  carriers each (15 takes), are recorded by **all six speakers**.
- **Every other take is recorded by exactly 3 of the 6.** `assignment.csv` names those 3 (`speakers`)
  and the other 3 (`complement`).
- The assignment is **deterministic**: takes are ordered by a SHA-256 of their item id, never by text
  or file order, so rewording the script during review moves nothing. It is also **balanced**:
  consecutive takes alternate between a speaker triple and its complement.
  - Every speaker records exactly half of each even-sized section (20 entity takes and 5 each of
    amounts, dates and questions), plus 52–53 term takes (15 critical and 37–38 others).
  - Totals: **87 or 88 takes per speaker** (s01 88, s02 87, s03 87, s04 88, s05 88, s06 87).
  - The triples rotate through all 10 possible sets, so every pair of speakers shares takes.

Observations per vendor, clean and noisy pooled:

| Gate | Split (primary sessions) | 95 % half-width | Full (with complement sessions) | 95 % half-width |
|---|---|---|---|---|
| Terms, at 90 % | 630 | ±2.3 pp | 1,080 | ±1.8 pp |
| Entities, at 80 % | 240 | ±5.1 pp | 480 | ±3.6 pp |
| Amounts + dates, at 95 % | 120 | ±3.9 pp | 240 | ±2.8 pp |
| Question WER | 60 utterances | — | 120 utterances | — |
| One term (floor 70 %) | 18 (critical: 36) | one miss = 5.6 pp | 36 | one miss = 2.8 pp |
| One speaker, terms (floor 80 %) | ~105 | — | 180 | — |

The split is a precision trade, stated openly in every report. If a verdict lands in the REVIEW
band, the complement sessions (step 6) restore the full counts.

## Run order

Everything runs from this directory, `tools/phase0/`, with Python 3.11+.

```bash
python3 -m pip install -r requirements.txt
python3 selftest.py                     # must end with "all checks passed"
python3 assign.py --check               # assignment.csv matches the script ids and is balanced
```

### 1. Freeze the script

**Done:** the script was frozen in `022dcc3d` (2026-09-24), with real entity names. What was and
wasn't reviewed is in [`phase0-freeze-checklist.md`](../../docs/voice/phase0-freeze-checklist.md).
The rest of this step is the procedure for any future re-freeze.

Every row of the five script CSVs carries `review_status`, which starts as `draft`. Reviewer 1
corrects the text; reviewer 2 confirms it and flips the row to `frozen`. Wording changes do not
affect `assignment.csv`, which depends on the item ids only. `assign.py --check` confirms that.

In `entities.csv`, **replace every placeholder name with a real project or subcontractor name**.
Each name has two rows (carrier 1 and carrier 2), and both must change together. Update `name`,
`sentence` and `target_form`, add `accepted_alternates` if the name has a likely alternative
spelling, and set `placeholder` to `n`. Keep the plan's mix: 10 projects and 10 subcontractors; at
least 5 names with a legal form (d.o.o., j.d.o.o., obrt); at least 3 containing a surname; at least 3
with č/ć/đ/š/ž; at least 2 of foreign origin. The placeholders already meet it.

**`record.html` refuses to start** while any row is `draft` or any entity is a placeholder. For a
test run, add `?dryrun=1`: a red banner then marks the session as not counting. Commit the frozen
files **before the first real recording**, and don't change them afterwards.

Carrier rules:
- **Terms:** C1 puts the term in the nominative inside a question, C2 in an oblique case
  mid-sentence, and C3 makes the term the last word.
- **Entities:** C1 has the name as the subject of a question; C2 has it after an oblique-case word,
  mid-sentence.
- `target_form` is the exact form in the sentence.
- `accepted_alternates` (pipe-separated) holds spoken or transcribed variants that also count as
  correct, under both strict and relaxed scoring. It is populated for every acronym, hyphenated and
  code-like target (PDV, R1 račun, OIB, IBAN, TIC).
- Amounts and dates are written out in words, and questions contain no numerals.

### 2. Record (primary session, ≤ 15 minutes)

Six speakers: at least two women and two men, from three regions; ideally real users. Each records
**87–88 takes**. At the pace measured for the full script (7 words per take on average, a careful
reading pace, about 10 % re-recorded), without playback, that is **about 10 minutes of active
recording** (9.8–10.0 minutes depending on the speaker). Allow **about 12–13 minutes** including the
microphone check.

```bash
python3 -m http.server 8000 --bind 127.0.0.1
# open http://127.0.0.1:8000/record.html in Chrome or Edge
```

Enter the speaker ID (`s01`–`s06`), click **Load script**, choose `tools/phase0/clean/` as the
output folder, and start.

- Hold **Space** while reading, and release when done: the take is saved and the next sentence
  appears. There is no playback.
- **R** goes back to the take just recorded, and the next Space replaces it. **Esc** cancels. A very
  short or clipping take shows a hint suggesting R.
- 300 ms before the key press and 300 ms after the release are kept, so a speaker releasing early
  does not clip a sentence-final word.
- Browser echo cancellation, noise suppression and gain control are off.
- The speaker's takes are shuffled with the speaker ID as the seed. Reopening the page resumes,
  skipping takes already in the folder.
- File names:
  - terms: `{speaker}_{term_id}_c{carrier}.wav`;
  - entities: `{speaker}_{entity_id}_c{carrier}.wav`;
  - amounts, dates, questions: `{speaker}_{item_id}.wav`.

  Each take upserts a line in `clean/manifest.csv`, tagged with its `section` and `session`
  (`primary` or `complement`).
- Use Chrome or Edge, so takes are written straight into the folder and a redo cleanly overwrites the
  file. Other browsers download each take instead. There, a redo produces a second download that
  must replace the first by hand.

### 3. Spot-check

With playback gone, quality control happens after recording:

```bash
# same server as step 2; open http://127.0.0.1:8000/review.html
```

Choose the `clean/` folder, set the number of takes per speaker (default 5), and draw the sample.
The seed is shown, so the same sample can be drawn again. Each take plays with its sentence:

- **Enter** marks it OK, **F** flags it, **Space** replays, **←** goes back.
- **Download flagged.csv** at the end.

To re-record flagged takes, delete those files from `clean/` and reopen the recorder for that
speaker; its resume step asks for exactly the missing takes. If one speaker shows many problems,
check more of their takes, or re-record the session.

### 4. Add noise

Get the fixed construction-site noise track, convert it to 16 kHz mono 16-bit, and mix at the frozen
10 dB SNR:

```bash
ffmpeg -i site-noise.mp3 -ac 1 -ar 16000 -sample_fmt s16 noise.wav
python3 mix_noise.py --clean clean --noise noise.wav --out noisy
```

Speech RMS is measured over active frames only. Each take's noise segment is chosen from a hash of
its file name, and `noisy/mix_log.csv` records the offset, gain and achieved SNR for each take.
Re-running gives byte-identical files. Re-run after any new takes, such as redos or complement
sessions.

### 5. Transcribe and score

```bash
# keys in a file outside the repo, e.g. ~/.config/cognilion-voice/stt.env
set -a; source ~/.config/cognilion-voice/stt.env; set +a   # SONIOX_API_KEY, ELEVENLABS_API_KEY, DEEPGRAM_API_KEY
python3 run_stt.py --dry-run            # shows how many streams are pending
python3 run_stt.py --limit 6            # smoke test: 6 real streams
python3 run_stt.py                      # everything; re-run after any failure to resume
python3 score.py                        # writes results.md
```

- **Configurations:** by default `soniox` and `soniox_hints`. Speech-to-text was decided for Soniox
  on 2026-10-22 (plan header), so the remaining runs check it against the gates.
  - `elevenlabs`, `deepgram` (each also as `_hints`), `google` and `azure` stay available with
    `--vendors`, to re-run a comparison.
  - `google` needs `GOOGLE_APPLICATION_CREDENTIALS`; `azure` needs `AZURE_SPEECH_KEY` and
    `AZURE_SPEECH_REGION`.
- **Vocabulary hints** are what production would send: the 30 domain terms and the 10 project names,
  never the subcontractor names, which production couldn't fit within the vendors' limits. Sending
  only the scripted ones would hand over the answers. ElevenLabs' realtime limit (50 terms of at most
  20 characters) drops 2 terms. The `model` column records the count, e.g. `+hints38`.
- **Regions:** Soniox and Deepgram default to their EU hosts. The Soniox key must come from the EU
  project. ElevenLabs runs on its US host; EU residency is Enterprise-only (`--elevenlabs-url`).
- Each take streams in 100 ms chunks on a real-time clock, followed by 1.5 s of silence, so the
  vendor's endpointing has to finalize the result by itself. The endpointing settings
  (`--soniox-endpoint-delay-ms` 1000, `--elevenlabs-vad-silence-s` 0.8, `--deepgram-endpointing-ms`
  300) stay below that silence. After it, each stream is ended the vendor's way, which also flushes
  anything not yet final.
- **Google model fallback:** if the first model (`--google-model`, default `long`) rejects streaming
  `hr-HR`, the take is retried on `chirp_2` in `europe-west4`, and the rest of the run uses it. The
  `model` column records which model produced each transcript.
- **Volume (the two Soniox configurations):** split design: 525 takes × 2 conditions × 2 =
  2,100 streams of about 5.5 s, about **50 minutes at `--concurrency 4`**, or under 30 at
  `--concurrency 8`. Soniox's default limit is 10 concurrent streams. Full design: 3,840 streams.
  - With all six configurations, multiply by 3 and keep `--concurrency` at 6 or below, which is
    ElevenLabs' free-tier limit.
- **The gate metric is RELAXED** (diacritics folded). STRICT is reported alongside and is never a
  gate. A match on the target or any alternate counts under both. The gates:
  - terms ≥ 90 % pass, 80–90 % review, < 80 % no-go; no term below 70 %; no speaker below 80 %;
  - each critical term ≥ 85 %, and any critical term below 70 % is a no-go;
  - entities exact ≥ 80 %, with the legal form optional;
  - amounts and dates pooled ≥ 95 % (the plan's single gate);
  - question WER ≤ 15 %.
- `results.md` opens with **Design and precision**: which design it found (split, partial or full),
  how many primary and complement takes are present, and for each gate the actual observations and
  95 % half-width next to the full-design figures. Every interval, floor and verdict uses the actual
  counts.

### 6. The escape hatch: complement sessions

If a verdict from the split design lands in the **REVIEW band**, restore the full counts before
deciding. Record each speaker's other half, which is 72–73 takes and a little under 10 minutes:

```
http://127.0.0.1:8000/record.html?session=complement
```

The same speaker IDs, the same `clean/` folder, and the same shuffle-and-resume behaviour apply. The
merge needs nothing special:

- complement takes use the same file-name scheme and never collide with a speaker's primary takes;
- `manifest.csv` gains lines tagged `session=complement` (with separate machines, pass every
  manifest: `run_stt.py --manifest a.csv b.csv`);
- `mix_noise.py` and `run_stt.py` process only what is new (resume by file);
- `score.py` then reports the design as **full**, with 1,080 / 480 / 240 / 120 observations.

A partial complement (some speakers only) is also valid. The report shows it as **partial**, with
the counts actually present.

## TTS listening panel

The plan's TTS gates (§10): mean naturalness **≥ 3.5** from **three native raters**, blind and in random
order, over 20 numeric and 10 general sentences, with **0 mispronounced amounts or dates**.

**Sentences** (`tts_sentences.csv`):
- **Gate block:** the 10 amounts and 10 dates from the STT script, numbers written in words, plus 10
  statements full of domain terms (TIC, R1 račun, OIB, cesija, kompenzacija, IBAN…). All 30 are the
  native-reviewed STT sentences, word for word.
- **Digits block:** the same 20 amounts and dates written with numerals (`12.500,50 eura`,
  `15. listopada`), so the voice has to expand them itself. It is informational, not a gate: the voice
  prompt asks the model to write numbers in words. It shows whether a voice can be trusted if the model
  slips.

**Voices** (`tts_voices.csv`), two per vendor, one female and one male:
- ElevenLabs `eleven_flash_v2_5` and `eleven_v4_turbo`, using the same two voices so that the model is
  the only difference;
- Azure `hr-HR-GabrijelaNeural` and `SreckoNeural`.

Google was left out (2026-10-22). `tts_panel.py` still supports a `google` row if one is added.

A row with an empty `voice` is skipped. To fill the empty ones, list what each vendor offers:

```bash
python3 tts_panel.py --list-voices elevenlabs   # Croatian voices in the Voice Library: put voice_id in `voice`
python3 tts_panel.py --list-voices azure        # confirms the two hr-HR neural voices
```

**Keys:**
- **ElevenLabs:** a key with the **text-to-speech** and **voices read** permissions.
  - The account must be on a paid plan, or have credits. Free accounts can't use library voices through
    the API, and every natively Croatian voice is a library voice.
- **Azure:** `AZURE_SPEECH_KEY` and `AZURE_SPEECH_REGION`, with an EU region such as `westeurope`.

**Run** (keep the panel outside the repo, like the recordings):

```bash
python3 tts_panel.py --out /mnt/c/phase0/tts --dry-run   # what would be generated
python3 tts_panel.py --out /mnt/c/phase0/tts             # 6 voices x 50 sentences = 300 clips, a few cents
python3 -m http.server 8000 --bind 127.0.0.1             # then open http://127.0.0.1:8000/rate.html
python3 tts_score.py --panel /mnt/c/phase0/tts           # after the ratings are in the panel folder
```

**What makes it blind and fair:**
- Clip names are hashes, and each rater gets their own random order (seeded by the rater ID).
- Every clip is scaled to the same speech loudness (−20 dBFS), so no voice wins by being louder.

**Raters:**
- Three native speakers each rate the **gate** block: 6 voices × 30 = 180 clips, about 20 minutes.
- One of them also rates the **digits** block.
- Each enters a rater ID (`r1`…), chooses the panel folder, rates, and downloads
  `ratings_<rater>_<block>.csv` into the panel folder.
- Keys: `1`–`5` naturalness, `N` number or date wrong, `P` other mispronunciation, `Enter` next,
  `Space` replay.

**Narrowing rounds:** after a first rater, drop the clearly weak voices and give the remaining raters a
smaller panel in a new folder.
- Copy the kept voices' clips and their manifest lines into the new folder.
- Generate any new voices there with `--out <new folder> --configs …`.
- Already-present clips are skipped, so nothing is paid for twice.

Round 2 (2026-10-22) is `C:\phase0\tts2`: ElevenLabs v4 Turbo with Sara and Martin, plus Branimir and
Karlo. After one rater, Azure and Flash were well below 3.5, and Flash also misread numerals.

**Scoring:**
- A numeric sentence counts as **mispronounced** when more than half of its raters flagged it.
  `tts_results.md` also lists sentences flagged by anyone.
- A voice with fewer than three raters is reported **INCOMPLETE**.
- Synthesis times are recorded, but only ElevenLabs streams. Real time-to-first-audio is measured on the
  live prototype.

## Where this still differs from the plan's phase 0 protocol

1. **Split design by default.** The plan's counts, and so its intervals, are reached only after
   the complement sessions (step 6). Until then, the report states the wider intervals.
2. **Amounts and dates are split 10 + 10, not 15 + 5.** The combined gate is the plan's: 20 items,
   ≥ 95 % pooled.
3. **Entity recoverability is not scored.** That is a later step, as the plan says.
4. **Engines, not platforms.** This streams straight to each vendor's speech API, not through a
   voice platform's web call. The TTS, barge-in and latency criteria need a live prototype.
5. **Vendors.** The plan named Vapi / Retell with their default speech-to-text. The shortlist is now
   Soniox, ElevenLabs Scribe and Deepgram Nova-3, each also with vocabulary hints.

Known fragile targets, which are worth a look in the per-term table even with alternates:

- **TIC** may come out as a different word entirely.
- **R1 račun** has many spoken forms.
- The **hyphenated forms** depend on the suffix staying attached to the acronym.

Add recurring variants to `accepted_alternates` **before** freezing, not after seeing the scores.
