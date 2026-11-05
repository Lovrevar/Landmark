#!/usr/bin/env python3
"""Generate (or verify) assignment.csv: which speakers record which takes.

    python3 assign.py            # write assignment.csv from the five script files
    python3 assign.py --check    # verify the committed file matches, and print the balance

Split design (to keep each session short):
  * The 5 critical terms (all 3 carriers each, 15 takes) are recorded by ALL six speakers.
  * Every other take is recorded by exactly 3 of the 6. Its `complement` column names the
    other 3, who can record it later in a complement session to restore the full design.

Deterministic and balanced by construction:
  * Within each section, takes are ordered by SHA-256 of their item id. That order depends
    on the ids alone, never on file order, text or time; reviewing the script's wording does
    not move anything, because the ids do not change.
  * Consecutive takes in a section alternate between a 3-speaker set and its complement, so
    across each pair every speaker records exactly one take. Each speaker therefore records
    exactly half of every even-sized section (every speaker x section cell is covered); the one
    spare take of an odd-sized section goes to the next set, and totals differ by at most 1.
  * The sets cycle through all 10 triples that contain s01 (each with its complement), so
    every speaker is paired with every other speaker, not always the same two.
"""

from __future__ import annotations

import argparse
import csv
import hashlib
import itertools
import sys
from collections import Counter
from pathlib import Path

HERE = Path(__file__).resolve().parent
SPEAKERS = [f"s0{i}" for i in range(1, 7)]
COLS = ["item_id", "section", "critical", "speakers", "complement"]
SECTIONS = ["term", "entity", "amount", "date", "question"]


def script_items(root: Path) -> list[tuple[str, str, bool]]:
    """(item_id, section, critical) for every take, in script order."""
    def rows(name):
        return list(csv.DictReader(open(root / name, encoding="utf-8")))
    items = [(f"{r['term_id']}_c{r['carrier_no']}", "term", r["critical"] == "y") for r in rows("sentences.csv")]
    items += [(f"{r['entity_id']}_c{r['carrier_no']}", "entity", False) for r in rows("entities.csv")]
    items += [(r["amount_id"], "amount", False) for r in rows("amounts.csv")]
    items += [(r["date_id"], "date", False) for r in rows("dates.csv")]
    items += [(r["question_id"], "question", False) for r in rows("questions.csv")]
    return items


def build(root: Path) -> list[dict]:
    triples = [("s01", a, b) for a, b in itertools.combinations(SPEAKERS[1:], 2)]  # 10 triples with s01
    items = script_items(root)
    out: list[dict] = []
    pair = 0  # runs across sections, so the triples keep rotating and an odd section's spare take moves on
    for section in SECTIONS:
        split = sorted((i for i in items if i[1] == section and not i[2]),
                       key=lambda i: hashlib.sha256(i[0].encode()).hexdigest())
        for i, (item_id, _, _) in enumerate(split):  # pairs never straddle sections: exact halves per section
            triple = set(triples[pair % len(triples)])
            chosen = triple if i % 2 == 0 else set(SPEAKERS) - triple
            out.append({"item_id": item_id, "section": section, "critical": "n",
                        "speakers": "|".join(sorted(chosen)), "complement": "|".join(sorted(set(SPEAKERS) - chosen))})
            if i % 2 == 1 or i == len(split) - 1:
                pair += 1
        for item_id, sec, critical in items:
            if sec == section and critical:
                out.append({"item_id": item_id, "section": section, "critical": "y",
                            "speakers": "|".join(SPEAKERS), "complement": ""})
    return sorted(out, key=lambda r: (SECTIONS.index(r["section"]), r["item_id"]))


def balance(rows: list[dict]) -> tuple[Counter, Counter]:
    per_speaker, per_cell = Counter(), Counter()
    for r in rows:
        for s in r["speakers"].split("|"):
            per_speaker[s] += 1
            per_cell[(s, r["section"])] += 1
    return per_speaker, per_cell


def render(rows: list[dict]) -> str:
    lines = [",".join(COLS)] + [",".join(r[c] for c in COLS) for r in rows]
    return "\n".join(lines) + "\n"


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--check", action="store_true", help="verify assignment.csv instead of writing it")
    ap.add_argument("--script-dir", type=Path, default=HERE)
    args = ap.parse_args()

    rows = build(args.script_dir)
    text = render(rows)
    target = args.script_dir / "assignment.csv"
    per_speaker, per_cell = balance(rows)
    ok = True
    if args.check:
        if not target.exists() or target.read_text(encoding="utf-8") != text:
            print("assignment.csv does not match the script ids: run `python3 assign.py` and commit it")
            ok = False
    else:
        target.write_text(text, encoding="utf-8")
        print(f"wrote {target.name}: {len(rows)} takes")
    print("takes per speaker: " + ", ".join(f"{s} {per_speaker[s]}" for s in SPEAKERS))
    print("per section: " + "; ".join(
        f"{sec} " + "/".join(str(per_cell[(s, sec)]) for s in SPEAKERS) for sec in SECTIONS))
    if max(per_speaker.values()) - min(per_speaker.values()) > 1 or any(per_cell[(s, sec)] == 0 for s in SPEAKERS for sec in SECTIONS):
        print("unbalanced assignment")
        ok = False
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
