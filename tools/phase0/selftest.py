#!/usr/bin/env python3
"""Offline self-test for the phase 0 tooling: no microphone, no cloud calls.

    python3 selftest.py

Checks the frozen script's invariants, that mix_noise.py is deterministic and
hits the requested SNR, the scoring rules and verdicts in score.py, and the
resume logic and real-time pacing in run_stt.py.
"""

from __future__ import annotations

import csv
import hashlib
import re
import subprocess
import sys
import tempfile
import time
import wave
from pathlib import Path

import numpy as np

HERE = Path(__file__).resolve().parent
PY = sys.executable
failures: list[str] = []


def check(cond: bool, msg: str) -> None:
    print(("  ok   " if cond else "  FAIL ") + msg)
    if not cond:
        failures.append(msg)


def write_wav(path: Path, x: np.ndarray) -> None:
    with wave.open(str(path), "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(16000)
        w.writeframes(np.clip(np.rint(x * 32768), -32768, 32767).astype("<i2").tobytes())


def sha(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def test_script() -> None:
    print("sentences.csv")
    rows = list(csv.DictReader(open(HERE / "sentences.csv", encoding="utf-8")))
    check(len(rows) == 90, "90 rows")
    check(list(rows[0]) == ["term_id", "term", "critical", "carrier_no", "sentence", "target_form"], "exact columns")
    check(len({r["term_id"] for r in rows}) == 30, "30 terms")
    check(len({r["term_id"] for r in rows if r["critical"] == "y"}) == 5, "5 critical terms")
    check(all(r["target_form"] in r["sentence"] for r in rows), "every target_form appears verbatim in its sentence")
    c3 = [r for r in rows if r["carrier_no"] == "3"]
    check(all(re.search(re.escape(r["target_form"]) + r"[.?!]$", r["sentence"]) for r in c3), "carrier 3 is term-final")
    check(all(r["sentence"].endswith("?") for r in rows if r["carrier_no"] == "1"), "carrier 1 is a question")
    crit = {r["term"] for r in rows if r["critical"] == "y"}
    check(crit == {"građevinska dozvola", "izvođač", "TIC", "proračun", "rokovi"}, "critical terms match the plan")


def test_mix(tmp: Path) -> None:
    print("mix_noise.py")
    clean = tmp / "clean"
    clean.mkdir()
    t = np.arange(16000 * 2) / 16000
    for i, name in enumerate(["s01_t01_c1.wav", "s01_t02_c3.wav", "s02_t25_c2.wav"]):
        speech = 0.3 * np.sin(2 * np.pi * (180 + 40 * i) * t) * (np.abs(t - 1.0) < 0.6)  # burst with silent edges
        write_wav(clean / name, speech)
    write_wav(clean / "s03_t10_c1.wav", 0.99 * np.sign(np.sin(2 * np.pi * 50 * t)))  # forces the anti-clip path
    rng = np.random.default_rng(7)
    write_wav(tmp / "noise.wav", 0.1 * rng.standard_normal(16000 * 5))
    outs = []
    for run in ("a", "b"):
        r = subprocess.run([PY, str(HERE / "mix_noise.py"), "--clean", str(clean), "--noise", str(tmp / "noise.wav"),
                            "--out", str(tmp / f"noisy_{run}")], capture_output=True, text=True)
        check(r.returncode == 0, f"run {run} exits 0 ({r.stderr.strip()[:80]})")
        outs.append(tmp / f"noisy_{run}")
    same = all(sha(outs[0] / p.name) == sha(outs[1] / p.name) for p in clean.glob("*.wav"))
    check(same, "two runs produce byte-identical WAVs")
    check(sha(outs[0] / "mix_log.csv") == sha(outs[1] / "mix_log.csv"), "two runs produce an identical mix_log.csv")
    log = list(csv.DictReader(open(outs[0] / "mix_log.csv")))
    check(all(abs(float(r["snr_db"]) - 15.0) < 1e-6 for r in log), "every take mixed at 15.0000 dB SNR")
    check(any(float(r["attenuation"]) < 1.0 for r in log), "a would-clip take is attenuated (SNR kept)")
    check(len({r["noise_offset"] for r in log}) > 1, "noise offsets differ per file name")


def test_score(tmp: Path) -> None:
    print("score.py")
    rows = [
        ("s01_t01_c1.wav", "Je li građevinska dozvola za Funtanu već izdana?"),   # hit
        ("s01_t03_c2.wav", "Pošalji izvodacu popis nedostataka do petka."),       # diacritics: strict miss, relaxed hit
        ("s01_t16_c2.wav", "Iznos bez PDV-a je sto dvadeset tisuća eura."),        # punctuation stripped both sides
        ("s01_t25_c3.wav", "Budžet projekta izračunava se iz tika."),              # miss
        ("s01_t20_c3.wav", ""),                                                    # empty: miss
    ]
    with open(tmp / "t.csv", "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(["file", "vendor", "condition", "transcript", "time_to_final_ms"])
        for file, text in rows:
            w.writerow([file, "google", "clean", text, 420])
            w.writerow([file, "azure", "clean", text if "t25" not in file else "Budžet se izračunava iz TIC-a.", ""])
    r = subprocess.run([PY, str(HERE / "score.py"), "--transcripts", str(tmp / "t.csv"),
                        "--sentences", str(HERE / "sentences.csv"), "--out", str(tmp / "r.md")],
                       capture_output=True, text=True)
    check(r.returncode == 0, "score.py exits 0")
    md = (tmp / "r.md").read_text(encoding="utf-8")
    check("| google | 40.0 %" in md, "google strict = 2/5 (diacritics-only miss counts as a miss)")
    check("| azure | 60.0 %" in md, "azure strict = 3/5 (TIC-a matched after punctuation stripping)")
    check("NO-GO" in md, "accuracy below 80 % is a no-go")
    google_row = next(line for line in md.splitlines() if line.startswith("| google | 40.0 %"))
    check(google_row.split(" | ")[2] == "60.0 %", "google relaxed = 3/5 (the diacritics-only miss is a relaxed hit)")
    check("coverage" in md, "incomplete coverage is reported")
    check("Carrier 3 (term-final)" in md and "Clean vs noisy" in md, "position and condition tables present")


def test_run_stt(tmp: Path) -> None:
    print("run_stt.py")
    (tmp / "clean").mkdir(exist_ok=True)
    (tmp / "noisy").mkdir(exist_ok=True)
    for name in ["s01_t01_c1.wav", "s01_t01_c2.wav"]:
        write_wav(tmp / "clean" / name, np.zeros(1600))
        write_wav(tmp / "noisy" / name, np.zeros(1600))
    with open(tmp / "clean" / "manifest.csv", "w", newline="") as f:
        w = csv.writer(f)
        w.writerow(["file", "speaker", "term_id", "carrier_no", "duration_ms", "sample_rate", "takes", "order_index", "recorded_at"])
        w.writerow(["s01_t01_c1.wav", "s01", "t01", 1, 100, 16000, 1, 1, "x"])
        w.writerow(["s01_t01_c2.wav", "s01", "t01", 2, 100, 16000, 1, 2, "x"])
    with open(tmp / "transcripts.csv", "w", newline="") as f:
        w = csv.writer(f)
        w.writerow(["file", "vendor", "condition", "transcript", "time_to_final_ms"])
        w.writerow(["s01_t01_c1.wav", "google", "clean", "x", 1])
    r = subprocess.run([PY, str(HERE / "run_stt.py"), "--dry-run", "--manifest", str(tmp / "clean" / "manifest.csv"),
                        "--clean-dir", str(tmp / "clean"), "--noisy-dir", str(tmp / "noisy"),
                        "--out", str(tmp / "transcripts.csv")], capture_output=True, text=True, cwd=tmp)
    check(r.returncode == 0 and "1 results already done; 7 to run" in r.stdout, "resume: 8 tasks minus 1 done = 7")

    sys.path.insert(0, str(HERE))
    from run_stt import paced_chunks  # noqa: E402

    speech = b"\x00\x00" * 8000  # 500 ms
    t0 = time.monotonic()
    chunks = list(paced_chunks(speech, silence_ms=300, chunk_ms=100))
    elapsed = time.monotonic() - t0
    check(len(chunks) == 8 and sum(c[1] for c in chunks) == 1 and chunks[4][1], "5 speech + 3 silence chunks, last speech flagged")
    check(0.65 <= elapsed <= 0.9, f"paced in real time (~0.7 s for 0.8 s of audio; took {elapsed:.2f} s)")


def main() -> int:
    test_script()
    with tempfile.TemporaryDirectory() as d:
        tmp = Path(d)
        test_mix(tmp)
        test_score(tmp)
        test_run_stt(tmp)
    print(f"\n{'all checks passed' if not failures else f'{len(failures)} check(s) failed'}")
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
