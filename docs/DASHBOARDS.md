# Module: Dashboards

**Path:** `src/components/dashboards/`

## Overview

Role-based dashboard views that aggregate KPIs and summaries from all other modules. Each dashboard is tailored to a specific user profile. Dashboard services are read-only aggregation — they never mutate data.

---

## Services

### accountingDashboardService.ts
- `fetchVATStats()` — returns VATStats (collected, paid, net, monthly breakdown)
- `fetchCashFlowStats()` — returns CashFlowStats (incoming, outgoing, net with YoY comparison)
- `fetchTopCompanies()` — returns top 5 companies ranked by net balance
- `fetchMonthlyTrends()` — returns MonthlyData[] for stacked bar chart
- `fetchMonthlyBudget()` — returns current MonthlyBudget or null
- **Depends on:** supabase client

### directorService.ts
- `fetchDirectorDashboard()` — single entry point that fetches all base tables in one `Promise.all` and returns `DirectorDashboardData` (`projects`, `financial`, `sales`, `construction`, `funding`, `alerts`). Internally delegates to private `derive*` helpers (`deriveProjects`, `deriveFinancial`, `deriveSales`, `deriveConstruction`, `deriveFunding`, `deriveAlerts`) — these are no longer separately exported
  - `projects` → ProjectStats[] with budget, expenses, revenue, profit margin, completion %
  - `financial` → FinancialMetrics (revenue, expenses, debt, equity, receivables, payables)
  - `sales` → SalesMetrics
  - `construction` → ConstructionMetrics
  - `funding` → FundingMetrics
  - `alerts` → Alert[] derived from milestones, credit maturities, and financial/sales metrics (capped at 10)
- The milestone maths moved to the pure, tested `utils/directorAlerts.ts`. **A milestone is
  settled only when `status === 'paid'`**: `subcontractor_milestones.status` is
  `pending | completed | paid` and the DB trigger sets `completed` on a *partial* payment, so the
  old `status !== 'completed'` filter counted fully paid milestones as overdue and skipped the
  part-paid ones that still owed money. The same filter drives `overdue_tasks`,
  `critical_deadlines` and the overdue alert
- `deriveAlerts` returns `{ type, kind, params, date }` — no prose. It used to build English
  title/message strings ("Overdue Milestone", "Credit Maturity", "High Leverage", …) that
  `DirectorAlertsSection` rendered raw; the words and the money formatting now live in the section
- **Exports type:** `DirectorDashboardData`
- **Depends on:** supabase client, directorAlerts, dateOnly

### investmentDashboardService.ts
- `fetchInvestmentDashboardData()` — returns projects, companies, banks, bankCredits, recentActivities, financialSummary in one call
- `recentActivities` are `{ type, params, date }`, not prose. They used to be English sentences
  built here ("Credit facility approved", "… matures in 12 days") and rendered verbatim into a
  Croatian dashboard; `InvestmentDashboard` now translates `dashboards.investment.activity.*`
- **Depends on:** supabase client

### retailDashboardService.ts
- `fetchRetailDashboardData()` — returns stats (DashboardStats) and overdueInvoices (OverdueInvoice[])
- The money maths lives in the pure `utils/retailTotals.ts`; this service only queries and
  assembles. Every query's `error` is checked with the `responses.find(r => r.error !== null)`
  guard copied from `Reports/services/retailReportService.ts:43-44` — it used to destructure
  `{ data }` alone, so a dropped request rendered a retail portfolio of zeros that
  `useCachedData` could not tell from a real one
- `active_projects` counts `status === 'In Progress'` (the Retail report's rule); the tile's
  subtitle said "Aktivnih projekata" while the figure counted every row
- The overdue list is **receivables only** (`invoice_type === 'OUTGOING_SALES'`). It did not
  filter by type, so a late *supplier* invoice appeared under "Kašnjenja u plaćanju … za naplatu"
  with the supplier's name on it
- **Depends on:** supabase client, retailTotals, dateOnly

### salesDashboardService.ts
- `fetchSalesDashboardData()` — returns stats, projectStats, monthlyTrends, paymentMethodBreakdown, recentSales
- `fetchRecentSales(sales)` — maps raw sale records into RecentSale[]
- `SalesDashboardStats.monthlyTarget` is **gone**. It was a hardcoded €5.000.000 with no
  counterpart anywhere in the database, and the dashboard measured collections against it
- All nine reads now check their `error`. The payments query was the one that did not, and it is
  the source of `totalRevenue`, `monthlyRevenue` and every per-project amount — a failed read
  showed a confident €0. `fetchRecentSales`'s three reads were unchecked too, which rendered
  every recent sale as "Unknown — N/A"
- **Depends on:** supabase client

### supervisionService.ts
- `fetchSupervisionDashboard()` — single entry point that fetches week work logs, draft/active contracts, subcontractor invoices, and the last 7 days of work logs in one `Promise.all`, then returns `SupervisionDashboardData` (`weekLogs: WorkLog[]`, `subcontractorStatus: SubcontractorStatus[]`, `stats: WeeklyStats`). Internally delegates to private helpers (`deriveContractStatus`, `deriveSubcontractorStatus`, `buildWeeklyStats`) — these are no longer separately exported. Recent-log lookups are grouped in-memory per subcontractor rather than queried per-row
- **Exports type:** `SupervisionDashboardData`
- **Depends on:** supabase client

### investmentReportPdf.ts
- `generateInvestmentReportPDF(financialSummary, bankCredits, projects)` — generates a multi-page jsPDF investment report with donut chart, bar chart, credit details, and project summaries
- **Depends on:** jsPDF, src/types/investment.ts

---

## Types

### accountingDashboardTypes.ts
- Exports: `VATStats`, `CashFlowStats`, `TopCompany`, `MonthlyData`, `MonthlyBudget`

### directorTypes.ts
- Exports: `ProjectStats`, `FinancialMetrics`, `SalesMetrics`, `ConstructionMetrics`, `FundingMetrics`, `Alert`
- `Alert` is now an alias of `DerivedAlert` from `utils/directorAlerts.ts` (`{ type, kind, params?, date? }`)

### retailDashboardTypes.ts
- Exports: `DashboardStats`, `OverdueInvoice`
- `DashboardStats` extends `RetailTotals` (from `utils/retailTotals.ts`) with `total_projects`,
  `active_projects` and `total_customers`

### salesDashboardTypes.ts
- Exports: `SalesDashboardStats`, `ProjectStats`, `MonthlyTrend`, `RecentSale`
- No `monthlyTarget`: there is no target data in the database
- `MonthlyTrend.month` is a **key**, the month's first day as `'YYYY-MM-DD'` — not a label.
  `SalesDashboard` formats it with `formatMonthYear`. Same for `MonthlyData.month` in
  `accountingDashboardTypes.ts`

### supervisionTypes.ts
- Exports: `WorkLog`, `SubcontractorStatus`, `WeeklyStats`

---

## Dashboards

### AccountingDashboard.tsx
- Renders VAT stats, cashflow, budget, top companies, and monthly trends panels
- **Uses services:** accountingDashboardService
- **Uses components:** AccountingVATSection, AccountingCashFlowSection, AccountingBudgetSection, AccountingCompaniesSection, AccountingMonthlyTrendsSection
- **Uses Ui:** Card

### DirectorDashboard.tsx
- Renders financial metrics, project table, sales/construction/funding summaries, and alerts
- The construction section's red tile is **"Zakašnjele prekretnice plaćanja"**
  (`dashboards.director.overdue_milestones`). It counts `subcontractor_milestones`, which are
  payment milestones on subcontractor contracts, not tasks; the key was `overdue_tasks`
  ("Zakašnjeli zadaci") and has been removed
- **Uses services:** directorService (`fetchDirectorDashboard()` — one call loads all sections)
- **Uses components:** DirectorFinancialSection, DirectorProjectsTable, DirectorAlertsSection
- **Uses Ui:** Card

### InvestmentDashboard.tsx
- Renders investment summary cards, credit table, recent activity, and PDF export button
- **Uses services:** investmentDashboardService
- **Uses components:** InvestmentSummaryCards, InvestmentCreditsTable
- **Uses services:** investmentReportPdf (for PDF export, driven through the `useAsyncExport` hook which handles the exporting flag and toast on failure)
- **Uses Ui:** Card, Button

### RetailDashboard.tsx
- Renders retail KPI cards, collection/profit/averages panels, and overdue receivable warnings
- Tiles: Projekti (with "N aktivnih"), Kupci ("Ukupno kupaca" — `retail_customers` has no status
  column, so "Aktivnih kupaca" was unsupportable), **Investirano** = development + construction
  paid only, and Prihod = contracted sales value
- "Investirano" and "Troškovi" are deliberately different figures now; they differ by exactly the
  land cost. They used to be the same variable (`const total_costs = total_invested`)
- The profit panel reads Naplaćeno − Troškovi = Profit. Its first row showed *invoiced* revenue
  under the label "Naplata:", which both misstated the figure and repeated the collection panel's
  heading
- **Uses services:** retailDashboardService
- **Uses Ui:** StatCard

### SalesDashboard.tsx
- Renders sales pipeline metrics, 6-month trend, payment method breakdown, and recent sales list
- Five KPI tiles: total revenue, **Naplaćeno ovaj mjesec**, sales rate, average sale price, active
  leads. The monthly figure replaces a "Napredak prema mjesečnom cilju" panel whose target was a
  hardcoded €5.000.000 and whose percentage label was unclamped. It is `monthlyRevenue`: payments
  since the start of the calendar month on `OUTGOING_SALES` invoices that carry an
  `apartment_id` — **apartments only** (garages and storage units are not invoiced) and **gross,
  VAT included**, which is what the tile's subtitle says
- **Uses services:** salesDashboardService
- **Uses Ui:** StatCard

### SupervisionDashboard.tsx
- Tabbed interface switching between weekly activity view, contractor status, and issues/alerts
- **Uses services:** supervisionService (`fetchSupervisionDashboard()` — one call returns week logs, subcontractor status, and weekly stats)
- **Uses components:** SupervisionWeekView, SupervisionStatusView, SupervisionIssuesView
- **Uses Ui:** Tabs, StatGrid

---

## Sections

Each section is a self-contained panel rendered inside its parent dashboard. All sections receive pre-fetched data as props — they do not fetch data themselves.

### AccountingVATSection.tsx
- Displays PDV collected, PDV paid, and net PDV with monthly breakdown
- Props: `VATStats`

### AccountingBudgetSection.tsx
- Monthly budget status card with percentage usage and remaining amount
- Props: `MonthlyBudget`, `CashFlowStats`

### AccountingCashFlowSection.tsx
- Three-card layout for incoming, outgoing, and net cashflow with YoY comparison
- Props: `CashFlowStats`

### AccountingCompaniesSection.tsx
- Top 5 companies ranked by net balance with invoice counts
- Props: `TopCompany[]`

### AccountingMonthlyTrendsSection.tsx
- One row per month: an incoming (green) and an outgoing (red) horizontal bar, and the month's signed net
- Every bar shares one denominator — `monthlyBarMax(monthlyData)`, the largest value in either series across the year — so bar length compares across months. It used to be computed per month, which made each month's larger bar full width
- Each € figure sits in a fixed-width column beside its bar, not inside the `overflow-hidden` track, where short bars clipped it
- Below `md` the row wraps: month and net on one line, the two bars stacked beneath
- Props: `MonthlyData[]`

### DirectorAlertsSection.tsx
- Displays up to 6 critical/warning/info alerts
- Translates each alert from its `kind` + `params` under `dashboards.director.alerts.*` and
  formats the credit amount with `formatEuro`. A day count of 0 uses the `message_today` variant
  rather than printing "dospijeva za 0 dana". This closes the "Director alerts panel is entirely
  English" finding
- Props: `Alert[]`

### DirectorFinancialSection.tsx
- 5+3 stat card grid for revenue, expenses, debt, equity, receivables, and payables
- Props: `FinancialMetrics`

### DirectorProjectsTable.tsx
- Clickable project table with budget, expenses, revenue, profit margin, and completion %
- The project cell carries the project-category badge (ProjectCategoryBadge) next to the name; `directorService` selects `category` for it
- Props: `ProjectStats[]`

### InvestmentSummaryCards.tsx
- 4-card grid showing total portfolio value, total debt, available credit, and utilization
- Props: `FinancialSummary`

### InvestmentCreditsTable.tsx
- Credit cards with utilization progress, dates, and expiry warnings
- The utilisation percentage and its bar both take their colour from `utilisationTone`
  (`Funding/Investors/utils/creditCalculations.ts`) — see `docs/FUNDING.md`. The bar used to run
  red / orange / **blue** on its own thresholds
- Props: `BankCredit[]`

### SupervisionWeekView.tsx
- Timeline of work logs for the week with blocker details and notes
- Props: `WorkLog[]`

### SupervisionStatusView.tsx
- Subcontractor performance cards with progress bars and deadline tracking
- Props: `SubcontractorStatus[]`

### SupervisionIssuesView.tsx
- Three alert sections: overdue tasks, critical deadlines, and items needing attention
- Props: `overdueTasks`, `criticalDeadlines`, `needsAttention: SubcontractorStatus[]`

---

## Shared dashboard utilities
- **`DashboardError.tsx`** — error panel (icon + message + retry). Every dashboard renders it when `useCachedData` reports an `error` and there is no cached data, so a failed fetch never renders as legitimate zeros. Since September 2026 it is a thin wrapper over the shared **`ErrorState`** (`src/components/ui/ErrorState.tsx`), which was promoted out of it so list pages and modals can make the same distinction; the wording moved with it to `common.load_error_title` / `common.load_error_description` / `common.retry`, and the `dashboards.common.*` trio is gone from both locale files. Rendering is unchanged apart from the title, which is now the generic "Failed to load" / "Učitavanje nije uspjelo" rather than "…dashboard". New code can import `ErrorState` directly — this wrapper exists so the six dashboards' call sites stayed put.
- **`utils/retailTotals.ts`** — `computeRetailTotals({ phases, contracts, landPlots, invoices })`,
  the Retail dashboard's money maths, on the **Retail report's** definitions so the dashboard and
  the PDF report agree (`Reports/services/retailReportService.ts:103-111,176-180`):
  - **Costs** = land + development-phase paid + construction-phase paid
  - **Collected** = sales-phase paid · **Profit** = collected − costs (cash basis on both sides)
  - **Invested** = development + construction paid, land excluded — so it is not a second name for
    Costs, which is what it was (`const total_costs = total_invested`)
  - Land is `retail_land_plots.total_price`, the source the report uses for its **portfolio**
    totals. The report's *per-project* figure uses `retail_projects.purchase_price` instead; this
    dashboard is portfolio-level and uses the portfolio source throughout
  - Cost and sales contracts are separated by their phase, because `retail_contracts` holds both
    (the DB CHECK allows exactly one of `supplier_id` / `customer_id`). Summing `budget_realized`
    over every contract folded buyer money into costs and left Profit subtracting revenue from
    itself. A contract on an unknown or missing phase is left out of every total rather than
    guessed at
  - `budget_realized` is the **net** paid share the
    `update_retail_contract_budget_realized_from_payments` trigger stores, not a gross figure —
    the "Razvoj i gradnja (s PDV)" subtitle was simply false and now reads "(bez PDV-a)"
  - Unit-tested in `retailTotals.test.ts` (8 tests), including the case that motivated it
- **`utils/directorAlerts.ts`** — `isSettledMilestone`, `countOverdueMilestones`,
  `countCriticalDeadlines` and `deriveAlerts`, pure and unit-tested (`directorAlerts.test.ts`,
  13 tests). `daysFromToday` is injected, so the tests fix "today" without fake timers. See
  `directorService.ts` above for what it fixes
- **`src/utils/dateOnly.ts`** — helpers for SQL `date` (date-only) columns: `parseLocalDate` (parse as local midnight, not UTC), `monthKey` (`'YYYY-MM'` bucket key), `daysFromToday` (whole-day diff, inclusive of today), `isValidDate`. All dashboard services use these for month bucketing, overdue/maturity windows, and "this week" math to avoid the UTC-vs-local off-by-one.
- **`useCachedData` now exposes `error`** alongside `data`/`loading`/`fetchedAt`/`refetch`.
- **`utils/barScale.ts`** — `monthlyBarMax(data)` (the shared denominator for incoming/outgoing month bars, floored at 1 so an empty or all-zero year is safe) and `barPercent(value, max)` (clamped 0–100). Unit-tested in `barScale.test.ts`. `SalesDashboard` hoists its own denominator inline the same way.
- **`src/utils/formatters.ts`** — every money figure on every dashboard goes through a shared helper; no dashboard renders its own `toLocaleString` or divides by a million any more. `formatEuroRounded` (`€1.235`) for the Cashflow/accounting rollups, `formatEuroCompact` (`€1,2M` / `€45K` / `€9.500`) for the Director, Investment and Sales tiles, `formatEuro` (`€1.234,56`) where cents are real (Retail totals, per-company net balance), `formatEuropean` (bare `1.234,56`) where the translated string already carries the `€` (`dashboards.accounting.in_out_label`), and `NO_VALUE` (`—`) where an average has no denominator. All emit the Croatian `€` -first form and the locale minus `€−1.234`, whatever the browser locale.

### Signed figures
Net figures show their own sign; colour is reinforcement, never the only cue. Net cash flow, the current-month net and a company's net balance render signed. `Math.abs` survives in exactly three money sites, where the **label** carries the direction and a minus would double it: net VAT and current-month net VAT (`to_pay_tax` / `to_receive_tax`), and the monthly budget tile (`budget_remaining` / `budget_overage`). Monthly trends prefix `+` for positives and lets the helper print the minus.

### Data-integrity conventions (enforced 2026-06-16, see `DASHBOARD_AUDIT.md`)
- Classify invoices against the real `invoice_type` enum (9 values) — never invented strings. `INCOMING_INVESTMENT` is treated as **incoming cash**.
- Debt KPIs exclude `credit_type='equity'` and repaid/defaulted credits; "weighted" interest is amount-weighted.
- Sales counts cover all three unit tables (`apartments`, `garages`, `repositories`); revenue is apartment-only (only apartments are invoiced) and labelled accordingly.
- Retail figures follow the Retail report, not the invoice table: revenue is the contracted sales
  value, collections are sales-phase `budget_realized` (net of VAT, cash basis), and outstanding /
  invoiced come from the invoices on those sales contracts. Profit is collected − costs.
- Supervision "completed this week" = distinct subcontractors with `completed_at` in the calendar week; progress bars are a **payment** ratio ("Paid Out"), not work completion.

## Notes
- `investmentReportPdf.ts` lives in this module (not in Reports/) — it generates the investment PDF report. It runs `yieldToUI()` (`src/utils/yieldToUI.ts`) periodically during long credit/project loops so the export does not freeze the UI
- `directorService` and `supervisionService` were consolidated during the May 2026 audit: each now exposes a single `fetch{Director,Supervision}Dashboard()` that batches all queries in one `Promise.all` and returns a typed bundle. The previous per-metric `fetch*` functions and the standalone `buildWeeklyStats` are now private helpers
- PDF export buttons use the shared `useAsyncExport` hook (`src/hooks/useAsyncExport.ts`) for the exporting flag and error toast instead of inline try/catch
- All dashboards are internationalised (react-i18next, keys under `dashboards.*`) and dark-mode aware; this is presentational only and does not change the data each view shows

### Language, dates and enums (September 2026 i18n sweep)
- **No dashboard formats a date itself.** Every `format(…, 'MMM dd, yyyy')` is gone; the helpers
  in `src/utils/formatters.ts` (`formatDate`, `formatDateTime`, `formatMonthYear`,
  `formatDayMonth`) take `i18n.language` explicitly, so a Croatian UI reads `05.01.2026.` and an
  English one `Jan 05, 2026`. A `date` column is passed as a **string** so `parseLocalDate` keeps
  it on the day it says — `InvestmentCreditsTable`'s three credit dates went through `new Date()`
  and rendered the previous day east of UTC
- **A service never renders a month name.** `salesDashboardService`'s `MonthlyTrend.month` and
  `accountingDashboardService`'s `MonthlyData.month` are now the month's **first day**
  (`'YYYY-MM-DD'`), not `'MMM yy'` / `'MMM yyyy'` labels; `SalesDashboard` and
  `AccountingMonthlyTrendsSection` format them. Neither is read by a PDF
- **The three Croatian labels that interpolated an English month** —
  `dashboards.director.monthly_sales`, `.cash_flow_month`, `dashboards.accounting.monthly_budget` —
  are fed `common.months` (nominative, which is what a parenthesised label wants) or
  `formatMonthYear`. Croatian grammar wants the genitive after some prepositions; these three do
  not take one, so do not invent forms for them
- **`investmentDashboardService` no longer writes sentences.** `RecentActivity` carries
  `{ type, params }` and `InvestmentDashboard` looks up
  `dashboards.investment.activity.<type>.*`, the shape `directorAlerts` already uses. A credit's
  project clause is a separate key (`description_with_project`), not an interpolated fragment
- **Raw DB enums are mapped at render time**, never compared against a translation:
  `DirectorProjectsTable` uses `PROJECT_STATUS` from `src/utils/statusDisplay.ts` (which settles
  "On Hold" on amber — it was red only here), and `SalesDashboard`'s payment-method breakdown uses
  the existing `payment_type.*` keys for `sales.payment_method`'s four CHECK values rather than
  `replace(/_/g,' ')` plus a CSS `capitalize`, which read "Bank Loan"
- **Services return `null`, not an English placeholder.** `supervisionService`'s `project_name`
  was `'Unknown Project'`; the views now label the gap with `common.no_project`
- **EVM is not surfaced on any dashboard.** The Earned Value Management utility (`src/utils/evm.ts`) is consumed only by the Budget Control feature (`src/components/General/BudgetControl/`)
- Role visibility is controlled via `src/utils/permissions.ts` and `AuthContext`
- Dashboard services are read-only aggregation — they do not mutate data
