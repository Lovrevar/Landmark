# Sales

_Part of the [Cognilion Manual Testing Cheat Sheet](../TESTING.md). See that file for status markers and how to walk this document._

## Sales Projects → Buildings → Units

_Path: `/sales-projects`. Role: Director / Sales. Profile: Sales (or General). Needs: at least 1 project; a sample Excel apartment import file; a sample Excel garage import file._

This page is a three-level drill-down: **Projects → Buildings → Units** (with unit tabs for apartments / garages / repozitorij).

### Navigation

- load `/sales-projects` — projects grid renders, each card showing building count, unit count, sold count, revenue, and progress bar   ( )
- click a project card — drills down to the building grid; "Back to projects" link is visible   ( )
- click a building — drills down to the unit grid with three tabs: Apartments, Garages, Repositories   ( )
- click each tab — unit list swaps; selected tab is visually active   ( )
- click "Back to buildings" — returns to buildings grid, preserving previous scroll/selection where possible   ( )

### Create buildings

**Single building**

- open "Add Building" → fill name, description, total_floors → save   ( )
- submit with empty name — inline `fieldErrors.name` blocks submit   ( )
- submit with `total_floors = 0` or negative — inline error   ( )
- submit with a very large `total_floors` (e.g. 100) — accepted; buildings grid renders without layout break   ( )
- enter Croatian characters in name — saves and displays correctly   ( )

**Bulk create (quantity)**

- open "Bulk Add Buildings" → enter quantity (1-20) → save — the specified count of default-named buildings are created   ( )
- submit with quantity = 0 or >20 — inline error "quantity 1-20"   ( )
- submit with non-numeric value — blocked   ( )

**Delete building**

- delete a building with no units — Cancel / Confirm in ConfirmDialog   ( )
- delete a building with units — expect block or cascade delete (document current behaviour)   ( )

### Create units (apartments, garages, repositories)

For each of the three unit types, the Single-Unit and Bulk-Unit modals are similar; run the shortened set per type.

**Single unit**

- open "Add Unit" on the Apartments tab → fill unit number, floor, size (m²), price per m² → total price auto-computes (size × pricePerM2) → save   ( )
- change size or price per m² — total updates live   ( )
- submit with empty unit number — inline `fieldErrors.number` blocks submit   ( )
- submit with floor out of `total_floors` range (e.g. floor 10 in a 5-floor building) — document behaviour (allowed or rejected)   ( )
- submit with size = 0 or negative — blocked   ( )
- submit with price per m² = 0 — document (probably allowed for TBD pricing)   ( )
- duplicate unit number in the same building — expect a unique-constraint error   ( )
- repeat the same checks on Garages and Repositories tabs   ( )

**Bulk units**

- open "Bulk Add Apartments" → fill start floor, end floor, units per floor, size variation, base price per m² → preview grid shows the to-be-created units   ( )
- save — all units created; count matches `(endFloor - startFloor + 1) × unitsPerFloor`   ( )
- submit with start > end floor — blocked   ( )
- submit with 0 units per floor — blocked   ( )
- bulk-create in a building where some numbers already exist — expect partial-create with per-row errors or a full block   ( )

**Excel import — Apartments** (3-step wizard: upload → preview → results)

- open "Import from Excel" → choose a valid `.xlsx` file → Next — preview step shows parsed rows with per-row errors highlighted   ( )
- row missing apartment number — "Missing apartment number" error appears on that row   ( )
- row missing size — "Missing size (m2)" error on that row   ( )
- row with building label that doesn't match any building in the project — row flagged, not imported   ( )
- confirm import → results step shows counts: success, failed, garagesCreated, storagesCreated   ( )
- upload a non-Excel file (`.txt` / `.pdf`) — rejected at upload or at parse time   ( )
- upload a malformed Excel (missing header row) — error message shown, no crash   ( )
- close with X / Esc after step 2 (preview) — nothing is imported   ( )
- re-open the modal after import — state is fresh (step 1 again)   ( )

**Excel import — Garages** (same 3-step wizard)

- open on a building with existing garages → import a file that includes 2 duplicate garage numbers → duplicates are flagged, non-duplicates import   ( )
- import a clean file → success count matches file row count   ( )
- close mid-import (if possible) — document whether partial results are committed or rolled back   ( )

### Unit selection and status

- on the Units grid, tick multiple unit checkboxes — selection count appears in a bulk-action bar   ( )
- filter units by status (available, reserved, sold) — grid narrows   ( )
- change a single unit's status via its row menu — badge updates; revenue/progress on the parent building refreshes   ( )

### Bulk price update (per m²)

_Opens `BulkPriceUpdateModal`. Only enabled when units are selected._

- select 3 apartments with different price-per-m² values → open Bulk Price Update   ( )
- selection summary shows count and current price range (min-max)   ( )
- choose "increase", enter +50 €/m² → new price range preview updates; total value delta is shown   ( )
- submit — prices update on all selected units; units grid re-renders   ( )
- choose "decrease", enter a value larger than the smallest current price (would make some prices negative) — inline error "would result in negative prices", submit blocked   ( )
- submit with empty adjustment value — error "enter a valid value greater than 0"   ( )
- submit with `0` — same error   ( )
- submit with decimal (e.g. `12.5`) — accepted; totals use decimal arithmetic   ( )
- close without submitting — prices unchanged   ( )

### Unit linking (garage ↔ apartment, repozitorij ↔ apartment)

_Linking lets you bundle a garage and/or storage with an apartment so they sell as a package._

- open an apartment → "Link Units" → modal lists available (un-linked) garages and repositories in the same building   ( )
- select 1 garage and 1 repository → save — links appear on the apartment row and on the garage/repo rows   ( )
- re-open Link Units — pre-checked checkboxes reflect current links; unchecking and saving unlinks   ( )
- attempt to link a garage already linked to another apartment — it shouldn't appear in the available list (verify)   ( )
- deleting the apartment should unlink (or cascade) its garage/repo links — document behaviour   ( )

### Sale flow (SaleFormModal)

_Records a sale against a unit — either using an existing customer or creating a new one inline._

- open Sell on an available apartment → choose "New customer" toggle → fill name, surname, email, phone, sale price, payment method, down payment, monthly payment, sale date, contract signed, notes → save   ( )
- same flow with "Existing customer" — dropdown lists customers; pick one; customer's contact fields pre-fill / are hidden   ( )
- save successfully — apartment status changes to sold; linked garage and repozitorij (if any) also change state; customer's category transitions to `buyer`   ( )
- submit with missing required fields (sale price empty, no customer picked) — inline errors per field   ( )
- sale price lower than the apartment's listed price — document behaviour (warn or allow)   ( )
- monthly payment × months ≠ sale price − down payment — document whether the app validates   ( )
- Cancel / Esc — no sale recorded   ( )

---

## Apartments

_Path: `/apartments`. Role: Director / Sales. Profile: Sales (or General)._

This is the flatter list view (vs. the drill-down above). Filters, modals for CRUD, and payment history per apartment.

**Filtering**

- filter by project — apartment list narrows   ( )
- filter by building (requires a project selection first) — narrows further   ( )
- filter by status (available / reserved / sold / all) — narrows   ( )
- change project with a building filter active — building filter resets   ( )

**Add apartment — single (SingleApartmentModal)**

- open → fill project, building, unit number, floor, size, price per m², total — save   ( )
- the `ContractedSection` is visible and **optional** — fill predugovor date + payment type (credit / installments) + per-installment percentages → save   ( )
- submit ContractedSection with installment percentages that don't sum to 100 — document behaviour (warn or allow)   ( )
- submit with only one contract field filled (rest empty) — document   ( )

**Add apartment — bulk (BulkApartmentModal)**

- pick project + building, enter start number, quantity, floor, size, price — preview shows the generated unit numbers   ( )
- save — all apartments created; grid refreshes   ( )
- submit with start number that would collide with existing numbers — row-level errors or full block   ( )

**Edit apartment (EditApartmentModal)**

- open Edit → fields pre-fill   ( )
- change size — total price recomputes from size × pricePerM2   ( )
- Cancel — no update   ( )

**Apartment details (ApartmentDetailsModal)**

- open Details → read-only view shows location, specs, and contract fields if the apartment has any   ( )
- no contract fields → the contract section is hidden or shows placeholder text   ( )
- close with X / Esc / backdrop   ( )

**Payment history (PaymentHistoryModal)**

- open on an apartment with sale + payments → modal shows: linked units, per-payment rows, total paid, total remaining, progress bar   ( )
- open on an apartment with no sale — empty state or disabled button   ( )
- edit a payment (EditPaymentModal) from the history → amount / date / type / notes — save   ( )
- delete a payment — ConfirmDialog → apartment's remaining total recalculates   ( )

**Wire payment summary (WirePaymentModal)**

- open on a sold apartment with linked garage + repozitorij → display-only summary shows all three units and total package price   ( )
- values match apartment + garage + repo totals exactly   ( )

**Delete apartment**

- delete an apartment with no sale → Cancel / Confirm   ( )
- delete a sold apartment → expect block, or a strong "double-confirm" dialog   ( )
- delete cascades to payments / unlinks garage-repo — document behaviour   ( )

---

## Customers (Sales)

_Path: `/customers`. Role: Director / Sales. Profile: Sales. Needs: at least 2 customers per category for meaningful tests._

Sales-side buyer CRM with 5 category tabs and a 5-minute client-side cache.

**Category tabs**

- tabs: `interested`, `hot_lead`, `negotiating`, `buyer`, `backed_out` — each with a badge count (read from cache)   ( )
- click each tab — list updates; URL / active tab state reflects the choice   ( )
- badge counts refresh after creating / deleting a customer   ( )

**Add customer (CustomerFormModal)**

- open Add → fill first name, last name, email, phone → save — customer appears in the current category (defaults to active tab or `interested`)   ( )

**Required fields**

- submit with empty first name — inline `fieldErrors.name` "First name is required"   ( )
- submit with empty last name — inline "Last name is required"   ( )
- submit with empty email — inline "Email is required"   ( )
- submit with empty phone — inline "Phone is required"   ( )

**Invalid values**

- duplicate email — server returns `23505` → Alert banner "A customer with this email already exists"   ( )
- malformed email (`foo@`) — HTML5 type=email blocks submit   ( )
- Croatian characters in first/last name — saves and displays correctly   ( )

**Preferences section**

- fill budget min/max, preferred size range, floor, location, bedrooms, preferences notes → save   ( )
- leave preferences blank → save succeeds; detail view shows empty preferences   ( )
- enter budget min > budget max — document behaviour (warn or allow)   ( )
- enter negative numbers in any preferences field — document (probably rejected or coerced to 0)   ( )

**Priority**

- set priority = `hot` / `warm` / `cold` — priority badge appears with the matching colour on the card   ( )

**Status / category changes**

- edit a customer and change `status` from `interested` to `hot_lead` — after save, they move to the hot_lead tab; interested count decreases, hot_lead increases   ( )
- a customer whose sale was completed via the Sale flow should have status = `buyer`   ( )

**Update last contact**

- click "Update Contact" on a customer card → `last_contact` updates to today; card indicator refreshes   ( )

**Detail modal (CustomerDetailModal)**

- open Details on a buyer — purchases grouped by project with per-project totals and a grand total   ( )
- open on a non-buyer — purchases section is empty; preferences and notes still show   ( )
- close with X / Esc / backdrop   ( )

**Multi-select grid**

- tick multiple customer cards — bulk-action bar appears (delete, change category, etc. per current app)   ( )
- untick all — bulk bar disappears   ( )

**Cache behaviour**

- create a new customer → counts and list refresh immediately (cache is invalidated on mutations)   ( )
- leave the page for >5 minutes and return — refetch happens on next navigation (TTL expiry)   ( )

**Delete customer**

- delete a customer with no purchases → Cancel / Confirm   ( )
- delete a buyer who owns apartments — expect block with a clear "has linked units" message   ( )

**Search**

- search by name / surname — list filters within the active category   ( )
- switch category while search is active — search text is preserved or cleared (document)   ( )

---

## Payments (Sales)

_Path: `/sales-payments`. Role: Director / Sales. Profile: Sales. Needs: at least 10 sales payments spread across 2 months._

**Stat cards**

- page loads with stat cards: total paid (all time), this-month total, (others as rendered)   ( )
- stats reflect the filtered view, not the full dataset — document the intended behaviour   ( )

**Filtering**

- filter by status (all / recent / large) — list narrows   ( )
- set a date range (start and end dates) — only payments in range show   ( )
- invert the date range (end before start) — document behaviour (blocked or auto-swap)   ( )
- clear filters — full list returns   ( )

**Search**

- search by customer name, apartment number, or sale reference — list filters   ( )
- debounce: typing quickly does not spam the filter logic   ( )

**Table**

- columns show customer, apartment, sale date, payment date, amount, method, status   ( )
- sort by each column (ascending / descending)   ( )
- paginate if the table supports pagination — empty page-5 if filter reduces results, pagination resets to 1   ( )

**CSV export**

- click Export CSV → file downloads; name includes a date stamp   ( )
- open the file — rows match the currently-filtered set; column headers are present   ( )
- export an empty (filtered-to-zero) set — file is headers-only or the button is disabled (document)   ( )
- Croatian characters in customer names (`Žgaljić`) render correctly in the CSV (BOM / UTF-8 verified)   ( )
