# Module: Funding

**Path:** `src/components/Funding/`

## Overview

Manages the investment and funding side of the business: bank credit facilities, investor relationships, credit allocations, disbursements, repayments, payment notifications, and TIC (Troškovna Informatička Struktura — structured investment cost breakdown).

---

## Sub-modules

### Investments
**Path:** `Investments/`

Detailed credit management: allocations per project, disbursements, expenses, repayments, and invoice linking per credit line.

#### Services

### creditService.ts
- `fetchCredits()` — fetches all bank credits with bank/project/company info
- `fetchAllocationsForCredit(creditId)` — fetches allocations for a credit, enriched with refinancing company/bank names
- `fetchDisbursedAmounts(creditIds)` — fetches unallocated OUTGOING_BANK disbursed amounts per credit
- `fetchProjects()` — fetches projects (id, name) for the allocation form
- `fetchCompanies()` — fetches companies (id, name) for refinancing selection
- `fetchBanks()` — fetches banks (id, name) for refinancing selection
- `createAllocation(creditId, form)` — creates a new credit allocation (project/opex/refinancing)
- `deleteAllocation(allocationId)` — removes a credit allocation
- `fetchCreditInvoices(creditId, invoiceType, showAllocation)` — fetches a credit's invoices for a given invoice type, optionally including allocation labels
- **Depends on:** supabase client, activityLog

### allocationService.ts
- `fetchAllocationInvoices(allocationId)` — fetches invoices linked to a credit allocation
- **Depends on:** supabase client

#### Hooks

### useCreditManagement.ts
- `useCreditManagement()` — manages credit list, allocation state, expanded credit/allocation sets, and form state
- Validates allocation form before submit (project_id or refinancing_entity_id required)
- **Calls:** creditService.ts
- **Returns:** credits, allocations, disbursedAmounts, expandedCredits, expandedAllocations, loading, projects, companies, banks, showAllocationModal, selectedCredit, allocationForm, setAllocationForm, toggleCredit, toggleAllocation, openAllocationModal, closeAllocationModal, handleCreateAllocation, handleDeleteAllocation, **fieldErrors**

### useLazySection.ts
- `useLazySection<T>(fetchFn)` — generic hook for lazy-loading a section's data on first expand
- **Returns:** expanded, loading, fetched, items, toggle

#### Views

### index.tsx (CreditsManagement)
- Expandable credit cards with allocation modal, disbursement, repayment, and expense sections
- **Uses hooks:** useCreditManagement
- **Uses components:** AllocationRow, CreditDisbursements, CreditRepayments, CreditExpenses, CreditInvoiceSection
- **Uses Ui:** Card, Modal, Button

### AllocationRow.tsx
- Displays allocation details with nested invoice table, lazy-loaded on expand
- **Uses hooks:** useLazySection
- **Uses services:** allocationService
- **Uses Ui:** Table, Button

### CreditDisbursements.tsx
- Invoice section wrapper for OUTGOING_BANK transactions for a credit
- **Uses components:** CreditInvoiceSection

### CreditRepayments.tsx
- Invoice section wrapper for INCOMING_BANK transactions for a credit
- **Uses components:** CreditInvoiceSection

### CreditExpenses.tsx
- Invoice section wrapper for INCOMING_BANK_EXPENSES transactions for a credit
- **Uses components:** CreditInvoiceSection

### CreditInvoiceSection.tsx
- Lazy-loaded table of invoices for a credit filtered by invoice type, with payment info and status badges
- Props: creditId, invoiceType, title, totalLabel, paymentAmountLabel, emptyMessage, accentColor, icon, showAllocation?
- **Uses hooks:** useLazySection
- **Calls:** creditService.fetchCreditInvoices
- **Uses Ui:** Badge, LoadingSpinner

---

### Investors
**Path:** `Investors/`

Bank and investor registry. Manages credit facilities and equity investments per bank/investor, with payment schedule previews.

#### Services

### bankService.ts
- `fetchFundingBanksData()` — fetches banks (with credit aggregates: utilized, outstanding, available, utilization) plus companies
- `createBank(payload)` — inserts a new bank/investor record
- `updateBank(bankId, payload)` — updates a bank/investor record
- `fetchBankCreditIds(bankId)` — returns the ids of the bank's credit facilities (used to size and perform the invoice detach)
- `deleteBank(bankId)` — detaches invoices from all the bank's credit facilities, then deletes the bank/investor record
- **Depends on:** supabase client, activityLog, creditService (`detachInvoicesFromCredits`)

### creditService.ts
- `fetchCompanyBankAccounts(companyId)` — fetches a company's bank accounts for disbursement selection
- `createCredit(newCredit, computed)` — inserts a new bank credit facility (with computed type/seniority/monthly payment)
- `updateCredit(creditId, newCredit, computed)` — updates a credit facility
- `countInvoicesForCredits(creditIds)` — how many invoices still reference these facilities (drives the delete-confirmation warning)
- `detachInvoicesFromCredits(creditIds)` — clears `accounting_invoices.bank_credit_id`, returns the number detached; also imported by `Cashflow/Banks/services/bankService.ts` and by `bankService.deleteBank`
- `deleteCredit(creditId)` — detaches linked invoices, then deletes the credit facility
- **Depends on:** supabase client, activityLog
- _Note: distinct from `Investments/services/creditService.ts`; this one handles facility CRUD for the investor registry._

### equityService.ts
- `createEquityInvestment(equity)` — records an equity investment as an `equity`-type bank credit row
- **Depends on:** supabase client, activityLog, date-fns

#### Hooks

### useBankData.ts
- `useBankData()` — fetches banks (with credits) and companies, and manages bank create/update/delete with pending-delete confirmation state
- **Calls:** bankService.ts
- **Returns:** banks, companies, loading, fetchData, addBank, updateBank, deleteBank, confirmDeleteBank, cancelDeleteBank, pendingDeleteId, pendingDeleteInvoiceCount, deleting

### useBankForm.ts
- `useBankForm()` — manages bank add/edit form state
- **Returns:** showBankForm, setShowBankForm, editingBank, newBank, setNewBank, handleEditBank, resetBankForm

### useCreditForm.ts
- `useCreditForm(onSaved)` — manages credit facility add/edit form state, lazy-loads company bank accounts, computes the annuity payment, and persists create/update/delete with confirmation state
- **Calls:** creditService.ts (Investors)
- **Uses utils:** creditCalculations (calculateAnnuityPayment, parseCreditTypeAndSeniority)
- **Returns:** showCreditForm, setShowCreditForm, editingCredit, newCredit, setNewCredit, companyBankAccounts, loadingAccounts, handleEditCredit, resetCreditForm, addCredit, handleDeleteCredit, confirmDeleteCredit, cancelDeleteCredit, pendingDeleteId, pendingDeleteInvoiceCount, deleting

### useEquityForm.ts
- `useEquityForm(onSaved)` — manages equity investment form state and persists the investment
- **Calls:** equityService.ts
- **Returns:** showEquityForm, setShowEquityForm, newEquity, setNewEquity, addEquity

#### Forms

### InvestorFormModal.tsx
- Add/edit bank or investor record form (presentational; state owned by useBankForm in the parent)
- Props: show, onClose, editingBank, formData, onChange, onSubmit
- **Uses Ui:** Modal, FormField, Input, Button

### CreditFormModal.tsx
- Form for creating/editing a credit facility with bank and company selection, plus a payment schedule preview (presentational; state owned by useCreditForm in the parent)
- Props: show, onClose, editingCredit, banks, companies, companyBankAccounts, loadingAccounts, formData, onChange, onSubmit
- **Uses components:** PaymentSchedulePreview
- **Uses utils:** creditCalculations (calculatePaymentSchedule)
- **Uses Ui:** Modal, FormField, Input, Select, Textarea, Button

### EquityFormModal.tsx
- Form for recording equity investments, with custom payment schedule rows and a read-only cashflow/money-multiple preview
- Props: show, onClose, banks, companies, formData, onChange, onSubmit
- **Uses utils:** creditCalculations (calculateEquityCashflow, calculateMoneyMultiple)
- **Uses Ui:** Modal, FormField, Input, Select, Textarea, Button

#### Modals

### InvestorDetailModal.tsx
- Detail view of a bank/investor showing risk/concentration metrics and their credit facilities list
- Props: bank, allBanks, onClose, onEditCredit, onDeleteCredit
- **Uses components:** CreditFacilityCard
- **Uses utils:** creditCalculations (getCreditRiskLevel)
- **Uses Ui:** Modal, EmptyState

#### Views

### InvestorCard.tsx
- Card for a bank/investor with credit-utilized / outstanding / utilization metrics and select/edit/delete actions
- Props: bank, onSelect, onEdit, onDelete
- **Uses Ui:** Button

### CreditFacilityCard.tsx
- Card for displaying a credit facility with key financial metrics

### PaymentSchedulePreview.tsx
- Preview block for a computed payment schedule (principal + interest, frequencies, start date)
- Props: calculation (PaymentScheduleResult | null), gracePeriodMonths

### index.tsx (InvestorsManagement)
- Bank/investor cards with add investor, credit, and equity buttons; orchestrates all modals
- **Uses hooks:** useBankData, useBankForm, useCreditForm (passed `fetchData`), useEquityForm (passed `fetchData`)
- **Uses components:** InvestorCard
- **Uses modals:** InvestorFormModal, CreditFormModal, InvestorDetailModal, EquityFormModal
- **Uses Ui:** PageHeader, LoadingSpinner, Button, ConfirmDialog

---

### Payments
**Path:** `Payments/`

Wire payment processing and payment notifications for bank credits, investors, and subcontractors.

#### Services

### bankPaymentsService.ts
- `fetchBankPayments()` — fetches accounting payments tied to bank credits, enriched with bank name, credit type, and project name
- **Depends on:** supabase client

### paymentNotificationService.ts
- Creates and manages payment notification records for scheduled credit repayments
- Exports include `fetchPaymentNotifications`, `calculateNotificationStats`, `dismissNotification`, `dismissMilestoneNotification`, `updateOverdueNotifications`, `getNotificationUrgency`
- **Depends on:** supabase client

#### Hooks

### usePaymentsData.ts
- `usePaymentsData()` — fetches bank payments and computes stats (totalPayments, totalAmount, paymentsThisMonth, amountThisMonth, bankPayments)
- **Calls:** bankPaymentsService.ts
- **Returns:** payments, stats, loading, refetch

### usePaymentNotifications.ts
- `usePaymentNotifications()` — manages pending payment notification state and actions
- **Calls:** paymentNotificationService.ts
- **Returns:** loading, stats, filteredNotifications, totalNotifications, selectedFilter, setSelectedFilter, showDismissed, setShowDismissed, expandedNotification, setExpandedNotification, handleDismiss

#### Views

### PaymentNotifications.tsx
- Displays pending payment notification alerts for upcoming credit repayments
- **Uses hooks:** usePaymentNotifications
- **Calls:** paymentNotificationService.getNotificationUrgency
- **Uses Ui:** LoadingSpinner, Badge, Button, EmptyState

#### Modals
Located in `Payments/modals/` (lowercase; renamed from `Payments/Modals/` in the audit refactor).

### NotificationPaymentModal.tsx
- Records a payment against a credit repayment notification
- **Calls:** paymentNotificationService.ts (PaymentNotification type)
- **Uses Ui:** Modal, Button, Select

### BankWirePaymentModal.tsx
- Form for bank wire payment entry
- **Uses Ui:** Modal, Button, Select

### InvestorWirePaymentModal.tsx
- Form for investor wire payment entry
- **Uses Ui:** Modal, Button, Select

### SubcontractorNotificationPaymentModal.tsx
- Records a payment against a subcontractor payment notification
- Validates amount > 0 with inline `fieldErrors` (no toast)
- **Calls:** paymentNotificationService.ts
- **Uses Ui:** Modal, Button, Select

### WirePaymentModal.tsx
- Generic wire payment entry form
- **Uses Ui:** Modal, Button, Select

### index.tsx (FundingPaymentsManagement)
- Payment list with search, status/date filters, CSV export, and stats cards
- **Uses hooks:** usePaymentsData
- **Uses Ui:** PageHeader, StatGrid, StatCard, SearchInput, Select, Button, FormField, Input, Badge, EmptyState, Table

---

### Projects
**Path:** `Projects/`

Investment project registry — links funding sources (banks, investors) to General/Projects.

#### Services

### investmentService.ts
- `fetchInvestmentProjects()` — fetches projects with equity, debt, ROI, risk level, and funding source details
- `fetchFundingUtilization(projectId)` — fetches per-allocation funding utilization (total/spent/available) for a project
- **Depends on:** supabase client, date-fns

#### Modals

### InvestmentProjectModal.tsx
- Detail modal for a project showing financing breakdown, funding progress, and funders list
- **Calls:** investmentService.fetchFundingUtilization
- **Uses Ui:** Modal, Table

#### Views

### index.tsx (InvestmentProjects)
- Project cards with equity/debt/ROI/funding status, progress bars, and detail modal
- **Calls:** investmentService.fetchInvestmentProjects
- **Uses components:** InvestmentProjectModal
- **Uses Ui:** PageHeader, LoadingSpinner, StatGrid, Badge, Button

---

### TIC
**Path:** `TIC/`

Troškovna Informatička Struktura (TIC) — structured cost breakdown per project showing own funds (vlastita sredstva) vs credit funds (kreditna sredstva) in EUR with percentages. Exported for investors.

Two tabs, mirroring the two sheets of the standard client workbook:
- **Investicija** — a flat list of cost categories (`line_items` jsonb)
- **Građenje** — a hierarchical construction breakdown: sections `A)` / `B)` / `C)` each holding roman-numeral items (`construction_sections` jsonb, added by migration `20260907120000`)

Both tabs are fully editable per project — rows and sections can be renamed, added, removed and reordered. The hardcoded defaults in `constants.ts` are only the starting point for a project that has no saved TIC yet. Section subtotals (`Ukupno`) and the grand totals (`UKUPNO:` / `SVEUKUPNO:`) are **always derived from the items, never stored**.

The two tabs are deliberately independent: the Građenje grand total is not written into the Investicija `Građenje` row, even though the two normally match in the source workbook.

#### The TIC is the only source of planned budget

Since migrations `20260909130000` and `20260909140000`, saving a TIC is what sets a project's
plan. Nothing else writes one — the project form, the phase setup modal and the classification
budgets modal all display budget read-only, and a project with no TIC reads **"budget not set"**
rather than showing a zero that looks like a real figure.

Saving `tic_cost_structures` fires `sync_project_from_tic(project_id)`, which derives:

| Target | From |
|---|---|
| `projects.budget` | the Investicija grand total |
| `project_phases` | the phases the TIC itself names |
| `project_phases.budget_allocated` | that phase's share of the plan |
| `phase_classification_budgets` | the (phase × classification) grid |

Three rules the function encodes, each protecting against a way this could destroy data:

- **An all-zero TIC changes nothing.** Every project shows the default template whether or not
  anything was filled in, so saving an untouched one is easy to do by accident; without the
  guard it would zero the budget and take EVM, funding ratios and every dashboard with it.
- **A phase with contracts or work logs is never deleted**, only zeroed, even when the TIC stops
  planning it. Both FKs are `ON DELETE SET NULL`, so deleting one would silently detach real work.
- **Only Investicija rows feed budgets.** Građenje is a breakdown of the single `Građenje` line —
  in both real workbooks its `SVEUKUPNO` equals that line exactly — so counting it too would
  double the largest item in the plan.

`phase_classification_budgets` is replaced wholesale on each sync rather than merged: the TIC is
the only author, so a row it no longer contains no longer exists. There are deliberately **no
client-side write helpers** for that table.

#### Two dimensions on a line item

Each Investicija row carries two optional fields beyond its amounts:

- **`classification_id`** — which cost classification the money belongs to, so the TIC can drive
  `phase_classification_budgets`. Seeded from `ticClassificationMap.ts` for the 16 canonical row
  names and editable per row, so a project that files Konzalting under preparation rather than
  control just changes it there. A row left unmapped shows as *unmapped* and contributes to no
  classification. **The defaults are mirrored in the backfill in migration `20260909130000`;
  change the two together.**
- **`phases`** — `[{ phase_number, vlastita, kreditna }]` when the cost is spread across phases,
  **absent when it is incurred once for the whole project**. That distinction is not cosmetic:
  in `1908_TIC_Osijek.xlsx` "Vrijednost zemljišta" prints its full 4.000.000 against each of
  three phase columns, and summing those would invent 8.000.000 of budget. An unphased line is
  shown as "—" in each phase column and counted once in the project total.

A TIC with no phased line at all is *unphased* and describes one undifferentiated project.

#### Services

### ticService.ts
- `fetchTICProjects()` — fetches projects (id, name) for the TIC project selector
- `fetchTICForProject(projectId)` — fetches the saved TIC cost structure for a project (or null); `construction_sections` defaults to `[]` for records saved before the Građenje tab existed
- `createTIC(payload)` — inserts a new TIC cost structure, returns the new id
- `updateTIC(ticId, payload, projectId)` — updates an existing TIC cost structure
- **Depends on:** supabase client, activityLog

### ticImport.ts
- `parseTICWorkbook(sheets)` — pure parser mapping a workbook's sheets onto the two tabs; returns `{ investment, construction, investorName, documentDate, errors }`
- `parseSheet(sheetName, rows)` — parses one sheet, throwing `missing_header` / `no_rows`
- `parseTICFile(file)` — browser entry point; dynamically imports `@e965/xlsx` and delegates to `parseTICWorkbook`
- Parsing is **layout-driven, not column-index-driven**: the header row is found by looking for `NAMJENA`, and the money columns by looking for `VLASTITA SREDSTVA`. This absorbs the one-column offset between the two sheets. A gap of ≥2 columns between the two headers marks the sheet as hierarchical.
- Blank spacer rows are skipped; `Ukupno` / `SVEUKUPNO:` rows are discarded (recomputed); names are trimmed. Percentage columns are ignored.
- Sheets are matched by name (`INVESTICIJ*` / `GRAĐENJ*`, diacritic-insensitive), falling back to the detected shape, so renamed and single-sheet files still import.
- **Depends on:** `@e965/xlsx` (dynamic import), `src/utils/excelParsers.ts` (`parseNumber`, `parseDate`)

### ticExport.ts
- `exportToExcel(data: TICExportData)` — async; writes a real `.xlsx` with two sheets (`INVESTICIJA`, `GRAĐENJE`) laid out in the source workbook's shape, so an export re-imports cleanly (covered by `ticExport.test.ts`)
- `exportToPDF(data: TICExportData)` — two-page landscape A4 PDF, one page per tab; row height is derived from the row count so a long Građenje breakdown is not clipped
- `buildInvestmentSheet(data)` / `buildConstructionSheet(data)` — pure AOA builders, exported for the round-trip test
- **Depends on:** `@e965/xlsx` (dynamic import), jsPDF, activityLog
- _Note: this previously emitted an HTML table blob named `.xls`, which the docs already described as `.xlsx`; it now genuinely is `.xlsx`._

#### Hooks

### useTIC.ts
- `useTIC()` — loads projects and the selected project's line items **and construction sections**, manages edits/investor/date, computes both tabs' totals, applies Excel imports, and saves (create or update)
- **Calls:** ticService.ts
- **Uses utils:** ticFormatters (calculateTotals, calculateConstructionTotals, toRomanNumeral, toSectionCode)
- **Returns:** projects, lineItems, constructionSections, investorName, documentDate, selectedProjectId, loading, saving, message, totals, grandTotal, constructionTotals, constructionGrandTotal, saveTIC, `applyImport`, and the row/section mutators (`addLineItem`, `updateLineItem`, `removeLineItem`, `moveLineItem`, `addSection`, `updateSection`, `removeSection`, `moveSection`, `addConstructionItem`, `updateConstructionItem`, `removeConstructionItem`, `moveConstructionItem`)
- `applyImport(parsed, fileName)` replaces the on-screen tables only and logs `tic.import_excel`; nothing reaches the database until the user presses Save

#### Constants

### constants.ts
- `defaultLineItems` — the 16 default Investicija rows (moved out of `useTIC.ts`)
- `defaultConstructionSections` — the 3 default Građenje sections (28 items) from the standard workbook

#### Utilities

### ticFormatters.ts
- `formatNumber(num)` — formats a number for TIC display (hr-HR, no decimals)
- `formatPercentage(num)` — formats a percentage for TIC display (hr-HR, 2 decimals)
- `calculateRowPercentages(value, total)` — computes a value's percentage of a total (0 when total is 0)
- `calculateTotals(lineItems)` — sums vlastita and kreditna across line items
- `calculateSectionTotals(section)` — one Građenje section's `Ukupno` row
- `calculateConstructionTotals(sections)` — the `SVEUKUPNO:` row across all sections
- `toRomanNumeral(n)` / `toSectionCode(i)` — next numeral/code when appending an item or section
- Types: `LineItem`, `ConstructionItem`, `ConstructionSection`, `TICTotals`, `LineItemPhaseAmount`
- `LineItem` carries the optional `classification_id` and `phases` described above; an absent or
  empty `phases` means the line is **not** phased, never "phased with nothing in it"

### ticBudget.ts
Pure derivation of everything the budget sync and the TIC screen display. All tested against the
real Savska Opatovina and Osijek figures in `ticBudget.test.ts`.
- `lineItemTotal(item)` / `ticGrandTotal(items)` — vlastita + kreditna, per row and overall
- `totalsByClassification(items)` — `{ byClassification: Map, unmapped, total }`; what the phase
  budgets are populated from
- `isPhased(item)` — whether a line carries per-phase amounts at all
- `phaseTotals(items)` — `{ byPhase: Map, notPhased }`; `notPhased` is the money that belongs to
  the project but to no single phase, and is the only thing explaining why the phase budgets stop
  short of the project total
- `lineItemPhaseTotal(item, n)` / `phaseClassificationTotals(items)` / `budgetMatrix(items, order)`
- `remainingFromTIC(planned, committed)`

### ticClassificationMap.ts
- `defaultClassificationForLine(name, classifications)` — canonical row name → seeded classification
- `applyDefaultClassifications(items, classifications)` — stamps the defaults onto rows that have
  none, which is what stops an Excel import from emptying the mapping
- `CANONICAL_TIC_LINE_NAMES` — the 16 names the defaults cover

#### Modals

### ExcelImportTICModal.tsx
- 3-step wizard (upload + format help → preview → summary) following `Sales/SalesProjects/modals/ExcelImportGaragesModal.tsx`
- The preview names which sheet mapped to which tab, lists skipped sheets with their reason, and warns that the import replaces both tables
- **Uses services:** ticImport
- **Uses Ui:** Modal, Button, Alert

#### Views

### index.tsx (TICManagement)
- Project selector, tab switcher, Save / Import Excel / Export Excel / Export PDF toolbar, and the shared investor/signature/date footer
- **Uses hooks:** useTIC
- **Uses services:** ticExport
- **Uses components:** InvestmentTable, ConstructionTable
- **Uses modals:** ExcelImportTICModal
- **Uses Ui:** LoadingSpinner, Button, FormField, Select, Input, Alert, Card, EmptyState, Tabs

### components/InvestmentTable.tsx, components/ConstructionTable.tsx
- Presentational tables — they take items plus handlers as props and never touch Supabase
- Per-row controls: move up / move down / delete, with an "Add row" (and "Add section") button
- `ConstructionTable` confirms section deletion via `ConfirmDialog` because it removes the section's items too

---

## Notes
- Shared investment TypeScript types live in `src/types/investment.ts`
- `lib/Deleted/` contains old credit components that were refactored into this module — do not restore
- All delete confirmation dialogs use `ConfirmDialog` from `src/components/ui/` via the pending-item hook pattern — never use `window.confirm()` or `confirm()`
- Architecture follows UI Component → Custom Hook → Service Layer → Supabase. The May 2026 audit refactor extracted Supabase query logic out of hooks into dedicated `services/*.ts` files; hooks own state and call the services
- There are two distinct `creditService.ts` files: `Investments/services/creditService.ts` (credit list, allocations, credit invoices) and `Investors/services/creditService.ts` (facility CRUD + company bank accounts)
- The audit refactor also lowercased the `Modals/`→`modals/` and `Services/`→`services/` directories in Payments, Projects, and TIC
- Pure calculation/formatting helpers have colocated unit tests: `Investors/utils/creditCalculations.test.ts`, `TIC/utils/ticFormatters.test.ts`, `TIC/services/ticImport.test.ts` and `TIC/services/ticExport.test.ts` (the last verifies an Excel export re-imports byte-for-byte)
- All service mutations log via `logActivity()` (fire-and-forget)
- **Deleting a credit facility or an investor detaches invoices first.** `accounting_invoices.bank_credit_id` is the only `ON DELETE RESTRICT` reference to `bank_credits`, so a bare delete fails with Postgres `23503` whenever an invoice is attached (and, for investors, aborts the `bank_credits` cascade). `creditService.detachInvoicesFromCredits()` clears the FK — the invoices are kept, only unlinked — and both delete paths call it before deleting. The confirmation dialog reports the count via `countInvoicesForCredits()`, and the hooks fall back to `isForeignKeyViolation()` from `src/lib/dbErrors.ts` for a readable toast if some other constraint blocks the delete
