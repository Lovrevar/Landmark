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
- **Exports type:** `DirectorDashboardData`
- **Depends on:** supabase client

### investmentDashboardService.ts
- `fetchInvestmentDashboardData()` — returns projects, companies, banks, bankCredits, recentActivities, financialSummary in one call
- **Depends on:** supabase client

### retailDashboardService.ts
- `fetchRetailDashboardData()` — returns stats (DashboardStats) and overdueInvoices (OverdueInvoice[])
- **Depends on:** supabase client

### salesDashboardService.ts
- `fetchSalesDashboardData()` — returns stats, projectStats, monthlyTrends, paymentMethodBreakdown, recentSales
- `fetchRecentSales(sales)` — maps raw sale records into RecentSale[]
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

### retailDashboardTypes.ts
- Exports: `DashboardStats`, `OverdueInvoice`

### salesDashboardTypes.ts
- Exports: `SalesDashboardStats`, `ProjectStats`, `MonthlyTrend`, `RecentSale`

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
- Renders retail KPI cards, project overview, payment tracking, and overdue invoice warnings
- **Uses services:** retailDashboardService
- **Uses Ui:** StatGrid, Card

### SalesDashboard.tsx
- Renders sales pipeline metrics, 6-month trend, payment method breakdown, and recent sales list
- **Uses services:** salesDashboardService
- **Uses Ui:** StatGrid, Card

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
- Stacked horizontal bar chart of monthly incoming vs outgoing amounts
- Props: `MonthlyData[]`

### DirectorAlertsSection.tsx
- Displays up to 6 critical/warning/info alerts
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
- **`DashboardError.tsx`** — shared error panel (icon + message + retry). Every dashboard renders it when `useCachedData` reports an `error` and there is no cached data, so a failed fetch never renders as legitimate zeros. i18n under `dashboards.common.*`.
- **`src/utils/dateOnly.ts`** — helpers for SQL `date` (date-only) columns: `parseLocalDate` (parse as local midnight, not UTC), `monthKey` (`'YYYY-MM'` bucket key), `daysFromToday` (whole-day diff, inclusive of today), `isValidDate`. All dashboard services use these for month bucketing, overdue/maturity windows, and "this week" math to avoid the UTC-vs-local off-by-one.
- **`useCachedData` now exposes `error`** alongside `data`/`loading`/`fetchedAt`/`refetch`.

### Data-integrity conventions (enforced 2026-06-16, see `DASHBOARD_AUDIT.md`)
- Classify invoices against the real `invoice_type` enum (9 values) — never invented strings. `INCOMING_INVESTMENT` is treated as **incoming cash**.
- Debt KPIs exclude `credit_type='equity'` and repaid/defaulted credits; "weighted" interest is amount-weighted.
- Sales counts cover all three unit tables (`apartments`, `garages`, `repositories`); revenue is apartment-only (only apartments are invoiced) and labelled accordingly.
- Retail revenue is **net of VAT** (`base_amount`); collection figures are customer (`OUTGOING_SALES`) only.
- Supervision "completed this week" = distinct subcontractors with `completed_at` in the calendar week; progress bars are a **payment** ratio ("Paid Out"), not work completion.

## Notes
- `investmentReportPdf.ts` lives in this module (not in Reports/) — it generates the investment PDF report. It runs `yieldToUI()` (`src/utils/yieldToUI.ts`) periodically during long credit/project loops so the export does not freeze the UI
- `directorService` and `supervisionService` were consolidated during the May 2026 audit: each now exposes a single `fetch{Director,Supervision}Dashboard()` that batches all queries in one `Promise.all` and returns a typed bundle. The previous per-metric `fetch*` functions and the standalone `buildWeeklyStats` are now private helpers
- PDF export buttons use the shared `useAsyncExport` hook (`src/hooks/useAsyncExport.ts`) for the exporting flag and error toast instead of inline try/catch
- All dashboards are internationalised (react-i18next, keys under `dashboards.*`) and dark-mode aware; this is presentational only and does not change the data each view shows
- **EVM is not surfaced on any dashboard.** The Earned Value Management utility (`src/utils/evm.ts`) is consumed only by the Budget Control feature (`src/components/General/BudgetControl/`)
- Role visibility is controlled via `src/utils/permissions.ts` and `AuthContext`
- Dashboard services are read-only aggregation — they do not mutate data
