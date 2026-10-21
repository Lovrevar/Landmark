---
name: backlog
description: Use when you find a bug, wrong figure, missing guard, dead code, doc/code disagreement or open decision you are not fixing in this change, or when you fix an item that has a backlog id — adds or closes the entry in docs/backlog/.
argument-hint: "add <area> <summary> | close <ID>"
---

# Backlog entry

Area files and their next free ids:

!`grep -h -A1 'Ids:' docs/backlog/*.md`

The format, severities and ranking live in `docs/backlog/README.md` — read it if you have not in
this session.

## Add

1. Pick the area file. One screen's problem goes in its module's file; a shared helper or sweep
   goes in `ui.md`. ERP items go in `docs/erp-integration/KNOWN_ISSUES.md` instead
2. Search the file and `docs/backlog/archive/DEFECT_BACKLOG.md` first — it may already be there
3. Take the next free id, bump the "next free" line, and write the entry under `## Open` in the
   README format (`### ID · Severity · one line`, then **Check**, **Where**, **What happens**,
   **Fix direction**)
4. If it ranks near the top, add it to the ranked list in the README

## Close

Move the entry to `## Resolved` at the bottom of its file, cut to the heading plus one line saying
how and in which commit or migration, and remove it from the README ranking. Never reuse or
renumber an id; never edit `archive/`.
