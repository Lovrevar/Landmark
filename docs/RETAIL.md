# Module: Retail

**Path:** `src/components/Retail/`

## Overview

Manages retail real estate operations: development projects with phases and milestones, retail sales contracts, customers, invoices, and land plot tracking. Distinct from the Sales module (which handles apartment buildings) — Retail covers land development and parcel sales.

---

## Shared Utilities

### utils.ts
- `formatCurrency(value)` — whole-euro display for Retail. Now an alias of the shared
  `formatEuroRounded` ([`src/utils/formatters.ts`](../src/utils/formatters.ts)), so it renders
  `€1.235` with the € leading; it used to build its own `Intl` currency formatter, which put the
  symbol last (`1.235 €`). The same delegation was applied to the per-screen `formatCurrency`
  copies in `Projects/ProjectStatistics`, `Projects/MilestoneList`, `Projects/PhaseCard`
  (exact cents, `formatEuro`), `Projects/forms/MilestoneFormModal` (exact cents) and
  `Projects/modals/EditPhaseModal` — call sites were left untouched
- `getStatusBadgeVariant(status)` — badge variant for `retail_projects.status`. Now delegates to
  the shared `PROJECT_STATUS` map ([`src/utils/statusDisplay.ts`](../src/utils/statusDisplay.ts)),
  so a retail project reads the same as a General or Sales one; it used to carry its own table
  with "Planning" yellow and "On Hold" grey, the inverse of everywhere else. Pair it with
  `statusLabel(PROJECT_STATUS, status, t)` for the text — `ProjectsGrid` and `ProjectDetail`
  printed the raw English column value in a Croatian UI

---

## Sub-modules

### Projects
**Path:** `Retail/Projects/`

Core retail module. Tracks development projects through phases (development, construction, sales) and milestones, with supplier contracts and invoice tracking per phase.

#### Services

### services/retailProjectService.ts
- Fetches retail projects, project details, and contracts grouped by phase. `fetchAllProjects` now batch-fetches all phases in one `.in()` query and groups them in memory (was per-project fan-out)
- `fetchContractsByPhases(phaseIds)` — batch variant of `fetchContractsByPhase`; fetches contracts for many phases at once (with supplier/customer joins) plus their `accounting_invoices` totals, and returns a `Map<phaseId, RetailContract[]>` with `invoice_total_paid` / `invoiced_remaining` enriched on each contract. `fetchContractsByPhase` (single-phase) is retained
- Project/phase/contract mutations log via `logActivity()` (`retail_project.*`, `retail_phase.*`, `retail_contract.create`)
- **Depends on:** supabase client, activityLog

#### Hooks

### hooks/useRetailProjects.ts
- `useRetailProjects()` — fetches all retail projects list
- **Calls:** retailProjectService
- **Returns:** projects, loading, error, dismissError, refetch

### hooks/useProjectDetail.ts
- `useProjectDetail(projectId)` — fetches a single retail project with its phases, then loads all phase contracts in one `fetchContractsByPhases` call (was a `Promise.all` of per-phase fetches) and builds `contractsMap`
- **Calls:** retailProjectService (`fetchProjectById`, `fetchContractsByPhases`)
- **Returns:** project, contractsMap, loading, error, dismissError, refetch
- Phases, their contracts and the statistics all hang off this one load, so a failure used to
  render the project as if it had no phases. `ProjectDetail` now shows a compact `ErrorState`
  with retry in the phase area and suppresses `ProjectStatistics` (its totals are summed from
  the contracts this load returns)

#### Views

### ProjectStatistics.tsx
- Computes and displays expenses by phase type (land/development/construction) vs revenue from sales contracts
- Shows profit/loss, margin, and cost structure breakdown
- Filters contracts by phase type to separate cost categories

### ProjectsGrid.tsx
- Grid of retail project cards with select/edit actions

### ProjectDetail.tsx
- Detailed project view with phase cards, milestones, and contract management
- The phase and contract delete confirmations close only after the delete succeeds
- **Uses Ui:** useToast, ErrorState

### PhaseCard.tsx
- Card component for a single project phase showing budget, status, and contracts
- Per contract, the old "Dobitak/Gubitak" row (paid − contracted with the sign inverted, so an unpaid contract read as a gain of its whole value) is replaced by [`contractVariance`](../src/utils/contractVariance.ts), shared with Supervision: a red "Prekoračenje" row when paid exceeds the contract, a green "Ušteda" row when a settled contract closed below its value, and **no row** while a contract is simply being paid. Settled = paid in full, or status `Completed` — except in the sales phase, where money comes in and a sale closed below its price is lost revenue, not a saving, so only full payment settles it there. A saving replaces the "Preostalo" row (it is the same remainder, no longer owed), and the card's badge/tint treat it as settled
- Completed and Cancelled contracts carry a badge next to the name; this screen has no status
  filter, and they used to look exactly like active ones. Colour and label now come from the
  shared `RETAIL_CONTRACT_STATUS` map (Completed green, Cancelled grey) rather than both being
  hardcoded grey, so the badge matches every other screen that shows a retail contract status

### MilestoneList.tsx
- List of milestones for a project with status display
- A failed load shows a compact `ErrorState` with retry instead of the "no milestones" empty
  state — the difference matters, since the milestones carry the invoiced percentages. The
  delete confirmation closes only after the delete succeeds
- **Uses Ui:** useToast, ErrorState

### index.tsx (RetailProjects)
- Main retail projects view: list → project detail navigation with modals for add/edit
- The hook's `error` was previously dropped here, so a failed fetch rendered the same empty
  grid as a company with no projects. It now renders `ErrorState` with retry in place of the
  grid (header and actions stay mounted), or a dismissible `Alert` above stale projects
- **Uses hooks:** useRetailProjects, useProjectDetail
- **Uses components:** ProjectsGrid, ProjectDetail, ProjectStatistics
- **Uses Ui:** Card, Button, ErrorState, Alert

#### Forms

### forms/ProjectFormModal.tsx
- Add/edit retail project form

### forms/DevelopmentFormModal.tsx
- Form for creating a development phase

### forms/MilestoneFormModal.tsx
- Form for adding a milestone to a project

### forms/SupplierFormModal.tsx
- Form for adding a supplier to a project phase
- `onSuccess(supplier?)` receives the created `RetailSupplier` on create and no argument on update. `ContractFormModal` and `DevelopmentFormModal` use it to close the sub-modal, select the new supplier and reload the supplier list

### forms/SalesFormModal.tsx
- Form for creating a sales contract for a parcel

#### Modals

### modals/ContractFormModal.tsx
- Add/edit a supplier or customer contract for a phase

### modals/EditPhaseModal.tsx
- Edit a retail project phase (name, dates, budget, status)
- **Uses Ui:** useToast

### modals/RetailInvoicesModal.tsx
- View invoices linked to a contract or phase
- A failed fetch renders a compact `ErrorState` with retry, not "no invoices"

### modals/RetailPaymentHistoryModal.tsx
- View payment history for a contract
- Same rule: "no payments recorded" and "we could not read the payments" are opposite answers
  to "has this contract been paid?", so the failure gets its own state
- Both modals label and colour invoice status through the shared `getInvoiceStatusVariant` /
  `getInvoiceStatusLabel` in `Cashflow/services/invoiceHelpers.ts` (UNPAID red, PARTIALLY_PAID
  yellow, PAID green), the same as every other screen that uses them. The payment-history modal
  used to show any unrecognised status as a red "Unpaid"; it now shows the raw value

---

### Sales
**Path:** `Retail/Sales/`

Retail-specific sales tracking (parcel/lot sales to buyers) — distinct from the Sales module.

#### Services

### services/retailSalesService.ts
- CRUD and fetch operations for retail sales records; `upsertRetailSale` / `deleteRetailSale` log `retail_sale.create` / `retail_sale.delete`; `recordRetailSalePayment` logs `retail_sale.payment` (high)
- A sale reads as `overdue` when `daysFromToday(payment_deadline) < 0` and it is not paid. It was
  `new Date(payment_deadline) < new Date()`, which parses the date-only column as UTC midnight and
  so flipped the sale to overdue from 01:00 on the day it was actually due
- **Depends on:** supabase client, activityLog

#### Hooks

### hooks/useRetailSales.ts
- `useRetailSales()` — fetches retail sales list with customer and land plot data
- **Returns** (additions): error, dismissError, refetch, hasData

### hooks/useRetailSalesManager.ts
- Manages retail sale creation and editing state
- **Returns** (additions): error, dismissError, refetch, hasData
- `confirmDelete` closes the dialog only after the delete succeeds, never in `finally`

#### Views

### RetailSales.tsx
- Retail sales view with sale cards, payment status, and CRUD actions
- Revenue / paid / to-collect are summed from the loaded sales, so on a failed load the stat
  grid is hidden rather than reporting €0, and the table area carries `ErrorState`
- **Uses Ui:** useToast, ErrorState, Alert

### index.tsx (RetailSales)
- Retail sales entry point

---

### Customers
**Path:** `Retail/Customers/`

Retail customer records (land/parcel buyers) — distinct from Sales/Customers (apartment buyers).

#### Services

### services/retailCustomerService.ts
- CRUD and fetch for retail customer records; create/update/delete log `retail_customer.*`
- **Depends on:** supabase client, activityLog

#### Hooks

### hooks/useRetailCustomers.ts
- `useRetailCustomers()` — fetches retail customer list with linked sales; validates customer name before save (returns `fieldErrors`)
- **Returns** (additions): error, dismissError, refetch, hasData
- `confirmDelete` closes the dialog only after the delete succeeds, never in `finally`

#### Views

### index.tsx (RetailCustomers)
- Retail customer list with search and detail modal
- On a failed load the stat cards (area, revenue, remaining) are hidden and the list area
  carries `ErrorState`; with stale rows a dismissible `Alert` sits above them

---

### Invoices
**Path:** `Retail/Invoices/`

Retail-specific invoicing separate from Cashflow invoices.

#### Services

### services/retailInvoiceService.ts
- Fetch and CRUD for retail invoice records; `toggleRetailInvoiceApproval` logs `invoice.approve`
- **Depends on:** supabase client, activityLog

#### Hooks

### hooks/useRetailInvoices.ts
- `useRetailInvoices()` — fetches retail invoices with contract and supplier data
- **Returns** (additions): error, dismissError, refetch, hasData

#### Views

### index.tsx (RetailInvoices)
- Retail invoice list with status filters and detail view
- A failed load hides the invoice-total stat cards and puts `ErrorState` where the table goes

---

### LandPlots
**Path:** `Retail/LandPlots/`

Land plot inventory tracking.

#### Services

### services/landPlotService.ts
- `fetchLandPlotsWithProjects(page, pageSize, searchTerm)` — server-paginated land plot list with `count: 'exact'`; search matches plot_number/owner_first_name/owner_last_name/location (ilike). Batch-fetches connected `retail_projects` for the page; returns `PaginatedLandPlotsResult` (`plots`, `totalCount`)
- `fetchLandPlotStats()` — aggregates totals across all plots; returns `LandPlotStats` (`total_plots`, `total_invested`, `total_area`, `paid_count`)
- `fetchLandPlotSales(plotId)` — sales for a single plot
- `upsertLandPlot(payload, id?)` — create/update a plot (logs `land_plot.create` / `land_plot.update`)
- `deleteLandPlot(id)` — removes a plot and logs `land_plot.delete` with its plot number
- Exports types: `LandPlotWithProject`, `LandPlotSaleRow`, `PaginatedLandPlotsResult`, `LandPlotStats`, `LandPlotPayload`
- **Depends on:** supabase client, activityLog

#### Hooks

### hooks/useLandPlots.ts
- `useLandPlots()` — owns server-side pagination, debounced search (500ms, resets to page 1), and the global stat totals. Loads the current page and stats together; exposes the pending-item delete pattern and `loadPlotDetails(plot)` (lazy-loads sales for the detail view). Exports `LAND_PLOTS_PAGE_SIZE` (50) and the `LandPlotWithSales` type
- **Calls:** landPlotService (`fetchLandPlotsWithProjects`, `fetchLandPlotStats`, `fetchLandPlotSales`, `upsertLandPlot`, `deleteLandPlot`)
- **Returns:** loading, refreshing, error, dismissError, refetch, plots, totalCount, pageSize, currentPage, setCurrentPage, totalStats, searchTerm, setSearchTerm, handleSave, handleDelete, confirmDelete, cancelDelete, pendingDeleteId, deleting, loadPlotDetails
- `confirmDelete` closes the dialog only after the delete succeeds, never in `finally`. On a
  failed load the page hides the invested/area stat cards and shows `ErrorState` instead of the
  "no plots" empty state

#### Views

### index.tsx (LandPlots)
- Land plot list with a `StatGrid` summary (total plots, area, invested, paid count from `totalStats`), search, a `Table`, and a `Pagination` control driven by the hook
- Inline form validates owner_first_name, owner_last_name, plot_number, total_area_m2, purchased_area_m2, price_per_m2 with `fieldErrors`
- **Uses hooks:** useLandPlots
- **Uses Ui:** PageHeader, StatGrid, StatCard, SearchInput, Table, Pagination, Modal, FormField, Input, Select, Textarea, Badge, EmptyState, Form, ConfirmDialog, useToast (via hook)

---

## i18n and status display

- **Dates** go through `formatDate` / `formatDateTime` from `src/utils/formatters.ts` with
  `i18n.language`: `dd.MM.yyyy.` in Croatian (trailing dot), `MMM dd, yyyy` in English. Every
  `format(new Date(…), 'dd.MM.yyyy')` in this module was replaced — besides the language, the
  old form read a date-only column as UTC midnight and rendered the previous day
- **Status is mapped at render, never translated in place.** `PROJECT_STATUS` for project status
  (`ProjectsGrid`, `ProjectDetail`), `RETAIL_CONTRACT_STATUS` for contract status (`PhaseCard`).
  `EditPhaseModal`'s status `<option>` values stay `Pending` / `In Progress` / `Completed` —
  they are written into a CHECK column; only the option label is translated
- `payment_method` is labelled through `paymentMethodLabel` from
  [`Sales/Payments/paymentMethod.ts`](../src/components/Sales/Payments/paymentMethod.ts), the
  same way invoice status comes from `Cashflow/services/invoiceHelpers`
- `exportRetailSalesCSV` and `exportRetailInvoicesCSV` parse their `date` columns with
  `parseLocalDate`, not `new Date` — the latter shifted every exported date back a day

## Notes
- Retail invoice types are shared with Cashflow via `Cashflow/Invoices/retailInvoiceTypes.ts` — do not duplicate
- Shared retail TypeScript interfaces live in `src/types/retail.ts` (RetailLandPlot, RetailCustomer, RetailSale, RetailProject, RetailProjectPhase, RetailSupplier, RetailContract, RetailContractMilestone, and composed variants)
- `SiteManagement/` and `Retail/Projects/` share a similar phase/milestone UI pattern — keep in sync when updating either
- All delete confirmation dialogs use `ConfirmDialog` from `src/components/ui/` via the pending-item hook pattern — never use `window.confirm()` or `confirm()`
