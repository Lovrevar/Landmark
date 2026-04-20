# General, Reports & Dashboards

_Part of the [Cognilion Manual Testing Cheat Sheet](../TESTING.md). See that file for status markers and how to walk this document._

_Preconditions: profile = General. Role for full access: Director. Accounting/Sales/Supervision/Investment roles may have partial visibility. Seed data: ≥3 projects with milestones and phases, ≥1 TIC, ≥1 overdue invoice, some activity log entries._

## General → Projects

_Route: `/projects`. Core project list with search, status filter, and grid layout. Detail view at `/projects/:id` via ProjectDetailsEnhanced._

### List, search, filter

open the page — ProjectCard grid shows all projects with status badge, budget, spent, remaining, progress bar, milestone count, days info ( )
page with **no** projects — EmptyState shown                                                                        ( )
search by name — matching cards filter                                                                              ( )
search by location — matches                                                                                        ( )
search with Croatian characters (č, ć, š, đ, ž) — matches                                                           ( )
search term not found — empty grid                                                                                  ( )
filter by status (Planning / In Progress / Completed / On Hold) — cards update                                      ( )
combine search + status filter — AND logic                                                                          ( )

### New project (ProjectFormModal, create mode)

click "New Project" — modal opens with empty fields                                                                 ( )
submit with all required fields (name, location, start_date, budget) — project created                             ( )
submit with name empty — inline `fieldErrors.name`                                                                  ( )
submit with location empty — inline `fieldErrors.location`                                                          ( )
submit with start_date empty — inline `fieldErrors.start_date`                                                      ( )
submit with budget empty or 0 — inline `fieldErrors.budget`                                                         ( )
submit with whitespace-only name/location — blocked (`.trim()`)                                                    ( )
submit with budget = negative — blocked (`min="0"`)                                                                 ( )
submit with end_date before start_date — server or UI rejects                                                       ( )
submit with Croatian characters in name/location — saves correctly                                                  ( )
change status between Planning / In Progress / Completed / On Hold — saves                                          ( )
cancel — no row created                                                                                             ( )

### Edit / delete project (ProjectFormModal, edit mode)

open edit → all fields pre-populated                                                                                ( )
edit a field — "Update project" enables; save persists                                                              ( )
click "Delete project" → ConfirmDialog opens                                                                        ( )
confirm delete — project + cascaded relations handled (sub-entities blocked or cascade)                             ( )
cancel delete — no change                                                                                           ( )
edit with name cleared — inline error                                                                               ( )

### Project detail view (ProjectDetailsEnhanced)

navigate to `/projects/:id` — tabbed view with Overview / Phases & Contracts / Apartments / Subcontractors / Financing / Milestones ( )
Overview tab shows stats (budget, spent, revenue, expenses, pending invoices, investor names)                      ( )
Phases & Contracts tab shows phase budget breakdown and contract table                                              ( )
Apartments tab shows apartment table for the project                                                                ( )
Subcontractors tab shows contracts grouped by subcontractor                                                         ( )
Financing tab shows credits and investor contributions                                                              ( )
Milestones tab shows MilestoneTimeline + inline add form                                                            ( )
invalid :id in the URL — 404 / redirect                                                                             ( )

### Milestones (inline form + MilestoneTimeline)

add a milestone with name + due_date — appears in timeline                                                          ( )
add with name empty — `milestoneFieldErrors.name` shown; submit blocked                                             ( )
add with due_date empty — accepted or blocked per spec                                                              ( )
add with Croatian characters                                                                                        ( )
toggle a milestone's completion checkbox — status updates live                                                      ( )
edit a milestone — name/date updates                                                                                ( )
delete a milestone — ConfirmDialog chain                                                                            ( )
overdue milestone shows red status color                                                                            ( )
completed milestone shows green status color                                                                        ( )
milestone summary stats reflect completed/overdue/pending counts                                                    ( )

---

## Budget Control

_Route: `/budget-control`. Standalone EVM (Earned Value Management) dashboard with project selector, metric cards, bar chart, scatter chart, and EVM indices._

### Project selector

open the page — dropdown lists all projects                                                                         ( )
select a project — metrics load, charts render                                                                      ( )
select a project that has **no** phases — EVM calculations use zero inputs, page shouldn't crash                   ( )
select a project that has **no** contracts — committed = 0, paid = 0                                               ( )
change project — all metrics/charts recompute                                                                       ( )

### Metric cards

TIC card shows current TIC total from the project's TIC data                                                        ( )
Planned Budget card shows project.budget                                                                            ( )
Committed card shows sum of active+draft contract amounts + % of budget                                             ( )
Paid card shows sum of budget_realized + % of committed                                                             ( )
Forecast EAC card shows predicted end cost + Under/Over Budget badge                                                ( )

### Budget Control bar chart

chart renders 4 bars: Planned, Committed, Paid, Forecast EAC                                                        ( )
bar colors match (planned=blue, committed=orange, paid=green, forecast=red)                                         ( )
large values format with K/M suffixes (e.g. €1.5M)                                                                  ( )
project with all-zero values — chart renders empty bars gracefully                                                  ( )

### EVM Indices scatter chart

CPI scatter point rendered against Target (1.0) and Warning (0.95) reference lines                                  ( )
SPI scatter point rendered against the same reference lines                                                         ( )
CPI = 1.0 → green status, label "Under budget ✓"                                                                    ( )
CPI = 0.97 → yellow status, label "Slightly over budget"                                                            ( )
CPI = 0.85 → red status, label "Over budget ✗"                                                                      ( )
SPI = 1.0 → green "On schedule ✓"                                                                                   ( )
SPI = 0.9 → red "Behind schedule ✗"                                                                                 ( )

### EVM Performance Metrics

CPI, SPI, EAC, VAC, Completion % shown with progress bar                                                            ( )
Completion % matches `sum(budget_realized) / sum(contract_amount)` per phase, aggregated                            ( )
EAC = project.budget / CPI (or similar formula in `calculateProjectEVM`) — verify with known values                 ( )
VAC (Variance at Completion) shows sign + color                                                                     ( )

### Permissions

non-Director visits `/budget-control` — depends on route guards; verify expected access                             ( )

---

## Activity Log

_Route: `/activity-log`. **Director-only** — `canViewActivityLog(user)` redirects non-Directors to `/`. Server-side filtering + pagination via `get_activity_logs` RPC._

### Director-only guard

login as Director, open `/activity-log` — full table loads                                                          ( )
login as non-Director (Accounting, Sales, Supervision, Investment) — redirected to `/`                             ( )
login as Director, switch to another role in AuthContext (if possible) — page re-evaluates access                   ( )

### List rendering

open the page with logs — table shows Timestamp (hr-HR), User (name+role badge), Action (i18n label), Entity (type+truncated id), Project, Severity badge, Details icon ( )
open the page with **no** logs — EmptyState shown                                                                   ( )
severity badges render correct colors: low=green/gray, medium=yellow/blue, high=red                                 ( )
long action names truncate or wrap gracefully                                                                       ( )

### Filters

search (500ms debounced) by action name — table filters server-side                                                 ( )
search by entity_name — matches                                                                                     ( )
filter by user (user dropdown lists all logged users) — results narrow                                              ( )
filter by category (35 action categories, ACTION_CATEGORIES) — results narrow                                       ( )
filter by severity (low / medium / high / ALL) — results narrow                                                     ( )
filter by project — results narrow                                                                                  ( )
set `dateFrom` only — results from that date                                                                        ( )
set `dateTo` only — results up to that date                                                                         ( )
set `dateFrom > dateTo` — empty results, no crash                                                                   ( )
combine multiple filters (user + category + severity) — AND logic                                                   ( )
click "Reset filters" — all selectors reset to ALL, date cleared, page = 1                                          ( )
click Refresh — logs reload                                                                                         ( )

### Pagination

navigate to page 2 — new logs fetched server-side                                                                   ( )
navigate past last page — empty or button disabled                                                                  ( )
change filter while on page > 1 — returns to page 1                                                                 ( )
totalCount matches the filter query                                                                                 ( )

### Detail modal (ActivityLogDetailModal)

click the eye icon on a row — modal opens with User info / Entity info / Metadata key-value pairs                  ( )
modal shows User name, role, email (if present)                                                                     ( )
modal shows Entity type + entity_id                                                                                 ( )
modal shows Metadata pairs (e.g. `entity_name`, `changed_fields`, `count`)                                          ( )
entity with a known `ENTITY_ROUTE_MAP` route → "View Entity" button navigates                                       ( )
entity with no route → "View Entity" hidden                                                                         ( )
close modal via X, Esc, and backdrop — all close                                                                    ( )

### Cross-verify with source actions

create an invoice in Cashflow → open Activity Log → verify row with `invoice.create`, severity=medium, entity_name metadata ( )
bulk-update apartment prices → verify row with `apartment.bulk_price_update`, severity=high, `count` metadata      ( )
delete an invoice → verify `invoice.delete`, severity=high                                                          ( )
approve an invoice → verify a distinct action (e.g. `invoice.approve`)                                              ( )
read-only operations (opening a page) should **not** produce log entries                                            ( )

---

## Reports

_Routes: `/general-reports`, `/sales-reports`, `/retail-reports`. All read-only. PDF export via jsPDF._

### General Reports (`/general-reports`)

open the page — 9 KPI summary cards render (portfolio value, sales rate, D/E ratio, etc.)                          ( )
sales performance section shows data if any sales exist                                                             ( )
construction status section aggregates phase/contract data                                                          ( )
accounting overview shows totals                                                                                    ( )
TIC cost management section renders                                                                                 ( )
company investments, buildings summary, retail portfolio sections render                                            ( )
contract distribution pie-chart-like layout                                                                         ( )
cash flow analysis chart                                                                                            ( )
per-project breakdown with risk badges                                                                              ( )
insights & recommendations list                                                                                     ( )
click "Export PDF" — 10+ page executive PDF downloads                                                               ( )
export when all numeric values are 0 — PDF still generates without division errors                                  ( )
Croatian characters render correctly in PDF                                                                         ( )
refresh button re-fetches data                                                                                      ( )

### Sales Reports (`/sales-reports`)

open the page — project selector + date range picker + report-type toggle (Project / Customer)                     ( )
select a project → project sales report (units, revenue, monthly trend, apartment details)                          ( )
switch to Customer report — customer distribution + insights render                                                ( )
date range start only → from-date applied                                                                          ( )
date range end only → to-date applied                                                                              ( )
date range start > end → empty or filtered-out report                                                              ( )
click "Export PDF" on project report — project sales PDF downloads                                                 ( )
click "Export PDF" on customer report — customer PDF downloads                                                      ( )
project with no sales → report shows empty sections, no crash                                                      ( )
project with Croatian-character names → renders correctly in PDF                                                   ( )

### Supervision Reports (accessed via SupervisionReports component)

open → project selector + date range                                                                               ( )
select a project → budget performance, contract status, monthly performance table, first 10 work logs, highlights render ( )
click "Export PDF" → construction PDF downloads                                                                    ( )
project with no contracts — empty sections                                                                         ( )

### Retail Reports (`/retail-reports`)

open — tabbed interface (Pregled / Projekti / Prodaja / Troškovi)                                                  ( )
Pregled tab (PortfolioOverview) shows KPI cards, finance summary, overdue-invoice alerts                            ( )
Projekti tab (ProjectPerformanceTable) sortable — click each column header, sort asc/desc                          ( )
expand a project row → phase breakdown appears                                                                     ( )
totals footer sums all project values                                                                              ( )
Prodaja tab (SalesAnalysis) shows customer payment table, stat cards, invoice status bar                            ( )
Troškovi tab (CostAnalysis) shows pie chart by type (Zemljišta / Razvoj / Gradnja), supplier type summary          ( )
click "Export PDF" → retail PDF downloads with Noto Sans font (Croatian chars)                                      ( )
click "Refresh" → data reloads from retailReportService                                                            ( )
no data — each tab shows EmptyState                                                                                ( )

---

## Dashboards (per profile)

_Each profile renders a distinct dashboard at `/`. Verify widgets, counts, and link navigation for all 6 profiles × applicable roles._

### DirectorDashboard (profile = General, role = Director)

financial metrics section shows revenue, expenses, debt, equity, receivables, payables                              ( )
project table lists all projects with budget / expenses / revenue / profit margin / completion %                    ( )
click a project row → navigates to `/projects/:id`                                                                  ( )
alerts section shows up to 6 critical/warning/info alerts                                                           ( )
construction metrics panel                                                                                          ( )
funding metrics panel                                                                                               ( )
counts match source (e.g. total projects = `ProjectsManagement` grid count)                                         ( )

### AccountingDashboard (profile = Cashflow, role = Accounting/Director)

VAT stats panel shows collected / paid / net + monthly breakdown                                                   ( )
Cashflow stats: incoming / outgoing / net with YoY comparison                                                      ( )
Budget section shows current monthly budget + % usage                                                              ( )
Top 5 companies by net balance                                                                                     ( )
Monthly trends stacked bar chart                                                                                   ( )
Accounting user without Cashflow unlock — redirected by CashflowRoute                                              ( )

### SalesDashboard (profile = Sales)

pipeline metrics stat grid                                                                                         ( )
6-month sales trend chart                                                                                          ( )
payment method breakdown                                                                                           ( )
recent sales list (10 most recent)                                                                                 ( )
click a sale row → navigates to apartment detail or sales screen                                                   ( )
counts reconcile against Sales/Customers/Apartments modules                                                        ( )

### SupervisionDashboard (profile = Supervision)

tabbed interface: Week / Status / Issues                                                                           ( )
Week tab shows work logs for current ISO week with blocker/notes blocks                                            ( )
Status tab shows subcontractor performance cards with progress + deadline tracking                                 ( )
Issues tab shows overdue tasks, critical deadlines, items needing attention                                        ( )
Supervision role auto-redirects from `/` to `/site-management` — verify this path in App.tsx                       ( )

### InvestmentDashboard (profile = Funding, role = Investment/Director)

4-card summary: total portfolio value / total debt / available credit / utilization                                 ( )
Credits table shows each credit with utilization progress, dates, expiry warnings                                   ( )
recent activity list                                                                                               ( )
click "Export PDF" → investment PDF downloads with donut + bar charts, credit details, project summaries            ( )
PDF handles Croatian chars                                                                                         ( )

### RetailDashboard (profile = Retail)

KPI stat grid (projects, customers, invoices, revenue)                                                             ( )
project overview section                                                                                           ( )
payment tracking section                                                                                           ( )
overdue invoice warnings list with days overdue                                                                    ( )
no overdue invoices → warning panel hidden or shows "all on time"                                                  ( )
click through to detail pages for each overdue invoice                                                             ( )

### Cross-profile switching

switch profile from General → Sales — dashboard re-renders for Sales                                                ( )
switch to Cashflow → password prompt if not unlocked, then AccountingDashboard                                      ( )
switch to Funding → InvestmentDashboard                                                                            ( )
switch to Retail → RetailDashboard                                                                                  ( )
switch to Supervision → auto-redirect to `/site-management`                                                         ( )
profile preference persists across reload (localStorage `currentProfile`)                                           ( )
