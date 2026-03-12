# Module: Reports

**Path:** `src/components/Reports/`

## Overview
Cross-domain reporting with PDF export. Aggregates data from Cashflow, Sales, Retail, and Supervision into structured reports and portfolio views.

## Files

| File | Purpose |
|---|---|
| `GeneralReports.tsx` | General financial report view |
| `CostAnalysis.tsx` | Cost breakdown analysis view |
| `PortfolioOverview.tsx` | High-level portfolio summary across all projects |
| `ProjectPerformanceTable.tsx` | Per-project KPI table |
| `SalesReports.tsx` | Sales pipeline and revenue reports |
| `SalesAnalysis.tsx` | Deeper sales data analysis view |
| `RetailReports.tsx` | Retail project reports |
| `SupervisionReports.tsx` | Construction site progress reports |

## Hooks
| File | Purpose |
|---|---|
| `useGeneralReportData.ts` | Fetches and aggregates data for general reports |

## Services
| File | Purpose |
|---|---|
| `generalReportService.ts` | Queries for general report data |
| `salesReportService.ts` | Queries for sales report data |
| `retailReportService.ts` | Queries for retail report data |
| `supervisionReportService.ts` | Queries for supervision report data |

## PDF Generation
**Path:** `Reports/pdf/`

| File | Purpose |
|---|---|
| `generalReportPdf.ts` | Generates general report PDF |
| `salesReportPdf.ts` | Generates sales report PDF |
| `retailReportPdf.ts` | Generates retail report PDF |
| `supervisionReportPdf.ts` | Generates supervision report PDF |
| `pdfCharts.ts` | Shared chart rendering helpers for PDFs |

## Notes
- `src/utils/reportGenerator.ts` contains shared PDF generation utilities used by this module
- `dashboards/investmentReportPdf.ts` is a related PDF generator that lives in the Dashboards folder — not here
- `types.ts` and `retailReportTypes.ts` define report-specific types locally
