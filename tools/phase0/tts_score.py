#!/usr/bin/env python3
"""Score the TTS listening panel against the plan's phase 0 gates and write
tts_results.md.

    python3 tts_score.py --panel /mnt/c/phase0/tts [--out tts_results.md]

Reads panel_manifest.csv and every ratings_*.csv that rate.html exported into the
panel folder. Gates, per voice, on the `gate` block (plan §10, phase 0):
  - mean naturalness >= 3.5, over every rating from every rater;
  - 0 mispronounced amounts or dates in the 20 numeric sentences. A sentence counts
    as mispronounced when more than half of the raters who heard it flagged it.
A verdict needs MIN_RATERS raters; with fewer it is INCOMPLETE. The `digits` block
(numbers as numerals, usually one rater) is informational: whether a voice can be
trusted if the model ever writes digits.
"""

from __future__ import annotations

import argparse
import csv
import math
import statistics
import sys
from collections import defaultdict
from pathlib import Path

MIN_RATERS = 3
NATURALNESS_GATE = 3.5


def read_csv(path: Path) -> list[dict]:
    with open(path, newline="", encoding="utf-8") as f:
        return list(csv.DictReader(f))


def mean_ci(values: list[float]) -> tuple[float, float]:
    """Mean and 95 % half-width (normal approximation)."""
    m = statistics.fmean(values)
    if len(values) < 2:
        return m, float("nan")
    return m, 1.96 * statistics.stdev(values) / math.sqrt(len(values))


def median(values: list[float]) -> str:
    return f"{statistics.median(values):.0f}" if values else "—"


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--panel", type=Path, required=True, help="the folder tts_panel.py wrote")
    ap.add_argument("--out", type=Path, help="default: <panel>/tts_results.md")
    args = ap.parse_args()
    out = args.out or args.panel / "tts_results.md"

    clips = {r["clip_id"]: r for r in read_csv(args.panel / "panel_manifest.csv")}  # a regenerated clip's last line wins
    ratings: dict[tuple[str, str], dict] = {}
    for path in sorted(args.panel.glob("ratings_*.csv")):
        for r in read_csv(path):
            if r["clip_id"] in clips and r.get("naturalness"):
                ratings[(r["rater"], r["clip_id"])] = r  # a re-exported file's later line wins
    if not ratings:
        print(f"no ratings_*.csv with ratings for these clips in {args.panel}", file=sys.stderr)
        return 1

    by_clip: dict[str, list[dict]] = defaultdict(list)
    for (_, cid), r in ratings.items():
        by_clip[cid].append(r)
    configs = sorted({c["config_id"] for c in clips.values()})
    meta = {c["config_id"]: c for c in clips.values()}

    lines: list[str] = []
    w = lines.append
    raters = sorted({rater for rater, _ in ratings})
    w("# Phase 0 — TTS listening panel\n")
    w(f"From `{args.panel}`. Raters: {', '.join(raters)}. Clips rated: {len(by_clip)} of {len(clips)}.\n")
    w(f"Gates (gate block): mean naturalness ≥ {NATURALNESS_GATE}; 0 numeric sentences mispronounced "
      f"(flagged by more than half of their raters). A verdict needs {MIN_RATERS} raters.\n")

    w("## Verdict\n")
    w("| Voice | Vendor / model | Naturalness (95 % CI) | Raters | Numbers wrong (majority) | Numbers flagged by anyone | "
      "Other mispronunciations (majority) | Verdict |")
    w("|---|---|---|---|---|---|---|---|")
    detail: dict[str, list[str]] = {}
    for cfg in configs:
        gate = [cid for cid, c in clips.items() if c["config_id"] == cfg and c["block"] == "gate" and cid in by_clip]
        if not gate:
            continue
        scores = [int(r["naturalness"]) for cid in gate for r in by_clip[cid]]
        m, hw = mean_ci(scores)
        cfg_raters = {r["rater"] for cid in gate for r in by_clip[cid]}
        wrong, flagged, other = [], [], []
        for cid in gate:
            rs = by_clip[cid]
            n_flag = sum(r["number_error"] == "1" for r in rs)
            if clips[cid]["kind"] == "numeric":
                if n_flag * 2 > len(rs):
                    wrong.append(clips[cid]["sentence_id"])
                if n_flag:
                    flagged.append(clips[cid]["sentence_id"])
            if sum(r["other_error"] == "1" for r in rs) * 2 > len(rs):
                other.append(clips[cid]["sentence_id"])
        if len(cfg_raters) < MIN_RATERS:
            verdict = f"INCOMPLETE ({len(cfg_raters)} of {MIN_RATERS} raters)"
        else:
            verdict = "**PASS**" if m >= NATURALNESS_GATE and not wrong else "**FAIL**"
        ci = "" if math.isnan(hw) else f" (±{hw:.2f})"
        w(f"| {cfg} | {meta[cfg]['vendor']} / {meta[cfg]['model']} | {m:.2f}{ci} | {len(cfg_raters)} | {len(wrong)} | "
          f"{len(flagged)} | {len(other)} | {verdict} |")
        detail[cfg] = [f"numbers wrong: {', '.join(sorted(wrong)) or 'none'}",
                       f"other mispronunciations: {', '.join(sorted(other)) or 'none'}"]
    w("")
    for cfg, parts in detail.items():
        w(f"- **{cfg}**: " + "; ".join(parts))
    w("")

    w("## Per rater (gate block mean naturalness)\n")
    w("Shows how strict each rater is; the verdict pools every rating.\n")
    w("| Voice | " + " | ".join(raters) + " |")
    w("|---|" + "---|" * len(raters))
    for cfg in configs:
        cells = []
        for rater in raters:
            s = [int(r["naturalness"]) for (rr, cid), r in ratings.items()
                 if rr == rater and clips[cid]["config_id"] == cfg and clips[cid]["block"] == "gate"]
            cells.append(f"{statistics.fmean(s):.2f} ({len(s)})" if s else "—")
        w(f"| {cfg} | " + " | ".join(cells) + " |")
    w("")

    w("## Digits block (informational)\n")
    w("Numbers written as numerals, so the voice has to expand them itself. Not a gate: the voice prompt "
      "asks the model to write numbers in words.\n")
    w("| Voice | Naturalness | Numbers flagged | Sentences flagged |")
    w("|---|---|---|---|")
    for cfg in configs:
        dig = [cid for cid, c in clips.items() if c["config_id"] == cfg and c["block"] == "digits" and cid in by_clip]
        if not dig:
            continue
        s = [int(r["naturalness"]) for cid in dig for r in by_clip[cid]]
        bad = sorted(clips[cid]["sentence_id"] for cid in dig if any(r["number_error"] == "1" for r in by_clip[cid]))
        w(f"| {cfg} | {statistics.fmean(s):.2f} | {len(bad)} of {len(dig)} | {', '.join(bad) or '—'} |")
    w("")

    w("## Synthesis time (ms per sentence, median)\n")
    w("Informational. ElevenLabs streams; Azure and Google return whole files, so their first byte is close "
      "to the total. Real time-to-first-audio is measured on the live prototype.\n")
    w("| Voice | First byte | Total | Clips |")
    w("|---|---|---|---|")
    for cfg in configs:
        rows = [c for c in clips.values() if c["config_id"] == cfg]
        w(f"| {cfg} | {median([float(c['first_byte_ms']) for c in rows])} | "
          f"{median([float(c['total_ms']) for c in rows])} | {len(rows)} |")
    w("")

    out.write_text("\n".join(lines), encoding="utf-8")
    print(f"wrote {out}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
