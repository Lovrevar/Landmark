# Module: Reports

**Path:** `src/components/Reports/`

## Overview

Cross-domain reporting with PDF export. Aggregates data from Cashflow, Sales, Retail, Supervision, and Funding into structured reports and portfolio views. All report services are read-only.

## Money formatting

Every money figure in this module — screen and PDF — goes through the shared helpers in
`src/utils/formatters.ts`. Nothing here formats currency by hand any more.

| Helper | Output | Used for |
|---|---|---|
| `formatEuro` | `€1.234,56` | exact cents — unit prices, per-invoice amounts (sales report) |
| `formatEuroRounded` | `€1.235` | aggregates — totals, balances, contract and budget rollups |
| `formatEuroCompact` | `€1,2M` / `€45K` / `€9.500` | KPI tiles, summary lines, chart labels |

All three take `number | null | undefined` and render `—` when the value is not a finite number,
so a missing budget can never read as `€0`. The euro sign comes **first**, matching `docs/CORE.md`;
the local `Intl` formatters with `style: 'currency'` (which emitted `1.235 €`) are gone.

Two things to know before adding a figure here:

- **`hr-HR` writes its minus as U+2212, which is not in WinAnsi.** jsPDF's built-in fonts are
  WinAnsi-encoded, and a single U+2212 makes jsPDF re-encode the *whole* string as two-byte
  characters that then render as mojibake — a negative net cash flow would come out as garbage.
  `generalReportPdf.ts` and `salesReportPdf.ts` therefore wrap the helpers in a local `winAnsi()`
  that swaps U+2212 for an ASCII hyphen. `retailReportPdf.ts` needs no such wrapper: it embeds
  Noto Sans, which has the character. The euro sign itself is fine in WinAnsi (0x80).
- **Square metres are not money.** `m²` figures keep their own `toLocaleString('hr-HR')`.

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
- **One failed query fails the whole report.** supabase-js resolves a failure as `{ data: null, error }` rather than rejecting, and every read here falls back to `[]`, so until September 2026 a dropped request produced an executive report of zeros — and exported it to PDF. `throwIfAnyFailed()` checks both `Promise.all` batches (the 27 top-level reads and the garage/repository price lookup) and throws, which `useCachedData` hands the page as an `error`
- **Depends on:** supabase client

### services/salesReportService.ts
- `fetchProjects()` — fetches project list for report selector
- `generateProjectReport(selectedProject, projects, dateRange)` — fetches apartments, garage/repository prices, monthly sales trend, and unit status for a project
- `generateCustomerReport(dateRange)` — fetches customer list with sales, payment distribution, and insights
- **Depends on:** supabase client

### services/retailReportService.ts
- `fetchRetailReportData()` — builds RetailReportData with project reports, customer reports, supplier reports, supplier type summary, and invoice summary
- Same rule as the general report: any of its seven reads failing throws, rather than rendering a retail portfolio of zeros that is indistinguishable from a company that owns no land
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
- **Returns:** report, loading, error, fetchedAt, refetch — `error` was deliberately omitted from
  the result interface until September 2026, which is why the page could only say "No data"

---

## PDF Generators

### pdf/pdfCharts.ts
- `drawBarChart(pdf, ...)` — draws a vertical bar chart onto a jsPDF document
- `drawPieChart(pdf, ...)` — draws a pie/donut chart
- `drawLineChart(pdf, ...)` — draws a line chart
- `drawHorizontalBarChart(pdf, ...)` — draws a horizontal bar chart
- `drawProgressBar(pdf, ...)` — draws a progress bar
- `hexToRgb(hex)` — converts hex colour to RGB tuple
- Bar, pie and horizontal-bar charts take a `valueFormat` option: `'currency'` (the default, via
  `formatEuroCompact`) or `'plain'` for the charts whose data points are counts or percentages —
  invoice status, contract distribution, unit status, profit margin. Without it those rendered a
  euro sign on a count ("€12" for twelve invoices)
- **Depends on:** jsPDF, `src/utils/formatters.ts`

### pdf/generalReportPdf.ts
- `generateGeneralReportPDF(report)` — generates a 10+ page executive PDF covering: cover page, KPIs, portfolio analytics, sales performance, funding & finance, construction status, accounting overview, TIC costs, bank accounts, contract distribution, cash flow trend, project portfolio, risk assessment, insights & recommendations
- In the project portfolio cards the project's category is appended to the location line (`Zagreb  ·  Stambeno`), keeping the fixed 50mm card height
- **Depends on:** jsPDF, pdfCharts.ts

### pdf/salesReportPdf.ts
- `generateSalesReportPDF(reportType, projectReport, customerReport, dateRange)` — generates a project sales PDF (overview, units, revenue, monthly trend, apartment details) or customer report PDF (distribution, insights)
- **Depends on:** jsPDF, pdfCharts.ts

### pdf/retailReportPdf.ts
- `generateRetailReportPdf(data)` — generates a retail portfolio PDF with project table, customer breakdown, and supplier-by-type analysis; loads Noto Sans (Google Fonts) for Croatian character support
- Its local `fmt` is `formatEuroRounded`, so amounts read `€1.235`, not `1.235 €`
- **Depends on:** jsPDF, pdfCharts.ts

---

## Views

> **Failed load vs. empty result.** All three `useCachedData` screens now separate the two, and
> none of them may render a failure as zeros:
> - **Loading, nothing yet** → spinner (unchanged).
> - **Failed, nothing loaded** → `<ErrorState onRetry={refetch} />` (`src/components/ui`) in the
>   content area, with the page header and filters left mounted so the user can retry in place.
> - **Genuinely empty** → the ordinary empty state (`reports.general.no_data`, `common.no_data`).
>
> `e2e/reports/load-failure.spec.ts` pins this end to end: it aborts the report's own REST reads
> (narrowly — aborting all of `/rest/v1/` also kills AuthContext's `users` lookup and bounces the
> session to `/login`), asserts the error copy and retry are shown and the "no data" copy is not,
> then unroutes and retries and asserts the report renders.

### GeneralReports.tsx
- Full executive dashboard: 9 KPI summary cards, sales performance, funding structure, construction status, accounting overview, TIC costs, company investments, buildings summary, retail portfolio, contract distribution, cash flow analysis, per-project breakdown with project-category and risk badges, risk assessment, and PDF export
- **Uses hooks:** useGeneralReportData
- **Uses services:** generalReportPdf (for PDF export)
- **Uses Ui:** Card, StatGrid, Button, ErrorState, EmptyState, useToast
- The blue gradient header is hoisted above the loading/error branches so it survives a failed
  load; the "generated at" line and the PDF export button render only with a report behind them,
  since exporting a report nobody could load would produce a PDF of zeros

### SalesReports.tsx
- Project sales report (unit status, revenue, monthly trend, apartment list) or customer report (distribution, insights), with project selector, date range picker, and PDF export
- **Uses services:** salesReportService, salesReportPdf
- **Uses Ui:** Card, Table, Button, Select, ErrorState, useToast
- Two `useCachedData` calls back the two report types; the error surfaced belongs to whichever
  type is selected (`reportError` / `retryReport`). The configuration panel stays mounted, so the
  date range and project selection survive a failure
- Still open: `loadProjects()` is an inline fetch that logs and leaves the project list empty on
  failure — one of the ~23 in-component fetches deferred by the September 2026 batch

### RetailReports.tsx
- Tabbed retail portfolio view (Pregled, Projekti, Prodaja, Troškovi) with refresh and PDF export buttons
- **Uses services:** retailReportService, retailReportPdf
- **Uses components:** PortfolioOverview, ProjectPerformanceTable, SalesAnalysis, CostAnalysis
- **Uses Ui:** Tabs, Button, ErrorState, EmptyState
- It used to show "Error loading data" off `!data` alone, so an empty portfolio read as a failure
  and a failure could not be told from an empty portfolio. The error state is gated on `error`;
  the no-data case uses `common.no_data`, and `reports.retail.error` / `.retry` are gone (the
  latter also carried the odd-one-out "Pokušaj ponovo" — the shared key says "ponovno")
- The `formatCurrency` prop it hands to all four panels **is** `formatEuroRounded`
  (`src/utils/formatters.ts`) — it is no longer a local `Intl` formatter, so the ~40 amounts in
  those panels now read `€1.235` rather than `1.235 €`. Changing this one binding changes all of
  them; the panels do not format money themselves

### PortfolioOverview.tsx
- Retail portfolio KPI cards and finance summary sections (investments, income, profitability, ROI, overdue invoice alerts)
- Props: `data: RetailReportData`, `formatCurrency` (`(n: number | null | undefined) => string`, bound to `formatEuroRounded`)

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
- `dashboards/investmentReportPdf.ts` is a related PDF generator that lives in the Dashboards folder — not here
- `retailReportPdf.ts` uses Noto Sans (dynamically loaded from Google Fonts) to ensure Croatian characters render correctly in PDF — do not replace with helvetica for this file
- During the May 2026 audit the report services were refactored to batch their queries in a single `Promise.all` instead of sequential awaits — same tables, same output shape
- The long-running PDF generators (`salesReportPdf`, `retailReportPdf`) call `yieldToUI()` (`src/utils/yieldToUI.ts`) inside their row loops so a large export does not freeze the UI; this does not change report content
- All report views are internationalised (react-i18next, keys under `reports.*`) and dark-mode aware, and long tables expose per-cell `label` props for the mobile card layout — presentational only, the report data and sections are unchanged
- **EVM is not surfaced in any report.** The Earned Value Management utility (`src/utils/evm.ts`) is consumed only by the Budget Control feature (`src/components/General/BudgetControl/`)
