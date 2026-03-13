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

### Services/retailProjectService.ts
- Fetches retail projects, project details, and contracts grouped by phase
- **Depends on:** supabase client

#### Hooks

### Hooks/useRetailProjects.ts
- `useRetailProjects()` — fetches all retail projects list
- **Calls:** retailProjectService
- **Returns:** projects, loading, error, refetch

### Hooks/useProjectDetail.ts
- `useProjectDetail(projectId)` — fetches a single retail project with its phases and contracts grouped by phase
- **Calls:** retailProjectService
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

### PhaseCard.tsx
- Card component for a single project phase showing budget, status, and contracts

### MilestoneList.tsx
- List of milestones for a project with status display

### index.tsx (RetailProjects)
- Main retail projects view: list → project detail navigation with modals for add/edit
- **Uses hooks:** useRetailProjects, useProjectDetail
- **Uses components:** ProjectsGrid, ProjectDetail, ProjectStatistics
- **Uses Ui:** Card, Button

#### Forms

### Forms/ProjectFormModal.tsx
- Add/edit retail project form

### Forms/DevelopmentFormModal.tsx
- Form for creating a development phase

### Forms/MilestoneFormModal.tsx
- Form for adding a milestone to a project

### Forms/SupplierFormModal.tsx
- Form for adding a supplier to a project phase

### Forms/SalesFormModal.tsx
- Form for creating a sales contract for a parcel

#### Modals

### Modals/ContractFormModal.tsx
- Add/edit a supplier or customer contract for a phase

### Modals/EditPhaseModal.tsx
- Edit a retail project phase (name, dates, budget, status)

### Modals/RetailInvoicesModal.tsx
- View invoices linked to a contract or phase

### Modals/RetailPaymentHistoryModal.tsx
- View payment history for a contract

---

### Sales
**Path:** `Retail/Sales/`

Retail-specific sales tracking (parcel/lot sales to buyers) — distinct from the Sales module.

#### Services

### services/retailSalesService.ts
- CRUD and fetch operations for retail sales records
- **Depends on:** supabase client

#### Hooks

### hooks/useRetailSales.ts
- `useRetailSales()` — fetches retail sales list with customer and land plot data

### hooks/useRetailSalesManager.ts
- Manages retail sale creation and editing state

#### Views

### RetailSales.tsx
- Retail sales view with sale cards, payment status, and CRUD actions

### index.tsx (RetailSales)
- Retail sales entry point

---

### Customers
**Path:** `Retail/Customers/`

Retail customer records (land/parcel buyers) — distinct from Sales/Customers (apartment buyers).

#### Services

### services/retailCustomerService.ts
- CRUD and fetch for retail customer records
- **Depends on:** supabase client

#### Hooks

### hooks/useRetailCustomers.ts
- `useRetailCustomers()` — fetches retail customer list with linked sales

#### Views

### index.tsx (RetailCustomers)
- Retail customer list with search and detail modal

---

### Invoices
**Path:** `Retail/Invoices/`

Retail-specific invoicing separate from Cashflow invoices.

#### Services

### services/retailInvoiceService.ts
- Fetch and CRUD for retail invoice records
- **Depends on:** supabase client

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
- CRUD and fetch for land plot records
- **Depends on:** supabase client

#### Hooks

### hooks/useLandPlots.ts
- `useLandPlots()` — fetches land plot inventory with purchase and sales data

#### Views

### index.tsx (LandPlots)
- Land plot list with status and area tracking

---

## Notes
- Retail invoice types are shared with Cashflow via `Cashflow/Invoices/retailInvoiceTypes.ts` — do not duplicate
- Shared retail TypeScript interfaces live in `src/types/retail.ts` (RetailLandPlot, RetailCustomer, RetailSale, RetailProject, RetailProjectPhase, RetailSupplier, RetailContract, RetailContractMilestone, and composed variants)
- `SiteManagement/` and `Retail/Projects/` share a similar phase/milestone UI pattern — keep in sync when updating either
