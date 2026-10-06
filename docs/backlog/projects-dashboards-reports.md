# Backlog — projects, dashboards and reports

The General module (projects, milestones, Budget Control / EVM, activity log), the per-profile
dashboards and the PDF/Excel reports. Ids: `GEN-n` (next free: `GEN-20`). Entry format and rules
are in [README.md](./README.md).

## Open

### GEN-5 · Low · Budget not gated on the TIC in three places
- Director dashboard portfolio table, Investment dashboard portfolio value and PDF, Sales report.
  A project without a TIC shows a €0 budget instead of "no budget set".

### GEN-9 · Low · Director and Sales dashboards define sales differently
- Director counts apartments only and uses contracted sale value; Sales counts all unit types and
  uses cash collected. Needs one definition, or labels that say which is which.

### GEN-10 · Low · Supervision dashboard "paid" uses invoice `paid_amount`
- Contrary to the rule that `contracts.budget_realized` is the only paid figure.

### GEN-7 · Low · Budget Control chart and scope
- The forecast bar is drawn in red when the forecast is suppressed; contracts without a phase
  count in Committed and Paid but not in EV and AC.

### GEN-8 · Low · EVM "physical" progress is payment-driven in practice
- Milestone statuses feeding EV are set by the payment trigger, so EV is not independent of AC.
  The code comment claims otherwise.

### GEN-15 · Low · Supervision dashboard display polish (was DASH-605)
- **Where:** `src/components/dashboards/services/supervisionService.ts`.
- `999` is still the sentinel for "no deadline" (prefer `null`). Re-check the other two points
  from the June audit: unrounded `progress`, and the week view showing and ordering by
  `created_at` instead of the work `date`.

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
- **What happens:** both appear whatever organisation the instance belongs to.
- **Fix direction:** one configurable organisation name used by both and by the other report
  generators that print it.
