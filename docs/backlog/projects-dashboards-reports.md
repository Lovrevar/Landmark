# Backlog — projects, dashboards and reports

The General module (projects, milestones, Budget Control / EVM, activity log), the per-profile
dashboards and the PDF/Excel reports. Ids: `GEN-n` (next free: `GEN-18`). Entry format and rules
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
