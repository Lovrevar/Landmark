# Backlog — Sales

Unit inventory, the sale flow, customers and Sales payments. Ids: `SALES-n` (next free:
`SALES-16`). Entry format and rules are in [README.md](./README.md). Retail is in
[retail.md](./retail.md).

## Open

### SALES-6 · Medium · The package total is still computed per screen
- **Where:** Sales Projects cards, Apartments page, Customers, Sales dashboard, Sales Payments.
- **What happens:** the "paid" side is fixed: every apartment-level screen counts payments on the
  apartment's `OUTGOING_SALES` invoices. The denominator is not: some screens use list price,
  others `sale_price`, so the same apartment can show different totals and remaining amounts.
- **Fix direction:** one shared helper for the package total; drop or derive the stale
  `sales.total_paid` / `remaining_amount` columns (documented as a sale-time snapshot).
- **ERP:** if buyer payments come from the ERP (Q14), the paid basis already matches.

### SALES-10 · Low · No sale cancellation flow
- **What happens:** nothing updates or deletes `sales` rows, so a reverted sale still counts in
  dashboards and reports. Filed Low, but it distorts figures for as long as the row exists.
- **Fix direction:** a cancel action that removes or flags the sale and returns the units to
  Available, in one RPC like `completeSale`.

### SALES-9 · Low · No unique constraint on unit numbers
- Duplicates are possible through bulk create, single create and within-file garage imports.

### SALES-8 · Low · Customers module keeps only one garage and one storage per apartment
- Customer totals also use list prices instead of `sale_price` (same root as SALES-6).

### SALES-13 · Low · Delete dialog on the Apartments page is half Croatian, half English
- **Where:** `src/components/Sales/Apartments/index.tsx`. Title is a literal "Potvrda brisanja",
  message is English.
- **Fix direction:** the `confirm.*` keys.

### SALES-14 · Low · Mixed money formats on customer cards and two modals
- **Where:** `CustomerCard.tsx` mixes a compact figure with full totals; `SingleUnitModal.tsx` and
  `BulkPriceUpdateModal.tsx` hand-roll their formatting.
- **Fix direction:** `formatEuro` / `formatEuroRounded`. Part of UI-1 in [ui.md](./ui.md).

### SALES-15 · Low · Sales project and building grids have no empty state
- **Where:** Sales `ProjectsGrid` and `BuildingsGrid`.
- **Fix direction:** `EmptyState`.
