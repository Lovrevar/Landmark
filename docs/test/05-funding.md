# Funding

_Part of the [Cognilion Manual Testing Cheat Sheet](../TESTING.md). See that file for status markers and how to walk this document._

_Preconditions: profile = Funding. Role = Director or Investment for full access; Accounting may read. Seed data: at least one bank, one company with bank account, one project, one milestone with subcontractor assignment._

## Investors

_Route: `/banks` — page title "Investors". Orchestrates three forms (Investor / Credit / Equity) plus InvestorDetailModal._

### Add Investor (InvestorFormModal)

add an investor with all fields (name, contact_person, contact_email, contact_phone) filled  ( )
add an investor with only the required name filled                                          ( )
add an investor with the name empty — submit button guard or save fails                     ( )
add an investor with a malformed email (no @) — browser `type=email` validation rejects     ( )
add an investor with a very long (>200 char) name                                           ( )
add an investor with Croatian characters in the name (č, ć, š, đ, ž)                       ( )
cancel the add form — no row added, form state reset on next open                           ( )

### Edit / Delete Investor

edit an investor — all fields pre-populated, update persists after refresh                  ( )
edit an investor and clear the name — save is blocked                                       ( )
delete an investor that has **no** credits/equities — ConfirmDialog → confirm removes card  ( )
delete an investor that **has** credits — cascade warning or block (depends on DB policy)   ( )
cancel the delete ConfirmDialog — nothing happens                                           ( )

### InvestorCard / InvestorDetailModal

click an investor card — InvestorDetailModal opens showing credits list                     ( )
the credit list in the modal shows status badges and amount columns                         ( )
click a credit in the modal → edit form pre-populates, modal closes                         ( )
delete a credit from the modal — ConfirmDialog chain                                        ( )

### Add Credit facility (CreditFormModal)

add a credit with bank + credit_name + amount + start_date all filled                       ( )
add a credit with the bank unselected — save blocked (required)                             ( )
add a credit with credit_name empty — save blocked                                          ( )
add a credit with amount = 0 — save blocked or zero stored (verify expected behaviour)     ( )
add a credit with amount negative — browser accepts, app should reject                      ( )
add a credit with start_date empty — save blocked                                           ( )
add a credit with maturity_date **before** start_date — payment schedule preview blank/warning ( )
add a credit with grace_period > term length — preview handles gracefully                   ( )
toggle every `credit_type` option (construction_loan_senior, term_loan_senior, loc_senior, loc_junior, bridge_loan_senior) — PaymentSchedulePreview updates ( )
toggle principal_repayment_type × interest_repayment_type (monthly / quarterly / biyearly / yearly) — schedule row count changes accordingly ( )
check "disbursed_to_account" **without** selecting a company — warning "select company first" shown ( )
check "disbursed_to_account", select a company with **no** bank accounts — red "no bank accounts" warning ( )
check "disbursed_to_account", select company + bank account — save succeeds, credit shows directly disbursed ( )
uncheck "disbursed_to_account" after selecting an account — disbursed_to_bank_account_id clears ( )
add a credit with a very long purpose textarea                                              ( )
cancel the credit form — no row added                                                       ( )

### Edit / Delete Credit

edit a credit — all fields pre-populated, update persists                                   ( )
edit a credit that already has disbursements — schedule recalculation warning               ( )
delete a credit with **no** allocations — ConfirmDialog chain succeeds                      ( )
delete a credit with active allocations — block or cascade (verify expected behaviour)     ( )

### Add Equity investment (EquityFormModal)

add equity with bank + amount + investment_date + payment_schedule=yearly — money multiple auto-calculates ( )
add equity with the bank unselected — save blocked                                          ( )
add equity with amount = 0 or negative — save blocked                                       ( )
add equity with investment_date empty — save blocked                                        ( )
switch payment_schedule to `custom` and set num_payments = 3 — 3 date+amount rows appear    ( )
custom schedule: leave one payment date empty — save blocked                                ( )
custom schedule: set a payment amount to 0 — save blocked                                   ( )
custom schedule: change num_payments from 3 → 1 — extra rows drop                           ( )
switch payment_schedule yearly → monthly → custom — cashflow field/value updates, custom_payments resets ( )
add equity with grace_period = 0, then = 12 — cashflow reflects                             ( )
add equity with expected_return = 0, 10, 100, negative — money multiple handles each        ( )
add equity with maturity_date before investment_date — app should reject or warn            ( )
add a large mortgages/notes textarea                                                        ( )
cancel the equity form — no row added                                                       ( )

---

## Investments (Credits Management)

_Route: `/funding-credits` — page title "Credits Management". Expandable credit cards with allocation modal plus disbursement / repayment / expense sections per credit._

### Credit list rendering

open the page with **no** credits — EmptyState "No investments" shown                       ( )
open the page with multiple credits — each credit card renders with its name, bank, company, status badge ( )
EQUITY credits show a purple `EQUITY` badge next to the title                               ( )
status badges map correctly: active=green, pending=yellow, closed=gray, other=blue          ( )

### Expand / collapse credit

click the expand chevron — credit expands showing allocations, disbursements, repayments, expenses ( )
click again — credit collapses                                                              ( )
expand two credits simultaneously — both stay open                                          ( )
credit marked `disbursed_to_account=true` shows directly disbursed, no allocations expected ( )

### Create allocation (allocation modal)

open the allocation modal from a credit's "Add allocation" button                           ( )
the modal header shows credit name and unallocated remaining amount                         ( )
add allocation with allocation_type=project + project selected + amount > 0                 ( )
add allocation with allocation_type=project and **no** project selected — inline `fieldErrors.project_id` appears ( )
add allocation with allocation_type=opex + amount — saves (no project required)             ( )
add allocation with allocation_type=refinancing + entity_type=company + company selected    ( )
add allocation with allocation_type=refinancing and **no** entity selected — inline `fieldErrors.refinancing_entity_id` ( )
switch entity_type company ↔ bank — refinancing_entity_id clears                            ( )
switch allocation_type project → opex → refinancing — project_id and refinancing_entity_id clear ( )
add allocation with amount = 0 — save blocked or rejected                                   ( )
add allocation with amount exceeding unallocated remaining — backend rejects or UI warns    ( )
cancel the modal — form resets                                                              ( )

### Allocation row (expanded credit)

expand an allocation — nested invoice table lazy-loads                                      ( )
expand an allocation with **no** linked invoices — empty-state row shown                    ( )
allocation shows allocated_amount vs used_amount with a progress bar or percentage          ( )
delete an allocation with **no** invoices — ConfirmDialog chain succeeds                    ( )
delete an allocation with invoices — cascade warning or block                               ( )
cancel the allocation delete dialog                                                         ( )

### Disbursement / Repayment / Expense sections

CreditDisbursements expands and lists OUTGOING_BANK invoices for the credit                 ( )
CreditRepayments expands and lists INCOMING_BANK invoices                                   ( )
CreditExpenses expands and lists INCOMING_BANK_EXPENSES invoices                            ( )
each section totals the amounts shown in its header                                         ( )
verify disbursed amount matches the sum of OUTGOING_BANK invoice payments                   ( )

---

## Projects (Funding / InvestmentProjects)

_Route: `/investment-projects` — page title "Investment Projects". Project cards with equity/debt/ROI summaries plus InvestmentProjectModal detail._

### Project list

open the page — project cards show name, total funding, equity/debt split, ROI, progress bar ( )
open the page with **no** funded projects — EmptyState or empty grid                        ( )
projects with 0 funders show a zero bar                                                     ( )
cards render Croatian characters in project names correctly                                 ( )

### Investment Project detail modal

click a project card — InvestmentProjectModal opens                                         ( )
modal shows equity funders, debt (credit) funders, amounts and progress                     ( )
modal shows each funder's contribution % adding up to 100%                                  ( )
close the modal with X, Esc, and backdrop click — all close the modal                       ( )

---

## Payments / Disbursements

_Route: `/funding-payments` — Funding Payments Management. CSV export plus four payment modals (NotificationPayment, SubcontractorNotificationPayment, BankWire, InvestorWire, WirePayment)._

### List, filters, search, export

open the page — StatGrid shows totalPayments, totalAmount, paymentsThisMonth, amountThisMonth ( )
filter by "All / Recent (last 7 days) / Large (>50k)" — table filters accordingly          ( )
set start_date only — table filters from that date                                          ( )
set end_date only — table filters up to that date                                           ( )
set start_date **after** end_date — empty list (no crash)                                   ( )
search by bank_name — matching rows shown                                                   ( )
search by project_name — matches                                                            ( )
search by notes — matches                                                                   ( )
search with a term that matches nothing — EmptyState "No payments"                          ( )
clear the search (X button) — full list returns                                             ( )
click "Export CSV" — browser downloads `funding-payments-<date>.csv` with visible rows only ( )
export with filters applied — CSV contains only the filtered rows                           ( )
export with 0 rows — CSV has header only                                                    ( )
Filtered Results footer shows correct count and total when filters are active               ( )

### PaymentNotifications (upcoming repayments)

page shows pending payment notifications for upcoming credit repayments                     ( )
expand a notification — details (bank, loan type, scheduled amount, due date) render        ( )
dismiss a notification — it disappears; "Show dismissed" toggle brings it back              ( )
filter notifications by credit type                                                         ( )

### Record payment against a credit notification (NotificationPaymentModal)

open the modal from a notification — details banner renders bank, loan type, due date, scheduled amount, payment_number, project ( )
submit with amount filled — payment recorded, notification marked done                      ( )
submit with amount = 0 or empty — submit button disabled                                    ( )
submit with payment_date empty — today's date used or save blocked                          ( )
submit with a date far in the future — accepted, flagged in notes                           ( )
submit with notes containing line breaks / long text                                        ( )
submit an amount > scheduled — warning banner shown ("Payment exceeds scheduled")          ( )
cancel — nothing recorded                                                                   ( )

### Record subcontractor milestone payment (SubcontractorNotificationPaymentModal)

open the modal from a subcontractor notification — contract / already-paid / remaining stats render, milestone info shown ( )
amount auto-populates from notification.amount                                              ( )
paid_by_bank auto-populates from subcontractor financing bank if one exists                 ( )
submit with amount > 0 and paid_by_bank selected — success toast shown, onSuccess fires     ( )
submit with amount = 0 — inline `fieldErrors.amount` appears, submit button disabled        ( )
submit with amount > remaining — backend behaviour (reject / overpayment flag)              ( )
change paid_by_bank to "No payer / none" — saves with null bank                             ( )
change paid_by_bank — amount stays the same                                                 ( )
project with **no** funder banks — Select hidden, payment still saves                       ( )
close the modal with loading in-flight — loading spinner prevents cancel until finished     ( )
errors in recordSubcontractorMilestonePayment show error toast (simulate by network drop)  ( )

### Bank / Investor wire payment (BankWirePaymentModal, InvestorWirePaymentModal, WirePaymentModal)

open BankWirePayment — amount, date, notes form, details banner with recipient info         ( )
submit with valid amount + date — payment saved                                             ( )
submit with amount = 0 or empty — save blocked                                              ( )
submit with date empty — default today used or save blocked                                 ( )
submit with a very large amount (>1,000,000,000) — renders without overflow                 ( )
submit with negative amount — blocked (min="0")                                             ( )
open InvestorWirePayment — same tests apply                                                 ( )
cancel — nothing saved                                                                      ( )

---

## TIC (Troškovna Informatička Struktura)

_Route: `/tic`. Per-project editable cost breakdown with vlastita (own funds) / kreditna (credit funds) in EUR + %, exported to Excel and PDF._

### Project selection

open the page with **no** project selected — EmptyState "No project selected"               ( )
open the dropdown — all investment projects listed                                          ( )
select a project — line items load, totals render                                           ( )
select a project that has **no** saved TIC data — default/empty line items shown           ( )
switch between projects — line items reload per project                                     ( )

### Line items editing

enter a vlastita value — row total + grand total + percentages update live                  ( )
enter a kreditna value — row total + grand total + percentages update live                  ( )
enter both vlastita and kreditna for a row — row total sums both                            ( )
enter a decimal value (e.g. 1234.56) — stored with step="0.01"                              ( )
enter a negative value — allowed by input but should be rejected by save                    ( )
enter a non-numeric string — Input type=number blocks or parseFloat returns 0               ( )
clear a previously-entered value — row reverts to 0                                         ( )
percentages add up to 100% across vlastita+kreditna columns vs grand total                  ( )

### Investor name, date, save

edit investor name — value stays across row edits                                           ( )
edit document date — date picker accepts ISO dates                                          ( )
click Save with unsaved changes — success Alert appears, saving spinner shown during flight ( )
click Save with **no** changes — idempotent save (no error)                                 ( )
save fails (simulate network drop) — error Alert appears                                    ( )
Save button is **disabled** when no project is selected                                     ( )

### Excel / PDF export

click "Export Excel" — .xlsx downloads with all rows + totals + investor name + date        ( )
click "Export PDF" — PDF renders with table, totals row, and grand total                    ( )
export with **no** project selected — buttons disabled                                      ( )
export with all zero values — file still generates with zero totals                         ( )
export with Croatian characters (č, ć, š, đ, ž) — characters preserved in both formats      ( )
PDF filename includes project name                                                          ( )
Excel filename includes project name                                                        ( )
export immediately after editing without saving — exports use the unsaved in-memory values  ( )
