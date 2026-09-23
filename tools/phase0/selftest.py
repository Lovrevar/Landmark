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
    from score import parse_amounts

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
    check(len(ents) == 15 and all(r["target_form"] in r["sentence"] for r in ents), "entities.csv: 15 rows, targets in sentences")
    check(all(r["placeholder"] in ("y", "n") for r in ents), "entities.csv: placeholder flag on every row")
    amts = rows_of("amounts.csv")
    check(len(amts) == 10, "amounts.csv: 10 rows")
    check(all(any(abs(a - float(r["amount_eur"])) < 0.005 for a in parse_amounts(r["sentence"])) for r in amts),
          "every amount sentence parses back to its own amount_eur")
    qs = rows_of("questions.csv")
    check(len(qs) == 10 and not any(re.search(r"\d", r["sentence"]) for r in qs), "questions.csv: 10 rows, no numerals")
    check(len(terms) + len(ents) + len(amts) + len(qs) == 125, "125 takes per speaker")


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
    from score import matches, parse_amounts, word_errors

    check(matches("Budžet se računa iz tika.", ["TIC-a", "tika", "tik-a"]) == (True, True), "alias: 'tika' scores for TIC-a (strict and relaxed)")
    check(matches("Je li tik za Kopko unesen", ["TIC", "tik", "tic"]) == (True, True), "alias: 'tik' scores for TIC")
    check(matches("bez er jedan računa ne možemo", ["R1 računa", "r jedan računa", "er jedan računa"]) == (True, True),
          "alias: 'er jedan računa' scores for R1 računa")
    check(matches("iznos bez pe de ve a je", ["PDV-a", "pdva", "pe de ve a"]) == (True, True), "alias: spelled-out 'pe de ve a'")
    check(matches("iznos bez PDV-a je", ["PDV-a"]) == (True, True), "hyphen deleted on both sides: PDV-a")
    check(matches("iznos bez tax je", ["PDV-a", "pdva"]) == (False, False), "no alias match is a miss")
    check(matches("posalji izvodacu popis", ["izvođaču"]) == (False, True), "diacritics-only difference: strict miss, relaxed hit")
    check(matches("dugujemo tvrtki Horvat gradnja", ["Horvat gradnja d.o.o."], strip_legal=True) == (True, True),
          "entity: legal form optional")
    check(matches("Schneider bau GmbH", ["Schneider Bau GmbH"], strip_legal=True)[1], "entity: foreign legal form optional")
    for text, want in [("dvanaest tisuća petsto eura i pedeset centi", 12500.5), ("12.500,50 €", 12500.5),
                       ("1,2 milijuna eura", 1_200_000), ("dvadeset i pet eura", 25)]:
        check(any(abs(a - want) < 0.005 for a in parse_amounts(text)), f"amount: '{text}' -> {want:g}")
    check(word_errors("Koji računi dospijevaju ovaj tjedan?", "koji racuni dospijevaju ovaj tjedan") == (0, 5),
          "WER ignores case, punctuation and diacritics")
    check(word_errors("Koji računi dospijevaju ovaj tjedan?", "koji računi dospjevaju taj tjedan") == (2, 5), "WER counts substitutions")


def test_score(tmp: Path) -> None:
    print("score.py verdicts")
    items = [(f"s01_{r['term_id']}_c{r['carrier_no']}.wav", r["sentence"]) for r in rows_of("sentences.csv")]
    items += [(f"s01_{r['entity_id']}.wav", r["sentence"]) for r in rows_of("entities.csv")]
    items += [(f"s01_{r['amount_id']}.wav", r["sentence"]) for r in rows_of("amounts.csv")]
    items += [(f"s01_{r['question_id']}.wav", r["sentence"]) for r in rows_of("questions.csv")]
    with open(tmp / "t.csv", "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(["file", "vendor", "condition", "transcript", "time_to_final_ms", "model"])
        for file, sentence in items:
            w.writerow([file, "perfect", "clean", sentence, 300, "google:long@global"])
            w.writerow([file, "nodiacritics", "clean", fold(sentence), 350, "azure:hr-HR"])
            w.writerow([file, "broken", "clean", "ne razumijem" if "_t" in file else sentence, "", "azure:hr-HR"])
    r = subprocess.run([PY, str(HERE / "score.py"), "--transcripts", str(tmp / "t.csv"), "--out", str(tmp / "r.md")],
                       capture_output=True, text=True)
    check(r.returncode == 0, f"score.py exits 0 {r.stderr.strip()[:120]}")
    md = (tmp / "r.md").read_text(encoding="utf-8")
    row = {v: next(line for line in md.splitlines() if line.startswith(f"| {v} |")) for v in ("perfect", "nodiacritics", "broken")}
    check(row["perfect"].endswith("**PASS** |") and "100.0 %" in row["perfect"],
          "perfect transcripts pass every section (terms, entities, amounts, WER)")
    check(row["nodiacritics"].endswith("**PASS** |"), "diacritics-only errors still PASS: the verdict keys off relaxed")
    strict_cell = row["nodiacritics"].split(" | ")[2]
    check(strict_cell != "100.0 %", f"...while strict is reported lower ({strict_cell})")
    check(row["broken"].endswith("**NO-GO** |"), "terms at 0 % are a no-go even with other sections perfect")
    check("Script not frozen" in md, "an unfrozen script is flagged on the report")
    check("## Per entity" in md and "## Per amount" in md and "## Per question" in md, "per-section tables present")
    check("google:long@global" in md and "## Models used" in md, "model usage reported")


def test_run_stt(tmp: Path) -> None:
    print("run_stt.py")
    (tmp / "clean").mkdir(exist_ok=True)
    (tmp / "noisy").mkdir(exist_ok=True)
    for name in ["s01_t01_c1.wav", "s01_e01.wav"]:
        write_wav(tmp / "clean" / name, np.zeros(1600))
        write_wav(tmp / "noisy" / name, np.zeros(1600))
    with open(tmp / "clean" / "manifest.csv", "w", newline="") as f:
        w = csv.writer(f)
        w.writerow(["file", "speaker", "section", "item_id", "term_id", "carrier_no", "duration_ms", "sample_rate",
                    "takes", "order_index", "recorded_at"])
        w.writerow(["s01_t01_c1.wav", "s01", "term", "t01_c1", "t01", 1, 100, 16000, 1, 1, "x"])
        w.writerow(["s01_e01.wav", "s01", "entity", "e01", "", "", 100, 16000, 1, 2, "x"])
    with open(tmp / "transcripts.csv", "w", newline="") as f:
        w = csv.writer(f)
        w.writerow(["file", "vendor", "condition", "transcript", "time_to_final_ms", "model"])
        w.writerow(["s01_t01_c1.wav", "google", "clean", "x", 1, "google:long@global"])
    args = [PY, str(HERE / "run_stt.py"), "--dry-run", "--manifest", str(tmp / "clean" / "manifest.csv"),
            "--clean-dir", str(tmp / "clean"), "--noisy-dir", str(tmp / "noisy"), "--out", str(tmp / "transcripts.csv")]
    r = subprocess.run(args, capture_output=True, text=True, cwd=tmp)
    check(r.returncode == 0 and "1 results already done; 7 to run" in r.stdout, "resume: 8 tasks minus 1 done = 7")

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
        test_mix(tmp)
        test_score(tmp)
        test_run_stt(tmp)
    print(f"\n{'all checks passed' if not failures else f'{len(failures)} check(s) failed'}")
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
