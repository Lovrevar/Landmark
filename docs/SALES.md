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

### Services/salesService.ts
- `fetchProjects()` — fetches all sales projects
- `fetchBuildings()` — fetches buildings for a project
- `fetchApartments()`, `fetchGarages()`, `fetchRepositories()` — fetches units by type
- `fetchCustomers()` — fetches all customers
- `fetchSales()` — fetches all sale records
- `fetchActualTotalPaidByApartment(apartmentId)` — computes total paid for an apartment
- `createBuilding(data)`, `deleteBuilding(id)` — building CRUD
- `createUnit(data)`, `bulkCreateUnits(data)`, `deleteUnit(id)` — unit CRUD
- `updateUnitStatus(id, status)` — updates a unit's availability status
- `bulkUpdateUnitPrice(ids, delta)` — adjusts price per m² for selected units
- `linkGarageToApartment(garageId, apartmentId)`, `unlinkGarageFromApartment(...)` — garage linking
- `linkRepositoryToApartment(repoId, apartmentId)`, `unlinkRepositoryFromApartment(...)` — storage linking
- `createCustomer(data)` — creates a new customer from the sale form
- `completeSale(saleData)` — records a sale and updates unit status, links customer
- `updateCustomerStatus(customerId, status)` — updates customer CRM status
- `updateUnitAfterSale(apartmentId, saleData)` — patches unit record post-sale
- **Depends on:** supabase client

### Services/garageImportService.ts
- `importGaragesFromExcel(file, buildingId)` — parses Excel file and bulk-inserts garage records
- `fetchExistingGarageNumbers(buildingId)` — returns existing garage numbers to detect duplicates
- **Depends on:** supabase client, xlsx

#### Hooks

### Hooks/useSalesData.ts
- `useSalesData()` — fetches projects, buildings, apartments, garages, repositories, customers, and sales; enriches apartments with sale_info; calculates totals
- **Calls:** salesService.ts
- **Returns:** projects, buildings, apartments, garages, repositories, customers, loading, refetch

#### Views

### ProjectsGrid.tsx
- Project card grid showing building count, unit count, sold count, revenue, and progress bar

### BuildingsGrid.tsx
- Building card grid for a selected project showing unit counts and revenue per building

### UnitsGrid.tsx
- Unit grid with type tabs (apartments/garages/repositories), status filters, multi-select checkboxes, linked unit display, and bulk price config button

### index.tsx (SalesProjectsEnhanced)
- Main view orchestrating project → building → unit navigation with all CRUD modals and linking
- **Uses hooks:** useSalesData
- **Uses components:** ProjectsGrid, BuildingsGrid, UnitsGrid, SaleFormModal, all unit/building modals
- **Uses Ui:** Card, Button, useToast

#### Forms

### Forms/SaleFormModal.tsx
- Sale creation form with new/existing customer toggle; collects sale price, payment method, down payment, monthly payment, sale date, contract signed, and notes
- **Uses Ui:** Modal, Button, Select

#### Modals

### Modals/BuildingQuantityModal.tsx
- Input for number of buildings to bulk-create (1–20); validates with `fieldErrors`
- **Uses Ui:** Modal, Button

### Modals/SingleBuildingModal.tsx
- Form for single building (name, description, total_floors); validates with `fieldErrors`
- **Uses Ui:** Modal, Button

### Modals/SingleUnitModal.tsx
- Form for single unit (number, floor, size, price per m², computed total price); validates with `fieldErrors`
- **Uses Ui:** Modal, Button

### Modals/BulkUnitsModal.tsx
- Form for bulk unit creation (floor range, units per floor, size variation, pricing) with preview
- **Uses Ui:** Modal, Button

### Modals/LinkingModal.tsx
- Select available garages or storage units to link to an apartment
- **Uses Ui:** Modal, Button

### Modals/BulkPriceUpdateModal.tsx
- Increase/decrease price per m² for selected units with preview of new prices; validates with `fieldErrors`
- **Uses Ui:** Modal, Button

### Modals/ExcelImportApartmentsModal.tsx
- 3-step apartment bulk import (file upload → preview → results)
- **Uses Ui:** Modal, Button, useToast

### Modals/ExcelImportGaragesModal.tsx
- 3-step garage bulk import (file upload → preview → results)
- **Uses services:** garageImportService
- **Uses Ui:** Modal, Button, useToast

---

### Apartments
**Path:** `Apartments/`

Individual apartment and unit management. Handles CRUD, payment history, contract fields, and garage/storage linking per unit.

#### Services

### Services/apartmentService.ts
- `createBulkApartments(data)` — bulk-inserts apartments
- `createSingleApartment(data)` — inserts a single apartment
- `updateApartment(id, data)` — updates apartment fields
- `deleteApartment(id)` — removes an apartment
- `fetchApartmentPayments(apartmentId)` — fetches payment records for an apartment
- `updatePayment(id, data)` — updates a payment record
- `deletePayment(id)` — removes a payment record
- `fetchSaleIdForApartment(apartmentId)` — resolves the sale ID for payment creation
- **Depends on:** supabase client

### Services/linkUnitsService.ts
- `fetchLinkedUnitIds(apartmentId)` — returns IDs of currently linked garages and storage units
- `fetchAvailableUnits(buildingId)` — returns unlinked garages and storage units in the building
- `saveUnitLinks(apartmentId, garageIds, storageIds)` — upserts and removes links to match selection
- **Depends on:** supabase client

#### Hooks

### hooks/useApartmentData.ts
- `useApartmentData()` — fetches apartments, projects, buildings, linked units, and payment totals; returns arrays indexed by unit ID
- **Calls:** apartmentService.ts
- **Returns:** apartments, projects, buildings, apartmentPaymentTotals, garagePaymentTotals, storagePaymentTotals, linkedGarages, linkedStorages, loading, refetch

### hooks/useLinkUnits.ts
- `useLinkUnits(apartmentId, buildingId, enabled)` — manages available/selected garage and storage IDs with save
- **Calls:** linkUnitsService.ts
- **Returns:** availableGarages, availableStorages, selectedGarageIds, selectedStorageIds, loading, saving, setSelectedGarageIds, setSelectedStorageIds, save

#### Views

### ContractedSection.tsx
- Reusable contract field group (predugovor date, payment type, installment percentages)
- Exports helpers: `emptyContractFields()`, `contractFieldsFromData()`, `contractFieldsToPayload()`

### index.tsx (Apartments)
- Apartment management page: project/building/status filters, CRUD modals, payment history, linking
- **Uses hooks:** useApartmentData, useLinkUnits
- **Uses Ui:** Card, Table, Button, Select

#### Modals

### Modals/ApartmentDetailsModal.tsx
- Read-only apartment detail view with location, specs, and contract data if present
- **Uses Ui:** Modal

### Modals/BulkApartmentModal.tsx
- Form for bulk apartment creation (project, building, start number, quantity, floor, size, price)
- **Uses Ui:** Modal, Button, Select, useToast

### Modals/SingleApartmentModal.tsx
- Single apartment creation form including ContractedSection
- **Uses components:** ContractedSection
- **Uses Ui:** Modal, Button, Select, useToast

### Modals/EditPaymentModal.tsx
- Edit a single payment record (amount, date, type, notes)
- **Uses Ui:** Modal, Button, Select

### Modals/PaymentHistoryModal.tsx
- All payments for an apartment with linked units, totals, and progress bar
- **Uses Ui:** Modal, Table

### Modals/WirePaymentModal.tsx
- Display-only summary of apartment and linked units with total package price
- **Uses Ui:** Modal

### Modals/LinkUnitsModal.tsx
- Link/unlink garages and storage units to an apartment
- **Uses hooks:** useLinkUnits
- **Uses Ui:** Modal, Button, useToast

---

### Customers
**Path:** `Customers/`

Sales-side buyer CRM with category segmentation (interested, hot_lead, negotiating, buyer, backed_out), preferences tracking, and linked unit summaries.

#### Services

### Services/customerService.ts
- `fetchCustomers(category)` — fetches customers filtered by category with linked apartment/garage/repository data
- `createCustomer(data)` — inserts a new customer
- `updateCustomer(id, data)` — updates a customer record
- `deleteCustomer(id)` — removes a customer
- `updateLastContact(id, date)` — updates the last contact date
- **Depends on:** supabase client, customerCache.ts

### Services/customerCache.ts
- Client-side cache with 5-minute TTL for customer data and counts
- Invalidated on all CRUD operations

#### Hooks

### Hooks/useCustomerData.ts
- `useCustomerData(activeCategory)` — fetches customers for the active category, reads counts from cache, exposes CRUD actions
- **Calls:** customerService.ts, customerCache.ts
- **Returns:** customers, counts, loading, saveCustomer, deleteCustomer, updateLastContact

#### Views

### CategoryTabs.tsx
- Tab bar with 5 category tabs (interested, hot_lead, negotiating, buyer, backed_out) showing badge counts

### CustomerGrid.tsx
- Multi-select customer card grid with edit/delete/view-details/update-contact actions

### CustomerCard.tsx
- Individual customer card with name, contact info, preferences, priority badge (hot/warm/cold), and purchased units for buyers

### index.tsx (Customers)
- Customer list page with category tabs, grid, and all CRUD modals
- **Uses hooks:** useCustomerData
- **Uses components:** CategoryTabs, CustomerGrid, CustomerCard, CustomerFormModal, CustomerDetailModal
- **Uses Ui:** SearchInput, useToast

#### Forms

### Forms/CustomerFormModal.tsx
- Add/edit customer modal: basic info, preferences (budget range, size, floor, bedrooms), and notes
- Validates name, surname, email, phone with per-field `fieldErrors` (inline red text, not Alert)
- **Uses Ui:** Modal, Button, FormField, Input

#### Modals

### Modals/CustomerDetailModal.tsx
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
- `exportSalesPaymentsCSV(payments)` — exports payment data as a CSV file
- **Depends on:** supabase client

#### Hooks

### hooks/useSalesPayments.ts
- `useSalesPayments()` — fetches and filters payments by search term, status (all/recent/large), and date range
- **Calls:** salesPaymentsService.ts
- **Returns:** loading, stats, filteredPayments, searchTerm, setSearchTerm, filterStatus, setFilterStatus, dateRange, setDateRange

#### Views

### index.tsx (SalesPayments)
- Payment dashboard with stat cards (total, this month), filterable table, and CSV export
- **Uses hooks:** useSalesPayments
- **Uses Ui:** Card, Table, StatGrid, Button

---

## Shared Utilities

### utils/priceUtils.ts
- `calculateAdjustedPriceRange(units, adjustment)` — computes adjusted price range for bulk price update preview

### utils/customerUtils.ts
- `groupCustomerPurchasesByProject(purchases)` — groups a customer's units by project with per-project totals (units, total, paid, remaining)

---

## Notes
- Customer records here are property buyers (Sales CRM) — distinct from `Cashflow/Customers` (accounting customers)
- Unit types: `stan` (apartment), `garaža` (garage), `repozitorij` (storage) — linked via junction tables `apartment_garages` and `apartment_repositories`
- All delete confirmation dialogs use `ConfirmDialog` from `src/components/Ui/` via the pending-item pattern — never use `window.confirm()` or `confirm()`
