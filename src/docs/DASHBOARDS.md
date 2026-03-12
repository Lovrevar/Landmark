# Module: Dashboards

**Path:** `src/components/dashboards/`

## Overview
Role-based dashboard views that aggregate KPIs and summaries from all other modules. Each dashboard is tailored to a specific user role.

## Dashboards

| File | Role | Description |
|---|---|---|
| `AccountingDashboard.tsx` | Accounting | Budget, cashflow, VAT, companies, monthly trends |
| `DirectorDashboard.tsx` | Director | Financial overview, project table, alerts |
| `InvestmentDashboard.tsx` | Investment | Credit summary cards and credits table |
| `RetailDashboard.tsx` | Retail | Retail project KPIs |
| `SalesDashboard.tsx` | Sales | Sales pipeline summary |
| `SupervisionDashboard.tsx` | Supervision | Site issues, status, and weekly view |

## Sections
**Path:** `dashboards/sections/`
Each section is a self-contained panel rendered inside its parent dashboard.

| File | Parent Dashboard |
|---|---|
| `AccountingBudgetSection.tsx` | Accounting |
| `AccountingCashFlowSection.tsx` | Accounting |
| `AccountingCompaniesSection.tsx` | Accounting |
| `AccountingMonthlyTrendsSection.tsx` | Accounting |
| `AccountingVATSection.tsx` | Accounting |
| `DirectorAlertsSection.tsx` | Director |
| `DirectorFinancialSection.tsx` | Director |
| `DirectorProjectsTable.tsx` | Director |
| `InvestmentCreditsTable.tsx` | Investment |
| `InvestmentSummaryCards.tsx` | Investment |
| `SupervisionIssuesView.tsx` | Supervision |
| `SupervisionStatusView.tsx` | Supervision |
| `SupervisionWeekView.tsx` | Supervision |

## Services
| File | Purpose |
|---|---|
| `accountingDashboardService.ts` | Aggregated accounting KPI queries |
| `directorService.ts` | Director-level summary queries |
| `investmentDashboardService.ts` | Investment summary queries |
| `retailDashboardService.ts` | Retail KPI queries |
| `salesDashboardService.ts` | Sales summary queries |
| `supervisionService.ts` | Supervision overview queries |

## Types
Each dashboard has a corresponding types file in `dashboards/types/`.

## Notes
- `investmentReportPdf.ts` lives here (not in Reports/) — generates the investment PDF report
- Dashboard services are read-only aggregation — they do not mutate data
- Role visibility is controlled via `src/utils/permissions.ts` and `AuthContext`
