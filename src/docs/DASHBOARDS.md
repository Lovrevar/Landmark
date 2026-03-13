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
- `fetchProjectsData()` — returns ProjectStats[] with budget, expenses, revenue, profit margin, completion %
- `fetchFinancialMetrics()` — returns FinancialMetrics (revenue, expenses, debt, equity, receivables, payables)
- `fetchSalesMetrics()` — returns SalesMetrics
- `fetchConstructionMetrics()` — returns ConstructionMetrics
- `fetchFundingMetrics()` — returns FundingMetrics
- `fetchAlerts(financial, sales)` — derives Alert[] from financial and sales metrics
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
- `fetchWeekLogs()` — returns WorkLog[] for the current week
- `fetchContractStatusData()` — returns contract records with subcontractor info
- `fetchSubcontractorStatus(contracts)` — maps contracts to SubcontractorStatus[]
- `buildWeeklyStats(contracts, subcontractorStatus, weekLogs)` — aggregates WeeklyStats
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
- **Uses services:** directorService
- **Uses components:** DirectorFinancialSection, DirectorProjectsTable, DirectorAlertsSection
- **Uses Ui:** Card

### InvestmentDashboard.tsx
- Renders investment summary cards, credit table, recent activity, and PDF export button
- **Uses services:** investmentDashboardService
- **Uses components:** InvestmentSummaryCards, InvestmentCreditsTable
- **Uses services:** investmentReportPdf (for PDF export)
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
- **Uses services:** supervisionService
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

## Notes
- `investmentReportPdf.ts` lives in this module (not in Reports/) — it generates the investment PDF report
- Role visibility is controlled via `src/utils/permissions.ts` and `AuthContext`
- Dashboard services are read-only aggregation — they do not mutate data
