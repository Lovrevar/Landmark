# Backlog

Every doc that tracks unfinished work lives here, plus one ranked list of what is still open
across all of them. The ranking was made on 2026-10-05 by reading each doc as it stands on
`fix/backlog-batch-2`; the docs themselves stay the source of truth for detail and status.

## What is in this folder

| File | What it tracks | State |
|---|---|---|
| [DEFECT_BACKLOG.md](./DEFECT_BACKLOG.md) | Code-level audit of the whole platform except Retail (30 Sept 2026), ~100 entries | Every High fixed in code; 2 Medium and ~35 Low open |
| [UI_AUDIT.md](./UI_AUDIT.md) | App-wide UI/UX review (15 Sept 2026) | 116 fixed, 20 partly fixed, 8 open |
| [SECURITY_BACKLOG.md](./SECURITY_BACKLOG.md) | Security limitations the team has accepted for now | SEC-001, SEC-002, SEC-004 open; SEC-003 resolved |
| [DASHBOARD_AUDIT.md](./DASHBOARD_AUDIT.md) | Dashboard data-integrity audit (June 2026) | Historical: all fixed, two Low items deferred |
| [SUPPLIER_UNIFICATION_PLAN.md](./SUPPLIER_UNIFICATION_PLAN.md) | Plan to merge the three vendor tables into one (June 2026) | Never started |

Backlog-like docs that stay with their feature, because other docs and checklists point at them:

- [../erp-integration/KNOWN_ISSUES.md](../erp-integration/KNOWN_ISSUES.md),
  [OPEN_QUESTIONS.md](../erp-integration/OPEN_QUESTIONS.md) and
  [PROGRESS.md](../erp-integration/PROGRESS.md) — the ERP integration, on hold.
- [../test/11-pre-merge-ui-audit.md](../test/11-pre-merge-ui-audit.md) — the manual pass over the
  UI-audit changes.
- `docs/voice/open-questions.md` and `docs/voice/phase0-freeze-checklist.md` — on
  `feature/voice-assistant` only.

## Open work, ranked

Ranked by what goes wrong if it is left, then by how small the job is. Ids are the ones used in
the source docs.

### 1. Do first: fixes that are written but not live

| # | Task | Why it ranks here | Source |
|---|---|---|---|
| 1 | **Apply the twelve pending migrations and merge `fix/backlog-batch-2`.** Three from the UI audit (`20260915120000`, `20260916100000`, `20260917100000`), five from `fix/defect-backlog` (`20260930100000`–`100400`), four from batch 2 (`20261001100000`–`100300`). | The docs record them as not applied. Until they are, the fixed High items are not fixed in production: `public.users` readable without login (SEC-A1), any user able to create a Director row (SEC-A2), `get_filtered_invoices` bypassing invoice RLS, `company_statistics` bypassing RLS (SEC-A11). Confirm against each database before relying on this. | DEFECT_BACKLOG §1, UI_AUDIT §1, KNOWN_ISSUES §2 |
| 2 | **Walk the pre-merge sheet.** 80 unticked checks, over a dozen marked blocker. Steps 0.4 and 0.5 must follow the migrations directly. | These changes have never been clicked through by a person. | test/11 |
| 3 | **Check bank accounts already wiped** by the opening-balance and company-save bugs, using the query at the end of migration `20260930100300`. | The code fix stops new damage; it does not repair balances that were already reset. | CASH-1, CASH-16 |
| 4 | **Runtime-check TIC saves** (first save, and a save as Accounting and Investment) once `20260930100400` is on dev. | The fix was made by reading the code and has not been tried. | FUND-2 |

### 2. Open defects that need code or a decision

| # | Task | Why it ranks here | Source |
|---|---|---|---|
| 5 | **Lock down document file storage.** Any signed-in user can delete or overwrite any file in the `documents` and `contract-documents` buckets. Mirror the table rule in the `storage.objects` policies. | The only open Medium security defect; data loss with no trace. One migration. | SEC-A12 |
| 6 | **Decide the cesija-from-credit sign with accounting**, then fix it and run drift check 2 from `20260917100000`. | One of two triggers has the wrong sign, so allocation usage is wrong for every such payment. Blocked on a decision, not on code. | CASH-6 |
| 7 | **One definition of the package total** (list price vs `sale_price`) across the Sales screens. | The same apartment still shows different totals and remaining amounts per screen. | SALES-6 |
| 8 | **Decide what the Investment role is for**, then make `canManagePayments` and the `accounting_payments` policy agree. | Investment users see a payment UI over rows RLS will not return, so paid contracts read as never paid. | SEC-004, SEC-A10, FUND-15 |
| 9 | **Scope `contracts` reads by project.** | Every signed-in user can read `budget_realized`, so the Supervision payment gate is screen-only. Touches the most-read table; needs its own test pass. | SEC-004 |
| 10 | **Fix AI rate-limit counting.** Tool results count as user messages, the check fails open and can be raced. | Deferred to the voice branch, where it is OQ-3. Do it there. | COLLAB-4 |
| 11 | **Add a sale cancellation flow.** | A reverted sale counts in dashboards and reports for ever. Filed Low, but it distorts figures. | SALES-10 |

### 3. Larger work, schedule deliberately

| # | Task | Size and note | Source |
|---|---|---|---|
| 12 | **Server-side Cashflow unlock** (edge function, JWT claim, RLS reads the claim). | ~15 policies on 11 tables. Accepted risk; needs its own design review. | SEC-001 |
| 13 | **Supervision on phones:** non-wrapping header rows, hover-only actions, the 1400px invoice table, Calendar opening on the month view. | Supervision is used on site, on phones. | UI_AUDIT §4.8 |
| 14 | **Remaining silent failures:** ~39 inline loaders in 33 components, 12 `.catch(() => [])` fallbacks, full-page spinner on refetch on 9 Cashflow pages. | A failed load still reads as "no data" on these screens. | UI_AUDIT §4.4 |
| 15 | **Status colours and labels inside Cashflow**, and the ~16 Croatian literal maps in `invoiceHelpers` / `paymentHelpers`. | Shared maps exist for the other domains. | UI_AUDIT §4.3 |
| 16 | **Money formatting sweep:** ~256 hand-rolled `toLocaleString('hr-HR')` renders in 68 files. | Mechanical; the helpers exist. | UI_AUDIT §4.1 |
| 17 | **Dark-mode contrast:** 441 lines with a `-600` accent and no dark variant. | Mechanical. | UI_AUDIT §4.9 |
| 18 | **Hand-rolled primitives:** ~60 KPI tiles, ~12 raw tables, 6 dashboard headers, 4 modal-footer styles. | Consistency, no wrong data. | UI_AUDIT §4.7 |
| 19 | **Hardcoded strings:** ~93 Croatian literals, ~420 in the export generators; PDFs ignore the UI language. | Follow the i18n rules in CLAUDE.md (ask before translating). | UI_AUDIT §4.5 |
| 20 | **Dates in exports:** the three PDF generators, CSV headers, `DateInput`'s third format, 59 native date inputs. | Screens are done. | UI_AUDIT §4.2 |
| 21 | **Team calendar overlay.** Ticking a teammate draws nothing and the hours figure is wrong; `get_busy_blocks` ignores recurrence and RSVPs. | Needs a migration. | UI_AUDIT §5, COLLAB-9 |
| 22 | **Supplier table unification.** | No `suppliers` table exists in any migration. Decide whether it is still wanted before the ERP work resumes, since ERP partner mapping targets the same three tables. | SUPPLIER_UNIFICATION_PLAN |

### 4. Small and low-risk, pick up when nearby

- **TIC Excel export drops phases**, so export then import returns an unphased TIC. The sheet
  layout is frozen, so the importer must be re-checked. (FUND-13, UI_AUDIT §5)
- **Names instead of UUID fragments** in Documents and the Activity Log. (UI_AUDIT §5)
- **Unique constraint on unit numbers.** (SALES-9)
- **Customers module** keeps one garage and one storage per apartment and uses list prices. (SALES-8)
- **Client and SQL disagree on project access.** (AUTH-4)
- **Loans:** no check that source and target differ or that the source has the balance. (CASH-9)
- **"Disbursed to account" without an account** gives a generic error. (FUND-6)
- **Equity form drops** `percentage_stake`, `notes` and custom schedules. (FUND-7)
- **Funding register and allocation lists** filter oddly and do not reconcile. (FUND-9, FUND-10, FUND-12)
- **Budget not gated on the TIC** in three places; Budget Control chart and scope; EV follows
  payments; Director and Sales dashboards define sales differently; Supervision dashboard "paid"
  uses invoice `paid_amount`. (GEN-5, GEN-7, GEN-8, GEN-9, GEN-10)
- **By-classification view** has no add or budget buttons. (SUP-5)
- **Financing is stored on the company**, not the contract. (SUP-7)
- **Dead code:** Supervision helpers, `BankCreditFormModal`, `check_subcontractor_budget_integrity()`,
  `update_overdue_notifications()`. (SUP-11, CASH-15, FUND-14)
- **Chat:** only the latest 50 messages, no edit, delete or member management. (COLLAB-6)
- **@mentions in task comments notify nobody.** (COLLAB-7)
- **Document categories:** seed data not in the repo; no Uncategorized filter node. (COLLAB-8, COLLAB-3)
- **Calendar reminders are parked.** Before turning them back on: shared-secret auth on
  `dispatch-calendar-reminders`, a pg_cron job, skip declined invitees. (SEC-A9, COLLAB-1)
- **Cashflow profile selectable when the password is unset.** (SEC-002)
- **Shared library:** `Alert` ignores `onClose`, `StatCard` ignores `trend`, `DateInput` min/max. (UI_AUDIT §4.6)
- **Dashboard leftovers:** Retail per-customer denominator, Supervision `999` deadline sentinel. (DASH-505, DASH-605)
- **Docs:** the "138 actions across 11 categories" total in ACTIVITY_LOG.md is probably stale;
  document that VAT rates are fixed per slot. (DEFECT_BACKLOG §10, CASH-14)

### 5. Parked with their feature

Not ranked against the rest; each waits on its feature being picked up.

**ERP integration (on hold since 2026-09-14).**
- Before resuming: fix ERP-1 to ERP-5. One bank invoice or one storno fails a whole import run,
  the Komitenti tab does not work against the migrated schema, and no BANK payment resolves.
- Before the historical import: ERP-6 to ERP-9.
- Decisions: Q14 (do buyer payments come from the ERP — marked blocking), Q17 (double counting in
  the derived balance), Q18 (bank accounts from the feed), Q15, Q16, Q20, and the accounting
  questions Q4, Q5–Q8, Q10, Q13.
- CASH-10, CASH-11, CASH-13 and CASH-15 become moot or turn into ERP work in phase 5.

**Voice assistant (`feature/voice-assistant`).**
- The phase 0 freeze checklist is out of date: all 160 script rows are `frozen` since commit
  `022dcc3d`, but its six boxes are unticked and the stash it mentions still exists. Tick it off
  and drop or apply the stash.
- Next: record phase 0 and take the go/no-go.
- Phase 2 carries the decided fixes for OQ-1 (a stop during a tool call breaks the branch) and
  OQ-2 (no tool says whether a TIC exists). OQ-3 to OQ-9 are open; OQ-6 is with the team as a
  chat bug.
- Ten team questions are open in the implementation plan (§11), among them Vapi or Retell,
  recording, cost ceiling and whether finance data may go over the phone.
