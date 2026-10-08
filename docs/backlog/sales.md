# Backlog — Sales

Unit inventory, the sale flow, customers and Sales payments. Ids: `SALES-n` (next free:
`SALES-21`). Entry format and rules are in [README.md](./README.md). Retail is in
[retail.md](./retail.md).

## Open

### SALES-20 · Low · Sales projects unit actions are not role-gated
- **Check:** Code reading (2026-10-08)
- **Where:** `Sales/SalesProjects/UnitsGrid.tsx` and its header: add, edit, delete, bulk create,
  bulk price, link, import and sell show to every role.
- **Fix direction:** `canEditSalesUnits` / `canDeleteSalesUnits` from `utils/permissions.ts`, as
  on the Apartments page. Check which roles `complete_apartment_sale` accepts before gating "sell".

### SALES-17 · Low · Bulk building creation
- **Check:** Code reading
- **Where:** `createBulkBuildings`.
- **What happens:** it can create buildings with names that already exist, always gives them 10
  floors, and writes `severity` inside the activity-log metadata, not as the severity.

### SALES-18 · Low · Garage and storage import has no template; import tolerance differs from the screen
- **Where:** the garage import modal has no "download template" button (the apartment import
  does). The apartment import accepts a price difference of 0,05 while the screen says 0,02.

### SALES-19 · Low · Sales labels, grammar and hardcoded strings
- **Check:** Code reading
- "Dodaj jednu Stan" and similar: sentences glued from a verb and a unit type.
- `Apartments/modals/PaymentHistoryModal.tsx:122,131` print English "Garages (…)" / "Storages (…)".
- The "all" option of the Apartments status filter is labelled "Status".
- Double colons in `CustomerCard.tsx` and `CustomerDetailModal.tsx`; the customer delete uses the
  generic confirmation text.
- "Apartmani" and "Stanovi" both name the same page; the menu says "Sales projekti", the page
  title "Projekti".
- Icon-only buttons without labels in `BuildingsGrid` and `UnitsGrid`; both hand-build money (UI-1).

### SALES-10 · Low · No sale cancellation flow
- **What happens:** nothing updates or deletes `sales` rows, so a reverted sale still counts in
  dashboards and reports. Filed Low, but it distorts figures for as long as the row exists.
- **Fix direction:** a cancel action that removes or flags the sale and returns the units to
  Available, in one RPC like `completeSale`.

### SALES-9 · Low · No unique constraint on unit numbers
- Duplicates are possible through bulk create, single create and within-file garage imports.

### SALES-8 · Low · Customers module keeps only one garage and one storage per apartment
- A second garage or storage unit linked to the apartment is neither shown nor counted in the
  package total on the Customers screens.

### SALES-13 · Low · Delete dialog on the Apartments page is half Croatian, half English
- **Where:** `src/components/Sales/Apartments/index.tsx`. Title is a literal "Potvrda brisanja",
  message is English.
- **Fix direction:** the `confirm.*` keys.

### SALES-14 · Low · Mixed money formats on customer cards and two modals
- **Where:** `CustomerCard.tsx` mixes a compact figure with full totals; `SingleUnitModal.tsx` and
  `BulkPriceUpdateModal.tsx` hand-roll their formatting.
- **Fix direction:** `formatEuro` / `formatEuroRounded`. Part of UI-1 in [ui.md](./ui.md).

## Resolved

### SALES-16 · Low · Apartments page actions are not role-gated
- Fixed on `fix/backlog-small-batch` (2026-10-08): `canEditSalesUnits` / `canDeleteSalesUnits` mirror the RLS policies and
  gate the Apartments page buttons and the delete-building button. The unit cards on Sales
  projects are not gated yet (SALES-20).

### SALES-6 · Medium · The package total is still computed per screen
- Decided 2026-10-08: a sold package totals its sale price plus the list prices of the linked
  garages and storage units; an unsold one, list prices throughout. `packageTotal` in
  `Sales/utils/packageTotal.ts` is the one implementation, used by the Sales project cards, the
  Apartments page and its payment history, and the Customers card, detail modal and per-project
  sums (`fix/figures-and-tic-export`). The stale `sales.total_paid` / `remaining_amount` columns
  are still there, unread by any screen; dropping them needs a migration.

### SALES-15 · Low · Sales project and building grids have no empty state
- Fixed on `feat/user-guidance-phase-2` (2026-10-06): both grids render `EmptyState` with a
  description saying where projects and buildings are added.
