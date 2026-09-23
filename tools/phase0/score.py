#!/usr/bin/env python3
"""Score transcripts.csv against the frozen script and write results.md.

    python3 score.py [--transcripts transcripts.csv] [--sentences sentences.csv] [--out results.md]

A take is a HIT when the transcript contains the take's target_form (the exact
inflected form in its carrier sentence) as a contiguous word sequence, after
normalisation:
  * STRICT (headline): lowercase; delete punctuation characters (Unicode
    category P*, so "PDV-a" -> "pdva", "T.I.C." -> "tic"); collapse whitespace.
    Diacritics must match: "izvodac" is a miss for "izvođač".
  * RELAXED (reported alongside): STRICT, then diacritics folded
    (č ć -> c, š -> s, ž -> z, đ -> d).
Only the target form is scored, never the rest of the carrier sentence. An
empty transcript is a miss.

Gates (docs/voice/02-voice-implementation-plan.md, phase 0), per vendor, on the
STRICT headline over clean + noisy pooled:
  overall term accuracy   >= 90 % pass | 80-90 % review | < 80 % no-go
  per-term floor          no term below 70 %
  per-speaker floor       no speaker below 80 %
  critical terms          each >= 85 %; any below 70 % is a no-go
Not scored here (outside this 90-sentence harness): entity names, amounts and
dates, full-question WER, TTS, turn-taking, platform latency floor.
"""

from __future__ import annotations

import argparse
import csv
import math
import re
import statistics
import sys
import unicodedata
from collections import defaultdict
from pathlib import Path

FILE_RE = re.compile(r"^(s0[1-6])_(t\d{2})_c([123])\.wav$")
PASS, REVIEW_FLOOR = 0.90, 0.80
TERM_FLOOR, SPEAKER_FLOOR = 0.70, 0.80
CRITICAL_PASS, CRITICAL_NOGO = 0.85, 0.70


def norm_strict(s: str) -> str:
    s = "".join(ch for ch in s.lower() if not unicodedata.category(ch).startswith("P"))
    return " ".join(s.split())


def norm_relaxed(s: str) -> str:
    s = norm_strict(s).replace("đ", "d")
    return "".join(ch for ch in unicodedata.normalize("NFD", s) if unicodedata.category(ch) != "Mn")


def contains(transcript: str, target: str) -> bool:
    t, g = transcript.split(), target.split()
    return bool(g) and any(t[i : i + len(g)] == g for i in range(len(t) - len(g) + 1))


def wilson(hits: int, n: int, z: float = 1.959964) -> tuple[float, float]:
    if n == 0:
        return (float("nan"), float("nan"))
    p = hits / n
    denom = 1 + z * z / n
    centre = (p + z * z / (2 * n)) / denom
    half = z * math.sqrt(p * (1 - p) / n + z * z / (4 * n * n)) / denom
    return max(0.0, centre - half), min(1.0, centre + half)


class Tally:
    __slots__ = ("n", "strict", "relaxed")

    def __init__(self):
        self.n = self.strict = self.relaxed = 0

    def add(self, s: bool, r: bool):
        self.n += 1
        self.strict += s
        self.relaxed += r

    def acc(self, relaxed: bool = False) -> float:
        return (self.relaxed if relaxed else self.strict) / self.n if self.n else float("nan")


def pct(x: float) -> str:
    return "—" if math.isnan(x) else f"{100 * x:.1f} %"


def cell(t: Tally | None) -> str:
    return "—" if t is None or t.n == 0 else f"{pct(t.acc())} ({t.strict}/{t.n})"


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--transcripts", type=Path, default=Path("transcripts.csv"))
    ap.add_argument("--sentences", type=Path, default=Path("sentences.csv"))
    ap.add_argument("--out", type=Path, default=Path("results.md"))
    args = ap.parse_args()

    with open(args.sentences, newline="", encoding="utf-8") as f:
        script = {(r["term_id"], r["carrier_no"]): r for r in csv.DictReader(f)}
    terms = {}
    for r in script.values():
        terms[r["term_id"]] = (r["term"], r["critical"] == "y")
    with open(args.transcripts, newline="", encoding="utf-8") as f:
        rows = list(csv.DictReader(f))
    if not rows:
        print("transcripts.csv is empty", file=sys.stderr)
        return 1

    vendors = sorted({r["vendor"] for r in rows})
    overall = defaultdict(Tally)
    by_term = defaultdict(Tally)
    by_speaker = defaultdict(Tally)
    by_condition = defaultdict(Tally)
    by_carrier = defaultdict(Tally)
    latency = defaultdict(list)
    speakers: set[str] = set()
    skipped = 0

    for r in rows:
        m = FILE_RE.match(r["file"])
        if not m or (m.group(2), m.group(3)) not in script:
            skipped += 1
            continue
        speaker, term_id, carrier = m.groups()
        speakers.add(speaker)
        target = script[(term_id, carrier)]["target_form"]
        transcript = r["transcript"] or ""
        s = contains(norm_strict(transcript), norm_strict(target))
        rx = contains(norm_relaxed(transcript), norm_relaxed(target))
        v, c = r["vendor"], r["condition"]
        overall[v].add(s, rx)
        by_term[(v, term_id)].add(s, rx)
        by_speaker[(v, speaker)].add(s, rx)
        by_condition[(v, c)].add(s, rx)
        by_carrier[(v, "c3" if carrier == "3" else "c1-2")].add(s, rx)
        if r.get("time_to_final_ms", "") not in ("", None):
            latency[(v, c)].append(int(r["time_to_final_ms"]))

    conditions = sorted({r["condition"] for r in rows})
    expected_per_vendor = len(speakers) * len(script) * len(conditions)
    L: list[str] = []
    w = L.append

    w("# Phase 0 — Croatian STT term accuracy\n")
    w(f"Generated from `{args.transcripts.name}` against `{args.sentences.name}`. "
      f"Speakers: {', '.join(sorted(speakers)) or '—'}. Conditions: {', '.join(conditions)}.\n")
    w("Headline = **strict** (diacritics must match). Relaxed folds č/ć/š/ž/đ. 95 % intervals are Wilson.\n")
    if skipped:
        w(f"> {skipped} transcript row(s) ignored: file name not in the `sNN_tNN_cN.wav` scheme or not in the script.\n")

    # ---- verdicts ----------------------------------------------------------
    w("## Verdict against the frozen gates\n")
    w("| Vendor | Strict accuracy (95 % CI) | Relaxed | Term floor | Speaker floor | Critical terms | Verdict |")
    w("|---|---|---|---|---|---|---|")
    verdict_notes = {}
    for v in vendors:
        o = overall[v]
        lo, hi = wilson(o.strict, o.n)
        term_bad = [t for t in sorted(terms) if by_term[(v, t)].n and by_term[(v, t)].acc() < TERM_FLOOR]
        spk_bad = [s for s in sorted(speakers) if by_speaker[(v, s)].n and by_speaker[(v, s)].acc() < SPEAKER_FLOOR]
        crit = [t for t in sorted(terms) if terms[t][1]]
        crit_low = [t for t in crit if by_term[(v, t)].n and by_term[(v, t)].acc() < CRITICAL_PASS]
        crit_nogo = [t for t in crit if by_term[(v, t)].n and by_term[(v, t)].acc() < CRITICAL_NOGO]
        acc = o.acc()
        reasons = []
        if acc < REVIEW_FLOOR:
            reasons.append(f"overall {pct(acc)} < 80 %")
        if crit_nogo:
            reasons.append("critical term below 70 %: " + ", ".join(crit_nogo))
        if reasons:
            verdict = "**NO-GO**"
        else:
            review = []
            if acc < PASS:
                review.append(f"overall {pct(acc)} in 80–90 %")
            if term_bad:
                review.append("term floor: " + ", ".join(term_bad))
            if spk_bad:
                review.append("speaker floor: " + ", ".join(spk_bad))
            if crit_low:
                review.append("critical below 85 %: " + ", ".join(crit_low))
            verdict = "**REVIEW**" if review else "**PASS**"
            reasons = review
        coverage = f" — coverage {o.n}/{expected_per_vendor}" if o.n != expected_per_vendor else ""
        verdict_notes[v] = "; ".join(reasons) + coverage
        w(f"| {v} | {pct(acc)} ({pct(lo)}–{pct(hi)}) | {pct(o.acc(True))} | "
          f"{'✅' if not term_bad else '⚠️ ' + str(len(term_bad))} | {'✅' if not spk_bad else '⚠️ ' + str(len(spk_bad))} | "
          f"{'✅' if not crit_low else ('❌' if crit_nogo else '⚠️')} | {verdict} |")
    w("")
    for v in vendors:
        if verdict_notes[v]:
            w(f"- **{v}**: {verdict_notes[v]}")
    w("\nGates not scored by this harness (plan §10): entity names (exact ≥ 80 %, recoverable ≥ 95 %), "
      "amounts/dates ≥ 95 %, full-question WER ≤ 15 %, TTS panel, barge-in, platform latency floor.\n")

    # ---- clean vs noisy, carrier position ------------------------------------
    w("## Clean vs noisy\n")
    w("| Vendor | " + " | ".join(conditions) + " |")
    w("|---|" + "---|" * len(conditions))
    for v in vendors:
        w(f"| {v} | " + " | ".join(cell(by_condition.get((v, c))) for c in conditions) + " |")
    w("\n## Term position: sentence-final (carrier 3) vs carriers 1–2\n")
    w("Carrier 3 puts the term last, where endpointing clips most often.\n")
    w("| Vendor | Carriers 1–2 | Carrier 3 (term-final) | Difference |")
    w("|---|---|---|---|")
    for v in vendors:
        a, b = by_carrier.get((v, "c1-2")), by_carrier.get((v, "c3"))
        diff = "—" if not (a and b and a.n and b.n) else f"{100 * (b.acc() - a.acc()):+.1f} pp"
        w(f"| {v} | {cell(a)} | {cell(b)} | {diff} |")

    # ---- per term ------------------------------------------------------------
    w("\n## Per term (strict; floor 70 %, critical ≥ 85 %)\n")
    head = "| Term | " + " | ".join(f"{v} strict | {v} relaxed" for v in vendors) + " |"
    w(head)
    w("|---|" + "---|---|" * len(vendors))
    for t in sorted(terms):
        name, critical = terms[t]
        label = f"{t} {'**' + name + '**' if critical else name}"
        cells = []
        for v in vendors:
            tt = by_term.get((v, t))
            flag = ""
            if tt and tt.n:
                if tt.acc() < TERM_FLOOR:
                    flag = " ⚠️"
                elif critical and tt.acc() < CRITICAL_PASS:
                    flag = " ⚠️"
            cells.append(f"{cell(tt)}{flag} | {pct(tt.acc(True)) if tt else '—'}")
        w(f"| {label} | " + " | ".join(cells) + " |")
    w("\nCritical terms in **bold**. ⚠️ = below the term floor, or a critical term below 85 %.\n")

    # ---- per speaker ---------------------------------------------------------
    w("## Per speaker (strict; floor 80 %)\n")
    w("| Speaker | " + " | ".join(vendors) + " |")
    w("|---|" + "---|" * len(vendors))
    for s in sorted(speakers):
        cells = []
        for v in vendors:
            ts = by_speaker.get((v, s))
            flag = " ⚠️" if ts and ts.n and ts.acc() < SPEAKER_FLOOR else ""
            cells.append(cell(ts) + flag)
        w(f"| {s} | " + " | ".join(cells) + " |")

    # ---- latency -------------------------------------------------------------
    w("\n## Time to final result (ms after the take's audio ended)\n")
    w("Informational; the latency gate in the plan is measured end-to-end on the platform, not here.\n")
    w("| Vendor | Condition | n | p50 | p95 | no final |")
    w("|---|---|---|---|---|---|")
    for v in vendors:
        for c in conditions:
            xs = sorted(latency.get((v, c), []))
            total = by_condition[(v, c)].n
            if not total:
                continue
            p50 = statistics.median(xs) if xs else float("nan")
            p95 = xs[min(len(xs) - 1, math.ceil(0.95 * len(xs)) - 1)] if xs else float("nan")
            fmt = lambda x: "—" if isinstance(x, float) and math.isnan(x) else f"{x:.0f}"
            w(f"| {v} | {c} | {len(xs)} | {fmt(p50)} | {fmt(p95)} | {total - len(xs)} |")

    args.out.write_text("\n".join(L) + "\n", encoding="utf-8")
    print(f"wrote {args.out}")
    for v in vendors:
        print(f"  {v}: strict {pct(overall[v].acc())} ({overall[v].strict}/{overall[v].n})")
    return 0


if __name__ == "__main__":
    sys.exit(main())
