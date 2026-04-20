# Cashflow

_Part of the [Cognilion Manual Testing Cheat Sheet](../TESTING.md). See that file for status markers and how to walk this document._

## Invoices

_Role: Director or Accounting. Profile: Cashflow. Needs: at least one company, one supplier, one project, one invoice category._

### Add Invoice

_The reference example for this whole document. Later phases replicate this shape everywhere._

**Golden path**

- add an invoice with all fields entered (type, company, supplier, project, invoice number, issue date, due date, single VAT rate with base amount, category, description)   (+)

**Missing required fields** — each line expects an inline validation error and no record created

- add an invoice with the invoice type missing   (+)
- add an invoice with the company missing   (+)
- add an invoice with the supplier missing (for `INCOMING_SUPPLIER` type)   (+)
- add an invoice with the office supplier missing (for `INCOMING_OFFICE` type)   (+)
- add an invoice with the customer missing (for `OUTGOING_SALES` type)   (+)
- add an invoice with the invoice number missing   (+)
- add an invoice with the issue date missing   (+)
- add an invoice with the due date missing   (+)
- add an invoice with zero base amount across all four VAT slots   (+)
- add an invoice with the category missing   (+)

**Invalid values**

- add an invoice with a duplicate invoice number (same supplier, same year)   (-)
- add an invoice with a negative base amount   (+)
- add an invoice with a due date before the issue date   (+)
- add an invoice with an issue date more than 1 year in the future   (-)
- add an invoice with a non-numeric reference number containing letters   (-)
- add an invoice with an IBAN that fails checksum   (-)
- add an invoice with a description of 5000+ characters   (-)
- add an invoice with Croatian diacritics (čćšđž) in the description and verify display + PDF render   ( )

**Multi-VAT (Croatian requirement: up to 4 rates on one invoice)**

- add an invoice with 1 VAT rate, verify total = base + VAT   (+)
- add an invoice with 2 different VAT rates, verify per-rate breakdown and grand total   (+)
- add an invoice with 3 different VAT rates   (+)
- add an invoice with 4 different VAT rates — the full multi-VAT case   (+)
- add an invoice where one VAT slot is 0% and verify it's handled as exempt, not empty   (+)

**Conditional field behaviour**

- change invoice type after selecting a supplier — supplier/project/contract fields must reset   (+)
- select a customer then a project — apartment dropdown should only list that customer's apartments on that project   (+)
- select a supplier then a project — contract dropdown should only list that supplier's contracts on that project   (+)
- select a contract — milestone dropdown should only list that contract's milestones   (+)

**Attachments**

- add an invoice with a valid PDF attached   ( )
- add an invoice with an oversized attachment (>10 MB) — expect rejection   ( )
- add an invoice with an unsupported file type (e.g. `.exe`) — expect rejection   ( )
- add an invoice with no attachment (should be allowed)   ( )

**Cancel / close**

- open Add Invoice, fill fields, press Esc — modal closes, nothing saved   (+)
- open Add Invoice, click backdrop — modal closes, nothing saved   (+)
- open Add Invoice, click the X button — modal closes, nothing saved   (+)

**Permissions**

- log in as Sales, open Cashflow profile — verify Add Invoice is hidden or disabled   (N/A if Sales lacks Cashflow access)   (+)
- log in as Supervision, attempt to reach Cashflow Invoices — expect redirect or hidden nav   (+)

**Activity log**

- after a successful add, open Activity Log and verify a row exists with action `invoice.create`, severity medium, entity link opens the new invoice   (+)

### Edit Invoice

_Precondition: at least one saved invoice, at least one with a recorded payment, at least one "office" invoice._

- open an existing invoice → click Edit — form pre-fills every field with current values   (+)
- change only the description, save — row updates, activity log records `invoice.update` with `changed_fields: ["description"]`   ( )
- change only the VAT breakdown (e.g. shift from 1 rate to 2), save — totals recompute, VAT summary reflects change   (+)
- change the invoice type after save-edit (e.g. from `INCOMING_SUPPLIER` to `OUTGOING_SALES`) — dependent fields (supplier/customer/project) clear and must be refilled   (+)
- edit an invoice that already has a payment — verify amount and invoice number are either locked or produce a visible warning (overpayment risk)   ( )
- edit an office invoice — the form swaps to office-supplier entity; supplier field is hidden   ( )
- change attachment: upload a replacement PDF — old attachment is removed, new one linked   ( )
- change attachment: clear the attachment — invoice saves without a file   ( )
- open edit, make changes, press Esc / Cancel — no update persisted; row unchanged   ( )
- edit while another user has the same invoice open (two sessions) — verify last-write-wins or optimistic-lock message, not silent data loss   ( )

### Delete Invoice

_Precondition: one invoice with no payments; one invoice with ≥1 payment; one approved invoice._

- click Delete on a row → Cancel in the confirm dialog — row remains   ( )
- click Delete → Confirm on an invoice with no payments — row disappears, success toast, activity log `invoice.delete` severity high   ( )
- click Delete → Confirm on an invoice with linked payments — verify current rule (expected: block with a clear error, OR cascade-delete the payments). Document whichever the app does   ( )
- click Delete on an approved invoice — same as above: expect either a block or an extra confirm step   ( )
- delete the last invoice in the filtered list on the last page — pagination snaps back to the previous page (no empty page)   ( )

### Filter / Search / Columns

_Precondition: invoice list with at least 30 rows, mix of types, statuses, companies, dates._

**Filters**

- filter by invoice type (`INCOMING_SUPPLIER`, `OUTGOING_SALES`, etc.) — only matching rows show; total counts update   ( )
- filter by direction (incoming / outgoing) — only matching types show   ( )
- filter by status (`PAID`, `UNPAID`, `PARTIAL`, `OVERDUE` if present) — only matching rows show   ( )
- filter by company — only that company's invoices show   ( )
- filter by category — only that category's invoices show   ( )
- combine type + status + company — rows match **all three** (AND)   ( )
- apply filters → navigate to page 3 of results → change a filter — page resets to 1   ( )
- clear all filters — full list returns   ( )

**Search**

- type 3 characters in the search box — request is debounced (≈300-500 ms); rows filter by invoice number, supplier name, project name, etc.   ( )
- search with Croatian diacritics (`Žgaljić`) — matches rows containing those characters   ( )
- search for a non-existent string — empty state appears with "no results" message   ( )
- clear search — full list returns   ( )

**Sorting**

- click the issue date column — rows sort ascending; click again — descending; click again — resets   ( )
- sort by total amount — numeric sort, not string sort (e.g. `90.00` below `100.00`)   ( )
- apply filter + sort combination — sort is preserved when filter changes   ( )

**Column visibility**

- open column menu — checkboxes for every column   ( )
- hide 3 columns — table re-renders without them   ( )
- close and reopen the menu — visibility choices persist within the session   ( )
- refresh the page — document whether column choices persist or reset (then note the current behaviour)   ( )

**Pagination**

- change page size (if selectable) — rows update, page index resets to 1   ( )
- navigate: next → next → prev → jump-to-last — every page renders without gaps or duplicates   ( )
- the filtered-total and filtered-unpaid totals in the header reflect current filters, not the full dataset   ( )

### Record Payment (from invoice row)

_Covered in depth under [Payments](#payments), but the flow is also reachable per-row from the invoice list. Verify:_

- open invoice row → Record Payment — payment modal opens pre-populated with the invoice and its remaining amount   ( )
- save payment — invoice row's remaining_amount decreases; status transitions to `PARTIAL` or `PAID` as appropriate   ( )

### Retail, Bank, and Land Purchase invoice variants

_These are separate form modals (`RetailInvoiceFormModal`, `BankInvoiceFormModal`, `LandPurchaseFormModal`). Run a shortened golden + 1 missing-field check for each:_

- Retail invoice: golden path + missing project + attach document   ( )
- Bank invoice: golden path + choose "credit" as source + credit allocation picker renders only credits linked to the chosen bank   ( )
- Land purchase invoice: golden path + verify the land plot dropdown lists only plots of the selected project   ( )

### Export / PDF

- click "Preview / Print" on a single invoice — PDF opens in a new tab with company letterhead, correct VAT breakdown (1-4 rows), correct totals   ( )
- export filtered list to Excel (if present) — file downloads, opens, rows match what was visible on screen   ( )
- export with zero rows — either button is disabled or an empty file is produced with only headers (document which)   ( )

---

## Payments

_Path: `/accounting-payments`. Role: Director / Accounting. Profile: Cashflow (unlocked). Needs: at least one unpaid invoice per scenario (bank-account payable, credit payable, kompenzacija-eligible, cash-eligible, cesija-eligible), at least 2 companies with bank accounts._

### Add Payment — bank account source

_The golden path for the most common case._

**Golden path**

- open Add Payment → select an unpaid invoice — amount field auto-fills with the invoice's remaining amount   ( )
- keep source = `bank_account`, pick a bank account from the dropdown, pick payment date = today, method = WIRE, save   ( )
- after save: the invoice's remaining_amount decreases by the entered amount; status becomes `PAID` if zero remains, otherwise `PARTIAL`   ( )
- the bank account's current_balance decreases by the payment amount   ( )
- activity log records `payment.create` severity medium   ( )

**Missing required fields**

- submit with no invoice selected — blocked, required-field indicator   ( )
- submit with no bank account selected — blocked   ( )
- submit with no payment date — blocked   ( )
- submit with amount = 0 — blocked (or document that 0 is accepted and record the bug)   ( )
- submit with no payment method — blocked   ( )

**Invalid values**

- enter a negative amount — rejected   ( )
- enter amount greater than invoice's remaining_amount (overpayment) — document whether the app blocks it, warns, or silently accepts; bank balance and invoice state must stay consistent either way   ( )
- enter a future payment date (e.g. +30 days) — accepted but flagged / or rejected; document the behaviour   ( )
- enter a payment date more than 5 years in the past — document behaviour   ( )

**Filtering behaviour inside the form**

- pick an invoice whose company has **no** bank accounts — bank account dropdown shows an inline error ("No bank accounts") and save is blocked   ( )
- change the selected invoice after selecting a bank account — bank account field resets to empty   ( )
- change the source type from `bank_account` to `credit` — previously selected bank account clears   ( )

### Add Payment — credit source

- select an invoice, set source = `credit`, choose a credit — credit dropdown lists only credits belonging to the invoice's company, excluding those with `disbursed_to_account` set   ( )
- "available" amount shown next to each credit equals `amount − used_amount`   ( )
- save — credit's `used_amount` increases by the payment amount; invoice status updates   ( )
- pick an invoice whose company has no eligible credits — inline error "No credits", save blocked   ( )
- pick a credit with less available than the invoice's remaining — document behaviour (expected: block or warn)   ( )

### Add Payment — kompenzacija (mutual offset)

_Kompenzacija records a mutual debt offset between two parties without moving cash._

- select an invoice, set source = `kompenzacija` — no bank account or credit dropdown renders; only amount/date/method/description remain   ( )
- save — invoice status and remaining update; no bank balance moves; no credit used   ( )
- payment method can be any of WIRE/CASH/CHECK/CARD — document whether kompenzacija enforces a specific method or not   ( )
- open the payment in the detail view — it is clearly marked as `kompenzacija` (badge, icon, or text)   ( )
- activity log records the payment with an indicator that it was a kompenzacija   ( )

### Add Payment — gotovina (cash)

- select an invoice, set source = `gotovina` — no bank/credit fields; payment method should auto-pin to CASH (or remain user-selectable — document which)   ( )
- save — invoice status updates; no bank balance change   ( )
- open the payment in the detail view — clearly marked as cash   ( )

### Add Payment — cesija (3-party debt assignment)

_Cesija: Company A's invoice is paid by Company B's bank account (B is assigned the debt). Third-party payment._

_Precondition: 2 distinct companies, each with at least one bank account; one unpaid invoice against company A._

- select an invoice whose payer is Company A   ( )
- tick the "cesija" checkbox — the cesija hint text appears; the normal bank-account/credit fields are suppressed; cesija-company and cesija-bank-account selectors appear   ( )
- pick cesija company = Company B, then pick one of B's bank accounts — save   ( )
- after save: Company B's bank balance decreases by the amount; Company A's bank balance is unchanged; the invoice's remaining_amount decreases   ( )
- cesija is visible in the payment detail (both companies and both bank accounts named)   ( )

**Missing cesija fields**

- tick cesija, leave cesija company empty, save — blocked   ( )
- tick cesija, pick a cesija company with no bank accounts — inline error, save blocked   ( )
- tick cesija, pick company and account, then untick cesija — cesija fields clear; bank/credit selectors reappear and must be refilled   ( )

### Edit Payment

- open an existing payment → Edit — invoice selector is **disabled** (invoice cannot be changed after creation)   ( )
- change the amount down — invoice's remaining_amount recalculates; bank balance adjusts   ( )
- change the amount up (beyond the invoice's original) — document behaviour (expected: block or warn)   ( )
- change the source type from bank to kompenzacija — previous bank balance restored, no new bank balance moved; invoice unchanged   ( )
- change the payment date — activity log records `payment.update` with `changed_fields: ["payment_date"]`   ( )
- edit cancel (Esc / X / Cancel) — no changes persisted   ( )

### Delete Payment

- delete a payment → Cancel in confirm — nothing happens   ( )
- delete a payment → Confirm — invoice's remaining_amount restores; bank balance restores; activity log `payment.delete` severity high   ( )
- delete a cesija payment — the *cesija company's* bank balance restores (not the invoice company's)   ( )
- delete a kompenzacija payment — invoice state restores; no bank balances move   ( )

### Filter / Search / Export

- filter by date range, company, method — list narrows correctly   ( )
- search by reference number / invoice number — rows filter   ( )
- stat cards (total paid, count, etc.) reflect the current filter, not all data   ( )
- export payments list (if a button exists) — file matches filtered rows   ( )

---

## Approvals

_Path: `/accounting-approvals`. Role: Director / Accounting. Profile: Cashflow. Needs: at least 5 approved invoices from subcontractors and retail sources; mix of PAID and UNPAID._

This view shows invoices already approved but still pending processing. The only actions are **hide** (single) and **bulk hide**.

**Golden path**

- load the page — stat cards show: pending count, total amount, oldest invoice date   ( )
- table lists approved invoices with category badge (retail vs subcontractor), invoice number, supplier, project, phase, dates, amounts, status, and per-row Hide button   ( )

**Search**

- type a term — rows filter client-side on supplier, invoice number, project name   ( )
- no-match term — "no results" empty state appears (distinct from the "no approved invoices at all" empty state)   ( )
- clear search — all rows return, selection state is preserved (document) or cleared   ( )

**Column menu**

- open column menu — 12 column toggles listed; `contract_number` is off by default, all others on   ( )
- hide a column — table re-renders without it   ( )
- click outside the menu — it closes   ( )

**Single hide**

- click Hide on a row → Confirm dialog appears with the invoice number in the message   ( )
- click Cancel — dialog closes, row remains   ( )
- click Confirm — row disappears from the list, toast appears, activity log records the hide action   ( )

**Bulk select + bulk hide**

- tick the header checkbox — all filtered rows are selected; selected count matches filtered count; selected total is the sum of `total_amount`   ( )
- untick a single row — header checkbox becomes partially-selected (or unchecked, document which)   ( )
- with some rows selected, the bulk bar shows: selected count + selected total + Cancel Selection button + Hide Selected button   ( )
- click Cancel Selection — all checkboxes clear   ( )
- click Hide Selected → Confirm dialog with count and total — Cancel leaves rows; Confirm removes them all   ( )
- select → filter by a search term → bulk hide — only the visible (filtered) subset is hidden; selections outside the filter are preserved or discarded (document)   ( )

**Empty states**

- load when there are zero approved invoices — EmptyState: "No pending approvals"   ( )
- load with ≥1 approved invoice, search for gibberish — different EmptyState: "No results for ___"   ( )

**Permissions**

- log in as Sales or Investment role — Approvals is not accessible via menu; direct-URL visit behaviour documented   ( )

---

## Debt Status

_Path: `/debt-status`. Role: Director / Accounting. Profile: Cashflow. Needs: at least 5 suppliers with a mix of paid/unpaid invoices across ≥2 projects._

The page shows aggregated debt per supplier, with a project filter and Excel/PDF export.

**Golden path**

- load the page — totals row shows total unpaid, total paid, total supplier count, and "suppliers with debt" count   ( )
- each row shows a supplier and their aggregated unpaid / paid / total   ( )

**Project filter**

- select a specific project — rows aggregate only that project's invoices   ( )
- select "All projects" — full aggregation returns   ( )
- select a project with zero invoices — empty state / zero totals   ( )

**Sorting**

- click each sortable column header — rows reorder; indicator shows current sort direction   ( )
- click the same header twice — toggles ascending/descending   ( )
- sort by unpaid amount — numeric sort, large values on top when descending   ( )

**Excel export**

- click Export to Excel → file downloads, name includes project or "all"   ( )
- open the file — rows match the currently-filtered, currently-sorted view; totals row present at the bottom   ( )
- export with zero rows — document whether the button is disabled or produces a headers-only file   ( )

**PDF export**

- click Export to PDF → a PDF downloads/opens with the same data plus "suppliers with debt" and total counts in the header   ( )
- large dataset (50+ suppliers) — PDF paginates cleanly, no rows cut off mid-line   ( )
- Croatian characters (diacritics, č/ć/š/đ/ž) render correctly in both Excel and PDF   ( )

**Permissions**

- attempt to access `/debt-status` as Sales or Investment role (even with Cashflow unlocked if possible) — document access outcome   ( )

## Banks

_Path: `/accounting-banks`. Role: Director / Accounting. Profile: Cashflow. Needs: at least 2 companies with bank accounts, at least 2 projects, one contract._

The Banks page groups credit lines under each bank and shows allocations + disbursed amounts.

**Layout / navigation**

- page lists banks with expandable sections per bank, showing credits and allocations below each   ( )
- progress bars reflect `used_amount / amount` for each credit; verify visually against the numbers shown   ( )
- empty state when no banks/credits exist yet   ( )

### Add Credit line

_The Credit form exposes every loan parameter._

**Golden path**

- open Add Credit → fill bank, credit name, company, loan type (default `construction_loan_senior`), amount, interest rate, grace period (months), principal repayment frequency, interest repayment frequency, start date, maturity date, usage expiration, purpose — save   ( )
- schedule preview box updates live as you change amount / interest / frequency — principal-per-payment and interest-per-payment refresh, payment-start date reflects grace period, total payment counts are shown   ( )
- after save, the credit appears under the selected bank with progress bar at 0%   ( )

**Missing required fields** — each must show the matching inline `fieldErrors.*` message and block submit

- submit with no bank — error "bank required"   ( )
- submit with no credit name (blank or whitespace-only) — error "credit name required"   ( )
- submit with no amount — error "amount required"   ( )
- submit with no start date — error "start date required"   ( )
- tick "disbursed to account" without selecting a bank account — error "bank account required"   ( )

**Loan type variants** — each sets different defaults; for each, verify the schedule preview renders without NaN / errors

- construction_loan_senior, term_loan_senior, line_of_credit_senior, line_of_credit_junior, bridge_loan_senior   ( )

**Repayment frequency combinations**

- principal monthly + interest monthly — preview shows both rows with "monthly" frequency and correct payment counts   ( )
- principal quarterly + interest monthly — preview reflects the mismatch   ( )
- principal yearly + interest biyearly — preview totals match maturity span   ( )

**Disbursed to account flow**

- tick "disbursed to account" without selecting a company first — yellow warning "select company first"   ( )
- select a company with no bank accounts, tick disbursed — red error "no bank accounts"   ( )
- select a company with bank accounts, tick disbursed — account dropdown lists them with bank name + balance   ( )
- untick the checkbox after selecting an account — the selected account is cleared   ( )

**Invalid values**

- enter a negative amount — document whether the input's min/behaviour blocks it   ( )
- enter an interest rate over 100 — document behaviour (expected: accepted or capped)   ( )
- grace period of 999 months — verify preview math doesn't crash; payment start date shifts forward accordingly   ( )
- maturity date before start date — verify app flags or silently accepts (bug if silently accepts)   ( )

### Edit Credit

- click Edit on an existing credit — form pre-fills all fields; schedule preview reflects saved values   ( )
- change the amount — preview updates   ( )
- save — row updates, progress bar recalculates if `used_amount` was unchanged   ( )
- cancel — no update persisted   ( )

### Delete Credit

- delete a credit with no allocations → Cancel / Confirm behaviour   ( )
- delete a credit that has allocations and/or has been used in payments — verify the app blocks (or cascades) and no orphan allocations remain   ( )

### Credit allocations

- assign an allocation of a credit to a project/contract — allocation appears under the credit   ( )
- allocate the remaining available amount — progress reflects 100% allocated   ( )
- attempt to allocate more than remaining available — expect a block or warning   ( )
- unallocate — available amount restores   ( )

### Bank Invoice creation (from Banks page)

- open the Bank Invoice form from a bank/credit — form loads with bank-restricted credit and allocation dropdowns   ( )
- fill the invoice with multi-VAT (1-4 rows), save — invoice appears in the standard Invoices list with invoice_type `INCOMING_BANK` or `OUTGOING_BANK`   ( )
- when selecting a credit in the invoice form, the allocation dropdown only lists allocations on **that** credit   ( )

---

## Suppliers

_Path: `/accounting-suppliers`. Role: Director / Accounting. Profile: Cashflow. Needs: at least one project with phases._

### Add Supplier

**Golden path**

- open Add Supplier → fill name + contact, optionally pick a project and phase, save — supplier appears in the list   ( )

**Missing required fields**

- submit with empty name (blank or whitespace-only) — inline "name required" error, submit blocked   ( )
- submit with empty contact — inline "contact required" error   ( )
- pick a project but leave phase empty — inline "phase required" error (phase is required only when a project is chosen)   ( )

**Conditional phase field**

- select a project — phase dropdown appears and lists that project's phases   ( )
- change project — phase resets to empty   ( )
- clear the project selection — phase field disappears   ( )

**Invalid values**

- enter a 500-character name — document whether the app truncates, rejects, or accepts   ( )
- enter Croatian characters in the name (`Žgaljić d.o.o.`) — saves correctly, displays correctly   ( )
- attempt to create a duplicate supplier by name on the same project — document the app's behaviour (unique constraint, warning, or duplicate allowed)   ( )

### Edit Supplier

- open an existing supplier — form pre-fills name and contact; the project/phase link section is hidden for edits   ( )
- change name, save — row updates   ( )
- cancel — no update persisted   ( )

### Link Supplier to Project (separate modal)

- open Link Supplier to Project on an existing supplier — modal lists projects and phases   ( )
- link to a project/phase — supplier now appears in that phase's supplier list   ( )
- link again to the same project/phase — verify duplicate prevention   ( )
- unlink from a project — supplier no longer appears there; global supplier record is unchanged   ( )

### Supplier details modal

- click a supplier row → details modal opens with invoices, projects, aggregated totals   ( )
- close with X / Esc / backdrop   ( )

### Retail supplier variant

_A separate `RetailSupplierModal` exists for retail-specific suppliers._

- open the Retail Supplier modal — form appears with retail-specific fields   ( )
- add a retail supplier, save — appears under retail sections where referenced   ( )

### Delete / Search

- delete a supplier with no invoices — Cancel / Confirm   ( )
- delete a supplier with invoices — expect block or cascade (document)   ( )
- search by name — list narrows; clear search — full list returns   ( )

---

## Office Suppliers

_Path: `/office-suppliers`. Role: Director / Accounting. Profile: Cashflow._

Office suppliers are distinct from project suppliers — used for office-overhead invoices (`INCOMING_OFFICE` / `OUTGOING_OFFICE`).

**Golden path**

- open Add Office Supplier → name is required; contact, email, address, OIB (`tax_id`), VAT ID are optional — save   ( )
- new office supplier appears in the list   ( )

**Missing / invalid fields**

- submit with empty name — HTML5 `required` blocks submit   ( )
- enter an invalid email (`not-an-email`) — HTML5 `type=email` blocks   ( )
- enter an OIB with only 5 digits — document behaviour (office supplier OIB has no visible pattern, so likely accepted; record a bug if OIB must be 11 digits for compliance)   ( )
- enter a VAT ID with unusual prefix (not `HR…`) — document behaviour   ( )

**Edit / Delete**

- edit an existing office supplier — all current fields pre-fill   ( )
- delete with no linked invoices — Cancel / Confirm   ( )
- delete with linked invoices — expect block or cascade   ( )

**Search**

- search by name or contact — list filters; clear returns full list   ( )

---

## Customers (Cashflow)

_Path: `/accounting-customers`. Role: Director / Accounting. Profile: Cashflow._

This view is largely read-only — it aggregates accounting-side customer stats. Customer creation happens through the sales flow; here you only **view** and search.

- load the page — customer list shows contact info, invoice count, total paid, total unpaid   ( )
- search by customer name — list filters   ( )
- click a customer row → details modal shows their invoices (full history) and linked properties (apartments, garages, repozitorij)   ( )
- close the details modal (X / Esc / backdrop)   ( )
- totals at the top of the page reflect **all** customers, not the search-filtered subset — verify this is the intended behaviour and not a bug   ( )

---

## Companies

_Path: `/accounting-companies`. Role: Director / Accounting. Profile: Cashflow. Needs: nothing (Companies is the root of financial entity data)._

Companies are the "my companies" entities that issue / receive invoices. Each has multiple bank accounts.

### Add Company

**Golden path**

- open Add Company → fill name, OIB (11 digits), choose Account Count (1-10); bank account blocks render dynamically — fill each with bank name + current balance; save   ( )
- new company appears in the grid with the sum of initial balances   ( )

**OIB validation**

- enter a 10-digit OIB — HTML5 `pattern="[0-9]{11}"` blocks submit   ( )
- enter a 12-digit OIB — truncated by `maxLength=11` at input time   ( )
- enter letters in OIB — blocked by `pattern`   ( )
- enter a valid 11-digit OIB that is already in use by another company — expect a duplicate error   ( )

**Missing required fields**

- submit with empty name — blocked   ( )
- submit with empty OIB — blocked   ( )
- submit with a bank account block whose bank name is empty — blocked (bank name required)   ( )
- submit with a bank account block whose current balance is empty — blocked   ( )

**Account count dynamic behaviour**

- start with 1 account, change to 5 — 4 additional blank blocks render   ( )
- lower the count from 5 to 2 — extra blocks are removed (data in those blocks is lost — verify the intent with a warning, or document that data is silently discarded)   ( )
- account count of 10 — all 10 blocks render and are scrollable   ( )

**Balance reset date (edit-only)**

- edit an existing company — each bank account block shows a `balance_reset_at` date field   ( )
- change a balance, set a reset date — running balance is recomputed from payments/loans/cesija after that date (verify on the details modal)   ( )
- clear the reset date — running balance includes all history   ( )
- the bank name field is **disabled** when editing — verify you cannot change it   ( )

**Details modal**

- click Details on a company — bank accounts, credits, and last 100 invoices listed   ( )
- close modal (X / Esc / backdrop)   ( )

### Edit / Delete Company

- edit name + OIB — row updates   ( )
- delete a company with no invoices/payments — Cancel / Confirm   ( )
- delete a company that has invoices, credits, or loans linked — expect block with a clear message   ( )

### Search

- search by company name — list filters   ( )
- search by OIB — list filters (if supported); document if not   ( )

---

## Loans

_Path: `/accounting-loans`. Role: Director / Accounting. Profile: Cashflow. Needs: at least 2 companies with bank accounts._

Loans record money transfers between two of **your own** companies.

### Add Loan

**Golden path**

- open Add Loan → pick From company → From account (dropdown filtered to that company's accounts, shows balance) → pick To company → To account (filtered) → loan date (defaults to today) → amount — save   ( )
- From company's bank balance decreases by the amount; To company's bank balance increases by the amount   ( )
- loan appears in the list   ( )

**Missing required fields**

- submit with no From company — inline error   ( )
- submit with no From account — inline error   ( )
- submit with no To company — inline error   ( )
- submit with no To account — inline error   ( )
- submit with no amount (or zero) — inline error (input min is `0.01`)   ( )

**Conditional resets**

- select From company, then From account, then change From company — From account resets   ( )
- same for To company / To account   ( )

**Edge cases**

- pick the same company as both From and To — document whether the app blocks this (self-loan doesn't make sense)   ( )
- pick the same bank account as both From and To (if possible) — document   ( )
- enter an amount greater than From account's current balance — document whether the app warns (overdraft)   ( )
- enter a large amount (1,000,000,000) — formatting and balance arithmetic don't overflow   ( )
- loan date in the future — accepted / rejected — document   ( )

### Delete Loan

- delete a loan → ConfirmDialog "loans.confirm_delete" appears → Cancel/Confirm   ( )
- after confirm-delete: From account balance restores, To account balance restores   ( )
- dialog shows a loading state during delete   ( )

### Search

- search by company name — rows narrow; clear — full list returns   ( )

---

## Cashflow Calendar

_Path: `/accounting-calendar`. Role: Director / Accounting. Profile: Cashflow. Needs: at least one month with invoice issue dates and due dates; at least one monthly budget entry._

A monthly grid view of invoice issue/due events with a 12-month budget per year.

**Month navigation**

- load the page — grid shows current month; today is highlighted   ( )
- click previous month arrow — grid updates; events rerender   ( )
- click next month arrow — grid updates   ( )
- navigate across a year boundary (Jan → Dec previous year, Dec → Jan next year) — data rolls over correctly   ( )
- each day cell shows invoice indicators and a net amount (income − expenses) when non-zero   ( )

**Day click**

- click a day with invoices — daily invoice list modal opens, lists each invoice on that date   ( )
- click a day with no invoices — empty state in the modal or no modal (document which)   ( )
- close the day modal (X / Esc / backdrop)   ( )

**Month stats header**

- month stats show monthly income, expenses, net, and budget utilisation vs. the current month's budget — numbers reconcile with the per-day totals   ( )

**Budget modal**

- open Set Budget → year select (current year ± 2) and 12 month inputs render   ( )
- switch year to previous year — existing budget values for that year load; annual total reflects them   ( )
- switch to a year with no budget — all 12 inputs default to 0; annual total = €0   ( )
- enter budgets for 3 months, leave others at 0, save — annual total reflects entered values only; saved correctly (upsert across 12 rows)   ( )
- enter a negative number — `min="0"` on the input blocks it   ( )
- enter a decimal (€1,234.56) — stored with 2 decimals; display formats in `hr-HR` locale   ( )
- change step: the step attribute is `1000`; verify arrow-key increment adjusts by 1000   ( )

**Budget interaction with calendar**

- set June 2026 budget to €50,000 → go to June 2026 grid → budget-utilisation stat reflects total invoiced vs €50,000   ( )
- if invoices exceed budget → visual cue (colour, badge) indicates overrun   ( )

**Permissions**

- non-Cashflow profile cannot reach `/accounting-calendar` directly; redirects to `/`   ( )
