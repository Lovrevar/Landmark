# Retail

_Part of the [Cognilion Manual Testing Cheat Sheet](../TESTING.md). See that file for status markers and how to walk this document._

## Projects (Retail)

_Path: `/retail-projects`. Role: Director / Sales. Profile: Retail. Needs: at least 2 land plots in inventory; at least one retail customer; one retail supplier._

Retail projects manage land development through phases and milestones — distinct from Sales (apartments). Creating a new project auto-generates a default set of phases.

### Navigate projects list → detail

- load `/retail-projects` — project grid shows project cards   ( )
- click a project card — drills into Project Detail with phase cards, milestones, contracts, and a statistics panel   ( )
- back button returns to grid without losing state   ( )

### Add / edit retail project (ProjectFormModal)

**Golden path — without a land plot**

- open Add Project → fill name, location, plot number, status, total area (m²), purchase price → save   ( )
- new project appears in grid; opening it shows the auto-created default phases (land / development / construction / sales — verify which are seeded)   ( )

**Golden path — with a land plot link**

- open Add Project → pick a land plot from the dropdown — location, plot number, and a blue info panel (owner, areas, price per m²) auto-fill; location and plot_number fields become **disabled**   ( )
- helper text under the budget field shows the plot's total price for reference   ( )
- save — project is created linked to the plot   ( )
- open Edit → change the land plot selection to "no land plot" — location and plot_number become editable again; data remains from the previous plot until manually changed   ( )

**Missing required fields**

- submit with empty name — inline error   ( )
- submit with empty location (when no land plot selected) — inline error   ( )
- submit with empty plot number (when no land plot selected) — inline error   ( )
- submit with empty total area — inline error   ( )
- submit with empty purchase price — inline error   ( )

**Invalid values**

- negative total area — blocked or coerced (document)   ( )
- purchase price = 0 — document whether allowed   ( )
- end_date earlier than start_date — document behaviour   ( )
- very long notes (5000+ chars) — saves and displays without layout break   ( )

**Status changes**

- cycle status through `Planning`, `In Progress`, `Completed`, `On Hold` — badge colour updates on the card   ( )

**Delete (in-modal)**

- open Edit → click Delete button → ConfirmDialog with the project's name in the message   ( )
- Cancel — dialog closes, project remains   ( )
- Confirm with the project having no linked contracts/invoices — removes the project and cascades its phases   ( )
- Confirm with linked contracts/invoices — expect block with a clear error   ( )
- while delete is running the ConfirmDialog shows a loading state and other buttons are disabled   ( )

### Phase management

**Edit phase (EditPhaseModal)**

- open a phase card → Edit — name, dates, budget, status pre-fill   ( )
- change the phase budget — parent project statistics recompute (expenses-by-phase, margin)   ( )
- change phase status — card colour updates   ( )
- save, Cancel, Esc — expected behaviour   ( )

**Add development phase (DevelopmentFormModal)**

- add a new phase (if the UI supports custom phases beyond the defaults) → required fields, budget, dates — save   ( )
- add a phase whose dates extend beyond project end_date — document behaviour   ( )

### Milestones (MilestoneFormModal)

- add a milestone to a project → name, target date, status → save → appears in MilestoneList   ( )
- submit with empty name or date — inline error   ( )
- change a milestone status to complete — visual indicator updates in the list   ( )
- delete a milestone → ConfirmDialog   ( )

### Supplier contracts (SupplierFormModal + ContractFormModal)

- add a retail supplier via the in-project SupplierFormModal — supplier appears in the supplier list for that project   ( )
- open ContractFormModal, assign the supplier to a phase with contract value and milestones → save — contract appears on the phase card   ( )
- the project statistics breakdown includes this contract's value in the correct phase-type bucket (land / development / construction)   ( )
- edit a contract — fields pre-fill; save; statistics refresh   ( )
- delete a contract with linked invoices/payments — expect block or cascade (document)   ( )

### View contract invoices + payments (RetailInvoicesModal, RetailPaymentHistoryModal)

- open a contract → "View Invoices" → modal lists all invoices linked to the contract with running totals   ( )
- open "Payment History" → chronological list of payments, total paid, remaining   ( )
- close each modal (X / Esc / backdrop)   ( )

### Sales contracts (SalesFormModal)

- create a sales contract for a parcel → customer, land plot / parcel, sale amount, dates → save   ( )
- contract appears in ProjectStatistics revenue side; profit/loss recomputes   ( )

### Project statistics panel

- stats show: land/development/construction expenses, sales revenue, profit/loss, margin, cost-structure breakdown   ( )
- values reconcile against the sum of contracts and invoices on the project   ( )
- zero-contract project shows €0 across the board without NaN/−∞   ( )
- a project with revenue but no expenses shows 100% margin (not infinity / NaN)   ( )

---

## Land Plots

_Path: `/retail-land-plots`. Role: Director / Sales. Profile: Retail._

Land plot inventory — rows of owned/pending parcels, each may be linked to a Retail Project.

**List + stat cards**

- load the page — stat cards show total plot count, total area (m²), total paid, etc.   ( )
- empty state when no plots exist — EmptyState placeholder   ( )

**Add plot**

- open Add Plot → fill owner first name, owner last name, plot number, location, total area, purchased area, price per m², payment date (optional), payment status (`paid` / `pending` / `partial`), notes → save   ( )
- total price field (if computed) = purchased_area × price_per_m²   ( )

**Required fields**

- submit with empty owner first name — inline error   ( )
- submit with empty owner last name — inline error   ( )
- submit with empty plot number — inline error   ( )
- submit with empty total area — inline error   ( )
- submit with empty purchased area — inline error   ( )
- submit with empty price per m² — inline error   ( )

**Invalid values**

- purchased area > total area — document whether the app flags   ( )
- plot number already exists — expect unique-constraint error   ( )
- negative area or price — blocked   ( )
- price per m² with many decimals (€12.3456) — stored with 2 decimal precision in display   ( )

**Payment status**

- set status = `paid` without a payment date — document behaviour   ( )
- set `partial` — should show a distinct badge colour from paid / pending   ( )
- switch between all three values and save — row reflects new badge   ( )

**Edit**

- open Edit on a plot — all fields pre-fill; payment date (if null) shows as empty   ( )
- reducing purchased area below what an existing project is using — expect block or warning   ( )

**Details modal**

- click Eye/Details → modal shows plot metadata + any sales records against this plot   ( )
- plot with no sales — empty sales section   ( )
- close with X / Esc / backdrop   ( )

**Delete**

- delete a plot with no linked project and no sales → Cancel / Confirm   ( )
- delete a plot linked to a Retail Project — expect block or cascade (document)   ( )
- delete a plot with recorded sales — expect block   ( )

**Search**

- search by owner name or plot number — list filters   ( )
- Croatian diacritics in search work   ( )

---

## Customers (Retail)

_Path: `/retail-customers`. Role: Director / Sales. Profile: Retail._

Retail customer records — parcel/lot buyers. Distinct from Sales customers.

**List + search**

- load page — customer list renders with contact info and linked sales count   ( )
- search by name/surname — list filters   ( )
- clear — full list   ( )

**Add / edit**

- open Add → name is required (the hook validates and returns `fieldErrors`); submit with empty name — inline error   ( )
- empty surname — inline error   ( )
- optional fields: email, phone, address, OIB — save with them empty   ( )
- duplicate customer by name+surname — document whether app prevents   ( )
- invalid email — HTML5 blocks   ( )

**Detail modal**

- open Details — customer data + list of their retail sales + totals   ( )
- customer with no sales — sales section is empty   ( )
- close (X / Esc / backdrop)   ( )

**Delete**

- delete with no linked sales → Cancel / Confirm   ( )
- delete with linked sales — expect block with a clear message   ( )

---

## Invoices (Retail)

_Path: `/retail-invoices`. Role: Director / Accounting. Profile: Retail. Needs: retail contracts with at least one invoice each._

Retail invoices are separate from Cashflow invoices but share type definitions.

**List + filters**

- load page — table lists retail invoices with contract, supplier, project, amounts, status   ( )
- filter by status (`PAID` / `UNPAID` / `PARTIAL`) — list narrows   ( )
- filter by project — list narrows to that project's invoices   ( )
- filter by supplier — list narrows   ( )
- combine filters — AND logic   ( )
- clear filters — full list   ( )

**Detail view**

- click a row → detail view shows invoice header, multi-VAT breakdown (if present), linked contract, payment history   ( )
- close / back returns to list with filters preserved   ( )

**Add / edit retail invoice**

- add a retail invoice (reachable from either `/retail-invoices` or from a Retail Project contract) → required fields block the golden path   ( )
- edit an invoice with a payment — amount and invoice number are locked or produce a warning   ( )
- delete an invoice with no payments → Cancel / Confirm   ( )
- delete an invoice with payments — expect block or cascade   ( )

**Cross-module consistency**

- the same retail invoice appears in both `/retail-invoices` and `/accounting-invoices` (Cashflow side) — edits in one reflect in the other on refresh   ( )
- the Cashflow Invoice list's retail-category filter should include these   ( )

---

## Sales (Retail)

_Path: `/retail-sales-payments`. Role: Director / Sales. Profile: Retail. Needs: at least 2 retail customers, at least 2 land plots with available area._

Retail sales = parcel/lot sales to customers. Distinct from apartment sales under `/sales-payments`.

**List + sale cards**

- load page — sale cards render with customer, land plot reference, sale amount, payment status   ( )
- empty state with no sales   ( )

**Add sale**

- open Add Sale → pick customer, pick land plot, enter sold area (m²), price, payment dates, payment status → save   ( )

**Required fields**

- submit with no customer — inline error   ( )
- submit with no land plot — inline error   ( )
- submit with no sold area or no price — inline error   ( )

**Invalid values**

- sold area > remaining available area on the plot — expect block with a clear message   ( )
- sold area = 0 or negative — blocked   ( )
- price per m² doesn't match the plot's base price — document whether allowed (usually yes, markup/discount)   ( )
- same customer, same plot, overlapping area — document whether app warns on duplicates   ( )

**Edit**

- open an existing sale → change the sold area within the plot's remaining bounds — save; plot's remaining area recomputes   ( )
- change the customer to a different customer — linked records update on both sides   ( )
- attempt to change the land plot to one without enough remaining area — expect block   ( )

**Payment tracking**

- record a payment against a retail sale → sale's payment status transitions (`pending` → `partial` → `paid`)   ( )
- delete a payment — status rolls back   ( )

**Delete**

- delete a sale with no payments → Cancel / Confirm — plot's available area restores   ( )
- delete a sale with payments — expect block or cascade (document)   ( )

**Permissions**

- profile = General or Sales — can still reach `/retail-sales-payments`? Document visibility   ( )
- profile = Retail, role = Investment — document access   ( )
