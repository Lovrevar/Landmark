# Module: Sales

**Path:** `src/components/Sales/`

## Overview
Manages the real estate sales pipeline: projects, buildings, apartment/garage units, customers, contracts, and payment tracking.

## Sub-modules

### SalesProjects
**Path:** `SalesProjects/`
- Top-level view of sales projects, buildings within them, and individual units.
- `useSalesData.ts` — fetches projects, buildings, units
- `salesService.ts` — CRUD for projects and buildings
- `garageImportService.ts` — bulk import garages from Excel
- Views: `ProjectsGrid`, `BuildingsGrid`, `UnitsGrid`
- `ExcelImportApartmentsModal.tsx` / `ExcelImportGaragesModal.tsx` — bulk unit import
- `BulkUnitsModal.tsx`, `BulkPriceUpdateModal.tsx` — mass operations on units
- `LinkingModal.tsx` — link units to customers/contracts

### Apartments
**Path:** `Apartments/`
- Individual apartment and unit management within a building.
- `useApartmentData.ts` — unit details and payment status
- `useLinkUnits.ts` — unit-to-customer linking logic
- `apartmentService.ts` — CRUD for units
- `linkUnitsService.ts` — linking operations
- `ContractedSection.tsx` — view of contracted/sold units
- Modals: detail, edit, bulk create, payment history, wire payment

### Customers
**Path:** `Customers/`
- Sales-side customer (buyer) records with category segmentation.
- `useCustomerData.ts` — customer list with category filtering
- `customerService.ts` — CRUD
- `customerCache.ts` — client-side cache to reduce Supabase calls
- Views: `CustomerGrid`, `CustomerCard`, `CategoryTabs`
- `CustomerDetailModal.tsx` — full customer profile with linked units

### Payments
**Path:** `Payments/`
- Payment tracking for apartment sales contracts.
- Entry point only (`index.tsx`) — likely delegates to shared payment components.

## Shared Utilities
| File | Purpose |
|---|---|
| `utils/customerUtils.ts` | Customer formatting and lookup helpers |
| `utils/priceUtils.ts` | Price calculation and formatting |

## Notes
- `forms/`, `hooks/`, `services/`, `types/`, `views/` folders exist at the Sales root but appear partially populated — check before adding new shared Sales utilities
- Customer records here are distinct from `Cashflow/Customers` — these are property buyers
