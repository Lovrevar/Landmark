# Pre-merge check — the UI audit batches

> Everything on this list changed on `development` during the UI-audit work and **has never been
> clicked through by a person**. Unit tests, e2e and a browser check cover some of it, but most of
> these are "does this screen now say something true", which only a human with real data can judge.
>
> Work top-to-bottom; it is grouped so you can stay in one profile at a time. Anything marked
> **⚠ blocker** should pass before the merge; the rest can be noted and fixed afterwards.

**Build/env:** ______________  **Date:** ______________  **Tester:** ______________

---

## 0. Before you touch the app

Three migrations are written but not applied everywhere. They must go to prod **with** this merge,
in this order, or several screens will be wrong or broken.

| # | Step | Expected | ✓ | Notes |
|---|---|---|---|---|
| 0.1 | Confirm `20260915120000_invoice_list_server_sort.sql` is on dev | Already applied by you | ☐ | |
| 0.2 | Apply `20260916100000_lock_down_finance_definer_functions.sql` to **dev** | Applies cleanly | ☐ | |
| 0.3 | Apply `20260917100000_payment_update_balance_triggers.sql` to **dev** | Applies cleanly | ☐ | |
| 0.4 | ⚠ **After 0.2**, log in as a **Sales** and a **Supervision** user and open any screen that lists invoices | Still works, or fails *visibly* — `get_filtered_invoices` is now Director/Accounting only, so check nothing silently shows an empty list | ☐ | |
| 0.5 | ⚠ **After 0.3**, edit an existing payment's amount, then its bank account | The bank balance and the credit allocation both follow the edit (before, only insert and delete were handled) | ☐ | |
| 0.6 | Plan the prod run: 0.1 → 0.2 → 0.3, same order | — | ☐ | |

---

## 1. ⚠ The payment gate (Supervision + Sales)

The biggest behaviour change in the batch. `canManagePayments` now hides every payment-derived
figure, not just the summary banner. **A Playwright check confirms no paid figure renders for a
Supervision user, but not that the screens still make sense.**

| # | Step | Expected | ✓ | Notes |
|---|---|---|---|---|
| 1.1 | Log in as a **Supervision** user → Site Management | Menu shows only Site Management, Work Logs, Documents | ☐ | |
| 1.2 | Look at the project cards | Budget, subcontractor counts and timeline are there; no "paid out", no paid bar segment, no red overdue badge | ☐ | |
| 1.3 | Open a project → phases → a contract card | Contract amount and deadline visible; no paid / remaining / overrun rows, no status badge, no card tint, no Invoices button | ☐ | |
| 1.4 | ⚠ Check a contract whose deadline has passed | The deadline is **still red** (falls back to "past due" on the date alone) | ☐ | |
| 1.5 | Look at any tile grid where figures were removed | Grids look intentional, not half-empty or ragged | ☐ | |
| 1.6 | Open the subcontractor details modal and the edit modal | No payment block, no paid tiles, no payment-derived badge | ☐ | |
| 1.7 | Open the milestones modal | Scrolls properly (it is inside the modal body now); no Paid column or totals | ☐ | |
| 1.8 | ⚠ Confirm a site manager can still do their job | Work logs, documents, contracts, milestones, phases all still usable | ☐ | |
| 1.9 | Log in as **Director** and repeat 1.1–1.3 | Everything is still visible, exactly as before | ☐ | |
| 1.10 | Log in as **Accounting**, then **Investment** | Both still see payment figures | ☐ | |

> Known gap, deliberate: an `Investment` user sees the paid UI but RLS gives them no
> `accounting_payments` rows, so the payment-history modal is empty. Written up as SEC-004.

---

## 2. ⚠ Dates, deadlines and "overdue"

"Overdue" had three definitions and is now one. The bugs were: overdue from 01:00 **on** the due
day, "Kasni za 0 dana", and every contract **without** an end date counting as overdue.

| # | Step | Expected | ✓ | Notes |
|---|---|---|---|---|
| 2.1 | ⚠ Find (or set) a contract whose deadline is **today** | Not overdue, no red, no "0 dana" | ☐ | |
| 2.2 | A contract with **no** end date | Not overdue, and not in the project's overdue count | ☐ | |
| 2.3 | A contract whose deadline passed yesterday | Overdue, and the day count reads 1 | ☐ | |
| 2.4 | A project **In Progress** past its end date | Reads as overdue in red — **not** a green "Completed" | ☐ | |
| 2.5 | A project whose status **is** Completed, past its end date | Reads "Završeno"; no "N days overdue" | ☐ | |
| 2.6 | A project one day before its end date | Reads "1 day left", not "Overdue" | ☐ | |
| 2.7 | Project card with no TIC | Budget reads "Budget not set" instead of a leftover number | ☐ | |
| 2.8 | Project card where spending exceeds budget | "Remaining" is red | ☐ | |

---

## 3. ⚠ Money figures that were wrong

These are the ones worth checking against a number you can verify independently.

| # | Step | Expected | ✓ | Notes |
|---|---|---|---|---|
| 3.1 | ⚠ Retail profile → dashboard, and the **Retail PDF report** side by side | Costs and Profit **agree between the two**. Costs = land + development + construction paid; Profit = collected − costs | ☐ | |
| 3.2 | Retail dashboard "Investirano" | Development + construction only, and its subtitle says *without* VAT | ☐ | |
| 3.3 | Retail dashboard late-payments list | Only customer invoices. A late **supplier** invoice must not appear as something to collect | ☐ | |
| 3.4 | ⚠ A **fully repaid** credit (Cashflow → Banks, and Funding → Investments) | "Dug €0,00" in neutral, not red | ☐ | |
| 3.5 | A credit with debt outstanding | "Dug" red, and the figure matches the DB `outstanding_balance` | ☐ | |
| 3.6 | A credit allocated beyond its facility (or paid out beyond it) | "Nealocirano" shows a **negative** figure in red, and the over-commitment warning appears | ☐ | |
| 3.7 | Compare the two credit screens for the same credit | Banks and Investments show identical tiles (they share one component now) | ☐ | |
| 3.8 | ⚠ A subcontractor milestone that has been fully paid | Reads as paid — at 25% VAT it used to stick at ~80% "Partial" | ☐ | |
| 3.9 | A contract with nothing paid | **No** "Dobit/Gubitak" row (only "Preostalo") | ☐ | |
| 3.10 | A contract paid beyond its value | A red overrun row, and the details modal agrees with the card (gross vs gross) | ☐ | |
| 3.11 | Funding → Payments: a drawdown and a repayment | One reads PRIHOD green, the other RASHOD red; the in / out / net cards add up | ☐ | |
| 3.12 | Cashflow → Payments: apply a filter (date or type) | ⚠ The stat cards **change with the filter**; in + out reconcile to the table below | ☐ | |
| 3.13 | Cashflow → Payments: an expense row | The amount is red, matching the RASHOD label beside it | ☐ | |

---

## 4. Dashboards

| # | Step | Expected | ✓ | Notes |
|---|---|---|---|---|
| 4.1 | Sales dashboard | No €5M target bar; "collected this month" is a plain figure | ☐ | |
| 4.2 | ⚠ Director dashboard → the overdue card | Counts **unpaid** payment milestones and is labelled as milestones, not tasks. Cross-check one against the data | ☐ | |
| 4.3 | Director dashboard → alerts panel | Fully Croatian (it was entirely English) | ☐ | |
| 4.4 | Cashflow dashboard → monthly trends | A small month's bars are visibly shorter than a big month's; every € label readable, none clipped | ☐ | |
| 4.5 | Cashflow dashboard at phone width | The row wraps instead of overflowing | ☐ | |
| 4.6 | Supervision dashboard → week view | Each work log shows a **status badge**; the stripe colour matches the status; date pill is neutral grey | ☐ | |
| 4.7 | Any dashboard, utilisation bars | One colour scale everywhere; the percentage text and its bar never disagree | ☐ | |

---

## 5. Failed loads and failed saves

Easiest with devtools set to **Offline**, or by blocking the Supabase host.

| # | Step | Expected | ✓ | Notes |
|---|---|---|---|---|
| 5.1 | ⚠ Calendar, go offline, change month | An error with a retry above the grid — **not** an empty month. Toolbar, filters and sidebar stay | ☐ | |
| 5.2 | Retry once back online | The events appear | ☐ | |
| 5.3 | ⚠ Offline, open the new-task form | The project field says it could not load and is disabled — it must **not** read "Bez projekta" and then save a project | ☐ | |
| 5.4 | Offline, open a task with attachments | Says the attachments could not be read; upload is blocked (the count is unknown) | ☐ | |
| 5.5 | Offline: Debt Status, Approvals, invoice register, activity log | Each says it failed and offers a retry; **no stat card reads €0** | ☐ | |
| 5.6 | Delete something another session already deleted | The dialog stays open and explains itself | ☐ | |
| 5.7 | Any bulk price update that partly fails | Reports "n of m", and the table refreshes for the rows that did change | ☐ | |

---

## 6. Tasks and calendar

| # | Step | Expected | ✓ | Notes |
|---|---|---|---|---|
| 6.1 | Calendar → month view with coloured tasks | Task pills are **tinted** with the task colour | ☐ | |
| 6.2 | An overdue task on the calendar | A warning icon, not a red left border; the only red left border in a cell is a deadline event | ☐ | |
| 6.3 | A day with 3 events and tasks | Nothing spills outside the cell; "+N more" counts what is hidden, and clicking it opens the day | ☐ | |
| 6.4 | Click an empty spot in a month cell | The new-event dialog opens (a transparent layer used to swallow this) | ☐ | |
| 6.5 | Reminder events across month / week / agenda / filter chips | The same colour everywhere (amber) | ☐ | |
| 6.6 | ⚠ Have someone assign you a task while /tasks is open | The blue dot appears and **stays** until you open that task | ☐ | |
| 6.7 | "Označi sve kao pročitano" | Clears the dots and the header badge | ☐ | |
| 6.8 | Hover the three header badges | Each says what it counts (messages / tasks / invitations awaiting a response) | ☐ | |
| 6.9 | Turn off "Prikaži gotove" in a category where everything is done | The tab count drops to 0 and the empty state points at the toggle | ☐ | |

---

## 7. Work logs, approvals, customers

| # | Step | Expected | ✓ | Notes |
|---|---|---|---|---|
| 7.1 | Supervision → Work Logs → new log | **No colour picker** | ☐ | |
| 7.2 | A log with status "Rad završen" | Green stripe **and** green badge — they can no longer contradict | ☐ | |
| 7.3 | Cashflow → Approvals | No green "Odobreno" on every row; status reads "Neplaćeno" in red, not `UNPAID` | ☐ | |
| 7.4 | Invoice status anywhere (Supervision, Retail, Funding modals) | Unpaid red, partial yellow, paid green — the same everywhere | ☐ | |
| 7.5 | Cashflow → Customers → a customer's invoice card | No PRIHOD badge/arrow/border (it was always income); "Preostalo" only red when above €0 | ☐ | |
| 7.6 | Funding → Investors → a credit facility card | "Maturing soon" only for credits actually approaching maturity; a matured one reads as past due; type reads properly, not "LINE OF_CREDIT" | ☐ | |

---

## 8. Croatian wording

About 150 strings were added or changed across the session's batches. Worth a pass while you click,
and three the agents flagged as uncertain:

| # | Step | Expected | ✓ | Notes |
|---|---|---|---|---|
| 8.1 | Funding → a defaulted credit | `funding.credit_status.defaulted` = "U kašnjenju" — alternatives: "Neispunjenje obveza", or keep "Default" | ☐ | |
| 8.2 | Director dashboard overdue card | "Zakašnjele prekretnice plaćanja" — is "prekretnica" the word the business uses? | ☐ | |
| 8.3 | Any picker whose list failed to load | "Naziv nije učitan" — reads oddly in a dropdown; "Naziv nije dostupan"? | ☐ | |
| 8.4 | Retail contract badges (Completed / Cancelled) | Still **English** in the Croatian UI — suggested: "Aktivan / Završen / Otkazan" | ☐ | |
| 8.5 | Anything else that reads wrong | Note the screen and the text | ☐ | |

---

## 9. Known and deliberate — do not report these as new

- **English month names** ("Jan 05, 2026") across many screens: the next batch.
- **Team calendars** (calendar sidebar): ticking a teammate only feeds an hours figure and draws
  nothing on the grid. The hours are a rough lower bound — recurring events are not expanded.
  Deferred; a real overlay needs a migration.
- **Documents and the Activity Log** show an ID fragment instead of a name for units, customers and
  companies. Deferred.
- **Retail dashboard now includes `Cancelled` contracts**, because the Retail report does and the
  point was for the two to agree. Say so if you would rather exclude them.
- `INCOMING_INVESTMENT` counts as money **out** in the payment screens and the DB trigger, but as
  **in** on the accounting dashboard. Pre-existing disagreement, documented, untouched.
- About 255 amounts still render with ragged decimals, and ~440 coloured accents still have no
  dark-mode variant. Both are known sweeps.

---

## 10. Sign-off

| Area | Result | Notes |
|---|---|---|
| 0. Migrations | ☐ pass ☐ issues | |
| 1. Payment gate | ☐ pass ☐ issues | |
| 2. Dates and overdue | ☐ pass ☐ issues | |
| 3. Money figures | ☐ pass ☐ issues | |
| 4. Dashboards | ☐ pass ☐ issues | |
| 5. Failed loads/saves | ☐ pass ☐ issues | |
| 6. Tasks and calendar | ☐ pass ☐ issues | |
| 7. Work logs / approvals / customers | ☐ pass ☐ issues | |
| 8. Croatian wording | ☐ pass ☐ issues | |
