# Backlog — projects, dashboards and reports

The General module (projects, milestones, Budget Control / EVM, activity log), the per-profile
dashboards and the PDF/Excel reports. Ids: `GEN-n` (next free: `GEN-45`). Entry format and rules
are in [README.md](./README.md).

## Open

The General report entries GEN-26 to GEN-37 were found while pinning
`Reports/services/generalReportService.ts` with characterization tests (`src/components/Reports/services/generalReportService.test.ts`,
2026-10-21). Each figure is pinned as it is, so a fix changes that test's expectation in the
fix's own commit, with a test named after the id that fails first.

GEN-42 (now resolved) to GEN-44 were found while planning Step 7 item 2 (2026-10-21) and are pinned by the
characterization tests of the Director and Sales dashboards and the Sales report.

### GEN-43 · Medium · Director and Sales dashboards, the Sales report and Sales payments read without paging past 1000 rows
- **Check:** Code reading (Step 7 item 2 planning, 2026-10-21). The General report's version is
  GEN-35
- **Where:**
  - `dashboards/services/directorService.ts`: apartments, contracts, invoices, payments, sales,
    credits, milestones.
  - `dashboards/services/salesDashboardService.ts`: every read, payments included.
  - `Reports/services/salesReportService.ts`: the customer report's customers and sales.
  - `Sales/Payments/services/salesPaymentsService.ts`: invoices and payments.
  - `Sales/SalesProjects/services/salesService.ts`: `fetchActualTotalPaidByApartment`, and an
    `.in()` with every sold apartment's id in the URL.
  - `General/Projects/services/projectDetailsService.ts`: one project's sales (added by Step 7
    item 2; a project rarely has 1000 sales).
- **What happens:** PostgREST returns at most 1000 rows without saying so. Past that, collected
  from sales, contracted sales, expenses and the unit counts all go silently low.
- **Fix direction:** `fetchAllRows` with a stable order on the tables that can grow, as for
  GEN-35. Check production counts first.

### GEN-44 · Low · Director "Novčani tok (mjesec)" counts only what customers paid
- **Check:** Code reading (Step 7 item 2 planning, 2026-10-21)
- **Where:** `dashboards/services/directorService.ts` `deriveFinancial`,
  `cash_flow_current_month`: payments this month on `invoice_category === 'CUSTOMER'` invoices
- **What happens:** the tile is labelled cash flow, but it is one side of it: what came in from
  customers. No money out, and no other money in. The Accounting dashboard and the General report
  each compute a real monthly cash flow (`cashFlowFigures`).
- **Fix direction:** decide what the tile is for. Either show the month from `monthlyCashFlow`, or
  call it "Naplaćeno od kupaca (mjesec)".

### GEN-27 · Medium · General report: per-project debt and equity still use the definitions GEN-2 replaced
- **Check:** Confirmed (pinned in `src/components/Reports/services/generalReportService.test.ts`)
- **Where:** `generalReportService.ts`, `projects[].equity` / `.debt`. Shown on screen as
  `reports.general.funding_value`
- **What happens:** equity is Σ credit allocations, debt and equity alike, and debt is the face value
  of every credit of the project, equity and repaid ones included. GEN-2 changed the portfolio
  figures to equity facilities and outstanding live debt, and the per-project ones were left behind.
  In the test, a project with €580k outstanding shows €1.4M of debt.
- **Fix direction:** the per-project figures on the portfolio's definitions, from the shared funding
  function.

### GEN-28 · Medium · General report retail section: two figures always 0, contract totals mix buyers and suppliers
- **Check:** Confirmed (schema CHECKs; pinned in `src/components/Reports/services/generalReportService.test.ts`)
- **Where:** `generalReportService.ts`, `retail_portfolio`
- **What happens:** "active retail projects" tests `status = 'active'` and "completed retail phases"
  tests `'completed'`. The tables allow `Planning | In Progress | Completed | On Hold` and
  `Pending | In Progress | Completed`, so both always read 0. Contract value and realised sum every
  `retail_contracts` row, buyers' contracts with suppliers', which is the bug
  `dashboards/utils/retailTotals.ts` was written to fix on the dashboard.
- **Fix direction:** the statuses the Retail screens use (`'In Progress'`, `'Completed'`), and costs
  and sales split by phase as `computeRetailTotals` does.

### GEN-29 · Low · General report counts only cesija paid from a credit
- **Check:** Confirmed (pinned in `src/components/Reports/services/generalReportService.test.ts`)
- **Where:** `generalReportService.ts`, `company_credits.cesija_payments` / `cesija_value`
- **What happens:** it filters on `cesija_credit_id`, which is set only when the cesija is paid from
  a credit. A cesija paid from another company's bank account is left out. `company_statistics`
  counts `is_cesija = true`. ERP payments never set `cesija_credit_*`, so after the ERP phase 5
  the figure would be 0.
- **Fix direction:** `is_cesija`. Decide whether the card is meant to show "cesija" or
  "cesija from a credit", since it sits under the company investments heading.

### GEN-30 · Low · General report TIC summary counts TIC rows that belong to no project
- **Check:** Confirmed (pinned in `src/components/Reports/services/generalReportService.test.ts`)
- **Where:** `generalReportService.ts`, `tic_cost_management` (PDF only)
- **What happens:** `total_tic_budget` and `projects_with_tic` include TIC rows with no
  `project_id`, while `portfolio_value` and `has_budget` skip them. "Projects without a plan" is
  projects minus TIC rows, so it undercounts. It can go negative, and two TICs on one project would
  count twice.
- **Fix direction:** count distinct projects whose TIC total is above 0, from the same per-project
  map as `portfolio_value`.

### GEN-31 · Low · General report screen shows "NaN%" units sold when there are no units
- **Check:** Code reading
- **Where:** `Reports/GeneralReports.tsx:201`, the "Units sold" line of the sales block
- **What happens:** the screen divides `units_sold / total_units` itself, with no zero guard, next
  to `kpis.sales_rate`, which already holds the same figure guarded. The PDF had the same
  re-derivation with a guard.
- **Fix direction:** render `kpis.sales_rate`.

### GEN-32 · Low · General report shows 0 for ratios it cannot measure, and calls every unit-less project high risk
- **Check:** Confirmed (pinned in `src/components/Reports/services/generalReportService.test.ts`)
- **Where:** `generalReportService.ts`: profit margin, ROI, D/E, conversion, payment completion,
  budget utilisation, and `risk_level`
- **What happens:**
  - With no revenue, equity, customers, invoices or contracts, the ratio is printed as 0 %, which
    reads as a measurement (rules/testing.md, "1 by construction").
  - A project with no units has a 0 % sales rate, so a project still in planning is "High" risk.
  - The PDF colours project bars by margin at 20 / 10 while the risk level uses 15 / 0.
- **Fix direction:** availability flags and "—", as GEN-20 did for EVM, and no sales-rate risk
  for a project without units.

### GEN-33 · Low · General report cash-flow table counts payments that move no bank money
- **Check:** Confirmed (pinned in `src/components/Reports/services/generalReportService.test.ts`); **open decision**
- **Where:** `generalReportService.ts`, `cash_flow`. `docs/REPORTS.md` says it reconciles with
  the bank balance
- **What happens:** every payment counts, whatever its `payment_source_type`: kompenzacija (a debt
  offset, no cash), payments from a credit, and cash. `recalc_company_bank_account_balance` counts
  only payments with a `company_bank_account_id`, so the table does not reconcile with the balance
  the way the doc says.
- **Fix direction:** ask accounting whether a kompenzacija belongs in a cash-flow statement. Then
  either filter by source or reword the doc and the screen.

### GEN-35 · Medium · General report reads 28 tables without paging past 1000 rows
- **Check:** Code reading. **Runtime check needed** on production row counts
- **Where:** `generalReportService.ts`, the first `Promise.all`. Also
  `dashboards/services/accountingDashboardService.ts` `fetchMonthlyTrends` (this year's payments)
- **What happens:** PostgREST returns at most 1000 rows without saying so, and none of the reads
  uses `fetchAllRows`. Past 1000 payments or invoices every total is silently low. A payment whose
  invoice is beyond row 1000 has no type, so it drops out of expenses and the cash flow altogether.
- **Fix direction:** `fetchAllRows` with a stable order for the tables that can grow:
  payments, invoices, apartments, work logs, milestones, contracts, customers.

### GEN-36 · Low · General report "office expenses" counts every office-category invoice at its total
- **Check:** Confirmed (pinned in `src/components/Reports/services/generalReportService.test.ts`)
- **Where:** `generalReportService.ts`, `office_expenses`
- **What happens:** it sums `total_amount` of every `invoice_category = 'OFFICE'` invoice, unpaid
  ones and the ones the company *issued* (OUTGOING_OFFICE, money in) included, under the label
  "Total office spent".
- **Fix direction:** paid amounts on cost invoices (`isCostInvoiceType`), or rename it "invoiced".

### GEN-37 · Low · General report computes six fields nothing reads
- **Check:** Confirmed (grep of the screen, the PDF and `src/`)
- **Where:** `generalReportService.ts`: `company_loans.*` (four fields), `executive_summary.portfolio_value`
  and `executive_summary.roi` (copies of `kpis`)
- **What happens:** dead output. The loans section was never rendered.
- **Fix direction:** render the loans or drop them, and drop the two copies.

### GEN-39 · Low · Director dashboard and General report measure expenses differently
- **Check:** Code reading (Step 7 item 1, 2026-10-21)
- **Where:**
  - `dashboards/services/directorService.ts`: portfolio expenses ~286, per-project ~226–240.
  - `src/utils/paymentFigures.ts` `costPaid`, which the General report uses.
- **What happens:** the same cost-invoice rule (`isCostInvoiceType`) is applied to three different
  amounts:
  - General report: Σ payments on cost invoices, portfolio and per project, matched by the
    invoice's `project_id`.
  - Director portfolio: Σ invoices' `paid_amount`. It agrees with payments only while
    `paid_amount` is kept in step.
  - Director per project: **invoiced** `total_amount`, matched by contract and, for invoices with
    no contract, by project.

  So "expenses" and the margin differ between the two screens for the same project.
- **Fix direction:** decide paid against invoiced for each card and name it. Then call `costPaid`,
  or add an invoiced twin of it beside it.

### GEN-40 · Low · Investment dashboard's portfolio value reads `projects.budget`, the General report reads the TIC
- **Check:** Code reading (Step 7 item 1, 2026-10-21)
- **Where:** `dashboards/services/investmentDashboardService.ts` ~74, against `ticTotalsByProject` /
  `portfolioValue` in `src/utils/ticFigures.ts`, which the General report calls
- **What happens:** both count only projects with a TIC (GEN-5). The dashboard sums the
  `projects.budget` the `sync_project_from_tic` trigger writes, and the report sums the TIC itself.
  They agree only while the trigger keeps the column in step with the TIC.
- **Fix direction:** read the TIC totals in the dashboard too, through `ticTotalsByProject`, or
  check on LandmarkDemo and production that the two never differ and say so here.

### GEN-41 · Low · A project's "risk" and "slow sales" are judged on three scales
- **Check:** Code reading (Step 7 item 1, 2026-10-21). The General report's rules are now
  `projectRiskLevel` and `reportRisks` in `src/utils/projectFigures.ts`
- **Where / what happens:**
  - Slow sales: the General report flags a project below **40 %** sold. The Director dashboard's
    `low_sales_rate` alert fires below **30 %** (`dashboards/utils/directorAlerts.ts` ~131). The
    marketing recommendation (General report and Sales report) starts below **50 %**.
  - Risk level: the General report rates a project on sales rate and margin (20 / 50 %, 0 / 15 %).
    The Funding projects list rates the same project on debt ratio, time overrun and
    underfunding (`Funding/Projects/services/investmentService.ts` ~65). Both show a
    "High / Medium / Low" badge.
  - The General PDF colours its top-projects bars at 20 / 10 % margin.
- **Fix direction:** decide whether the two risk badges are meant to differ. If they are, name
  them on screen ("prodajni rizik", "financijski rizik"). Pick one slow-sales threshold.

### GEN-24 · Low · Phased plan with some undated phases overstates SPI
- **Check:** Code reading (convention review of GEN-23, 2026-10-20)
- **Where:** `src/utils/evm.ts` `calculateProjectEVM`, the PV/EV accumulation
- **What happens:** in a phased plan, PV comes only from the dated phases while EV comes from all
  of them, so an undated phase with progress pushes SPI up. The "—" note appears only when no
  phase is dated. Existed before GEN-23.
- **Fix direction:** as for the unphased plan, report the schedule unavailable when any phase with
  a budget is undated, or leave undated phases out of EV for SPI only.

### GEN-25 · Low · Payments without a contract are scaled down when contracts exceed the plan
- **Check:** Code reading (convention review of GEN-23, 2026-10-20)
- **Where:** `src/utils/evm.ts`, `completionBase = max(committed, budget)`
- **What happens:** once a phase's commitments exceed its plan, every row's progress is scaled to
  the plan, including payments to suppliers without a contract, which are meant to count as done
  for what was paid. Plan 100, a 200 contract unpaid, 50 paid without a contract: EV 20, AC 50,
  CPI 0,4. Moot on production while no paid contract has milestones (GEN-8).
- **Fix direction:** add the no-contract rows to EV outside the scaling, or accept and say so in
  `help-kb/term-evm.md`.

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
- Since GEN-23 a contract without milestones no longer counts as measured: CPI and the forecast
  show "—" until a paid contract has milestones. On production on 2026-10-20 only 1 of 59
  contracts with an amount had milestones and none of the 6 paid ones did, so every project shows
  "—". Entering milestones is a process decision for the site team, not code.

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

### GEN-38 · Low · "Sales revenue" and "average price" have six definitions
- Fixed on `refactor/sales-figures` (2026-10-21), Step 7 item 2: one definition of a sale (a
  `sales` row, worth its package) and two named figures, contracted sales and collected, in
  `src/utils/salesFigures.ts` (`docs/SALES.md` → A sale and sales revenue). Every screen in the
  list calls them. The ones that differed changed in their own commits (6e7cf1a1, 92dab90b,
  67f30b0a, ec2ec718, fdda5c8e, c270c4e2, 8311c76b, d604e114) with a LandmarkDemo diff; the
  labels followed in 9c35431c. Tests: the characterization tests of the Director and Sales
  dashboards, both Sales reports, the General report and Project details, whose expectations
  changed in those commits (commented GEN-38), and `contracted sales` in `salesFigures.test.ts`.

### GEN-9 · Low · Director and Sales dashboards define sales differently
- Decided 2026-10-08 to keep both figures and name them. The follow-up, one shared definition
  for each (GEN-38), was done on `refactor/sales-figures` (2026-10-21).

### GEN-34 · Low · Sales report buckets its monthly sales by UTC dates
- Fixed on `refactor/sales-figures` (2026-10-21): the range is parsed with `parseLocalDate` and the
  sales are bucketed with `salesByMonth` (`monthKey`) (f9daf291). Test
  `it('GEN-34: the months hold west of UTC')` in `salesReportService.test.ts`, which runs in New
  York time and failed first.

### GEN-26 · Medium · General report: a project's revenue never includes its linked garages and storage
- Fixed on `refactor/sales-figures` (2026-10-21) with GEN-38's definition: a project's revenue is
  its contracted sales, each at its package value, with the links read from `apartment_garages` /
  `apartment_repositories` (`fetchLinkedPrices`). The portfolio total is the sum of the same sales,
  so the projects add up to it (8311c76b). Pinned in `generalReportService.test.ts` ("projects",
  "sales performance"), which failed before.

### GEN-42 · Low · Sales report: a failed garage or storage price read is not reported
- Fixed on `refactor/sales-figures` (2026-10-21): the report reads the links through the shared
  `fetchLinkedPrices` (`src/lib/linkedUnitPrices.ts`), which pages and throws (3240ae3b). Tests
  `it.each(…)('GEN-42: rejects when the %s read fails')` in `salesReportService.test.ts`, seen
  failing first.

### GEN-23 · Medium · Earned value counted work with no contract as done
- Fixed on `fix/gen-23-evm-uncontracted` (2026-10-20), for phased and unphased plans: completion is
  the contract-weighted progress over the larger of the plan and the committed total, so
  uncontracted work is not started; a row with no contract value counts as done for what was paid;
  `costAvailable` needs a payment on a contract with milestones; an unphased plan has a schedule only
  when every phase is dated. Tests named GEN-23 in `src/utils/evm.test.ts`, seen failing first.

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

### GEN-20 · Medium · Budget Control reports healthy CPI and SPI when there is nothing to measure
- Fixed on `fix/audit-medium-findings` (2026-10-07): `calculateProjectEVM` returns `costAvailable`, and until something is
  paid CPI, EAC and VAC show "—" with "Još nema plaćenih troškova". The SPI half of the report
  was wrong: `scheduleAvailable` already covered it.
