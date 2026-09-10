# Module: Reports

**Path:** `src/components/Reports/`

## Overview

Cross-domain reporting with PDF export. Aggregates data from Cashflow, Sales, Retail, Supervision, and Funding into structured reports and portfolio views. All report services are read-only.

---

## Types

### types.ts
- Exports: `ProjectData`, `ComprehensiveReport`, `SalesData`, `ProjectSalesReport`, `CustomerReport`, `MonthlyData`, `WorkLog`, `ProjectSupervisionReport`
- Used by general, sales, and supervision report views and services

### retailReportTypes.ts
- Exports: `ProjectReportData`, `PhaseReportData`, `CustomerReportData`, `SupplierReportData`, `SupplierTypeSummary`, `InvoiceSummary`, `RetailReportData`
- Used by retail report view and service

---

## Services

### services/generalReportService.ts
- Planned budget per project, and the `portfolio_value` KPI, come from the project's **TIC** —
  never `projects.budget`, which still holds whatever was typed before the TIC took over. Each
  `ProjectData` carries `has_budget`; render "not set" when it is false. Before this, Precko
  Zapad's leftover €1.000.000.000 made up 89% of a €1.118M "Portfolio Value" on a page headed
  Executive Report; the same figure is now €63.6M, the sum of the three real cost plans.
- `fetchGeneralReportData(selectedProject, dateRange)` — aggregates data from 40+ tables into a ComprehensiveReport covering: executive summary, KPIs (portfolio value, sales rate, D/E ratio), sales performance, funding structure, construction status, accounting overview, TIC cost management, risk assessment, and cash flow analysis
- **Depends on:** supabase client

### services/salesReportService.ts
- `fetchProjects()` — fetches project list for report selector
- `generateProjectReport(selectedProject, projects, dateRange)` — fetches apartments, garage/repository prices, monthly sales trend, and unit status for a project
- `generateCustomerReport(dateRange)` — fetches customer list with sales, payment distribution, and insights
- **Depends on:** supabase client

### services/retailReportService.ts
- `fetchRetailReportData()` — builds RetailReportData with project reports, customer reports, supplier reports, supplier type summary, and invoice summary
- **Depends on:** supabase client

> **Removed:** `SupervisionReports.tsx`, `services/supervisionReportService.ts` and
> `pdf/supervisionReportPdf.ts` were deleted in September 2026. Nothing routed or imported the
> component — it had no entry in `App.tsx` and zero references — and its service queried
> `subcontractor_payments`, a table that exists in neither the production nor the dev database.
> Had anyone reached it, `generateProjectReport` would have thrown `PGRST205` on every call and
> the page would have rendered nothing at all, because the component destructured only `data` and
> `loading` from `useCachedData` and ignored its `error`. Supervision figures are available in
> the general report and in Site Management.

---

## Hooks

### hooks/useGeneralReportData.ts
- `useGeneralReportData()` — fetches ComprehensiveReport data for the last 6 months on mount with loading state
- **Calls:** generalReportService
- **Returns:** report, loading, refetch

---

## PDF Generators

### pdf/pdfCharts.ts
- `drawBarChart(pdf, ...)` — draws a vertical bar chart onto a jsPDF document
- `drawPieChart(pdf, ...)` — draws a pie/donut chart
- `drawLineChart(pdf, ...)` — draws a line chart
- `drawHorizontalBarChart(pdf, ...)` — draws a horizontal bar chart
- `drawProgressBar(pdf, ...)` — draws a progress bar
- `hexToRgb(hex)` — converts hex colour to RGB tuple
- `formatValue(value, type)` — formats a value for chart labels
- **Depends on:** jsPDF

### pdf/generalReportPdf.ts
- `generateGeneralReportPDF(report)` — generates a 10+ page executive PDF covering: cover page, KPIs, portfolio analytics, sales performance, funding & finance, construction status, accounting overview, TIC costs, bank accounts, contract distribution, cash flow trend, project portfolio, risk assessment, insights & recommendations
- In the project portfolio cards the project's category is appended to the location line (`Zagreb  ·  Stambeno`), keeping the fixed 50mm card height
- **Depends on:** jsPDF, pdfCharts.ts

### pdf/salesReportPdf.ts
- `generateSalesReportPDF(reportType, projectReport, customerReport, dateRange)` — generates a project sales PDF (overview, units, revenue, monthly trend, apartment details) or customer report PDF (distribution, insights)
- **Depends on:** jsPDF, pdfCharts.ts

### pdf/retailReportPdf.ts
- `generateRetailReportPdf(data)` — generates a retail portfolio PDF with project table, customer breakdown, and supplier-by-type analysis; loads Noto Sans (Google Fonts) for Croatian character support
- **Depends on:** jsPDF, pdfCharts.ts

---

## Views

### GeneralReports.tsx
- Full executive dashboard: 9 KPI summary cards, sales performance, funding structure, construction status, accounting overview, TIC costs, company investments, buildings summary, retail portfolio, contract distribution, cash flow analysis, per-project breakdown with project-category and risk badges, risk assessment, and PDF export
- **Uses hooks:** useGeneralReportData
- **Uses services:** generalReportPdf (for PDF export)
- **Uses Ui:** Card, StatGrid, Button, useToast

### SalesReports.tsx
- Project sales report (unit status, revenue, monthly trend, apartment list) or customer report (distribution, insights), with project selector, date range picker, and PDF export
- **Uses services:** salesReportService, salesReportPdf
- **Uses Ui:** Card, Table, Button, Select, useToast

### RetailReports.tsx
- Tabbed retail portfolio view (Pregled, Projekti, Prodaja, Troškovi) with refresh and PDF export buttons
- **Uses services:** retailReportService, retailReportPdf
- **Uses components:** PortfolioOverview, ProjectPerformanceTable, SalesAnalysis, CostAnalysis
- **Uses Ui:** Tabs, Button

### PortfolioOverview.tsx
- Retail portfolio KPI cards and finance summary sections (investments, income, profitability, ROI, overdue invoice alerts)
- Props: `data: RetailReportData`, `formatCurrency`

### ProjectPerformanceTable.tsx
- Sortable project comparison table (name, land cost, total costs, revenue, profit, ROI) with expandable phase breakdown rows and totals footer
- Props: `projects: ProjectReportData[]`, `formatCurrency`

### SalesAnalysis.tsx
- Customer-level sales and payment analysis: stat cards (ugovoreno, naplaćeno, za naplatu, u kašnjenju), customer payment table, invoice status bar
- Props: `customers: CustomerReportData[]`, `invoices: InvoiceSummary`, `formatCurrency`

### CostAnalysis.tsx
- Cost structure breakdown: pie chart by type (Zemljišta, Razvoj, Gradnja), supplier type summary, and supplier table with payment status
- Props: `data: RetailReportData`, `formatCurrency`

---

## Notes
- `src/utils/reportGenerator.ts` contains an older shared PDF utility used separately from these module-specific generators
- `dashboards/investmentReportPdf.ts` is a related PDF generator that lives in the Dashboards folder — not here
- `retailReportPdf.ts` uses Noto Sans (dynamically loaded from Google Fonts) to ensure Croatian characters render correctly in PDF — do not replace with helvetica for this file
- During the May 2026 audit the report services were refactored to batch their queries in a single `Promise.all` instead of sequential awaits — same tables, same output shape
- The long-running PDF generators (`salesReportPdf`, `retailReportPdf`) call `yieldToUI()` (`src/utils/yieldToUI.ts`) inside their row loops so a large export does not freeze the UI; this does not change report content
- All report views are internationalised (react-i18next, keys under `reports.*`) and dark-mode aware, and long tables expose per-cell `label` props for the mobile card layout — presentational only, the report data and sections are unchanged
- **EVM is not surfaced in any report.** The Earned Value Management utility (`src/utils/evm.ts`) is consumed only by the Budget Control feature (`src/components/General/BudgetControl/`)
