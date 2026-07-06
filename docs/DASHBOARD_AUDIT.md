# Dashboard Data-Integrity Audit

A persistent, in-repo record of misleading-data, calculation, and correctness findings across all six dashboards (`src/components/dashboards/`). Each entry gives a future maintainer enough context to pick the work up cold: what's wrong, why it misleads, and the fix. Filed **2026-06-16** from a full-stack audit (service → types → component → sections), cross-checked against `supabase/migrations/00000000000000_baseline_schema.sql`.

**Status (2026-06-16): the findings below have been FIXED** in a follow-up pass (typecheck/lint/tests/build all green). Cross-cutting infra added: `src/utils/dateOnly.ts` (date-only parsing/bucketing helpers — `parseLocalDate`, `monthKey`, `daysFromToday`, `isValidDate`), an `error` field on `useCachedData`, and a shared `src/components/dashboards/DashboardError.tsx` wired into all six dashboards. Entries are kept for historical context and to document the rationale. A few **Low** items were intentionally deferred (noted inline): Sales hardcoded monthly target (DASH-303, needs a config source), Retail per-customer denominator nuance (DASH-505), Supervision `999` deadline sentinel (DASH-605).

## Format

`## DASH-NNN: <title>` + metadata (`**Severity:**`, `**Dashboard:**`, `**File:**`) + `### What's wrong` / `### Why it misleads` / `### Fix`. Severity: **Critical / High / Medium / Low**.

## Resolved business-intent decisions (2026-06-16)

These were confirmed with the product owner and govern the fixes below:

1. **Sales scope** — the Sales dashboard MUST include all three unit types (`apartments` + `garages` + `repositories`), matching the Sales module's own aggregation. Apartment-only is not acceptable. (DASH-301, DASH-302)
2. **Accounting financing flow** — `INCOMING_INVESTMENT` (investor capital + bank drawdowns) is **incoming cash**, consistent with `src/components/Cashflow/Calendar/hooks/useCalendar.ts`. (DASH-201)
3. **Retail revenue** — "Revenue" is **net of VAT** (`base_amount`), not VAT-inclusive `total_amount`. (DASH-505)

---

## Cross-cutting (affect multiple dashboards)

## DASH-001: Date-only columns parsed as UTC midnight, compared to local "now"

**Severity:** High (aggregate) · **Dashboard:** all · **File:** multiple services

### What's wrong
SQL `date` columns (`due_date`, `maturity_date`, `payment_date`, `sale_date`, `work_logs.date`) are read with `new Date('YYYY-MM-DD')`, which parses as **UTC** midnight, then compared against `new Date()` / `startOfMonth(...)` which are **local**. Croatia is UTC+1/+2.

### Why it misleads
Every time-based metric drifts by a day at boundaries: month buckets, overdue detection, maturity/deadline windows, "this week" counts. A sale on the 1st can drop out of the month; an invoice due today can show as overdue.

### Fix
Add one shared helper (e.g. `parseLocalDate(str)` building `new Date(y, m-1, d)`, or compare on `YYYY-MM`/`YYYY-MM-DD` strings) and use it everywhere a date-only column is compared or bucketed. Affects Director, Accounting (DASH-204), Sales (DASH-303), Investment (DASH-403), Retail (DASH-504), Supervision (DASH-602).

## DASH-002: `replace('_', ' ')` only replaces the first underscore

**Severity:** Low · **Dashboard:** Investment, Sales · **File:** multiple

### What's wrong / Fix
`'line_of_credit'.replace('_',' ')` → `'line of_credit'`. Use `replace(/_/g, ' ')`. Sites: `investmentDashboardService.ts:70`, `InvestmentCreditsTable.tsx:57`, `investmentReportPdf.ts:426`, Sales payment-method formatting in `SalesDashboard.tsx`.

## DASH-003: `useCachedData` swallows fetch errors → silent all-zero dashboards

**Severity:** Critical · **Dashboard:** all (Sales most visible) · **File:** `src/hooks/useCachedData.ts:98-100`, `SalesDashboard.tsx:29-39`

### What's wrong
On any fetch error (RLS denial, network, query bug) the hook logs to console, leaves `data` null, and the dashboard renders its zero-valued defaults with `loading=false`.

### Why it misleads
A broken load is indistinguishable from "this company genuinely has zero sales/revenue." The single most dangerous failure mode for a financial dashboard.

### Fix
Expose the caught error from `useCachedData` and render an explicit "Failed to load" state instead of substituting zeros.

---

## Director dashboard

## DASH-101: Funding section — banks shown as investors, debt shown as investments, debt-service hardcoded to 0

**Severity:** Critical · **File:** `directorService.ts:368-392`, `DirectorDashboard.tsx:143-152`

### What's wrong
- `total_investors` actually counts distinct funded **projects**; displayed under "Investors" is `total_banks` (row count of `banks`).
- "Total Investments" card shows `total_bank_credit` (sum of `bank_credits.amount`) — i.e. **debt**, not equity investment.
- `monthly_debt_service: 0` is hardcoded though `bank_credits.monthly_payment` exists.

### Fix
Rename fields to match reality; source a real investor figure (or remove the card); split credits by `credit_type` (equity vs debt); compute `monthly_debt_service` from `monthly_payment`. Until then, hide the fabricated €0 card.

## DASH-102: Company profit mixes accrual revenue with cash expenses over ALL invoice types

**Severity:** High · **File:** `directorService.ts:266-269`

### What's wrong
Revenue = full `sales.sale_price` (accrual); Expenses = `paid_amount` summed over **every** `invoice_type`, including `OUTGOING_SALES` (customer invoices). Customer payments are subtracted as if they were company costs.

### Fix
Filter expenses to cost types (`INCOMING_SUPPLIER`/`INCOMING_OFFICE`, matching `deriveProjects`) and pick one consistent basis.

## DASH-103: Payables duplicates total debt; receivables counts Reserved list-price, ignores sold-but-unpaid

**Severity:** High · **File:** `directorService.ts:270-280`

### Fix
`outstanding_payables` = Σ(`total_amount − paid_amount`) over unpaid supplier/office invoices. `outstanding_receivables` = Σ(`total_amount − paid_amount`) over unpaid customer (`OUTGOING_SALES`) invoices — not Reserved-unit list price.

## DASH-104: Equity-type credits counted as debt

**Severity:** High · **File:** `directorService.ts:270-272, 370-377`

### What's wrong
`bank_credits` rows with `credit_type='equity'` are summed into `total_debt`, `avg_interest_rate` (drags the mean down with 0% rows), and the debt-to-equity ratio that drives the High-Leverage alert.

### Fix
`credits.filter(c => c.credit_type !== 'equity')` for all debt metrics; make avg interest value-weighted.

## DASH-105: Per-project expenses use `Math.max(contract, invoiced)`; margin 0% when no sales

**Severity:** High · **File:** `directorService.ts:204-235`

### Fix
Choose committed (`contract_amount`) OR incurred (invoiced) cost consistently — don't `Math.max` two unlike quantities. Show "N/A" for margin when revenue is 0 rather than 0%.

## DASH-106: Mislabeled counts and heuristics

**Severity:** Medium · **File:** `directorService.ts:329-335, 374-375`

- "Active Subcontractors" counts active **contracts** → rename `active_contracts`.
- `completed_contracts` inferred from budget burn instead of `status === 'completed'`.
- `credit_paid_out` computes draw-down/utilization but is labeled "Credit Paid Out" → relabel "Credit Utilization."

## DASH-107: No status/soft-delete filtering; alert cap/format issues

**Severity:** Medium/Low · **File:** `directorService.ts:116-140, 456`, `DirectorAlertsSection.tsx`, `DirectorFinancialSection.tsx:80`

- Terminated/draft contracts and paid/defaulted credits pollute value & maturity totals.
- Alerts: header counts full array but body renders `slice(0,6)`; not sorted by urgency before slicing.
- "Last updated" shows render time, not cache fetch time.
- Inconsistent magnitude formatting (`/1e6` `.toFixed(3)` vs `/1e3` K) → small values read as €0.00M.

---

## Accounting dashboard

## DASH-201: Phantom invoice-type classifiers misroute financing cash

**Severity:** Critical · **File:** `accountingDashboardService.ts:5-15, 37-45`

### What's wrong
Classifiers key on `INCOMING_BANK_CREDIT`, `INCOMING_BANK_DRAWN`, `INCOMING_INVESTOR` — none exist in the `invoice_type` check constraint. Real type `INCOMING_INVESTMENT` falls through `startsWith('INCOMING')` and is counted as **outgoing cash** (money received → reported as spent). Also pulls financing invoices into VAT-paid (pretporez).

### Fix
Per the resolved decision, treat `INCOMING_INVESTMENT` as incoming cash. Replace phantom checks with an explicit allow-list against the real 9 enum values; mirror `useCalendar.ts:69-81`. Build the input-VAT set from taxable purchase types only (`INCOMING_SUPPLIER`, `INCOMING_OFFICE`, and `INCOMING_BANK*` if deductible). Repairs Cash Flow, VAT, Top Companies, Monthly Trends at once.

## DASH-202: `else if` classifier can silently drop a type

**Severity:** High · **File:** `accountingDashboardService.ts:151-152, 196-197`

### Fix
After fixing DASH-201, keep the two predicates mutually exhaustive or assert/log on fallthrough so future types can't vanish from charts while remaining in year totals.

## DASH-203: Top Companies ranks by idle bank balance, displayed as payment flow

**Severity:** High · **File:** `accountingDashboardService.ts:167-172`, `AccountingCompaniesSection.tsx:52-56`

### What's wrong
`netBalance` = Σ`company_bank_accounts.current_balance`, unrelated to the In/Out payment totals shown on the same row, which implies `netBalance = in − out`.

### Fix
Either rank/label explicitly by bank balance (visually separated from flow) or compute `netBalance = incoming − outgoing`.

## DASH-204: Misc accounting issues

**Severity:** High/Medium/Low · **File:** `accountingDashboardService.ts`

- `invoiceCount` per company ignores the year filter & status (line 125-133) — N+1 query too.
- Monthly trends omit zero-payment months and render in Map-insertion order (line 185-204).
- `payment_date` bucketed via `new Date()` → UTC drift (see DASH-001); bucket by `payment_date.slice(0,7)`.
- VAT filtered by `issue_date` + `status='PAID'` mixes accrual bucketing with a cash gate (line 30-53) — pick one basis.
- `parseFloat(p.amount)` lacks `|| 0` guard; locale inconsistency (`hr-HR` vs `en-US`).
- cesija/kompenzacija rows may double-count or misattribute company (confirm netting/attribution).

---

## Sales dashboard

## DASH-301: Inventory excludes garages and storage units

**Severity:** Critical · **File:** `salesDashboardService.ts:19, 46-49, 75-84`

### What's wrong
Only `apartments` is queried. `totalUnits`, sold/reserved/available, `salesRate`, and per-project counts ignore `garages` (garaža) and `repositories` (repozitorij).

### Fix
Per the resolved decision: fetch all three tables and aggregate by status (like `useSalesData.ts`), exposing per-type breakdowns.

## DASH-302: Revenue captures only apartment-linked invoices

**Severity:** Critical · **File:** `salesDashboardService.ts:23-30, 105-117`

### What's wrong
Revenue joins `accounting_invoices` filtered on `apartment_id IS NOT NULL`; `accounting_invoices` has no `garage_id`/`repository_id`, so garage/storage sales revenue is dropped.

### Fix
Confirm how garage/storage are invoiced; cover them so revenue matches the all-units scope from DASH-301.

## DASH-303: Recent Sales not ordered; trend conflates two time series; hardcoded target

**Severity:** High/Medium · **File:** `salesDashboardService.ts:70, 100-131`

- `fetchRecentSales` uses `slice(-10)` on an unordered query → add `.order('sale_date', {ascending:false}).limit(10)`.
- 6-month trend: `sales_count` bucketed by `sale_date` but `revenue` by `payment_date` — orthogonal series in one bar; bar width driven by revenue only.
- `monthlyTarget: 5000000` hardcoded in two places → source from config/DB.
- Date bucketing TZ drift (DASH-001); `'MMM'` labels ambiguous across year boundary.

---

## Investment dashboard

## DASH-401: PDF export always receives empty projects array

**Severity:** Critical · **File:** `InvestmentDashboard.tsx:37-40`

### What's wrong
`generateInvestmentReportPDF(financialSummary, bankCredits, [])` — hardcoded `[]`, so the entire Portfolio Projects section never renders, though `data.projects` is available.

### Fix
Pass `data?.projects ?? []`. One-line fix.

## DASH-402: `total_debt` inconsistent with used − repaid; available can go negative; "weighted" avg isn't weighted

**Severity:** Critical/High · **File:** `investmentDashboardService.ts:49-58`, `InvestmentSummaryCards.tsx:13-46`

- `total_debt` sums stored `outstanding_balance` while used/repaid are summed separately — the three KPIs can disagree. Derive debt as `used − repaid` (or reconcile).
- `available_credit = total − used` can be negative, shown in **green**; utilization can exceed 100% while per-row bars are capped. Clamp/recolor.
- `weighted_avg_interest` is a plain mean; weight by amount: `Σ(rate·amount)/Σ(amount)`.

## DASH-403: Donut mixes bases; maturity boundary drops "today"; activity date mismatch; array mutation

**Severity:** High/Medium · **File:** `investmentReportPdf.ts:285-299`, `investmentDashboardService.ts:54-93`

- Donut sums `allocated_amount` for allocated credits but full `amount` for unallocated — inconsistent denominators. Pick one basis; bucket unallocated remainder.
- `differenceInDays(..) > 0` drops credits maturing today; compute once with `startOfDay`, use `>= 0`.
- `noCriticalIssues` predicate diverges from the banner predicate → dashboard can show neither green nor warning.
- Recent activity picks top-3 by `created_at` but displays/sorts by `start_date`; `.sort()` mutates the returned `bankCredits` in place — use copies.
- `format(new Date(x))` throws on invalid dates — guard with `isValid`.

---

## Retail dashboard

## DASH-501: Profit subtracts accrued cost from cash collected

**Severity:** Critical · **File:** `retailDashboardService.ts:87`, `RetailDashboard.tsx:100-121`

### What's wrong
`profit = total_paid (cash collected) − total_costs (budget_realized, accrued)` — incoherent under any accounting basis.

### Fix
Use one basis: `total_revenue (invoiced) − total_costs`, or make both sides cash. Relabel "Income" to match the value used.

## DASH-502: "Collection / Paid" sums paid_amount over both incoming and outgoing invoices

**Severity:** Critical · **File:** `retailDashboardService.ts:46`

### What's wrong
`total_supplier_paid` reduces `paid_amount` over all invoices (no type filter), mixing customer receipts with supplier payouts, but is shown as customer collection. `total_remaining` ("To collect") has the same defect.

### Fix
Restrict to `OUTGOING_SALES` if the card is customer collection (or relabel).

## DASH-503: Phantom type/status strings

**Severity:** High · **File:** `retailDashboardService.ts:42, 58, 63`

`invoice_type === 'OUTGOING'` and `status === 'PARTIAL'` never match (valid: `OUTGOING_SALES/SUPPLIER/OFFICE/BANK`; `UNPAID/PARTIALLY_PAID/PAID`). Remove dead branches; confirm whether revenue should be `OUTGOING_SALES` only.

## DASH-504: Cancelled contracts inflate cost; overdue date off-by-one; 0-day overdue rows

**Severity:** High · **File:** `retailDashboardService.ts:13-74`

- `retail_contracts` with `status='Cancelled'` still summed into costs/profit → `.neq('status','Cancelled')`.
- Overdue uses local `new Date()` vs UTC-parsed `due_date` (DASH-001); invoices due today flagged overdue; `days_overdue` can render 0 in the overdue list.

## DASH-505: Revenue uses VAT-inclusive `total_amount`

**Severity:** Low → **actionable** · **File:** `retailDashboardService.ts:44`

### Fix
Per the resolved decision, revenue is **net of VAT** — use `base_amount` (the fetched `vat_amount` is currently unused). Also: per-customer revenue divides by all customers (incl. non-buyers); `customer_name` falls back to invoice number (confusing); `'N/A'`/contract_number not localized; consider `.eq('approved', true)` gating.

---

## Supervision dashboard

## DASH-601: "Completed this week" reads subcontractor `completed_at` per-contract-row

**Severity:** Critical · **File:** `supervisionService.ts:52, 129, 167-174`

### What's wrong
`completed_at` comes from the joined **subcontractor** (no such column on `contracts`) and is counted once per contract row → a subcontractor with N contracts counts N times. Meanwhile contract-level completion (`status='completed'`) is filtered out by `.in('status',['draft','active'])`.

### Fix
Track contract-level completion (timestamp or `status='completed'` + date), query completed contracts for the week window separately, count distinct contracts. Normalize the `timestamptz` vs local-week comparison (DASH-602).

## DASH-602: Three inconsistent time windows; date/DST boundary slippage

**Severity:** High · **File:** `supervisionService.ts:31-64`, `SupervisionDashboard.tsx:55-80`, status/issues views

### What's wrong
Calendar-week (Mon–Sun) for `work_logs_this_week` & header, rolling-7-day for `recent_work_logs`/`last_activity`, yet the Status view labels the 7-day count "Weekly logs" and Issues says "no work logs **this week**." `sevenDaysAgo` uses naive 7×24h (DST-fragile). `work_logs.date` filtered with locally-formatted boundaries.

### Fix
Pick one window (recommend calendar week to match header/Week tab); relabel or recompute; compute boundaries in business timezone.

## DASH-603: Progress bar is a payment ratio mislabeled as completion

**Severity:** High · **File:** `supervisionService.ts:107-118, 142`, status/issues views

### What's wrong
`progress = budget_realized / contract_amount` is financial disbursement, but `is_overdue` gates on `progress < 100` and Issues prints "{progress}% complete." 100% paid ≠ work done. Also a three-way `budget_realized` fallback (invoices vs stored vs 0 for `has_contract=false`) makes identical real-world payment show different progress.

### Fix
Label consistently as "paid out / financial progress," or derive real progress from work-log/phase status; don't gate `is_overdue` on payment %. Single source of truth for `budget_realized`.

## DASH-604: Per-contract counts presented as per-site / per-crew; null phase_id phantom site

**Severity:** Medium · **File:** `supervisionService.ts:176-183`

- "Active crews" / status & issues lists count/render per **contract**, not per subcontractor (no dedupe; `key` uses contract id) → one subcontractor appears N times.
- `active_sites` counts distinct `phase_id`, but `phase_id` is nullable → all phase-less contracts collapse into one phantom "site" (+1).
- `criticalDeadlines` subtitled "due this week" but window is rolling 7 days.

### Fix
Dedupe by `subcontractor_id`; exclude null `phase_id`; relabel "due within 7 days."

## DASH-605: Display polish

**Severity:** Low · **File:** `supervisionService.ts:118, 141`, week/status/issues views

- `progress` unrounded → "33.333333%"; `Math.round` at derivation.
- Week view shows `created_at` time, not the work `date`; orders by `created_at` not `date`.
- `999` magic sentinel for "no deadline" → prefer `null`.
