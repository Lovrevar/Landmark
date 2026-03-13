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

### services/supervisionReportService.ts
- `fetchProjects()` — fetches project list for report selector
- `generateProjectReport(selectedProject, projects, dateRange)` — fetches contracts, phases, payments, subcontractors, work logs, investor names; computes budget utilization and contract status distribution
- **Depends on:** supabase client

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
- **Depends on:** jsPDF, pdfCharts.ts

### pdf/salesReportPdf.ts
- `generateSalesReportPDF(reportType, projectReport, customerReport, dateRange)` — generates a project sales PDF (overview, units, revenue, monthly trend, apartment details) or customer report PDF (distribution, insights)
- **Depends on:** jsPDF, pdfCharts.ts

### pdf/supervisionReportPdf.ts
- `generateSupervisionReportPDF(projectReport, dateRange)` — generates a construction PDF with project overview, monthly budget performance, contract details, and work log summary
- **Depends on:** jsPDF, pdfCharts.ts

### pdf/retailReportPdf.ts
- `generateRetailReportPdf(data)` — generates a retail portfolio PDF with project table, customer breakdown, and supplier-by-type analysis; loads Noto Sans (Google Fonts) for Croatian character support
- **Depends on:** jsPDF, pdfCharts.ts

---

## Views

### GeneralReports.tsx
- Full executive dashboard: 9 KPI summary cards, sales performance, funding structure, construction status, accounting overview, TIC costs, company investments, buildings summary, retail portfolio, contract distribution, cash flow analysis, per-project breakdown with risk badges, risk assessment, and PDF export
- **Uses hooks:** useGeneralReportData
- **Uses services:** generalReportPdf (for PDF export)
- **Uses Ui:** Card, StatGrid, Button

### SalesReports.tsx
- Project sales report (unit status, revenue, monthly trend, apartment list) or customer report (distribution, insights), with project selector, date range picker, and PDF export
- **Uses services:** salesReportService, salesReportPdf
- **Uses Ui:** Card, Table, Button, Select

### SupervisionReports.tsx
- Construction dashboard: budget performance overview, contract status distribution, monthly performance table, first 10 work logs, highlights & recommendations, and PDF export
- **Uses services:** supervisionReportService, supervisionReportPdf
- **Uses Ui:** Card, Table, Button, Select

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
