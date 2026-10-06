# Backlog

Everything known to be wrong, missing or undecided in Cognilion, grouped by area. One file per
area holds the open items; the audits that found them are kept in `archive/` as history.

## Files

| File | Covers | Open |
|---|---|---|
| [release.md](./release.md) | Fixes written but not live, and checks nobody has run | 5 steps |
| [security.md](./security.md) | RLS, storage policies, role gating; accepted risks | 4 defects, 3 accepted risks |
| [sales.md](./sales.md) | Units, the sale flow, customers | 7 |
| [retail.md](./retail.md) | Land development, retail buyers | 3 |
| [supervision.md](./supervision.md) | Site management, subcontractors, contracts | 4 |
| [cashflow.md](./cashflow.md) | Invoices, payments, companies, bank accounts | 10, plus 4 waiting on the ERP |
| [funding.md](./funding.md) | Credits, investors, allocations, TIC | 10 |
| [projects-dashboards-reports.md](./projects-dashboards-reports.md) | General module, dashboards, reports, activity log | 10 |
| [collaboration.md](./collaboration.md) | Tasks, calendar, chat, documents, AI assistant | 10 |
| [ui.md](./ui.md) | App-wide UI: formatting, failed loads, i18n, mobile, dark mode | 9 |
| [plans/supplier-unification.md](./plans/supplier-unification.md) | Plan to merge the three vendor tables | Not started |
| [archive/](./archive/) | The four audits, with every fixed entry | Closed, do not update |

Two features keep their own lists, because their docs and checklists point at them:

- **ERP integration (on hold):** [../erp-integration/KNOWN_ISSUES.md](../erp-integration/KNOWN_ISSUES.md)
  (`ERP-n`), [OPEN_QUESTIONS.md](../erp-integration/OPEN_QUESTIONS.md) (`Qn`) and the resume
  checklist in [PROGRESS.md](../erp-integration/PROGRESS.md).
- **Voice assistant:** `docs/voice/open-questions.md` (`OQ-n`) and
  `docs/voice/phase0-freeze-checklist.md`, on `feature/voice-assistant` only.

## Adding and closing items

**Add an item when** you find a bug, a wrong figure, a missing guard, dead code, a doc that
disagrees with the code, or a decision nobody has made, and you are not fixing it in the same
change. A fix you make straight away needs no entry.

1. Pick the file by area. A UI problem on one screen goes in that module's file; one that needs a
   shared helper or a sweep goes in [ui.md](./ui.md). ERP and voice items go in their own docs.
2. Take the next free id from the top of the file and update that line.
3. Write the entry:

   ```markdown
   ### CASH-21 · Medium · One line saying what is wrong
   - **Check:** Confirmed | Code reading | Runtime check needed
   - **Where:** file, function, migration or screen
   - **What happens:** what the user or the data ends up with
   - **Fix direction:** what a fix would look like, if you know
   ```

   - **High:** data is lost or written wrong, a feature does not work at all, or data is exposed.
   - **Medium:** wrong figures are shown, a secondary flow is broken, or behaviour contradicts the
     documented rules.
   - **Low:** inconsistency, dead code, missing guard or cosmetic problem.
4. If it belongs near the top of the ranking below, add it there too.

**When an item is fixed,** move its entry to a `## Resolved` section at the bottom of the same
file, cut it to the heading plus one line saying how and in which commit or migration, and remove
it from the ranking. Never reuse an id: code comments and migrations quote them (for example
`DEFECT_BACKLOG CASH-7`). An id that is not in an area file is in
[archive/DEFECT_BACKLOG.md](./archive/DEFECT_BACKLOG.md).

**A security item the team decides to live with** moves to "Accepted risks" in
[security.md](./security.md), with the reason and the shape of a fix.

## Open work, ranked

Ranked on 2026-10-05 by what goes wrong if the item is left, then by how small the job is.

### 1. Do first

Everything in [release.md](./release.md): apply the twelve pending migrations with the merge of
`fix/backlog-batch-2`, walk the pre-merge sheet, check the bank accounts that were already wiped,
and try TIC saves on dev. Until the migrations are applied, the fixed High security items are
still open in production.

### 2. Open defects that need code or a decision

| # | Item | Why it ranks here |
|---|---|---|
| 1 | [SEC-A12](./security.md) — any signed-in user can delete or overwrite stored document files | The only open Medium security defect; data loss with no trace. One migration. |
| 2 | [CASH-6](./cashflow.md) — cesija-from-credit sign | Allocation usage is wrong for every such payment. Blocked on an accounting decision, not on code. |
| 3 | [SALES-6](./sales.md) — package total computed per screen | The same apartment shows different totals and remaining amounts. |
| 4 | [SEC-A10](./security.md), [FUND-15](./funding.md) — what the Investment role may see | Investment users get a payment UI over rows RLS will not return, so paid contracts read as never paid. Needs a product decision. |
| 5 | [SEC-004](./security.md) — `contracts` readable by every signed-in user | The Supervision payment gate is screen-only. Touches the most-read table; needs its own test pass. |
| 6 | [COLLAB-4](./collaboration.md) — AI rate limit miscounts and fails open | Deferred to the voice branch (OQ-3). Do it there. |
| 7 | [SALES-10](./sales.md) — no sale cancellation flow | A reverted sale counts in dashboards and reports for ever. |

### 3. Larger work, schedule deliberately

| # | Item | Note |
|---|---|---|
| 8 | [SEC-001](./security.md) — server-side Cashflow unlock | ~15 policies on 11 tables. Accepted risk; needs its own design review. |
| 9 | [UI-8](./ui.md) — mobile | Supervision is used on site, on phones. |
| 10 | [UI-4](./ui.md) — remaining silent failures | A failed load still reads as "no data" on ~39 inline loaders. |
| 11 | [UI-3](./ui.md), [CASH-18](./cashflow.md) — status and invoice-type display in Cashflow | Shared maps exist for the other domains. |
| 12 | [COLLAB-10](./collaboration.md), [COLLAB-9](./collaboration.md) — team calendar overlay | Needs a migration. |
| 13 | [UI-1](./ui.md), [UI-9](./ui.md), [UI-2](./ui.md) — money formatting, dark-mode contrast, export dates | Mechanical sweeps; the helpers exist. |
| 14 | [UI-5](./ui.md), [UI-7](./ui.md) — hardcoded strings, hand-rolled primitives | Consistency, no wrong data. |
| 15 | [plans/supplier-unification.md](./plans/supplier-unification.md) | Decide whether it is still wanted before the ERP work resumes; ERP partner mapping targets the same three tables. |

### 4. Small and low-risk

Everything else marked Low in the area files. Pick these up when working nearby. The ones with
visible effect: [FUND-13](./funding.md) (TIC export drops phases), [GEN-5](./projects-dashboards-reports.md)
(€0 budget where there is no TIC), [GEN-16](./projects-dashboards-reports.md) and
[COLLAB-11](./collaboration.md) (UUID fragments instead of names), [SALES-9](./sales.md) (duplicate
unit numbers), [CASH-9](./cashflow.md) (loans with no checks).

### 5. Parked with their feature

**ERP integration (on hold since 2026-09-14).**
- Before resuming: fix ERP-1 to ERP-5. One bank invoice or one storno fails a whole import run,
  the Komitenti tab does not work against the migrated schema, and no BANK payment resolves.
- Before the historical import: ERP-6 to ERP-9.
- Decisions: Q14 (do buyer payments come from the ERP; marked blocking), Q17 (double counting in
  the derived balance), Q18 (bank accounts from the feed), Q15, Q16, Q20, and the accounting
  questions Q4, Q5–Q8, Q10, Q13.
- The "Waiting on the ERP integration" section of [cashflow.md](./cashflow.md) lists what becomes
  moot or turns into ERP work in phase 5.

**Voice assistant (`feature/voice-assistant`).**
- The phase 0 freeze checklist is out of date: all 160 script rows are `frozen` since commit
  `022dcc3d`, but its six boxes are unticked and the stash it mentions still exists.
- Next: record phase 0 and take the go/no-go.
- Phase 2 carries the decided fixes for OQ-1 and OQ-2. OQ-3 to OQ-9 are open.
- Ten team questions are open in the implementation plan (§11), among them Vapi or Retell,
  recording, cost ceiling and whether finance data may go over the phone.
