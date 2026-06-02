# Module: Retail

**Path:** `src/components/Retail/`

## Overview

Manages retail real estate operations: development projects with phases and milestones, retail sales contracts, customers, invoices, and land plot tracking. Distinct from the Sales module (which handles apartment buildings) — Retail covers land development and parcel sales.

---

## Shared Utilities

### utils.ts
- `formatCurrency(value)` — formats a currency value for Retail UI display
- `getStatusBadgeVariant(status)` — returns badge variant for a status string

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
- **Returns:** projects, loading, error, refetch

### hooks/useProjectDetail.ts
- `useProjectDetail(projectId)` — fetches a single retail project with its phases, then loads all phase contracts in one `fetchContractsByPhases` call (was a `Promise.all` of per-phase fetches) and builds `contractsMap`
- **Calls:** retailProjectService (`fetchProjectById`, `fetchContractsByPhases`)
- **Returns:** project, contractsMap, loading, refetch

#### Views

### ProjectStatistics.tsx
- Computes and displays expenses by phase type (land/development/construction) vs revenue from sales contracts
- Shows profit/loss, margin, and cost structure breakdown
- Filters contracts by phase type to separate cost categories

### ProjectsGrid.tsx
- Grid of retail project cards with select/edit actions

### ProjectDetail.tsx
- Detailed project view with phase cards, milestones, and contract management
- **Uses Ui:** useToast

### PhaseCard.tsx
- Card component for a single project phase showing budget, status, and contracts

### MilestoneList.tsx
- List of milestones for a project with status display
- **Uses Ui:** useToast

### index.tsx (RetailProjects)
- Main retail projects view: list → project detail navigation with modals for add/edit
- **Uses hooks:** useRetailProjects, useProjectDetail
- **Uses components:** ProjectsGrid, ProjectDetail, ProjectStatistics
- **Uses Ui:** Card, Button

#### Forms

### forms/ProjectFormModal.tsx
- Add/edit retail project form

### forms/DevelopmentFormModal.tsx
- Form for creating a development phase

### forms/MilestoneFormModal.tsx
- Form for adding a milestone to a project

### forms/SupplierFormModal.tsx
- Form for adding a supplier to a project phase

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

### modals/RetailPaymentHistoryModal.tsx
- View payment history for a contract

---

### Sales
**Path:** `Retail/Sales/`

Retail-specific sales tracking (parcel/lot sales to buyers) — distinct from the Sales module.

#### Services

### services/retailSalesService.ts
- CRUD and fetch operations for retail sales records; `upsertRetailSale` / `deleteRetailSale` log `retail_sale.create` / `retail_sale.delete`
- **Depends on:** supabase client, activityLog

#### Hooks

### hooks/useRetailSales.ts
- `useRetailSales()` — fetches retail sales list with customer and land plot data

### hooks/useRetailSalesManager.ts
- Manages retail sale creation and editing state

#### Views

### RetailSales.tsx
- Retail sales view with sale cards, payment status, and CRUD actions
- **Uses Ui:** useToast

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

#### Views

### index.tsx (RetailCustomers)
- Retail customer list with search and detail modal

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

#### Views

### index.tsx (RetailInvoices)
- Retail invoice list with status filters and detail view

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
- `deleteLandPlot(id)` — removes a plot
- Exports types: `LandPlotWithProject`, `LandPlotSaleRow`, `PaginatedLandPlotsResult`, `LandPlotStats`, `LandPlotPayload`
- **Depends on:** supabase client, activityLog

#### Hooks

### hooks/useLandPlots.ts
- `useLandPlots()` — owns server-side pagination, debounced search (500ms, resets to page 1), and the global stat totals. Loads the current page and stats together; exposes the pending-item delete pattern and `loadPlotDetails(plot)` (lazy-loads sales for the detail view). Exports `LAND_PLOTS_PAGE_SIZE` (50) and the `LandPlotWithSales` type
- **Calls:** landPlotService (`fetchLandPlotsWithProjects`, `fetchLandPlotStats`, `fetchLandPlotSales`, `upsertLandPlot`, `deleteLandPlot`)
- **Returns:** loading, refreshing, plots, totalCount, pageSize, currentPage, setCurrentPage, totalStats, searchTerm, setSearchTerm, handleSave, handleDelete, confirmDelete, cancelDelete, pendingDeleteId, deleting, loadPlotDetails

#### Views

### index.tsx (LandPlots)
- Land plot list with a `StatGrid` summary (total plots, area, invested, paid count from `totalStats`), search, a `Table`, and a `Pagination` control driven by the hook
- Inline form validates owner_first_name, owner_last_name, plot_number, total_area_m2, purchased_area_m2, price_per_m2 with `fieldErrors`
- **Uses hooks:** useLandPlots
- **Uses Ui:** PageHeader, StatGrid, StatCard, SearchInput, Table, Pagination, Modal, FormField, Input, Select, Textarea, Badge, EmptyState, Form, ConfirmDialog, useToast (via hook)

---

## Notes
- Retail invoice types are shared with Cashflow via `Cashflow/Invoices/retailInvoiceTypes.ts` — do not duplicate
- Shared retail TypeScript interfaces live in `src/types/retail.ts` (RetailLandPlot, RetailCustomer, RetailSale, RetailProject, RetailProjectPhase, RetailSupplier, RetailContract, RetailContractMilestone, and composed variants)
- `SiteManagement/` and `Retail/Projects/` share a similar phase/milestone UI pattern — keep in sync when updating either
- All delete confirmation dialogs use `ConfirmDialog` from `src/components/ui/` via the pending-item hook pattern — never use `window.confirm()` or `confirm()`
