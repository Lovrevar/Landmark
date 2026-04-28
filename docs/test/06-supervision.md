# Supervision

_Part of the [Cognilion Manual Testing Cheat Sheet](../TESTING.md). See that file for status markers and how to walk this document._

_Preconditions: profile = Supervision (auto-redirects from `/`) or General. Role = Supervision/Director/Accounting. Seed data: at least one project with budget, one subcontractor registry entry, one bank funder linked to a project, one credit allocation, one contract type, one milestone._

## Site Management

_Route: `/site-management`. Master orchestrator: project grid → project detail → phase cards → subcontractor contracts → milestones → payments._

### Projects grid

open the page — ProjectsGrid lists all accessible projects with budget, phases count, subcontractors count, timeline    ( )
open the page with **no** projects — EmptyState shown                                                                ( )
`getAccessibleProjectIds(user)` filters for non-Directors — a restricted user sees only linked projects               ( )
budget allocation progress bar reflects allocated vs total budget                                                    ( )
click a project card → ProjectDetail replaces grid with selected project                                             ( )

### ProjectDetail / credit allocations

credit allocations section shows funder name + allocated amount per allocation                                       ( )
project with **no** allocations — section renders empty                                                              ( )
project summary stats reflect totals correctly (budget / allocated / used / remaining)                               ( )
"Back to projects" button returns to grid                                                                            ( )

### Phase setup (PhaseSetupModal — bulk create)

open PhaseSetupModal on a project **with no phases** — 4 default phases loaded                                       ( )
change num_phases from 4 → 7 — modal renders 7 rows with default names (Zemljište, Priprema i razvoj, …)            ( )
change num_phases from 4 → 1 — rows collapse; only first phase kept                                                  ( )
enter custom phase names (Croatian characters ok)                                                                    ( )
enter budget_allocated values that sum **exactly** to project.budget — "Matched" indicator green                    ( )
enter sum > project.budget — "Over" indicator orange                                                                 ( )
enter sum < project.budget — "Under" indicator blue, mismatch note shown                                             ( )
submit with mismatch — requestConfirm prompt asks to confirm over/under budget                                       ( )
enter start_date > end_date for a phase — save blocked or warning                                                    ( )
submit with all fields valid — phases created, refetched                                                             ( )
cancel — no phases created                                                                                           ( )

### Phase setup — edit mode

open PhaseSetupModal on a project **with existing phases** (editMode=true) — existing phases pre-populated sorted by phase_number ( )
edit a phase's budget_allocated — diff recalculates                                                                  ( )
reduce num_phases below existing — phases with budget_used > 0 are blocked from deletion                             ( )
update — phases persist, ProjectDetail re-renders                                                                    ( )

### EditPhaseModal (single phase edit)

click edit on a single phase — modal opens with phase_name, budget_allocated, dates, status pre-populated             ( )
update phase_name only — saves                                                                                       ( )
change status (e.g. planned → in_progress → completed) — saves and status badge updates                              ( )
attempt to delete a phase with `budget_used > 0` — error/blocked (service `deletePhase` guards)                     ( )
delete a phase with `budget_used = 0` — ConfirmDialog chain succeeds                                                 ( )
cancel — no change                                                                                                   ( )

### Add subcontractor to phase (SubcontractorFormModal)

open the modal from "Add subcontractor" on a phase — header shows phase_name + available_budget                      ( )
select a contract category — save enabled                                                                            ( )
leave contract_category empty — inline `fieldErrors.contract_type_id` appears on submit                              ( )
click the "+" button → ContractTypeFormModal opens; create a new category and it's auto-selected                     ( )

**Create new subcontractor path**:
name + contact required — leave both empty, submit → `fieldErrors.name` + `fieldErrors.contact` inline               ( )
fill name + contact + base_amount + vat_rate (0/5/13/25) + start_date + deadline — VAT/total summary updates         ( )
fill name with Croatian characters                                                                                   ( )
total > phase.available_budget — Add button disabled                                                                 ( )
submit with pendingFiles (PDF < 25 MB) — files uploaded to Supabase storage after subcontractor insert               ( )
upload a non-PDF file — ContractDocumentUpload rejects with error message                                            ( )
upload a PDF > 25 MB — rejected                                                                                      ( )
upload a duplicate file name — rejected                                                                              ( )

**Existing subcontractor path**:
toggle radio to "Select existing" — existing_subcontractor_id Select appears                                         ( )
leave existing unselected, submit → inline `fieldErrors.existing_subcontractor_id` shown                             ( )
pick an existing — name/contact/job_description auto-populate from the selected record                               ( )

**No contract toggle** (hasContract=false):
check "No contract" — ContractFormFields hide, cost/base/vat/total reset to 0                                       ( )
deadline field still present but optional                                                                            ( )
document upload section hidden                                                                                       ( )
save → subcontractor added without contract ("BEZ UGOVORA" badge later in list)                                     ( )

**Funder select** (financing source):
project with no banks funder — Select hidden                                                                         ( )
project with banks — select a bank → financed_by_type/bank_id saved                                                  ( )
select "No financing" — fields cleared                                                                               ( )

cancel — no record inserted; fieldErrors reset on next open                                                          ( )

### Subcontractor details & edit (SubcontractorDetailsModal, EditSubcontractorModal)

click a subcontractor card — SubcontractorDetailsModal opens read-only                                               ( )
details show contract info, milestones, payment history, documents                                                    ( )
click Edit from details → EditSubcontractorModal opens with fields pre-populated                                     ( )
edit cost / deadline / vat_rate — VAT/total recalculated live                                                        ( )
add/replace a document — upload validated (PDF only, 25 MB max)                                                      ( )
delete a document — ConfirmDialog chain                                                                              ( )
cancel edit — unsaved changes discarded                                                                              ( )

### Milestones (MilestoneList + MilestoneFormModal)

open MilestoneFormModal on a contract — milestone_number auto-populates to next available                            ( )
add a milestone with name + percentage + due_date                                                                    ( )
add a milestone with percentage = 0 — save blocked                                                                   ( )
add a milestone with percentage > 100 — blocked                                                                      ( )
sum of milestone percentages exceeds 100% — warning or block                                                         ( )
edit milestone — fields pre-populated, save updates                                                                  ( )
delete milestone — ConfirmDialog chain; paid milestone is blocked                                                    ( )
milestone status transitions: pending → paid (via payment) — auto-updates                                           ( )
MilestoneList shows stats summary (count, paid, pending)                                                             ( )

### Record wire payment (WirePaymentModal — from PaymentHistoryModal)

open WirePaymentModal for a subcontractor — contract/paid/remaining summary renders                                  ( )
pending milestones dropdown lists each with computed amount (`cost × percentage / 100`)                              ( )
select a milestone — amount auto-fills to computed value                                                             ( )
select "Manual payment" — amount returns to 0                                                                        ( )
paid_by_bank defaults to `subcontractor.financed_by_bank_id` when set                                                ( )
change paid_by_bank to another funder — saves with that bank                                                         ( )
amount = 0 — Record button disabled                                                                                  ( )
amount > 0 but total paid > contract.cost — "wouldBeOverBudget" Alert with loss amount                               ( )
payment_date defaults to today                                                                                       ( )
submit with milestone + amount → payment recorded, milestone marked paid                                             ( )
submit manual payment — recorded without milestone link                                                              ( )
project with no funder banks — paid_by select hidden                                                                 ( )
cancel — nothing recorded                                                                                             ( )

### Payment history & edit (PaymentHistoryModal, EditPaymentModal)

open PaymentHistoryModal for a subcontractor — lists all wire payments with totals                                   ( )
click Edit on a payment → EditPaymentModal opens with amount, date, notes, milestone, paid_by_bank                   ( )
change amount — subcontractor budget_realized recalculates                                                           ( )
change milestone link — previous milestone reverts to pending, new one marked paid                                   ( )
delete payment — ConfirmDialog chain; budget_realized decrements                                                     ( )
cancel edit — no change                                                                                              ( )

### InvoicesModal

open InvoicesModal for a subcontractor — invoices filtered by contract_id listed                                     ( )
subcontractor with **no** invoices — empty-state row                                                                 ( )
invoice shows status, amount, date, approval flag                                                                    ( )
click an invoice row → opens linked invoice in Cashflow Invoices (if wired) or read-only view                        ( )

### Contract type creation (ContractTypeFormModal)

open ContractTypeFormModal → enter a new type name → save                                                           ( )
leave name empty — save blocked                                                                                      ( )
duplicate type name — unique-constraint error shown                                                                  ( )
after save, new type auto-selected in the parent SubcontractorFormModal                                              ( )

### Document upload & viewer

drag-and-drop a PDF < 25 MB — accepted                                                                               ( )
drop an image / .docx — rejected with error                                                                          ( )
drop a PDF > 25 MB — rejected                                                                                        ( )
upload multiple PDFs at once — all accepted if valid                                                                 ( )
open a stored document — signed URL opens in a new tab                                                               ( )
delete a document — ConfirmDialog → file removed from Supabase storage + DB row                                      ( )
ContractDocumentViewer with contractId filters to only that contract's documents                                     ( )
readOnly mode hides the delete button                                                                                ( )

### Subcontractor comments

add a comment with type=general — appears in detail modal timeline                                                   ( )
add a comment with type=completed — appears with success icon                                                        ( )
add a comment with type=issue — appears with warning icon                                                            ( )
long comment (>2000 chars) — accepted or limit enforced                                                              ( )
comments are timestamped with author user name                                                                       ( )

### Permissions

non-Director without `canManagePayments` sees payment action buttons hidden                                          ( )
non-Director without project access cannot see the project in ProjectsGrid                                           ( )
Accounting role: may read subcontractors/contracts but cannot edit                                                   ( )

---

## Subcontractors

_Route: `/subcontractors`. Standalone subcontractor registry with aggregated contract/payment summaries._

### List & search

open the page — SubcontractorCard grid shows all subcontractors with aggregated totals                               ( )
each card shows name/contact, total/active/completed contracts, total value, paid, remaining, progress bar           ( )
page with **no** subcontractors — EmptyState shown                                                                   ( )
search by name — matching cards filtered                                                                             ( )
search by contact — matches                                                                                          ( )
search term matches nothing — EmptyState                                                                             ( )
clear search — full list returns                                                                                     ( )

### Add / edit subcontractor (SubcontractorBasicFormModal)

add with name + contact + notes — saves                                                                              ( )
add with only required fields (name + contact) — saves with null notes                                               ( )
add with name empty — inline `fieldErrors.name` ("name_required")                                                    ( )
add with contact empty — inline `fieldErrors.contact` ("contact_required")                                           ( )
add with whitespace-only name — blocked (`.trim()`)                                                                  ( )
add with Croatian characters                                                                                         ( )
add with a duplicate name — DB accepts or unique constraint rejects (verify)                                         ( )
edit — fields pre-populated; update saves, toast success                                                             ( )
edit with name cleared — inline error                                                                                ( )
save fails (network drop) — error toast shown                                                                        ( )
cancel — no change                                                                                                   ( )

### Delete subcontractor

delete a subcontractor with **no** contracts — ConfirmDialog → delete                                                ( )
delete with active contracts — blocked or cascade (verify)                                                           ( )
cancel delete — nothing happens                                                                                      ( )

### Detail modal

click a subcontractor card → detail modal opens with contracts list + documents section                              ( )
SubcontractorContractsList shows project, phase, job_description, cost/paid/remaining, deadline, progress badge      ( )
"BEZ UGOVORA" badge shown for contracts without a file                                                               ( )
overdue contracts flagged with warning color                                                                         ( )
click "View documents" → ContractDocumentViewer filters to that contract                                             ( )
SubcontractorDocumentsSection allows upload + delete of general (non-contract) docs                                  ( )

---

## Work Logs

_Route: `/work-logs`. Daily/weekly on-site log entries with cascading project → phase → contract selects._

### List

open the page — work logs render as cards with color-coded left border, status badge, subcontractor, project/phase, date ( )
page with **no** logs — EmptyState shown                                                                             ( )
logs are sorted by date desc                                                                                          ( )
each log shows work_description, optional blocker_details (red block), optional notes                                 ( )

### New log (cascading selects)

click "New log" → modal opens                                                                                        ( )
select project — phases dropdown populates                                                                           ( )
select phase — contracts dropdown populates                                                                          ( )
select phase with **no** contracts — "No contracts" option + amber hint                                              ( )
phase dropdown disabled until project selected                                                                       ( )
contract dropdown disabled until phase selected                                                                      ( )
change project → phase and contract reset                                                                            ( )
change phase → contract resets                                                                                       ( )

### Validation

submit with project empty → `fieldErrors.project_id`                                                                 ( )
submit with phase empty → `fieldErrors.phase_id`                                                                     ( )
submit with contract empty → `fieldErrors.contract_id`                                                               ( )
submit with date empty → `fieldErrors.date`                                                                          ( )
submit with work_description empty or whitespace → `fieldErrors.work_description`                                    ( )
submit with all fields filled → log created, appears at top of history                                               ( )

### Status-specific fields

select status=blocker → `blocker_details` textarea appears                                                           ( )
select status=quality_issue → "issue_details" textarea appears                                                        ( )
select status=work_finished / in_progress / waiting_materials / weather_delay — no extra field                       ( )
save with blocker but no blocker_details — accepted (optional)                                                       ( )

### Color picker

8 colors selectable — selected color scales and border highlights                                                    ( )
card left border renders in the chosen color                                                                         ( )
save → color persists                                                                                                ( )

### Edit / delete

click edit on a log card → modal opens in edit mode with all fields pre-populated                                    ( )
change status / description / notes → save updates                                                                   ( )
change project after edit → phases/contracts cascade reset                                                           ( )
click delete → ConfirmDialog → confirm removes log                                                                   ( )
cancel delete dialog — log remains                                                                                   ( )

---

## Invoices (Supervision)

_Route: `/invoices`. Subcontractor invoices raised for on-site work with approval toggling and CSV export._

### List & stats

open the page — StatGrid shows total/monthly invoice counts and amounts                                              ( )
invoice table shows subcontractor, project, contract, amount, status, approval, date                                 ( )
page with **no** invoices — EmptyState                                                                               ( )

### Filters

filter by status (paid/unpaid/partial) — table updates                                                               ( )
filter by approval (approved / pending / all) — table updates                                                        ( )
set date range start only — from-date applied                                                                        ( )
set date range end only — to-date applied                                                                            ( )
start > end — empty list                                                                                              ( )
search by subcontractor name — matches                                                                               ( )
search by project / contract / invoice_number — matches                                                              ( )
search term not found — EmptyState                                                                                   ( )
clear filters — full list returns                                                                                    ( )

### Approval toggle

click approval toggle on an unapproved invoice → flips to approved (optimistic UI)                                   ( )
click toggle on approved → flips back                                                                                ( )
toggle fails (simulate network) — reverts, error toast                                                               ( )
non-Director / non-Accounting role — toggle hidden or disabled                                                       ( )

### CSV export

click "Export CSV" → downloads file with visible rows                                                                ( )
export with filters applied — CSV contains only filtered rows                                                        ( )
export with 0 rows — CSV has header only                                                                             ( )
file name includes today's date                                                                                      ( )

---

## Payments (Supervision)

_Route: `/payments`. Payments to subcontractors against their invoices (INCOMING_SUPPLIER), including cesija and paid-by bank tracking._

### List & stats

open the page — StatGrid shows total/monthly payment counts and amounts                                              ( )
payment table shows payment_date, subcontractor, project, contract, amount, paid-by (bank/investor/cesija company)   ( )
page with **no** payments — EmptyState                                                                               ( )

### Filters

filter by status — table updates                                                                                     ( )
filter by date range start/end — as in Invoices                                                                      ( )
search by subcontractor/project/contract/notes — matches                                                             ( )
filters combine (AND) correctly                                                                                      ( )

### Paid-by display

a cesija payment shows the cesija company in the paid-by column                                                      ( )
a bank-funded payment shows the bank name                                                                            ( )
an investor-funded payment shows the investor name                                                                   ( )
a payment with no paid-by shows `-`                                                                                  ( )

### CSV export

click "Export CSV" → downloads file with visible rows                                                                ( )
export with filters applied — CSV contains only filtered rows                                                        ( )
cesija rows include the cesija company column in the CSV                                                             ( )

### Cross-module consistency

a payment created in Supervision appears in Cashflow Payments list (same record, INCOMING_SUPPLIER scope)            ( )
deleting a subcontractor that has payments — cascade behaviour (block or cascade) matches Cashflow expectations      ( )
