# Module: Retail

**Path:** `src/components/Retail/`

## Overview
Manages retail real estate operations: development projects with phases and milestones, retail sales, customers, invoices, and land plot tracking.

## Sub-modules

### Projects
**Path:** `Retail/Projects/`
- Core retail module. Tracks development projects through phases and milestones.
- `useRetailProjects.ts` — project list and CRUD
- `useProjectDetail.ts` — single project with phases, milestones, suppliers
- `retailProjectService.ts` — Supabase queries
- Views: `ProjectsGrid`, `ProjectDetail`, `ProjectStatistics`, `PhaseCard`, `MilestoneList`
- Forms: `ProjectFormModal`, `MilestoneFormModal`, `DevelopmentFormModal`, `SalesFormModal`, `SupplierFormModal`
- Modals: `ContractFormModal`, `EditPhaseModal`, `RetailInvoicesModal`, `RetailPaymentHistoryModal`

### Sales
**Path:** `Retail/Sales/`
- Retail-specific sales tracking (distinct from the Sales module).
- `useRetailSales.ts` — retail sales list
- `retailSalesService.ts` — Supabase queries
- `RetailSales.tsx` — main sales view

### Customers
**Path:** `Retail/Customers/`
- Retail customer records.
- `useRetailCustomers.ts` — customer list
- `retailCustomerService.ts` — Supabase queries

### Invoices
**Path:** `Retail/Invoices/`
- Retail-specific invoicing separate from Cashflow invoices.
- `useRetailInvoices.ts` — invoice list
- `retailInvoiceService.ts` — Supabase queries

### LandPlots
**Path:** `Retail/LandPlots/`
- Land plot inventory tracking.
- Entry point only (`index.tsx`) — minimal implementation.

## Shared Utilities
| File | Purpose |
|---|---|
| `utils.ts` | Retail-specific formatting and calculation helpers |

## Notes
- Retail has active uncommitted changes
- Retail invoice types are shared with Cashflow via `Cashflow/Invoices/retailInvoiceTypes.ts` — do not duplicate
- Shared retail TypeScript types also live in `src/types/retail.ts`
