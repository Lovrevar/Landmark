#!/usr/bin/env python3
"""Score transcripts.csv against the frozen script and write results.md.

    python3 score.py [--transcripts transcripts.csv] [--out results.md] [--script-dir .]

Five sections, each scored against its own file (see README):

  terms      sentences.csv  hit = target_form OR any accepted_alternate appears as a
                            contiguous word sequence in the transcript
  entities   entities.csv   same, with a trailing legal form (d.o.o., j.d.o.o., d.d.,
                            obrt, GmbH) optional
  amounts    amounts.csv    hit = some amount parsed from the transcript (Croatian number
                            words or digits, "eura i N centi") equals amount_eur
  dates      dates.csv      hit = some date parsed from the transcript has the right day and
                            month (ordinal words in any case, "15.10.", "15. listopada"), and
                            the right year when the sentence speaks one
  questions  questions.csv  word error rate against the question text, pooled

Normalisation:
  STRICT   lowercase; punctuation characters (Unicode P*) deleted, so "PDV-a" -> "pdva",
           "d.o.o." -> "doo"; whitespace collapsed; diacritics must match.
  RELAXED  STRICT, then diacritics folded (č ć -> c, š -> s, ž -> z, đ -> d).
Alternates are normalised the same way, and a match on the target or on an alternate
counts under both. RELAXED is the gate metric (plan §10); STRICT is reported alongside.

Gates, per vendor, clean + noisy pooled (plan §10, phase 0):
  terms      >= 90 % pass | 80-90 % review | < 80 % no-go
             per-term floor 70 %; per-speaker floor 80 %
             critical terms each >= 85 %; any critical term < 70 % is a no-go
  entities   exact >= 80 %
  amounts + dates, pooled (the plan's single "amounts / dates" gate) >= 95 %
  questions  WER <= 15 %
Not scored here: entity recoverability through the real search tools (a later step),
TTS, turn-taking, and the platform latency floor.

Split design (assignment.csv): the 5 critical terms are recorded by all six speakers, every
other take by 3 of 6. All intervals, floors and verdicts use the observations actually
present, and results.md states them next to the full-design figures. Complement sessions
(each speaker's other half) merge in simply by being present: their takes are ordinary rows
of transcripts.csv, and the report says which design it found (split, partial, full).
"""

from __future__ import annotations

import argparse
import csv
import math
import re
import statistics
import sys
import unicodedata
from collections import Counter, defaultdict
from pathlib import Path

HERE = Path(__file__).resolve().parent
SCRIPT_DIR = HERE  # overridden by --script-dir
TERM_RE = re.compile(r"^(s0[1-6])_(t\d{2})_c([123])\.wav$")
ENTITY_RE = re.compile(r"^(s0[1-6])_(e\d{2})_c([12])\.wav$")
ITEM_RE = re.compile(r"^(s0[1-6])_([adq]\d{2})\.wav$")
SECTION_OF = {"a": "amount", "d": "date", "q": "question"}

TERM_PASS, TERM_NOGO = 0.90, 0.80
TERM_FLOOR, SPEAKER_FLOOR = 0.70, 0.80
CRITICAL_PASS, CRITICAL_NOGO = 0.85, 0.70
ENTITY_PASS, NUMERIC_PASS, WER_MAX = 0.80, 0.95, 0.15
LEGAL_FORMS = {"doo", "jdoo", "dd", "obrt", "gmbh"}


# ---------------------------------------------------------------------------
# Normalisation and matching
# ---------------------------------------------------------------------------

def norm_strict(s: str) -> str:
    s = "".join(ch for ch in s.lower() if not unicodedata.category(ch).startswith("P"))
    return " ".join(s.split())


def fold(s: str) -> str:
    s = s.replace("đ", "d").replace("Đ", "D")
    return "".join(ch for ch in unicodedata.normalize("NFD", s) if unicodedata.category(ch) != "Mn")


def norm_relaxed(s: str) -> str:
    return fold(norm_strict(s))


def contains(transcript: str, target: str) -> bool:
    t, g = transcript.split(), target.split()
    return bool(g) and any(t[i : i + len(g)] == g for i in range(len(t) - len(g) + 1))


def alternates(field: str) -> list[str]:
    return [a for a in (field or "").split("|") if a.strip()]


def matches(transcript: str, forms: list[str], strip_legal: bool = False) -> tuple[bool, bool]:
    """(strict hit, relaxed hit) for a transcript against target + alternates."""
    def variants(norm):
        out = []
        for f in forms:
            n = norm(f)
            toks = n.split()
            if strip_legal:
                while len(toks) > 1 and toks[-1] in LEGAL_FORMS:
                    toks = toks[:-1]
            out.append(" ".join(toks))
        return out
    ts, tr = norm_strict(transcript), norm_relaxed(transcript)
    return any(contains(ts, v) for v in variants(norm_strict)), any(contains(tr, v) for v in variants(norm_relaxed))


# ---------------------------------------------------------------------------
# Croatian amounts
# ---------------------------------------------------------------------------

_UNITS = {
    "nula": 0, "jedan": 1, "jedna": 1, "jedno": 1, "jednu": 1, "dva": 2, "dvije": 2, "tri": 3, "cetiri": 4,
    "pet": 5, "sest": 6, "sedam": 7, "osam": 8, "devet": 9, "deset": 10, "jedanaest": 11, "dvanaest": 12,
    "trinaest": 13, "cetrnaest": 14, "petnaest": 15, "sesnaest": 16, "sedamnaest": 17, "osamnaest": 18,
    "devetnaest": 19, "dvadeset": 20, "trideset": 30, "cetrdeset": 40, "pedeset": 50, "sezdeset": 60,
    "sedamdeset": 70, "osamdeset": 80, "devedeset": 90, "sto": 100, "stotinu": 100, "dvjesto": 200,
    "dvjesta": 200, "tristo": 300, "trista": 300, "cetiristo": 400, "petsto": 500, "sesto": 600,
    "seststo": 600, "sedamsto": 700, "osamsto": 800, "devetsto": 900,
}
_MULT = {
    "tisuca": 1_000, "tisucu": 1_000, "tisuce": 1_000,
    "milijun": 1_000_000, "milijuna": 1_000_000, "milijuni": 1_000_000,
    "milijarda": 1_000_000_000, "milijarde": 1_000_000_000, "milijardi": 1_000_000_000,
}
_CURRENCY = {"eura", "euro", "eur", "eure", "€"}
_CENTS = {"centi", "centa", "cent", "centima"}
_DIGITS = re.compile(r"\d{1,3}(?:[.\s]\d{3})+(?:,\d+)?|\d+(?:,\d+)?")


def _digit_value(tok: str) -> float:
    whole, _, frac = tok.replace(" ", "").replace(".", "").partition(",")
    return float(f"{whole}.{frac}" if frac else whole)


def parse_amounts(text: str) -> list[float]:
    """Every euro amount in a transcript: number words, Croatian-formatted digits
    (1.200.000 / 12.500,50 / 1,2 milijuna) and an optional "i N centi" tail."""
    s = fold(text.lower()).replace("€", " € ")
    tokens: list[tuple[str, float | None]] = []
    pos = 0
    for m in _DIGITS.finditer(s):
        for w in re.findall(r"[a-z€]+", s[pos : m.start()]):
            tokens.append((w, None))
        tokens.append(("#", _digit_value(m.group(0))))
        pos = m.end()
    for w in re.findall(r"[a-z€]+", s[pos:]):
        tokens.append((w, None))

    def is_num(tok):
        return tok[0] == "#" or tok[0] in _UNITS or tok[0] in _MULT

    groups: list[tuple[int, int, float]] = []  # (start, end_exclusive, value)
    i = 0
    while i < len(tokens):
        if not is_num(tokens[i]):
            i += 1
            continue
        start, total, current = i, 0.0, 0.0
        while i < len(tokens):
            word, val = tokens[i]
            if word == "#":
                current += val
            elif word in _UNITS:
                current += _UNITS[word]
            elif word in _MULT:
                total += (current or 1) * _MULT[word]
                current = 0.0
            elif word == "i" and i + 1 < len(tokens) and is_num(tokens[i + 1]) and tokens[i + 1][0] not in _MULT:
                pass  # "dvadeset i pet"
            else:
                break
            i += 1
        groups.append((start, i, total + current))

    amounts = []
    for k, (start, end, value) in enumerate(groups):
        if start > 0 and tokens[start - 1][0] == "i" and k > 0 and end < len(tokens) and tokens[end][0] in _CENTS:
            continue  # this group is the cents tail of the previous amount
        amount = value
        j = end
        if j < len(tokens) and tokens[j][0] in _CURRENCY:
            j += 1
        if (j + 1 < len(tokens) and tokens[j][0] == "i" and k + 1 < len(groups) and groups[k + 1][0] == j + 1
                and groups[k + 1][1] < len(tokens) and tokens[groups[k + 1][1]][0] in _CENTS):
            amount += groups[k + 1][2] / 100
        amounts.append(round(amount, 2))
    return amounts


# ---------------------------------------------------------------------------
# Croatian dates
# ---------------------------------------------------------------------------

_ORD_STEMS = {
    "prv": 1, "drug": 2, "trec": 3, "cetvrt": 4, "pet": 5, "sest": 6, "sedm": 7, "osm": 8, "devet": 9,
    "deset": 10, "jedanaest": 11, "dvanaest": 12, "trinaest": 13, "cetrnaest": 14, "petnaest": 15,
    "sesnaest": 16, "sedamnaest": 17, "osamnaest": 18, "devetnaest": 19, "dvadeset": 20, "trideset": 30,
}
# Ordinal endings across the cases dates take (nom. -i, gen. -og(a)/-eg(a), dat./loc. -om(u)/-em(u),
# feminine year forms -a/-e/-oj/-u); longest first so "-oga" wins over "-a".
_ORD_ENDINGS = sorted(["i", "og", "oga", "om", "omu", "ome", "eg", "ega", "em", "emu", "a", "e", "oj", "u"], key=len, reverse=True)
_MONTHS = {
    "sijecnja": 1, "sijecanj": 1, "veljace": 2, "veljaca": 2, "ozujka": 3, "ozujak": 3, "travnja": 4,
    "travanj": 4, "svibnja": 5, "svibanj": 5, "lipnja": 6, "lipanj": 6, "srpnja": 7, "srpanj": 7,
    "kolovoza": 8, "kolovoz": 8, "rujna": 9, "rujan": 9, "listopada": 10, "listopad": 10,
    "studenoga": 11, "studenog": 11, "studeni": 11, "prosinca": 12, "prosinac": 12,
}
_TENS = {"dvadeset": 20, "trideset": 30}
_NUMERIC_DATE = re.compile(r"(?<!\d)(\d{1,2})\.\s?(\d{1,2})\.(?:\s?(\d{4})\.?)?")


def ordinal(word: str) -> int | None:
    for end in _ORD_ENDINGS:
        if word.endswith(end) and word[: -len(end)] in _ORD_STEMS:
            return _ORD_STEMS[word[: -len(end)]]
    return None


def parse_dates(text: str) -> list[tuple[int, int, int | None]]:
    """Every (day, month, year-or-None) in a transcript: "15.10.", "15.10.2026.",
    "15. listopada", "petnaesti listopada", "petnaestog listopada", "dvadeset prvog
    ožujka", with an optional year after the month ("dvije tisuće dvadeset šeste",
    "2026")."""
    s = fold(text.lower())
    out: list[tuple[int, int, int | None]] = []
    for m in _NUMERIC_DATE.finditer(s):
        d, mo = int(m.group(1)), int(m.group(2))
        if 1 <= d <= 31 and 1 <= mo <= 12:
            out.append((d, mo, int(m.group(3)) if m.group(3) else None))
    toks = re.findall(r"\d+\.?|[a-z]+", s)
    for i, tok in enumerate(toks):
        if tok not in _MONTHS:
            continue
        day = None
        prev = toks[i - 1] if i >= 1 else ""
        if re.fullmatch(r"\d{1,2}\.?", prev):
            day = int(prev.rstrip("."))
        elif (o := ordinal(prev)) is not None:
            day = o
            if o < 10 and i >= 2 and toks[i - 2] in _TENS:
                day = _TENS[toks[i - 2]] + o
        if day is None or not 1 <= day <= 31:
            continue
        year = None
        nxt = toks[i + 1 : i + 5]
        if nxt and re.fullmatch(r"\d{4}\.?", nxt[0]):
            year = int(nxt[0].rstrip("."))
        elif len(nxt) >= 3 and nxt[0] == "dvije" and nxt[1] in ("tisuce", "tisuca"):
            rest = nxt[2:]
            if rest and rest[0] in _TENS and len(rest) > 1 and (o := ordinal(rest[1])) is not None and o < 10:
                year = 2000 + _TENS[rest[0]] + o
            elif rest and (o := ordinal(rest[0])) is not None:
                year = 2000 + o
        out.append((day, _MONTHS[tok], year))
    return out


# ---------------------------------------------------------------------------
# WER
# ---------------------------------------------------------------------------

def word_errors(ref: str, hyp: str) -> tuple[int, int]:
    r, h = norm_relaxed(ref).split(), norm_relaxed(hyp).split()
    prev = list(range(len(h) + 1))
    for i in range(1, len(r) + 1):
        cur = [i] + [0] * len(h)
        for j in range(1, len(h) + 1):
            cur[j] = min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (r[i - 1] != h[j - 1]))
        prev = cur
    return prev[-1], len(r)


# ---------------------------------------------------------------------------
# Tallies
# ---------------------------------------------------------------------------

def wilson(hits: int, n: int, z: float = 1.959964) -> tuple[float, float]:
    if n == 0:
        return float("nan"), float("nan")
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

    def acc(self, strict: bool = False) -> float:
        return (self.strict if strict else self.relaxed) / self.n if self.n else float("nan")


def half_width(p: float, n: int) -> float:
    """95 % half-width at proportion p for n observations (normal approximation)."""
    return 1.959964 * math.sqrt(p * (1 - p) / n) if n else float("nan")


def pp(x: float) -> str:
    return "—" if math.isnan(x) else f"±{100 * x:.1f} pp"


def pct(x: float) -> str:
    return "—" if math.isnan(x) else f"{100 * x:.1f} %"


def cell(t: Tally | None, strict: bool = False) -> str:
    if t is None or t.n == 0:
        return "—"
    return f"{pct(t.acc(strict))} ({t.strict if strict else t.relaxed}/{t.n})"


def load(name: str) -> list[dict]:
    path = SCRIPT_DIR / name
    with open(path, newline="", encoding="utf-8") as f:
        return list(csv.DictReader(f))


# ---------------------------------------------------------------------------

def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--transcripts", type=Path, default=Path("transcripts.csv"))
    ap.add_argument("--out", type=Path, default=Path("results.md"))
    ap.add_argument("--script-dir", type=Path, default=HERE,
                    help="folder holding sentences.csv, entities.csv, amounts.csv, questions.csv")
    args = ap.parse_args()
    global SCRIPT_DIR
    SCRIPT_DIR = args.script_dir

    terms_script = {(r["term_id"], r["carrier_no"]): r for r in load("sentences.csv")}
    term_info = {r["term_id"]: (r["term"], r["critical"] == "y") for r in terms_script.values()}
    entities = {(r["entity_id"], r["carrier_no"]): r for r in load("entities.csv")}
    entity_names = {r["entity_id"]: r for r in entities.values()}
    amounts = {r["amount_id"]: r for r in load("amounts.csv")}
    dates = {r["date_id"]: r for r in load("dates.csv")}
    questions = {r["question_id"]: r for r in load("questions.csv")}
    assignment = {r["item_id"]: r for r in load("assignment.csv")}

    with open(args.transcripts, newline="", encoding="utf-8") as f:
        rows = list(csv.DictReader(f))
    if not rows:
        print("transcripts.csv is empty", file=sys.stderr)
        return 1

    vendors = sorted({r["vendor"] for r in rows})
    conditions = sorted({r["condition"] for r in rows})
    T = defaultdict(Tally)          # keyed by tuples; see uses below
    wer = defaultdict(lambda: [0, 0])  # (vendor, cond|*) -> [errors, ref words]
    wer_item = defaultdict(lambda: [0, 0])
    latency = defaultdict(list)
    models = Counter()
    speakers: set[str] = set()
    seen_sections = Counter()
    skipped = 0

    for r in rows:
        v, c, text = r["vendor"], r["condition"], r.get("transcript") or ""
        models[(v, r.get("model") or "—")] += 1
        if r.get("time_to_final_ms") not in ("", None):
            latency[(v, c)].append(int(r["time_to_final_ms"]))
        m = TERM_RE.match(r["file"])
        if m and (m.group(2), m.group(3)) in terms_script:
            spk, tid, car = m.groups()
            row = terms_script[(tid, car)]
            s, rx = matches(text, [row["target_form"], *alternates(row["accepted_alternates"])])
            for key in [("term", v), ("term", v, c), ("term_t", v, tid), ("term_s", v, spk),
                        ("term_pos", v, "c3" if car == "3" else "c1-2")]:
                T[key].add(s, rx)
            speakers.add(spk)
            seen_sections["term"] += 1
            continue
        m = ENTITY_RE.match(r["file"])
        if m and (m.group(2), m.group(3)) in entities:
            spk, eid, car = m.groups()
            row = entities[(eid, car)]
            s, rx = matches(text, [row["target_form"], *alternates(row["accepted_alternates"])], strip_legal=True)
            for key in [("entity", v), ("entity", v, c), ("entity_i", v, eid)]:
                T[key].add(s, rx)
            speakers.add(spk)
            seen_sections["entity"] += 1
            continue
        m = ITEM_RE.match(r["file"])
        if not m:
            skipped += 1
            continue
        spk, item = m.groups()
        section = SECTION_OF[item[0]]
        speakers.add(spk)
        if section == "amount" and item in amounts:
            target = round(float(amounts[item]["amount_eur"]), 2)
            hit = any(abs(a - target) < 0.005 for a in parse_amounts(text))
            for key in [("amount", v), ("amount", v, c), ("amount_i", v, item), ("numeric", v)]:
                T[key].add(hit, hit)
        elif section == "date" and item in dates:
            want = dates[item]
            d, mo, y = int(want["day"]), int(want["month"]), (int(want["year"]) if want["year"] else None)
            hit = any(pd == d and pm == mo and (y is None or py == y) for pd, pm, py in parse_dates(text))
            for key in [("date", v), ("date", v, c), ("date_i", v, item), ("numeric", v)]:
                T[key].add(hit, hit)
        elif section == "question" and item in questions:
            e, n = word_errors(questions[item]["sentence"], text)
            for key in [(v, "*"), (v, c)]:
                wer[key][0] += e
                wer[key][1] += n
            wer_item[(v, item)][0] += e
            wer_item[(v, item)][1] += n
        else:
            skipped += 1
            continue
        seen_sections[section] += 1

    L: list[str] = []
    w = L.append
    w("# Phase 0 — Croatian STT results\n")
    w(f"From `{args.transcripts.name}`. Speakers: {', '.join(sorted(speakers)) or '—'}. "
      f"Conditions: {', '.join(conditions)}. Rows per section: "
      + ", ".join(f"{k} {seen_sections[k]}" for k in ("term", "entity", "amount", "date", "question")) + ".\n")
    w("**Gate metric: RELAXED** (diacritics folded). STRICT (diacritics must match) is reported alongside. "
      "Accepted alternates count under both. 95 % intervals are Wilson.\n")
    if skipped:
        w(f"> {skipped} row(s) ignored: file name not in a known scheme or not in the script.\n")
    drafts = sum(1 for d in (terms_script, entities, amounts, dates, questions) for r in d.values()
                 if r.get("review_status", "frozen") != "frozen")
    placeholders = sum(1 for r in entities.values() if r.get("placeholder") == "y")
    if drafts or placeholders:
        w(f"> ⚠️ Script not frozen: {drafts} row(s) still `draft`, {placeholders} placeholder entit"
          f"{'y' if placeholders == 1 else 'ies'}. Results from an unfrozen script are not a phase 0 decision.\n")

    # ---- design, coverage and precision --------------------------------------------
    recorded = {r["file"] for r in rows}
    sessions = Counter()
    for f in recorded:
        spk, item = f[:3], f[4:-4]
        a = assignment.get(item)
        if a is None:
            continue
        if spk in a["speakers"].split("|"):
            sessions["primary"] += 1
        elif a["complement"] and spk in a["complement"].split("|"):
            sessions["complement"] += 1
        else:
            sessions["unassigned"] += 1
    expected_primary = sum(len(a["speakers"].split("|")) for a in assignment.values())
    expected_complement = sum(len(a["complement"].split("|")) for a in assignment.values() if a["complement"])
    if sessions["complement"] == 0:
        design = "split (primary sessions only)"
    elif sessions["complement"] >= expected_complement:
        design = "full (split + complement sessions merged)"
    else:
        design = "partial (some complement sessions merged)"
    split_design = sessions["complement"] < expected_complement
    n_cond = max(1, len(conditions))
    w("## Design and precision\n")
    w(f"Design found: **{design}**. Recorded takes: primary {sessions['primary']}/{expected_primary}, "
      f"complement {sessions['complement']}/{expected_complement}"
      + (f", {sessions['unassigned']} recorded by a speaker not assigned to them" if sessions["unassigned"] else "")
      + f". Every interval, floor and verdict below uses the observations actually present, pooled over "
      f"{n_cond} condition(s).\n")
    full = {"term": 90 * 6 * n_cond, "entity": 40 * 6 * n_cond, "numeric": 20 * 6 * n_cond, "question": 10 * 6 * n_cond}
    gates = [("Terms", "term", TERM_PASS), ("Entities", "entity", ENTITY_PASS), ("Amounts + dates", "numeric", NUMERIC_PASS)]
    w("| Gate | At | Observations per vendor | 95 % half-width | Full design | Full-design half-width |")
    w("|---|---|---|---|---|---|")
    for label, key, p in gates:
        ns = sorted({T[(key, v)].n for v in vendors if T[(key, v)].n})
        n_txt = "—" if not ns else (str(ns[0]) if len(ns) == 1 else f"{ns[0]}–{ns[-1]}")
        w(f"| {label} | {int(p * 100)} % | {n_txt} | {pp(half_width(p, ns[0])) if ns else '—'} | "
          f"{full[key]} | {pp(half_width(p, full[key]))} |")
    q_utts = sorted({sum(1 for r in rows if r['vendor'] == v and ITEM_RE.match(r['file']) and ITEM_RE.match(r['file']).group(2)[0] == 'q') for v in vendors})
    w(f"| Question WER | ≤ 15 % | {q_utts[-1] if q_utts else '—'} utterances | — | {full['question']} utterances | — |")
    term_ns = sorted({T[("term_t", v, x)].n for v in vendors for x in term_info if T[("term_t", v, x)].n})
    spk_ns = sorted({T[("term_s", v, s)].n for v in vendors for s in speakers if T[("term_s", v, s)].n})
    if term_ns:
        w(f"\nFloor granularity: a single term has {term_ns[0]}–{term_ns[-1]} observations "
          f"(one miss moves it by {100 / term_ns[0]:.1f} pp at the smallest); a single speaker has "
          f"{spk_ns[0] if spk_ns else 0}–{spk_ns[-1] if spk_ns else 0} term observations. "
          "Full design: 36 per term, 180 per speaker.\n")
    if split_design:
        w("> Split design: intervals are wider than the plan's full design. If a gate lands in the REVIEW band, "
          "record the complement sessions (README, step 6) and re-run: they merge in and restore the full counts.\n")

    # ---- verdict ----------------------------------------------------------------
    w("## Verdict against the frozen gates\n")
    w("| Vendor | Terms (relaxed, 95 % CI) | Terms strict | Entities exact | Amounts + dates | Question WER | Verdict |")
    w("|---|---|---|---|---|---|---|")
    notes = {}
    for v in vendors:
        t = T[("term", v)]
        lo, hi = wilson(t.relaxed, t.n)
        acc = t.acc()
        term_low = [x for x in sorted(term_info) if T[("term_t", v, x)].n and T[("term_t", v, x)].acc() < TERM_FLOOR]
        spk_low = [s for s in sorted(speakers) if T[("term_s", v, s)].n and T[("term_s", v, s)].acc() < SPEAKER_FLOOR]
        crit = [x for x in sorted(term_info) if term_info[x][1] and T[("term_t", v, x)].n]
        crit_low = [x for x in crit if T[("term_t", v, x)].acc() < CRITICAL_PASS]
        crit_nogo = [x for x in crit if T[("term_t", v, x)].acc() < CRITICAL_NOGO]
        ent, num = T[("entity", v)], T[("numeric", v)]
        we, wn = wer[(v, "*")]
        wer_v = we / wn if wn else float("nan")

        nogo, review = [], []
        if t.n == 0:
            nogo.append("no term results")
        elif acc < TERM_NOGO:
            nogo.append(f"terms {pct(acc)} < 80 %")
        if crit_nogo:
            nogo.append("critical term < 70 %: " + ", ".join(crit_nogo))
        if t.n and TERM_NOGO <= acc < TERM_PASS:
            review.append(f"terms {pct(acc)} in 80–90 %")
        if term_low:
            review.append("term floor: " + ", ".join(term_low))
        if spk_low:
            review.append("speaker floor: " + ", ".join(spk_low))
        if crit_low and not crit_nogo:
            review.append("critical < 85 %: " + ", ".join(crit_low))
        for label, tally, bar in (("entities", ent, ENTITY_PASS), ("amounts/dates", num, NUMERIC_PASS)):
            if tally.n == 0:
                review.append(f"{label} not recorded")
            elif tally.acc() < bar:
                review.append(f"{label} {pct(tally.acc())} < {int(bar * 100)} %")
        if not wn:
            review.append("questions not recorded")
        elif wer_v > WER_MAX:
            review.append(f"question WER {pct(wer_v)} > 15 %")
        verdict = "**NO-GO**" if nogo else ("**REVIEW**" if review else "**PASS**")
        notes[v] = "; ".join(nogo + review)
        w(f"| {v} | {pct(acc)} ({pct(lo)}–{pct(hi)}) | {pct(t.acc(strict=True))} | {cell(ent)} | {cell(num)} | "
          f"{'—' if not wn else pct(wer_v)} | {verdict} |")
    w("")
    for v in vendors:
        if notes[v]:
            w(f"- **{v}**: {notes[v]}")
    w("\nThresholds: terms ≥ 90 % pass, 80–90 % review, < 80 % no-go; term floor 70 %; speaker floor 80 %; "
      "critical terms ≥ 85 % (any < 70 % is a no-go); entities ≥ 80 %; amounts and dates pooled ≥ 95 %; question WER ≤ 15 %. "
      "Entity recoverability through the real search tools is a later step, not scored here.\n")

    # ---- per section, clean vs noisy ------------------------------------------------
    w("## Sections by condition (relaxed; strict in brackets)\n")
    w("| Vendor | Section | " + " | ".join(conditions) + " |")
    w("|---|---|" + "---|" * len(conditions))
    for v in vendors:
        for sec in ("term", "entity", "amount", "date"):
            cells = []
            for c in conditions:
                tt = T.get((sec, v, c))
                cells.append("—" if not tt or not tt.n else f"{cell(tt)} [{pct(tt.acc(strict=True))}]")
            w(f"| {v} | {sec} | " + " | ".join(cells) + " |")
        w(f"| {v} | question WER | " + " | ".join(
            "—" if not wer[(v, c)][1] else pct(wer[(v, c)][0] / wer[(v, c)][1]) for c in conditions) + " |")

    # ---- term position ------------------------------------------------------------
    w("\n## Terms: sentence-final (carrier 3) vs carriers 1–2\n")
    w("| Vendor | Carriers 1–2 | Carrier 3 (term-final) | Difference |")
    w("|---|---|---|---|")
    for v in vendors:
        a, b = T.get(("term_pos", v, "c1-2")), T.get(("term_pos", v, "c3"))
        diff = "—" if not (a and b and a.n and b.n) else f"{100 * (b.acc() - a.acc()):+.1f} pp"
        w(f"| {v} | {cell(a)} | {cell(b)} | {diff} |")

    # ---- per term -----------------------------------------------------------------
    w("\n## Per term (relaxed gate; floor 70 %, critical ≥ 85 %)\n")
    w("| Term | " + " | ".join(f"{v} relaxed | {v} strict" for v in vendors) + " |")
    w("|---|" + "---|---|" * len(vendors))
    for x in sorted(term_info):
        name, critical = term_info[x]
        cells = []
        for v in vendors:
            tt = T.get(("term_t", v, x))
            flag = ""
            if tt and tt.n and (tt.acc() < TERM_FLOOR or (critical and tt.acc() < CRITICAL_PASS)):
                flag = " ⚠️"
            cells.append(f"{cell(tt)}{flag} | {pct(tt.acc(strict=True)) if tt and tt.n else '—'}")
        w(f"| {x} {'**' + name + '**' if critical else name} | " + " | ".join(cells) + " |")
    w("\nCritical terms in **bold**. ⚠️ = below the term floor, or a critical term below 85 %.\n")

    # ---- per speaker -------------------------------------------------------------
    w("## Per speaker, terms (relaxed; floor 80 %)\n")
    w("| Speaker | " + " | ".join(vendors) + " |")
    w("|---|" + "---|" * len(vendors))
    for s in sorted(speakers):
        cells = []
        for v in vendors:
            tt = T.get(("term_s", v, s))
            cells.append(cell(tt) + (" ⚠️" if tt and tt.n and tt.acc() < SPEAKER_FLOOR else ""))
        w(f"| {s} | " + " | ".join(cells) + " |")

    # ---- entities, amounts, questions per item ------------------------------------
    w("\n## Per entity (relaxed; legal form optional; both carriers pooled)\n")
    w("| Entity | " + " | ".join(vendors) + " |")
    w("|---|" + "---|" * len(vendors))
    for e in sorted(entity_names):
        tag = " *(placeholder)*" if entity_names[e].get("placeholder") == "y" else ""
        w(f"| {e} {entity_names[e]['name']}{tag} | " + " | ".join(cell(T.get(("entity_i", v, e))) for v in vendors) + " |")
    w("\n## Per amount\n")
    w("| Amount | Value (EUR) | " + " | ".join(vendors) + " |")
    w("|---|---|" + "---|" * len(vendors))
    for a in sorted(amounts):
        w(f"| {a} | {amounts[a]['amount_eur']} | " + " | ".join(cell(T.get(("amount_i", v, a))) for v in vendors) + " |")
    w("\n## Per date\n")
    w("| Date | Day.month.year | " + " | ".join(vendors) + " |")
    w("|---|---|" + "---|" * len(vendors))
    for d in sorted(dates):
        r = dates[d]
        w(f"| {d} | {r['day']}.{r['month']}.{r['year'] or ''} | " + " | ".join(cell(T.get(("date_i", v, d))) for v in vendors) + " |")
    w("\n## Per question (WER)\n")
    w("| Question | " + " | ".join(vendors) + " |")
    w("|---|" + "---|" * len(vendors))
    for q in sorted(questions):
        cells = []
        for v in vendors:
            e, n = wer_item[(v, q)]
            cells.append("—" if not n else f"{pct(e / n)} ({e}/{n})")
        w(f"| {q} | " + " | ".join(cells) + " |")

    # ---- models and latency --------------------------------------------------------
    w("\n## Models used\n")
    w("| Vendor | Model | Transcripts |")
    w("|---|---|---|")
    for (v, model), n in sorted(models.items()):
        w(f"| {v} | {model} | {n} |")
    w("\n## Time to final result (ms after the take's audio ended)\n")
    w("Informational; the plan's latency gate is measured end-to-end on the platform, not here.\n")
    w("| Vendor | Condition | n | p50 | p95 | no final |")
    w("|---|---|---|---|---|---|")
    totals = Counter((r["vendor"], r["condition"]) for r in rows)
    for v in vendors:
        for c in conditions:
            if not totals[(v, c)]:
                continue
            xs = sorted(latency.get((v, c), []))
            p50 = f"{statistics.median(xs):.0f}" if xs else "—"
            p95 = f"{xs[min(len(xs) - 1, math.ceil(0.95 * len(xs)) - 1)]:.0f}" if xs else "—"
            w(f"| {v} | {c} | {len(xs)} | {p50} | {p95} | {totals[(v, c)] - len(xs)} |")

    args.out.write_text("\n".join(L) + "\n", encoding="utf-8")
    print(f"wrote {args.out}")
    for v in vendors:
        t = T[("term", v)]
        print(f"  {v}: terms relaxed {pct(t.acc())} ({t.relaxed}/{t.n}), strict {pct(t.acc(strict=True))}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
