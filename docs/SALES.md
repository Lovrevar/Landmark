# Module: Sales

**Path:** `src/components/Sales/`

## Overview

Manages the real estate sales pipeline: projects, buildings, apartment/garage/storage units, customers, sales contracts, linking units to buyers, and payment tracking.

---

## Sub-modules

### SalesProjects
**Path:** `SalesProjects/`

Top-level navigation through projects → buildings → units. Handles bulk/single unit creation, price updates, Excel import, and unit-to-customer linking.

#### Services

### services/salesService.ts
- `fetchProjects()` — fetches all sales projects
- `fetchBuildings()` — fetches buildings for a project
- `fetchApartments()`, `fetchGarages()`, `fetchRepositories()` — fetches units by type
- `fetchCustomers()` — fetches all customers
- `fetchSales()` — fetches all sale records
- `fetchActualTotalPaidByApartment(apartmentId)` — computes total paid for an apartment
- `createBuilding(data)`, `deleteBuilding(id)` — building CRUD
- `createUnit(data)`, `bulkCreateUnits(data)`, `deleteUnit(id)` — unit CRUD
- `updateUnitStatus(id, status)` — updates a unit's availability status
- `bulkUpdateUnitPrice(ids, unitType, adjustmentType, value)` — adjusts price per m² for selected units. Sold units are never repriced: they are excluded from the fetch and each update re-checks `status <> 'Sold'`. The `apartment.bulk_price_update` log `count` is the number of rows actually updated, not the number of ids passed
  - **Returns `{ selected, updated, failed }`** (`bulkPriceResult.ts`, folded by the pure
    `summarizeBulkPriceUpdate`, unit-tested) instead of throwing on a partial failure. It used
    to throw `Failed to update N units`, which both discarded the count and skipped the page's
    `refetch()` — so rows that *had* changed kept showing their old price. The page now always
    refetches and reports "n of m"
  - `updated < selected` is normal, because sold units are skipped by design; only `failed > 0`
    is an error. A failure to even read the units still throws — there is nothing to report then
- `linkGarageToApartment(garageId, apartmentId)`, `unlinkGarageFromApartment(...)` — garage linking
- `linkRepositoryToApartment(repoId, apartmentId)`, `unlinkRepositoryFromApartment(...)` — storage linking
- `createCustomer(data)` — creates a new customer from the sale form
- `completeSale(saleData)` — records a sale and updates unit status, links customer
- `updateCustomerStatus(customerId, status)` — updates customer CRM status
- `updateUnitAfterSale(apartmentId, saleData)` — patches unit record post-sale
- **Depends on:** supabase client

### services/garageImportService.ts
- `importGaragesFromExcel(file, buildingId)` — parses Excel file and bulk-inserts garage records. Returns `{ created, updated, errors }`, where `errors` is `{ number, message }[]` (one per failed garage) so the modal can list them translated
- `fetchExistingGarageNumbers(buildingId)` — returns existing garage numbers to detect duplicates
- **Depends on:** supabase client, xlsx, importOutcome

### services/apartmentImportService.ts
- `importApartmentRow(row, projectId)` — upserts one apartment plus its parking/storage unit and link; logs `apartment.import_excel` per row
- `logApartmentImportSummary(projectId, summary)` — one `apartment.import_excel_summary` entry per run (severity high, metadata `count` = rows imported, `failed`, `garages_linked`, `storages_linked`). A run whose rows all fail writes no per-row entry, so this is its only trace

> All mutating functions in `salesService.ts`, `apartmentImportService.ts`, and `garageImportService.ts` fire-and-forget `logActivity()` after a successful write (`building.*`, `sale.create`, `apartment.bulk_price_update`, etc.).

#### Hooks

### hooks/useSalesData.ts
- `useSalesData()` — fetches projects, buildings, apartments, garages, repositories, customers, and sales; enriches apartments with sale_info; calculates totals
- **Calls:** salesService.ts
- **Returns:** projects, buildings, apartments, garages, repositories, customers, loading, error, dismissError, refetch
- One `try` wraps all seven queries plus the aggregation, so any failure used to leave every
  total at 0. It now records `error`; the page renders `ErrorState` when nothing loaded and a
  dismissible `Alert` over the stale cards when something did

#### Views

### ProjectsGrid.tsx
- Project card grid showing building count, unit count, sold count, revenue, and progress bar
- Only `stambeno` projects reach this screen: `fetchProjects()` filters on `category = 'stambeno'`, since the Sales module sells residential units and Interno/Retail projects have nothing to sell here

### BuildingsGrid.tsx
- Building card grid for a selected project showing unit counts and revenue per building

### unitFilters.ts
- `getUnitsOfType(building, unitType)` — the apartments, garages or repositories of a building
- `filterUnitsByStatus(units, filterStatus)` — the units the grid shows for a status filter
- `getSelectableUnitIds(units, filterStatus)` — the ids "Select all" picks: filtered units minus Sold ones
- Shared by `UnitsGrid` and `index.tsx` so the grid and "Select all" cannot drift; covered by `unitFilters.test.ts`

### importOutcome.ts
- `classifyImportOutcome(succeeded, failed)` — `nothing_imported` (no row succeeded), `partial` (some failed) or `success`; drives the step-3 icon and headline of both Excel imports
- `importErrorMessage(error)` — message from an `Error` or a plain Supabase error object (which `String()` renders as "[object Object]")
- `MAX_LISTED_IMPORT_ERRORS` — step 3 lists this many row errors (10), then "…and N more"
- Covered by `importOutcome.test.ts`

### UnitsGrid.tsx
- Unit grid with type tabs (apartments/garages/repositories), status filters, multi-select checkboxes, linked unit display, and bulk price config button
- "Select all" selects only the units visible under the current status filter and skips Sold units; it is disabled when nothing is selectable. A Sold unit's checkbox is disabled (it can still be unticked if it was sold after being selected)

### index.tsx (SalesProjectsEnhanced)
- Main view orchestrating project → building → unit navigation with all CRUD modals and linking
- Changing the unit type tab or the status filter clears the unit selection. The bulk price modal receives the selected units minus any Sold ones
- The full-page spinner shows on the first load only (`loading && projects.length === 0`); later refetches keep the page and any open modal mounted
- `loadFailed` (`error && projects.length === 0`) replaces the project grid with `ErrorState`, keeping the header mounted; with stale projects on screen the error is a dismissible `Alert` above them instead
- Both delete confirmations close only after the delete succeeds — never in `finally`
- Every modal submit handler is `async`, awaits its service call and `refetch()`, and keeps its own try/catch + toast; the modals return that promise so `Button` spins and disables until it settles (no double submit)
- **Uses hooks:** useSalesData
- **Uses components:** ProjectsGrid, BuildingsGrid, UnitsGrid, SaleFormModal, all unit/building modals
- **Uses Ui:** Card, Button, useToast

#### Forms

### forms/SaleFormModal.tsx
- Sale creation form with new/existing customer toggle; collects sale price, payment method, down payment, monthly payment, sale date, contract signed, and notes
- `onSubmit` returns `Promise<void> | void`; the Complete sale button returns it, so it is disabled while the sale is saving
- **Uses Ui:** Modal, Button, Select

#### Modals

### modals/BuildingQuantityModal.tsx
- Input for number of buildings to bulk-create (1–20); validates with `fieldErrors`; resets the quantity after the submit settles
- **Uses Ui:** Modal, Button

### modals/SingleBuildingModal.tsx
- Form for single building (name, description, total_floors); validates with `fieldErrors`
- **Uses Ui:** Modal, Button

### modals/SingleUnitModal.tsx
- Form for single unit (number, floor, size, price per m², computed total price); validates with `fieldErrors`
- **Uses Ui:** Modal, Button

### modals/BulkUnitsModal.tsx
- Form for bulk unit creation (floor range, units per floor, size variation, pricing) with preview
- **Uses Ui:** Modal, Button

### modals/LinkingModal.tsx
- Select available garages or storage units to link to an apartment
- **Uses Ui:** Modal, Button

> `BuildingQuantityModal`, `SingleBuildingModal`, `SingleUnitModal`, `BulkUnitsModal` and `BulkPriceUpdateModal` take `onSubmit: (...) => Promise<void> | void` and return it from their submit button, which is what disables the button while saving. They have no `loading` prop.

### modals/BulkPriceUpdateModal.tsx
- Increase/decrease price per m² for selected units with preview of new prices; validates with `fieldErrors`
- **Uses Ui:** Modal, Button

### modals/ExcelImportApartmentsModal.tsx
- 3-step apartment bulk import (file upload → preview → results)
- Collects a per-row error (validation reason or the write error) for every skipped/failed row and logs one run summary via `logApartmentImportSummary`
- **Uses services:** apartmentImportService
- **Uses Ui:** Modal, Button, useToast

### modals/ExcelImportGaragesModal.tsx
- 3-step garage bulk import (file upload → preview → results)
- The preview parses sizes and prices with `parseNumber` (the service's parser), so it shows the values that will be written
- **Uses services:** garageImportService
- **Uses Ui:** Modal, Button, useToast

### modals/ImportOutcomeSummary.tsx
- Step-3 headline shared by both Excel imports: red `XCircle` + "Nothing was imported" when no row succeeded, amber "Import completed with errors" when some failed, green tick otherwise; lists the first 10 row errors

> Both import modals ignore close requests (Escape, backdrop, header X) while an import is running, and disable the step-2 Back button, so the result screen cannot be skipped mid-run. The import button shows the row count.

---

### Apartments
**Path:** `Apartments/`

Individual apartment and unit management. Handles CRUD, payment history, contract fields, and garage/storage linking per unit.

#### Services

### services/apartmentListService.ts
- `fetchApartmentFilterOptions()` — fetches the projects and buildings used to populate the filter dropdowns; returns `ApartmentFilterOptions`
- `fetchApartmentListPage(params)` — server-paginated, server-filtered apartment list. Runs the `apartments` query with `count: 'exact'`, search (`number`/`buyer_name` ilike), and project/building/status filters, then batch-fetches projects, buildings, `accounting_payments` totals, and linked garages/repositories for the page; returns `ApartmentListPage`
- Exports types: `LinkedUnit`, `ApartmentFilterOptions`, `ApartmentListParams` (page, pageSize, searchTerm, projectId, buildingId, status), `ApartmentListPage` (apartments, totalCount, apartmentPaymentTotals, linkedGarages, linkedStorages)
- **Depends on:** supabase client

### services/apartmentService.ts
- `createBulkApartments(data)` — bulk-inserts apartments
- `createSingleApartment(data)` — inserts a single apartment
- `updateApartment(id, data)` — updates apartment fields
- `deleteApartment(id)` — removes an apartment
- `fetchApartmentPayments(apartmentId)` — fetches the `accounting_payments` rows for an apartment's invoices (read-only here; payments are edited in Cashflow → Payments)
- All mutations log via `logActivity()` (`apartment.create`, `apartment.bulk_create`, `apartment.update`, `apartment.delete`)
- **Depends on:** supabase client, activityLog

### services/linkUnitsService.ts
- `fetchLinkedUnitIds(apartmentId)` — returns IDs of currently linked garages and storage units
- `fetchAvailableUnits(buildingId)` — returns unlinked garages and storage units in the building
- `saveUnitLinks(apartmentId, garageIds, storageIds)` — upserts and removes links to match selection; logs `apartment.link_garage` / `apartment.link_repository` when links are added
- **Depends on:** supabase client, activityLog

#### Hooks

### hooks/useApartmentData.ts
- `useApartmentData()` — owns server-side pagination and filter state (search is debounced 500ms; changing any filter resets to page 1). Fetches filter options once, then re-fetches the current page whenever page/search/filters change. Exports `APARTMENTS_PAGE_SIZE` (24)
- **Calls:** apartmentListService.ts (`fetchApartmentFilterOptions`, `fetchApartmentListPage`)
- **Returns:** apartments, totalCount, projects, buildings, apartmentPaymentTotals, garagePaymentTotals, storagePaymentTotals, linkedGarages, linkedStorages, loading, refreshing, error, dismissError, refetch, pageSize, currentPage, setCurrentPage, searchTerm, setSearchTerm, filterProject, setFilterProject, filterBuilding, setFilterBuilding, filterStatus, setFilterStatus
- **Note:** `garagePaymentTotals` and `storagePaymentTotals` are kept in the return shape but are always empty — only apartment-level payment totals are computed by the service

### hooks/useLinkUnits.ts
- `useLinkUnits(apartmentId, buildingId, enabled)` — manages available/selected garage and storage IDs with save
- **Calls:** linkUnitsService.ts
- **Returns:** availableGarages, availableStorages, selectedGarageIds, selectedStorageIds, loading, saving, error, refetch, setSelectedGarageIds, setSelectedStorageIds, save
- `error` is load-bearing, not cosmetic: `save()` writes the selection as the complete link
  set, so saving on top of a failed load would unlink everything. `LinkUnitsModal` shows a
  compact `ErrorState` and disables Save while `error` is set

#### Views

### ContractedSection.tsx
- Reusable contract field group (predugovor date, payment type, installment percentages)
- Exports helpers: `emptyContractFields()`, `contractFieldsFromData()`, `contractFieldsToPayload()`

### index.tsx (Apartments)
- Apartment management page: project/building/status filters and search now come from `useApartmentData` (server-side); the page renders the current page and a `Pagination` control. Header shows `totalCount`. CRUD modals, payment history, and unit linking unchanged
- Create / bulk create / update / delete each show a success toast and, on failure, a
  `toErrorMessage` toast under `apartments.toast.*`. The delete confirmation closes only after
  the row is gone — it used to close in `finally`, so a refused delete looked identical to a
  completed one. The header count renders "—" rather than 0 when the load failed
- The list area carries `ErrorState` when nothing loaded; with stale rows on screen a
  dismissible `Alert` sits above them. Header, filters and search stay mounted either way
- **Uses hooks:** useApartmentData, useLinkUnits
- **Uses Ui:** SearchInput, Button, Select, EmptyState, ErrorState, Alert, PageHeader, ConfirmDialog, Pagination, LoadingSpinner, useToast

#### Modals

### modals/ApartmentDetailsModal.tsx
- Read-only apartment detail view with location, specs, and contract data if present
- **Uses Ui:** Modal

### modals/BulkApartmentModal.tsx
- Form for bulk apartment creation (project, building, start number, quantity, floor, size, price)
- **Uses Ui:** Modal, Button, Select, useToast

### modals/SingleApartmentModal.tsx
- Single apartment creation form including ContractedSection
- **Uses components:** ContractedSection
- **Uses Ui:** Modal, Button, Select, useToast

### modals/EditApartmentModal.tsx
- Edits an existing apartment; controlled by the Apartments page
- Props: `visible`, `onClose`, `apartment` (`ApartmentWithDetails | null`), `onSubmit(id, updates)`

### modals/PaymentHistoryModal.tsx
- All payments for an apartment with linked units, totals, and progress bar
- Read-only: each row shows the `payments.managed_in_accounting` note instead of Edit/Delete, since the rows are `accounting_payments` owned by Cashflow
- **Uses Ui:** Modal, Button, EmptyState

### modals/LinkUnitsModal.tsx
- Link/unlink garages and storage units to an apartment
- **Uses hooks:** useLinkUnits
- **Uses Ui:** Modal, Button, useToast

---

### Customers
**Path:** `Customers/`

Sales-side buyer CRM with category segmentation (`lead`, `interested`, `buyer` — see `CustomerCategory` in `Customers/types.ts`), preferences tracking, a project-of-interest link and linked unit summaries.

#### Services

### services/customerService.ts
- `fetchCustomers(category)` — fetches customers filtered by category; for `buyer` records it enriches with linked apartment/garage/repository purchases. Now uses batched `.in()` queries (apartments, garage/repo links, invoices, payments) and in-memory maps instead of the previous per-customer/per-sale request fan-out
- `fetchProjectOptions()` — id/name list of projects, backing the form's project select and the page filter
- `createCustomer(data)` — inserts a new customer (captures new id; logs `customer.create`)
- `updateCustomer(id, data)` — updates a customer record (logs `customer.update`)
- Both writes pass through `normalizeContactFields()`, which rewrites blank `email`/`phone` to `null`. `customers.email` is UNIQUE and nullable: Postgres permits many NULLs but only one `''`, so writing empty strings would fail the *second* contactless customer with a 23505 reported as a duplicate email
- `deleteCustomer(id)` — removes a customer (logs `customer.delete`)
- `updateLastContact(id, date)` — updates the last contact date
- **Depends on:** supabase client, customerCache.ts, activityLog

### services/customerCache.ts
- Client-side cache with 5-minute TTL for customer data and counts
- Invalidated on all CRUD operations

#### Hooks

### hooks/useCustomerData.ts
- `useCustomerData(activeCategory)` — fetches customers for the active category, reads counts from cache, fetches the project list once per mount, exposes CRUD actions
- **Calls:** customerService.ts, customerCache.ts
- **Returns:** customers, counts, projects, loading, error, refetch, dismissError, saveCustomer, deleteCustomer, updateLastContact
- A failed customer fetch *or* a failed counts fetch sets `error`; the page passes
  `loadFailed` into `CustomerGrid` (which then renders `ErrorState` instead of its empty
  state) and `countsUnknown` into `CategoryTabs`, whose badges show "—" rather than 0
- `updateLastContact` still rethrows; the page wraps it so the card's button can stay a
  plain `(id) => void` without dropping a rejection

#### Views

### CategoryTabs.tsx
- Tab bar with 3 category tabs (Leads / Interested / Buyers) showing badge counts; clicking the active tab clears the filter
- `countsUnknown` renders every badge as "—": after a failed counts query a 0 would be a claim about the pipeline

### CustomerGrid.tsx
- Multi-select customer card grid with edit/delete/view-details/update-contact actions
- The "Select all" button counts only the customers on screen, so an id left over from a deleted customer cannot make it read "all selected"

### CustomerCard.tsx
- Individual customer card with name, contact info, a project-of-interest badge, and purchased units for buyers. Email and phone rows are hidden when absent, since both are optional
- Clicking the card (or Enter/Space when it has focus — it is `role="button"`) opens the detail modal. Selection is a separate checkbox button in the header (`aria-pressed`); a selected card keeps the blue border

### index.tsx (Customers)
- Customer list page with category tabs, grid, and all CRUD modals
- Filter bar pairs the search box with a project dropdown. The project filter is applied client-side and matches either `interested_project_id` or any purchased apartment's project, so it works for interested customers and buyers alike
- Changing the category, search or project filter clears the selection, so "Email Selected" can only reach customers that are on screen. With nothing selected the button emails every visible customer with an address
- A failed load renders `ErrorState` (with retry) inside the grid, not the "no customers"
  empty state, and the delete confirmation stays open — with the reason in a toast — when the
  delete is refused
- **Uses hooks:** useCustomerData
- **Uses components:** CategoryTabs, CustomerGrid, CustomerCard, CustomerFormModal, CustomerDetailModal
- **Uses Ui:** SearchInput, Alert, useToast

#### Forms

### forms/CustomerFormModal.tsx
- Add/edit customer modal: basic info, project of interest, preferences (budget range, size, floor, bedrooms), and notes
- Validates name and surname only with per-field `fieldErrors` (inline red text, not Alert). Email and phone are optional
- The `priority` select was retired here; the `customers.priority` column is kept so existing values survive
- **Uses Ui:** Modal, Button, FormField, Input

#### Modals

### modals/CustomerDetailModal.tsx
- Read-only customer detail view; groups purchases by project with per-project and grand totals
- **Uses Ui:** Modal, Table

---

### Payments
**Path:** `Payments/`

Payment tracking for apartment sales contracts.

#### Services

### services/salesPaymentsService.ts
- `fetchSalesPayments()` — fetches all payments with linked apartment, customer, and sale details
- `calculateSalesPaymentStats(payments)` — computes totals and this-month stats
- `exportSalesPaymentsExcel(payments)` — async; writes a real `.xlsx` (one `Plaćanja` sheet) through `src/lib/xlsxExport.ts`
- `buildSalesPaymentsSheet(payments, t)` — pure AOA builder, exported for `salesPaymentsService.test.ts`
- **Depends on:** supabase client

#### Hooks

### hooks/useSalesPayments.ts
- `useSalesPayments()` — fetches and filters payments by search term, status (all/recent/large), and date range
- **Calls:** salesPaymentsService.ts
- **Returns:** loading, error, dismissError, hasData, refetch, stats, filteredPayments, searchTerm, setSearchTerm, filterStatus, setFilterStatus, dateRange, setDateRange
- The export itself is wired in `index.tsx` through `useAsyncExport`, which owns the button's loading flag and toasts `common.export_error` on failure

#### Views

### index.tsx (SalesPayments)
- Payment dashboard with stat cards (total, this month), filterable table, and Excel export
- When the load failed with nothing to show, the stat cards are hidden entirely (€0 totals
  would be a claim about the business) and the table area carries `ErrorState`; the header and
  the filter card stay mounted
- **Uses hooks:** useSalesPayments
- **Uses Ui:** Card, Table, StatGrid, Button

---

## Shared Utilities

### Payments/paymentMethod.ts
- `PAYMENT_METHOD_LABEL_KEY` + `paymentMethodLabel(method, t)` — label for
  `accounting_payments.payment_method` (WIRE / CASH / CHECK / CARD), using the same
  `payments.method_*` keys `Cashflow/components/PaymentMethodField` already uses. Three screens
  printed the raw stored value in a Croatian UI: `Sales/Payments`, `Retail/Sales` and
  `Retail/Projects/modals/RetailPaymentHistoryModal` (which imports it from here). The stored
  value is a CHECK constraint — map at render only. An unknown value keeps its raw text, a
  missing one renders `—`. Covered by `paymentMethod.test.ts`

### utils/priceUtils.ts
- `calculateAdjustedPriceRange(range, adjustmentType, amount)` — applies an `'increase'` / `'decrease'` of `amount` to a `PriceRange` (`{ min, max }`) for the bulk price update preview; decrease clamps each bound to 0. Exports the `PriceRange` interface
- Unit-tested in `priceUtils.test.ts` (vitest) covering increase/decrease, zero no-op, and negative-clamping cases

### utils/customerUtils.ts
- `groupCustomerPurchasesByProject(purchases)` — groups a customer's units by project with per-project totals (units, total, paid, remaining)

---

## i18n and status display

- **One namespace per import screen.** Both Excel modals and `ImportOutcomeSummary` share
  `sales_projects.excel_import.*`. The orphaned `apartments.import_modal.*` and
  `apartments.import_garages_modal.*` duplicates were folded into it and deleted; likewise
  `apartments.bulk_price_update.*` into the live `sales_projects.bulk_price.*`. Do not
  reintroduce a parallel namespace for these screens
- **Status is mapped at render, never translated in place.** `UnitsGrid`, `ApartmentDetailsModal`
  and `LinkUnitsModal` label unit status through `UNIT_STATUS` +
  `statusVariant`/`statusLabel` (`src/utils/statusDisplay.ts`); `SalesProjects/ProjectsGrid` uses
  `PROJECT_STATUS`. The surrounding comparisons (`status === 'Sold'`, `updateUnitStatus(…,
  'Reserved')`) stay English — they are written back into a CHECK column
- **Dates** go through `formatDate` / `formatDateTime` from `src/utils/formatters.ts` with
  `i18n.language`. `ApartmentDetailsModal`'s private `hr-HR`-only `formatDate` is gone
- The export is an `.xlsx`, not a CSV: amounts are written as **numbers** (a dot decimal is text
  to Croatian Excel), dates as **real date cells** formatted `dd.mm.yyyy.`, `payment_method` is
  translated rather than written raw, and the headers are the screen's own Croatian keys. Dates go
  through `toDateCell`, so a date-only column keeps the day it says rather than the UTC one before it
- **Deliberately left in English**, pending a wording decision: the 12- and 4-bullet
  "Expected File Format" lists in the two import modals (they name literal Croatian spreadsheet
  columns — `zgrada`, `oznaka stana`, `stan m2 prodajno`, `kapara 10%` — which must stay
  verbatim); the sample identity placeholders in `SaleFormModal` ("John Smith",
  "john@example.com", "+1 (555) 123-4567", "123 Main St"); and the `e.g., …` placeholders in
  `SingleApartmentModal`, `EditApartmentModal`, `SingleUnitModal`, `SingleBuildingModal`,
  `BulkUnitsModal` and `CustomerFormModal`

## Notes
- Customer records here are property buyers (Sales CRM) — distinct from `Cashflow/Customers` (accounting customers)
- Unit types: `stan` (apartment), `garaža` (garage), `repozitorij` (storage) — linked via junction tables `apartment_garages` and `apartment_repositories`
- All delete confirmation dialogs use `ConfirmDialog` from `src/components/ui/` via the pending-item pattern — never use `window.confirm()` or `confirm()`
