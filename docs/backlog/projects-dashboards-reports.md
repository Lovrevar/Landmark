# Backlog — projects, dashboards and reports

The General module (projects, milestones, Budget Control / EVM, activity log), the per-profile
dashboards and the PDF/Excel reports. Ids: `GEN-n` (next free: `GEN-23`). Entry format and rules
are in [README.md](./README.md).

## Open

### GEN-21 · Low · Projects list shows a failed load as an Alert in the content area
- **Where:** `General/Projects/index.tsx:117`.
- **Fix direction:** `ErrorState` with `refetch`. Part of UI-4 in [ui.md](./ui.md).

### GEN-7 · Low · Budget Control: contracts without a phase are half counted
- Contracts without a phase count in Committed and Paid (`useBudgetControl.ts`) but not in EV
  and AC (`calculateProjectEVM` joins contracts to phases), so CPI leaves them out.
- The other two points once listed here are fixed: the forecast bar is hidden when there is no
  forecast and coloured by VAC (`12840616`), and the indices chart's axis tops out at a round
  value with `formatIndex` ticks instead of printing "…527306968" (`indexAxisTop`, on
  `development` 2026-10-15).

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

## Resolved

### GEN-19 · Low · Company name is hardcoded
- Fixed on `development` (2026-10-15): the name lives in each database, in the one row of
  `organization_settings` (migration `20261015100100`, read by every signed-in user, written only
  with SQL; `src/lib/orgName.ts`). With no name set the General and Sales reports print only
  their titles; the demo seed sets "Adriatic Development". The
  `reports.general.landmark_group` key and the literal cover text are gone, the Companies subtitle
  and the company-name placeholder are neutral, and the help articles no longer name the
  customer. Production needs the migration and its name set before the release (see
  [release.md](./release.md)).

### GEN-22 · Medium · With an unphased TIC and several phases, Budget Control credits the whole budget to phase 1
- Fixed on `feat/user-guidance-phase-3` (2026-10-12): when only one of several phases carries a budget, `calculateProjectEVM` measures the project as one phase from the first start date to the last end date, holding every phase's contracts. Tested in `src/utils/evm.test.ts`. Followed up on `development` (2026-10-15) in migration `20261015100000_unphased_tic_phase_budgets` (written, not applied — see [release.md](./release.md)): the phases of an unphased TIC are NULL rather than the whole plan on phase 1, re-applied by a `project_phases` trigger when phases are added or removed. The client detects that with `budgetNotSplitByPhase` instead of guessing from "one funded phase"; the phase list, Site Management and the AI tool say the budget covers the whole project.

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
