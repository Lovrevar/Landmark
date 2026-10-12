# Backlog — Sales

Unit inventory, the sale flow, customers and Sales payments. Ids: `SALES-n` (next free:
`SALES-21`). Entry format and rules are in [README.md](./README.md). Retail is in
[retail.md](./retail.md).

## Open

### SALES-17 · Low · Bulk building creation always gives ten floors
- **Where:** `createBulkBuildings` (`total_floors: 10`); `BuildingQuantityModal` asks only for a
  quantity. (The duplicate names were fixed on `fix/contracts-scope-sale-cancel-unit-numbers`:
  numbering continues from the first free name. The "severity in metadata" point was not a
  defect — `logActivity` stores severity there for every call.)
- **Fix direction:** a floors field in the modal.

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

### SALES-13 · Low · Delete dialog on the Apartments page is half Croatian, half English
- **Where:** `src/components/Sales/Apartments/index.tsx`. Title is a literal "Potvrda brisanja",
  message is English.
- **Fix direction:** the `confirm.*` keys.

### SALES-14 · Low · Mixed money formats on customer cards and two modals
- **Where:** `CustomerCard.tsx` mixes a compact figure with full totals; `SingleUnitModal.tsx` and
  `BulkPriceUpdateModal.tsx` hand-roll their formatting.
- **Fix direction:** `formatEuro` / `formatEuroRounded`. Part of UI-1 in [ui.md](./ui.md).

## Resolved

### SALES-9 · Low · No unique constraint on unit numbers
- Fixed on `fix/contracts-scope-sale-cancel-unit-numbers` (2026-10-12): unique indexes on unit numbers per building and building names per
  project (migration `20261012100200`, **not applied yet**); the create, edit and import paths say
  so in words. No database had a duplicate on 2026-10-12.

### SALES-10 · Low · No sale cancellation flow
- Fixed on `fix/contracts-scope-sale-cancel-unit-numbers` (2026-10-12): `cancel_apartment_sale` (migration `20261012100100`, **not applied yet** —
  see [release.md](./release.md)) and the "Poništi prodaju" action for Director and Accounting.
  The Edit Apartment form no longer sets or unsets Sold.

### SALES-8 · Low · Customers module keeps only one garage and one storage per apartment
- Fixed on `fix/backlog-batch-4` (2026-10-09): Customers keeps every linked garage and storage unit, shows each on the
  card and in the detail window, and counts them all in the package total.

### SALES-18 · Low · Garage and storage import has no template; import tolerance differs from the screen
- Fixed on `fix/backlog-batch-3` (2026-10-08): the garage import has a "Preuzmi predložak" button
  (`garageImportTemplate.ts`). The reported tolerance mismatch (0,05 against 0,02) was not found
  in the code or the strings.

### SALES-20 · Low · Sales projects unit actions are not role-gated
- Fixed on `fix/backlog-batch-3` (2026-10-08): the unit cards and the page header use `canEditSalesUnits` /
  `canDeleteSalesUnits`. Selling needs INSERT on `sales` and `customers` and UPDATE on the unit,
  all three open to Director, Sales and Accounting.

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
