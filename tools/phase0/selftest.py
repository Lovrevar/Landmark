#!/usr/bin/env python3
"""Offline self-test for the phase 0 tooling: no microphone, no cloud calls.

    python3 selftest.py

Checks the script files' invariants, that mix_noise.py is deterministic and hits
the frozen SNR, the matching / alias / amount / WER rules and the verdicts in
score.py, and the resume logic, real-time pacing and Google model fallback in
run_stt.py. Install requirements.txt first.
"""

from __future__ import annotations

import csv
import hashlib
import re
import subprocess
import sys
import tempfile
import time
import unicodedata
import wave
from pathlib import Path

import numpy as np

HERE = Path(__file__).resolve().parent
PY = sys.executable
sys.path.insert(0, str(HERE))
failures: list[str] = []


def check(cond: bool, msg: str) -> None:
    print(("  ok   " if cond else "  FAIL ") + msg)
    if not cond:
        failures.append(msg)


def rows_of(name: str) -> list[dict]:
    return list(csv.DictReader(open(HERE / name, encoding="utf-8")))


def write_wav(path: Path, x: np.ndarray) -> None:
    with wave.open(str(path), "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(16000)
        w.writeframes(np.clip(np.rint(x * 32768), -32768, 32767).astype("<i2").tobytes())


def sha(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def fold(s: str) -> str:
    s = s.replace("đ", "d").replace("Đ", "D")
    return "".join(ch for ch in unicodedata.normalize("NFD", s) if unicodedata.category(ch) != "Mn")


# ---------------------------------------------------------------------------

def test_script() -> None:
    print("script files")
    from score import parse_amounts, parse_dates

    terms = rows_of("sentences.csv")
    check(len(terms) == 90, "sentences.csv: 90 rows")
    check(list(terms[0]) == ["term_id", "term", "critical", "carrier_no", "sentence", "target_form",
                             "accepted_alternates", "review_status"], "sentences.csv: exact columns")
    check(len({r["term_id"] for r in terms}) == 30 and len({r["term_id"] for r in terms if r["critical"] == "y"}) == 5,
          "30 terms, 5 critical")
    check({r["term"] for r in terms if r["critical"] == "y"} == {"građevinska dozvola", "izvođač", "TIC", "proračun", "rokovi"},
          "critical terms match the plan")
    check(all(r["target_form"] in r["sentence"] for r in terms), "every target_form appears verbatim in its sentence")
    check(all(re.search(re.escape(r["target_form"]) + r"[.?!]$", r["sentence"]) for r in terms if r["carrier_no"] == "3"),
          "carrier 3 is term-final")
    code_like = [r for r in terms if re.search(r"[A-Z]{2,}|\d|-", r["target_form"])]
    check(len(code_like) == 15 and all(r["accepted_alternates"] for r in code_like),
          "all 15 acronym / hyphenated / code-like rows have accepted_alternates")
    check(all(r["review_status"] in ("draft", "frozen") for r in terms), "review_status is draft or frozen")

    ents = rows_of("entities.csv")
    names = {r["entity_id"]: r for r in ents}
    check(len(ents) == 40 and len(names) == 20 and all(r["target_form"] in r["sentence"] for r in ents),
          "entities.csv: 20 names x 2 carriers = 40 rows (the plan's 480-observation design)")
    check(sorted(r["carrier_no"] for r in ents) == ["1"] * 20 + ["2"] * 20, "every entity has carrier 1 and carrier 2")
    check(sum(r["entity_type"] == "project" for r in names.values()) == 10, "10 projects + 10 subcontractors")
    check(all(r["sentence"].endswith("?") for r in ents if r["carrier_no"] == "1"), "entity carrier 1 is a question")
    check(all(not re.search(re.escape(r["target_form"]) + r"[.?!]$", r["sentence"]) and not r["sentence"].startswith(r["target_form"])
              for r in ents if r["carrier_no"] == "2"), "entity carrier 2 has the name mid-sentence")
    legal = sum(bool(re.search(r"\b(d\.o\.o\.|j\.d\.o\.o\.|obrt|GmbH)$", n["name"])) for n in names.values())
    diacritic = sum(bool(re.search(r"[čćđšžČĆĐŠŽ]", n["name"])) for n in names.values())
    check(legal >= 5 and diacritic >= 3, f"name mix: {legal} legal forms (>= 5), {diacritic} with diacritics (>= 3)")
    check(all(r["placeholder"] in ("y", "n") for r in ents), "entities.csv: placeholder flag on every row")
    check(all(r["placeholder"] == "n" for r in ents), "no placeholder entities remain (real names from the dev database)")
    check(all(len({x["target_form"] for x in ents if x["entity_id"] == e}) == 1 for e in names),
          "both carriers of an entity use the same spoken target")
    all_targets = {r["target_form"].lower() for r in ents}
    own = {r["entity_id"]: r["target_form"].lower() for r in ents}
    clashes = [a for r in ents for a in r["accepted_alternates"].split("|") if a and a.lower() in all_targets - {own[r["entity_id"]]}]
    check(not clashes, "no entity alternate is another entity's name")
    tic = [r for r in terms if r["term_id"] == "t25"]
    check(all(not re.search(r"\b(te i ce|t i c)\b", r["accepted_alternates"]) for r in tic),
          "TIC alternates are one-syllable spellings only (it is said 'tic', never spelled out)")
    check(all(r["review_status"] == "draft" for f in ("sentences.csv", "entities.csv", "amounts.csv", "dates.csv", "questions.csv")
              for r in rows_of(f)), "everything is still draft (the flip to frozen is the reviewers' step)")
    amts = rows_of("amounts.csv")
    check(len(amts) == 10, "amounts.csv: 10 rows")
    check(all(any(abs(a - float(r["amount_eur"])) < 0.005 for a in parse_amounts(r["sentence"])) for r in amts),
          "every amount sentence parses back to its own amount_eur")
    dts = rows_of("dates.csv")
    check(len(dts) == 10 and not any(re.search(r"\d", r["sentence"]) for r in dts), "dates.csv: 10 rows, written out in words")
    check(all((int(r["day"]), int(r["month"]), int(r["year"]) if r["year"] else None) in parse_dates(r["sentence"]) for r in dts),
          "every date sentence parses back to its own day, month and year")
    check(len(amts) + len(dts) == 20, "amounts + dates = 20 items (the plan's 240-observation pooled gate)")
    qs = rows_of("questions.csv")
    check(len(qs) == 10 and not any(re.search(r"\d", r["sentence"]) for r in qs), "questions.csv: 10 rows, no numerals")
    check(len(terms) + len(ents) + len(amts) + len(dts) + len(qs) == 160, "160 takes per speaker")


def test_assignment(tmp: Path) -> None:
    print("assign.py")
    import shutil

    from assign import SPEAKERS, balance, build

    r = subprocess.run([PY, str(HERE / "assign.py"), "--check"], capture_output=True, text=True)
    check(r.returncode == 0, "committed assignment.csv matches the script ids and is balanced")
    rows = build(HERE)
    check(rows == build(HERE), "deterministic: two builds are identical")
    for name in ("sentences.csv", "entities.csv", "amounts.csv", "dates.csv", "questions.csv"):
        shutil.copy(HERE / name, tmp / name)
    # Reword every sentence and reverse the row order: the assignment must not move.
    for name in ("sentences.csv", "questions.csv"):
        rs = list(csv.DictReader(open(tmp / name, encoding="utf-8")))
        for x in rs:
            x["sentence"] = "IZMIJENJENO " + x["sentence"]
        with open(tmp / name, "w", newline="", encoding="utf-8") as f:
            w = csv.DictWriter(f, fieldnames=list(rs[0]), lineterminator="\n")
            w.writeheader()
            w.writerows(reversed(rs))
    check(build(tmp) == rows, "assignment depends only on item ids (not on wording or row order)")

    per_speaker, per_cell = balance(rows)
    check(len(rows) == 160, "160 takes assigned")
    check(max(per_speaker.values()) - min(per_speaker.values()) <= 1 and sorted(set(per_speaker.values())) == [87, 88],
          f"takes per speaker are equal to within 1 ({sorted(per_speaker.values())})")
    check(all(per_cell[(s, sec)] == n for s in SPEAKERS for sec, n in (("entity", 20), ("amount", 5), ("date", 5), ("question", 5))),
          "every speaker records exactly half of each even-sized section")
    check(all(per_cell[(s, "term")] in (52, 53) for s in SPEAKERS), "terms: 15 critical + 37 or 38 split takes each")
    crit = [x for x in rows if x["critical"] == "y"]
    check(len(crit) == 15 and all(x["speakers"] == "|".join(SPEAKERS) and x["complement"] == "" for x in crit),
          "the 15 critical-term takes go to all six speakers")
    split = [x for x in rows if x["critical"] == "n"]
    check(all(len(x["speakers"].split("|")) == 3 and set(x["speakers"].split("|")) | set(x["complement"].split("|")) == set(SPEAKERS)
              and not set(x["speakers"].split("|")) & set(x["complement"].split("|")) for x in split),
          "every other take: 3 speakers + the 3 others as its complement, disjoint")


def test_mix(tmp: Path) -> None:
    print("mix_noise.py")
    clean = tmp / "clean"
    clean.mkdir()
    t = np.arange(16000 * 2) / 16000
    for i, name in enumerate(["s01_t01_c1.wav", "s01_e02.wav", "s02_a03.wav"]):
        write_wav(clean / name, 0.3 * np.sin(2 * np.pi * (180 + 40 * i) * t) * (np.abs(t - 1.0) < 0.6))
    write_wav(clean / "s03_q04.wav", 0.99 * np.sign(np.sin(2 * np.pi * 50 * t)))  # forces the anti-clip path
    write_wav(tmp / "noise.wav", 0.1 * np.random.default_rng(7).standard_normal(16000 * 5))
    outs = []
    for run in ("a", "b"):
        r = subprocess.run([PY, str(HERE / "mix_noise.py"), "--clean", str(clean), "--noise", str(tmp / "noise.wav"),
                            "--out", str(tmp / f"noisy_{run}")], capture_output=True, text=True)
        check(r.returncode == 0, f"run {run} exits 0 {r.stderr.strip()[:80]}")
        outs.append(tmp / f"noisy_{run}")
    check(all(sha(outs[0] / p.name) == sha(outs[1] / p.name) for p in clean.glob("*.wav")), "two runs: byte-identical WAVs")
    check(sha(outs[0] / "mix_log.csv") == sha(outs[1] / "mix_log.csv"), "two runs: identical mix_log.csv")
    log = list(csv.DictReader(open(outs[0] / "mix_log.csv")))
    check(all(abs(float(r["snr_db"]) - 10.0) < 1e-6 for r in log), "default SNR is the frozen 10.0000 dB")
    check(any(float(r["attenuation"]) < 1.0 for r in log), "a would-clip take is attenuated (SNR kept)")


def test_matching() -> None:
    print("score.py rules")
    from score import matches, parse_amounts, parse_dates, word_errors

    check(matches("Budžet se računa iz tika.", ["TIC-a", "tika", "tik-a"]) == (True, True), "alias: 'tika' scores for TIC-a (strict and relaxed)")
    check(matches("Je li tik za Kopko unesen", ["TIC", "tik", "tic"]) == (True, True), "alias: 'tik' scores for TIC")
    check(matches("bez er jedan računa ne možemo", ["R1 računa", "r jedan računa", "er jedan računa"]) == (True, True),
          "alias: 'er jedan računa' scores for R1 računa")
    check(matches("iznos bez pe de ve a je", ["PDV-a", "pdva", "pe de ve a"]) == (True, True), "alias: spelled-out 'pe de ve a'")
    check(matches("iznos bez PDV-a je", ["PDV-a"]) == (True, True), "hyphen deleted on both sides: PDV-a")
    check(matches("iznos bez tax je", ["PDV-a", "pdva"]) == (False, False), "no alias match is a miss")
    check(matches("posalji izvodacu popis", ["izvođaču"]) == (False, True), "diacritics-only difference: strict miss, relaxed hit")
    check(matches("prema tiću za osijek", ["TIC-u", "ticu", "tic-u", "tiku", "tik-u", "tiću"]) == (True, True), "alias: 'tiću' scores for TIC-u")
    check(matches("dobavljač nije poslao r jedan račun", ["R1 račun", "er jedan račun", "r jedan račun", "r 1 račun"]) == (True, True),
          "alias: multi-word 'r jedan račun' scores for R1 račun")
    check(matches("račune od tvrtke geo informatički studio plaćamo", ["Geo-informatički studio d.o.o.", "geo informatički studio"],
                  strip_legal=True) == (True, True), "entity: multi-word alternate with the legal form dropped")
    check(matches("je li zona trideset jedan dobila dozvolu", ["Zona 31", "zona trideset jedan", "zona trideset i jedan"],
                  strip_legal=True) == (True, True), "entity: number spoken as words ('Zona trideset jedan')")
    check(matches("je li el roj potpisao ugovor", ["El Roy d.o.o.", "el roj", "elroy", "elroj"], strip_legal=True) == (True, True),
          "entity: sound spelling of a foreign name ('El Roj')")
    check(matches("je li el potpisao ugovor", ["El Roy d.o.o.", "el roj"], strip_legal=True) == (False, False),
          "entity: a partial name is still a miss")
    check(matches("dugujemo tvrtki Horvat gradnja", ["Horvat gradnja d.o.o."], strip_legal=True) == (True, True),
          "entity: legal form optional")
    check(matches("Schneider bau GmbH", ["Schneider Bau GmbH"], strip_legal=True)[1], "entity: foreign legal form optional")
    for text, want in [("dvanaest tisuća petsto eura i pedeset centi", 12500.5), ("12.500,50 €", 12500.5),
                       ("1,2 milijuna eura", 1_200_000), ("dvadeset i pet eura", 25)]:
        check(any(abs(a - want) < 0.005 for a in parse_amounts(text)), f"amount: '{text}' -> {want:g}")
    for text, want in [("petnaesti listopada", (15, 10, None)), ("15.10.", (15, 10, None)), ("15. listopada", (15, 10, None)),
                       ("do petnaestog listopada", (15, 10, None)), ("petnaestoga listopada", (15, 10, None)),
                       ("do trećeg svibnja", (3, 5, None)), ("dvadeset prvog ožujka dvije tisuće dvadeset sedme", (21, 3, 2027)),
                       ("15.10.2026.", (15, 10, 2026)), ("1. ožujka 2027.", (1, 3, 2027))]:
        check(want in parse_dates(text), f"date: '{text}' -> {want}")
    check(parse_dates("Koliko košta druga faza?") == [], "date: an ordinal with no month is not a date")
    check((1, 3, None) in parse_dates("prvog ožujka") and not any(y == 2027 for _, _, y in parse_dates("prvog ožujka")),
          "date: a transcript that drops the spoken year yields no year (so it scores as a miss)")
    check(word_errors("Koji računi dospijevaju ovaj tjedan?", "koji racuni dospijevaju ovaj tjedan") == (0, 5),
          "WER ignores case, punctuation and diacritics")
    check(word_errors("Koji računi dospijevaju ovaj tjedan?", "koji računi dospjevaju taj tjedan") == (2, 5), "WER counts substitutions")


def test_score(tmp: Path) -> None:
    print("score.py verdicts")
    items = [(f"s01_{r['term_id']}_c{r['carrier_no']}.wav", r["sentence"]) for r in rows_of("sentences.csv")]
    items += [(f"s01_{r['entity_id']}_c{r['carrier_no']}.wav", r["sentence"]) for r in rows_of("entities.csv")]
    items += [(f"s01_{r['amount_id']}.wav", r["sentence"]) for r in rows_of("amounts.csv")]
    items += [(f"s01_{r['date_id']}.wav", r["sentence"]) for r in rows_of("dates.csv")]
    items += [(f"s01_{r['question_id']}.wav", r["sentence"]) for r in rows_of("questions.csv")]
    with open(tmp / "t.csv", "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(["file", "vendor", "condition", "transcript", "time_to_final_ms", "model"])
        for file, sentence in items:
            w.writerow([file, "perfect", "clean", sentence, 300, "google:long@global"])
            w.writerow([file, "nodiacritics", "clean", fold(sentence), 350, "azure:hr-HR"])
            w.writerow([file, "broken", "clean", "ne razumijem" if "_t" in file else sentence, "", "azure:hr-HR"])
            garble = file in ("s01_d01.wav", "s01_d02.wav")  # 2 of 10 dates wrong -> 18/20 amounts+dates
            w.writerow([file, "datesbad", "clean", "negdje u jesen" if garble else sentence, 300, "azure:hr-HR"])
    r = subprocess.run([PY, str(HERE / "score.py"), "--transcripts", str(tmp / "t.csv"), "--out", str(tmp / "r.md")],
                       capture_output=True, text=True)
    check(r.returncode == 0, f"score.py exits 0 {r.stderr.strip()[:120]}")
    md = (tmp / "r.md").read_text(encoding="utf-8")
    row = {v: next(line for line in md.splitlines() if line.startswith(f"| {v} |")) for v in ("perfect", "nodiacritics", "broken", "datesbad")}
    check(row["perfect"].endswith("**PASS** |") and "100.0 %" in row["perfect"],
          "perfect transcripts pass every section (terms, entities, amounts, WER)")
    check(row["nodiacritics"].endswith("**PASS** |"), "diacritics-only errors still PASS: the verdict keys off relaxed")
    strict_cell = row["nodiacritics"].split(" | ")[2]
    check(strict_cell != "100.0 %", f"...while strict is reported lower ({strict_cell})")
    check(row["broken"].endswith("**NO-GO** |"), "terms at 0 % are a no-go even with other sections perfect")
    check(row["datesbad"].endswith("**REVIEW** |") and "90.0 % (18/20)" in row["datesbad"],
          "amounts and dates share one pooled gate: 18/20 = 90 % < 95 % is a review")
    check("amounts/dates 90.0 % < 95 %" in md, "the pooled-gate miss is named in the reasons")
    check("Script not frozen" in md, "an unfrozen script is flagged on the report")
    check(all(f"## Per {x}" in md for x in ("entity", "amount", "date", "question")), "per-section tables present")
    check("entity 160" in md and "date 40" in md, "row counts per section reported (40 entity + 10 date takes x 4 vendors)")
    check("google:long@global" in md and "## Models used" in md, "model usage reported")


def test_split_scoring(tmp: Path) -> None:
    print("score.py split design and complement merge")
    from assign import build

    sentence = {}
    for name, idf in (("sentences.csv", lambda r: f"{r['term_id']}_c{r['carrier_no']}"),
                      ("entities.csv", lambda r: f"{r['entity_id']}_c{r['carrier_no']}"),
                      ("amounts.csv", lambda r: r["amount_id"]), ("dates.csv", lambda r: r["date_id"]),
                      ("questions.csv", lambda r: r["question_id"])):
        for r in rows_of(name):
            sentence[idf(r)] = r["sentence"]
    assignment = build(HERE)

    def write(path: Path, include_complement: bool, bad_terms: int = 0) -> None:
        with open(path, "w", newline="", encoding="utf-8") as f:
            w = csv.writer(f)
            w.writerow(["file", "vendor", "condition", "transcript", "time_to_final_ms", "model"])
            misses = 0
            for a in assignment:
                who = a["speakers"].split("|") + (a["complement"].split("|") if include_complement and a["complement"] else [])
                for spk in who:
                    text = sentence[a["item_id"]]
                    if a["section"] == "term" and a["critical"] == "n" and misses < bad_terms:
                        text, misses = "ne razumijem", misses + 1
                    w.writerow([f"{spk}_{a['item_id']}.wav", "vendor", "clean", text, 300, "azure:hr-HR"])

    def score(path: Path) -> str:
        r = subprocess.run([PY, str(HERE / "score.py"), "--transcripts", str(path), "--out", str(tmp / "s.md")],
                           capture_output=True, text=True)
        check(r.returncode == 0, f"score.py exits 0 {r.stderr.strip()[:120]}")
        return (tmp / "s.md").read_text(encoding="utf-8")

    write(tmp / "split.csv", include_complement=False)
    md = score(tmp / "split.csv")
    check("Design found: **split (primary sessions only)**" in md and "primary 525/525, complement 0/435" in md,
          "split run: design and coverage reported (525 primary takes = 15x6 + 145x3; 0 of 435 complement)")
    check("| Terms | 90 % | 315 | ±3.3 pp | 540 | ±2.5 pp |" in md, "terms: 315 observations (15x6 + 75x3), interval stated next to the full design")
    check("| Entities | 80 % | 120 | ±7.2 pp | 240 | ±5.1 pp |" in md, "entities: 120 observations, widened interval stated")
    check("| Amounts + dates | 95 % | 60 | ±5.5 pp | 120 | ±3.9 pp |" in md, "amounts + dates: 60 observations, widened interval stated")
    check("a single term has 9–18 observations" in md, "floor granularity reported (9 per split term, 18 per critical term)")
    check("**PASS**" in md, "perfect split transcripts pass")

    write(tmp / "split_review.csv", include_complement=False, bad_terms=35)  # 280/315 = 88.9 %: the REVIEW band
    md = score(tmp / "split_review.csv")
    check("| vendor | 88.9 %" in md and md.count("**REVIEW**") == 1 and "record the complement sessions" in md,
          "split run in the REVIEW band (88.9 %) points to the complement sessions")

    write(tmp / "full.csv", include_complement=True)
    md = score(tmp / "full.csv")
    check("Design found: **full (split + complement sessions merged)**" in md and "complement 435/435" in md,
          "complement merged: design reported as full")
    check("| Terms | 90 % | 540 | ±2.5 pp | 540 | ±2.5 pp |" in md, "merged run restores the full-design counts")
    check("record the complement sessions" not in md, "no complement hint once merged")


def test_run_stt(tmp: Path) -> None:
    print("run_stt.py")
    (tmp / "clean").mkdir(exist_ok=True)
    (tmp / "noisy").mkdir(exist_ok=True)
    for name in ["s01_t01_c1.wav", "s01_e01_c2.wav"]:
        write_wav(tmp / "clean" / name, np.zeros(1600))
        write_wav(tmp / "noisy" / name, np.zeros(1600))
    with open(tmp / "clean" / "manifest.csv", "w", newline="") as f:
        w = csv.writer(f)
        w.writerow(["file", "speaker", "section", "item_id", "term_id", "carrier_no", "duration_ms", "sample_rate",
                    "takes", "order_index", "recorded_at"])
        w.writerow(["s01_t01_c1.wav", "s01", "term", "t01_c1", "t01", 1, 100, 16000, 1, 1, "x"])
        w.writerow(["s01_e01_c2.wav", "s01", "entity", "e01_c2", "", 2, 100, 16000, 1, 2, "x"])
    with open(tmp / "transcripts.csv", "w", newline="") as f:
        w = csv.writer(f)
        w.writerow(["file", "vendor", "condition", "transcript", "time_to_final_ms", "model"])
        w.writerow(["s01_t01_c1.wav", "google", "clean", "x", 1, "google:long@global"])
    args = [PY, str(HERE / "run_stt.py"), "--dry-run", "--manifest", str(tmp / "clean" / "manifest.csv"),
            "--clean-dir", str(tmp / "clean"), "--noisy-dir", str(tmp / "noisy"), "--out", str(tmp / "transcripts.csv")]
    r = subprocess.run(args, capture_output=True, text=True, cwd=tmp)
    check(r.returncode == 0 and "1 results already done; 7 to run" in r.stdout, "resume: 8 tasks minus 1 done = 7")
    # A complement session's manifest merges with the primary one: its takes just add tasks.
    write_wav(tmp / "clean" / "s01_a01.wav", np.zeros(1600))
    write_wav(tmp / "noisy" / "s01_a01.wav", np.zeros(1600))
    with open(tmp / "complement.csv", "w", newline="") as f:
        w = csv.writer(f)
        w.writerow(["file", "speaker", "session", "section", "item_id", "term_id", "carrier_no", "duration_ms", "sample_rate",
                    "takes", "order_index", "recorded_at"])
        w.writerow(["s01_a01.wav", "s01", "complement", "amount", "a01", "", "", 100, 16000, 1, 1, "x"])
    args2 = args[:4] + [str(tmp / "clean" / "manifest.csv"), str(tmp / "complement.csv")] + args[5:]
    r = subprocess.run(args2, capture_output=True, text=True, cwd=tmp)
    check(r.returncode == 0 and "3 takes in manifest" in r.stdout and "11 to run" in r.stdout,
          "primary + complement manifests merge: 3 takes, 12 tasks minus 1 done = 11")

    from run_stt import Google, paced_chunks

    t0 = time.monotonic()
    chunks = list(paced_chunks(b"\x00\x00" * 8000, silence_ms=300, chunk_ms=100))  # 500 ms + 300 ms
    elapsed = time.monotonic() - t0
    check(len(chunks) == 8 and chunks[4][1] and sum(c[1] for c in chunks) == 1, "5 speech + 3 silence chunks, last speech flagged")
    check(0.65 <= elapsed <= 0.9, f"paced in real time ({elapsed:.2f} s)")

    try:
        import threading

        from google.api_core import exceptions as gexc
    except ImportError:
        print("  SKIP Google fallback checks: google-cloud-speech not installed")
        return

    def engine(behaviour):
        g = Google.__new__(Google)  # bypass credential lookup
        g.primary, g.fallback, g.use_fallback, g._lock = ("global", "long"), ("europe-west4", "chirp_2"), False, threading.Lock()
        calls = []

        def fake_stream(target, pcm, chunk_ms, silence_ms):
            calls.append(target)
            outcome = behaviour(target)
            if isinstance(outcome, Exception):
                raise outcome
            return "tekst", 100, f"google:{target[1]}@{target[0]}"
        g._stream = fake_stream
        return g, calls

    import io
    import contextlib

    g, calls = engine(lambda t: gexc.InvalidArgument("model long does not support hr-HR streaming") if t[1] == "long" else None)
    with contextlib.redirect_stderr(io.StringIO()):
        first = g.transcribe(b"", 100, 0)
    second = g.transcribe(b"", 100, 0)
    check(first[2] == "google:chirp_2@europe-west4", "rejected default model -> the take is retried on chirp_2@europe-west4")
    check(calls == [("global", "long"), ("europe-west4", "chirp_2"), ("europe-west4", "chirp_2")],
          "the fallback is sticky: later takes skip the rejected model")
    g, calls = engine(lambda t: gexc.ServiceUnavailable("try later"))
    try:
        g.transcribe(b"", 100, 0)
        check(False, "a transient error is not treated as a model rejection")
    except gexc.ServiceUnavailable:
        check(calls == [("global", "long")] and not g.use_fallback, "a transient error is re-raised, with no fallback")


def main() -> int:
    test_script()
    test_matching()
    with tempfile.TemporaryDirectory() as d:
        tmp = Path(d)
        test_assignment(tmp)
        test_mix(tmp)
        test_score(tmp)
        test_split_scoring(tmp)
        test_run_stt(tmp)
    print(f"\n{'all checks passed' if not failures else f'{len(failures)} check(s) failed'}")
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
