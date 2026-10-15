---
paths:
  - "docs/backlog/**"
---

# Backlog

The entry format, severities and the ranked list are in
[`docs/backlog/README.md`](../../docs/backlog/README.md). On top of what CLAUDE.md says:

- **When you fix an item, close it** — move the entry to `## Resolved` at the bottom of its file
  with one line saying how and in which commit or migration, and take it out of the ranked list
- **Never reuse or renumber an id** — code comments and migrations quote them (`DEFECT_BACKLOG
  CASH-7`). An id that is not in an area file is in `docs/backlog/archive/DEFECT_BACKLOG.md`
- `docs/backlog/archive/` is closed history — do not update it. ERP items go in
  `docs/erp-integration/KNOWN_ISSUES.md` and `OPEN_QUESTIONS.md`, not here
- `release.md` holds fixes that are written but not live (no ids; tick and date)
