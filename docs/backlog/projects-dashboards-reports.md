# Backlog — projects, dashboards and reports

The General module (projects, milestones, Budget Control / EVM, activity log), the per-profile
dashboards and the PDF/Excel reports. Ids: `GEN-n` (next free: `GEN-23`). Entry format and rules
are in [README.md](./README.md).

## Open

### GEN-22 · Medium · With an unphased TIC and several phases, Budget Control credits the whole budget to phase 1
- **Check:** Confirmed by code reading and on LandmarkDemo ("Rezidencija Jarun", 2026-10-12); the figures on screen match the arithmetic below exactly. Not checked against production: it applies to any project whose TIC has no phase columns but which has more than one phase with contracts.
- **Where:** `sync_project_from_tic` (`20260909140000_tic_sole_budget_source.sql`, "Unphased TIC: one phase holds the whole plan") puts the full budget on phase 1 and 0 on the others; `calculateProjectEVM` (`src/utils/evm.ts`) earns value per phase as `budget_allocated × physical %`.
- **What happens:** earned value is the whole project budget times phase 1's completion, while cost is what was paid in every phase. On the demo: phase 1 is complete and holds €8,5M, so EV = €8,5M against €3,32M paid across four phases. CPI = 2,56 ("healthy"), and EAC = budget / CPI comes out equal to the amount paid so far (€3.318.750,00, "Ispod proračuna") on a project with €5,7M already contracted. Once phase 1 is complete the forecast always equals paid-to-date. The phase list shows the same split: "Plaćeno €335.000 / €8.500.000" on phase 1 and "Budžet nije postavljen" on the rest.
- **Fix direction:** when no phase beyond the first has a budget, compute EVM at project level (project budget × contract-weighted physical % over all contracts) instead of summing per phase; or have the trigger leave every phase at 0 for an unphased TIC so the screens say "nije fazirano". The first is client-only. The unreadable top axis label that drew attention to this is GEN-7.

### GEN-21 · Low · Projects list shows a failed load as an Alert in the content area
- **Where:** `General/Projects/index.tsx:117`.
- **Fix direction:** `ErrorState` with `refetch`. Part of UI-4 in [ui.md](./ui.md).

### GEN-7 · Low · Budget Control chart and scope
- The forecast bar is drawn in red when the forecast is suppressed; contracts without a phase
  count in Committed and Paid but not in EV and AC.
- The indices chart prints an unrounded number as its top axis label when CPI is above 2
  (seen 2026-10-07 on the demo: "…527306968").

### GEN-8 · Low · EVM "physical" progress is payment-driven in practice
- Milestone statuses feeding EV are set by the payment trigger, so EV is not independent of AC.
  The code comment claims otherwise.

### GEN-16 · Low · Activity Log shows raw entity keys and ID fragments
- Every entity type shows its key and a UUID fragment instead of a name. Same problem in
  Documents (COLLAB-11 in [collaboration.md](./collaboration.md)).

### GEN-17 · Low · Action total in ACTIVITY_LOG.md is probably stale
- [../ACTIVITY_LOG.md](../ACTIVITY_LOG.md) says "138 discrete actions across 11 categories".
  Recount against `ACTION_CATEGORIES`.

### GEN-18 · Low · General report PDF: trend chart filled black, labels touch the next heading
- **Check:** Seen in the guidance visual check ([../screenshots/guidance-phase-1/README.md](../screenshots/guidance-phase-1/README.md), finding 10).
- **Where:** `drawLineChart(…, { fillArea: true })` on the cash-flow trend page of
  `Reports/pdf/generalReportPdf.ts`.
- **What happens:** the area under the line renders almost black instead of a light tint, and the
  chart's month labels sit directly on the "ANALIZA NOVČANOG TOKA" heading below it.
- **Fix direction:** a light solid fill instead of relying on alpha; a few millimetres more after
  the chart.

### GEN-19 · Low · Company name is hardcoded
- **Check:** Seen in the same check, on the demo instance (finding 11).
- **Where:** "LANDMARK GROUP" in the General report's on-screen header and every PDF page footer;
  "Financijski pregled svih firmi pod Landmarkom" under Cashflow → Moje firme.
  Every occurrence (2026-10-12): `reports.general.landmark_group` in both locale files, used by
  `Reports/GeneralReports.tsx`, `pdf/generalReportPdf.ts` and `pdf/salesReportPdf.ts`; the literal
  `'LANDMARK'` on the General report PDF cover (`generalReportPdf.ts:150`), which no locale key
  covers; `companies.subtitle` in both locale files; and the placeholder "npr. Landmark d.o.o."
  in `Companies/forms/CompanyFormModal.tsx`.
- **What happens:** both appear whatever organisation the instance belongs to.
- **Fix direction:** one configurable organisation name used by both and by the other report
  generators that print it.

## Resolved

### GEN-15 · Low · Supervision dashboard display polish (was DASH-605)
- Closed on `fix/backlog-batch-3` (2026-10-08): "no deadline" is `null`, tested in `dashboards/utils/supervisionDeadlines.ts`.
  The other two points from the June audit were already fixed: progress is rounded, and the week
  view shows and orders by the work `date`.

### GEN-10 · Low · Supervision dashboard "paid" uses invoice `paid_amount`
- Fixed on `fix/backlog-small-batch` (2026-10-08): contract progress reads `contracts.budget_realized` only; the invoice
  query is gone.

### GEN-5 · Low · Budget not gated on the TIC in three places
- Fixed on `fix/figures-and-tic-export` (2026-10-08): `budgetIsSet` / `fetchBudgetedProjectIds`; the Director table, the
  Investment dashboard's portfolio value and PDF, and the Sales report say "Budžet nije postavljen".

### GEN-9 · Low · Director and Sales dashboards define sales differently
- Decided 2026-10-08 to keep both figures and name them: the Director dashboard says
  "Prodani stanovi" and "Ugovorena prodaja", the Sales dashboard "Naplaćeno od prodaje" and
  "Stopa prodaje (sve jedinice)". Done on `fix/figures-and-tic-export` (2026-10-08).

### GEN-20 · Medium · Budget Control reports healthy CPI and SPI when there is nothing to measure
- Fixed on `fix/audit-medium-findings` (2026-10-07): `calculateProjectEVM` returns `costAvailable`, and until something is
  paid CPI, EAC and VAC show "—" with "Još nema plaćenih troškova". The SPI half of the report
  was wrong: `scheduleAvailable` already covered it.
