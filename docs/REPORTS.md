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

- **In a PDF, go through `pdf/pdfText.ts`** — `pdfMoney` (exact cents), `pdfMoneyRounded` (whole
  euros) and `pdfMoneyCompact` (`€1,2M`). They are the three helpers above wrapped in `winAnsi()`,
  which swaps `hr-HR`'s U+2212 minus for an ASCII hyphen. Every generator now embeds Noto Sans,
  which *has* U+2212, so this is belt and braces rather than the only line of defence — but it is
  two lines, an ASCII hyphen reads correctly in Croatian, and the day someone adds a generator and
  forgets the font, a number is still a number. It used to be three copies of `winAnsi` and two
  generators that needed it and did not have it.
- **Square metres are not money.** `m²` figures keep their own `toLocaleString('hr-HR')`.

---

## Types

### types.ts
- Exports: `ProjectData`, `ComprehensiveReport`, `SalesData`, `ProjectSalesReport`, `CustomerReport`, `ReportRisk`, `RiskKind`, `MonthlyData`, `WorkLog`
- Used by general, sales, and supervision report views and services
- **No English half any more.** Five fields existed only because the PDF generators read English
  prose the services built: `cash_flow[].month` and `SalesData.month` (`'MMM yyyy'` labels, one of
  them sliced to three characters for a chart axis), `ReportRisk.type` / `.description`, and
  `insights.recommendations`. They were deleted with the September 2026 export batch. What is left
  is machine-readable and formatted at the render site: `month_key` (`'YYYY-MM-DD'`), a risk as
  `{ kind, count }`, and `recommendation_keys` as i18n key paths

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
- Every draw function takes a `fontFamily` option. It used to hard-code `setFont('helvetica', …)`
  at **nine** sites and take no font at all, so a generator could embed Noto Sans, set it on the
  document, and still have every chart title, axis label, pie legend and progress-bar caption
  silently revert to the WinAnsi built-in — i.e. exactly the strings that carry Croatian. Callers
  pass `PDF_FONT_FAMILY`. Passing nothing keeps whatever face the document is already on
  (`pdf.getFont()`) rather than forcing one, so a generator inherits the embedded font the day it
  loads one instead of needing both edits at once
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
- `generateGeneralReportPDF(report, t, language)` — generates a 10+ page executive PDF covering: cover page, KPIs, portfolio analytics, sales performance, funding & finance, construction status, accounting overview, TIC costs, bank accounts, contract distribution, cash flow trend, project portfolio, risk assessment, insights & recommendations
- **Croatian, from the same keys the screen renders.** Roughly two thirds of its labels are
  `reports.general.*` keys that `GeneralReports.tsx` already used, so the document and the page
  cannot drift apart; only the PDF's own chrome (cover, footer, chart titles) lives under
  `reports.general.pdf.*`. Two shapes of key meet here — the screen's grid labels mostly end in a
  colon, its card labels mostly do not, and a progress-bar caption appends its own separator — so
  the file has `withColon()` and `bare()` rather than producing `Ukupno jedinica::`
- **The value columns are measured, not hard-coded.** They used to sit at fixed offsets
  (`margin + 35 / 45 / 50 / 55 / 125 / 145`) tuned to English; Croatian runs longer and seven of
  the fourteen columns overran their value outright — "Ukupna vrijednost investicija:" by 14mm,
  "Ukupno uredskih dobavljača:" by 13mm. `labelValueRows()` measures the widest label in each
  column and places the values past it, keeping the intended column when the labels are short and
  widening instead of colliding when they are not. The cover title and the KPI captions shrink to
  fit the same way
- In the project portfolio cards the project's category is appended to the location line (`Zagreb  ·  Stambeno`), keeping the fixed 50mm card height, and the risk badge maps `risk_level` through `RISK_LEVEL` rather than printing the stored `'High'`
- Logs `export.general_pdf` after `pdf.save()`; the file is `izvjestaj-portfelj-YYYY-MM-DD.pdf`
- **Depends on:** jsPDF, pdfCharts.ts, pdfText.ts, pdfFont.ts, formatters.ts, statusDisplay.ts

### pdf/salesReportPdf.ts
- `generateSalesReportPDF(reportType, projectReport, customerReport, dateRange)` — generates a project sales PDF (overview, units, revenue, monthly trend, apartment details) or customer report PDF (distribution, insights)
- **Depends on:** jsPDF, pdfCharts.ts

### pdf/retailReportPdf.ts
- `generateRetailReportPdf(data, t?)` — generates a retail portfolio PDF with project table, customer breakdown, and supplier-by-type analysis. `t` defaults to `exportT()`, so the caller needs no change
- Its Croatian used to be **hard-coded**, which meant none of it could be reused, none of it was covered by the locale parity guard, and it had drifted: `Zemljiste` and `m2` were transliterations left over from before the font was embedded, in the one generator that always had the glyphs to spell them. The strings are now keys — mostly the retail screens' own (`reports.portfolio.*`, `reports.costs.*`, `reports.project_performance.*`, `common.*`), with `reports.retail.pdf.*` for what is only in the document. `Plac.` / `Nepl.` became the full "Plaćeno" / "Neplaćeno": the rows are right-aligned and had 60mm to spare
- Its local `fmt` is `formatEuroRounded`, so amounts read `€1.235`, not `1.235 €`
- Logs `export.retail_pdf`; the file is `izvjestaj-retail-YYYY-MM-DD.pdf`
- **Depends on:** jsPDF, pdfFont.ts, formatters.ts, exportLanguage.ts

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
- The export goes through `useAsyncExport(generateGeneralReportPDF, 'reports.general.pdf_error')`,
  not the eleven hand-rolled lines of try/catch/toast it used to be, and hands the generator
  `exportT()` + `EXPORT_LANGUAGE` rather than the page's own `t` — the document is Croatian
  whatever the reader of the screen has selected

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

## Language, dates and service-built prose

### The exports decision — landed September 2026

- **Every export is Croatian, whatever the UI language**, via `exportT()`
  (`src/utils/exportLanguage.ts`, a thin `i18n.getFixedT('hr')`). These files go to a bank, an
  investor or the accountant, and the recipient's language has nothing to do with whichever
  language the person clicking Export happens to be reading the app in. Generators take
  `(…, t, language)`; the caller passes `exportT()` and `EXPORT_LANGUAGE`.
- **Exports read the same locale files as the screens.** About two thirds of the labels a report
  needs were already translated for the equivalent screen, so a generator reuses those keys rather
  than carrying a second set of strings (which is how `retailReportPdf` ended up with `Zemljiste`
  while the screen said `Zemljište`). `pdf/pdfExportKeys.test.ts` scans all four generators and
  fails if any key they name is missing from either bundle — an unresolved key does not throw in
  i18next, it prints the key path into a document that has already left the building.
- **The font is local and there is no fallback.** `src/utils/pdfFont.ts` imports the two Noto Sans
  faces from `src/assets/fonts/` as Vite assets and **throws** if they cannot be loaded. A failure
  means a broken deploy; the honest response is to fail the export through `useAsyncExport`'s
  toast rather than hand someone a corrupted document with a company letterhead on it. Only
  `normal` and `bold` are registered — asking jsPDF for `italic` silently gets Times-Italic.
- **Croatian filenames, ASCII only**, through `exportFileName()`: `izvjestaj-portfelj-2026-09-23.pdf`.
- **Every export is logged** at `severity: 'low'` with its row count, inside the generator, after
  the file is written — see `docs/ACTIVITY_LOG.md` → Reports.
- **The TIC export stays Croatian and its sheet layout must not change.** `ticImport.ts` reads its
  own output back, so a column moved for cosmetic reasons breaks the round trip.

### The screens

Screens and exports are both Croatian-first now; they differ only in that an export is Croatian
*unconditionally* while a screen follows the user.

- **Dates go through `src/utils/formatters.ts`.** `formatDate` / `formatDateTime` /
  `formatMonthYear` / `formatMonthShort` take the language explicitly, so the executive report's
  "Generirano:" line reads `05.01.2026.` in Croatian and `Jan 05, 2026` in English. No view and no
  generator calls date-fns `format` any more, and `i18nGuards.test.ts` enforces it — its allowlist
  no longer excuses `Reports/pdf/**` or the two report services.
- **The services hand over machine values, not prose.** A month is `month_key`
  (`'YYYY-MM-DD'`) — `formatMonthYear` for a table row, `formatMonthShort` (`sij`) for the
  six-bar chart axis the old English label was sliced to three characters for. A risk is
  `{ kind, count }`. A recommendation is an i18n key path. A service has no translator and must
  not decide anyone's language; the five English fields that existed only for the PDFs are gone.
- **`generalReportService` no longer writes English prose.** A risk is `{ kind, count }`
  (`ReportRisk`) and `GeneralReports` renders `reports.general.risks.<kind>.*`; the four strategic
  recommendations are keys under `reports.general.recs.*`. This is the shape
  `dashboards/utils/directorAlerts.ts` settled on. A service has no translator and must not decide
  the user's language.
- **The interpolated summary sentences are whole keys**, not `t()` output with English glue
  welded on: `reports.general.summary_portfolio` / `_financial` / `_capital` / `_sales` /
  `_construction`, `units_value`, `phases_value`, `funding_value`, `top_project_line`, and the
  sales report's `highlight_*` / `opportunity_*` family. Croatian word order differs from
  English, so each sentence has to be translatable as a unit.
- **Status and risk badges use the shared maps** in `src/utils/statusDisplay.ts` —
  `PROJECT_STATUS` in `GeneralReports`, `SalesReports` and `ProjectPerformanceTable` (which had
  its own local `statusBadgeVariants`), `RISK_LEVEL` for the project risk badge, which read
  "Rizik: High". The stored value stays English; only the label is mapped.
- Supplier types (Retail / Site / Office / Mixed) in `CostAnalysis` are **not** translated — they
  are internal domain labels, per the sweep's decision.

---

## Notes
- `dashboards/investmentReportPdf.ts` is a related PDF generator that lives in the Dashboards folder — not here
- **All four generators** embed Noto Sans through `src/utils/pdfFont.ts` (a local asset, not a
  Google Fonts fetch) and draw everything in `PDF_FONT_FAMILY`. Do not reintroduce `helvetica`
  anywhere: WinAnsi has no `č`, `ć` or `đ`, and one unmapped character makes jsPDF re-encode the
  whole string as UCS-2BE, which renders as noise — `Račun` came out as `R a u n`. That is not a
  dropped accent, it is an unreadable line
- During the May 2026 audit the report services were refactored to batch their queries in a single `Promise.all` instead of sequential awaits — same tables, same output shape
- The long-running PDF generators (`salesReportPdf`, `retailReportPdf`) call `yieldToUI()` (`src/utils/yieldToUI.ts`) inside their row loops so a large export does not freeze the UI; this does not change report content
- All report views are internationalised (react-i18next, keys under `reports.*`) and dark-mode aware, and long tables expose per-cell `label` props for the mobile card layout — presentational only, the report data and sections are unchanged
- **EVM is not surfaced in any report.** The Earned Value Management utility (`src/utils/evm.ts`) is consumed only by the Budget Control feature (`src/components/General/BudgetControl/`)
