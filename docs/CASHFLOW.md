# Module: Cashflow

**Path:** `src/components/Cashflow/`

## Overview

The largest module. Manages the full accounting lifecycle: invoices (multi-VAT), payments (with cesija and kompenzacija), bank accounts and credit lines, suppliers, office suppliers, customers, loans, approvals, and debt reporting. All financial flows pass through this module.

## Money formatting

Render amounts through the shared helpers in `src/utils/formatters.ts` — `formatEuro` (exact
cents), `formatEuroRounded` (aggregates), `formatEuroCompact` (dashboard tiles) — never through a
hand-rolled `toLocaleString`. Two rules the module used to break:

- **€ goes first** (`€1.234,56`). The trailing-`€` renders in the land-purchase modal and the
  approvals selection counter are gone.
- **Never the browser's locale.** `toLocaleString(undefined, …)` renders `1,234.56` on an en-US
  machine, which a Croatian reader parses as one thousandth of the amount. Where a translated
  string already contains the `€` (e.g. `office_suppliers.invoices_modal.subtitle`), pass
  `formatEuropean` so the symbol isn't doubled.

A sweep of the remaining plain `toLocaleString('hr-HR')` money renders (correct locale, ragged
decimals) is still outstanding — see `docs/UI_AUDIT.md`.

## Load failures must not look like data

On a financial screen, an empty list and a failed query render identically unless the page is
told them apart. Debt Status used to say "no outstanding debt" when its query failed, and
Approvals said "all approved invoices are processed".

**The hook contract.** Every loader hook in this module returns, alongside its data:

| Field | Meaning |
|---|---|
| `error: Error \| null` | the last load failure; `null` once a load succeeds |
| `refetch()` | re-runs the load. An alias where the loader already had a name (`fetchData`, `load`, `fetchAll`) — existing call sites keep using the old name |
| `dismissError()` | clears `error` without reloading, for the dismissible stale-data alert |

Errors are coerced with `toLoadError` (`Cashflow/services/loadError.ts`) rather than
`new Error(String(err))`: Supabase rejects with a plain `{ code, message }` object, which
`String()` turns into `"[object Object]"` — and `toErrorMessage` would then show it. `toLoadError`
keeps the message and the SQLSTATE, so `toErrorMessage` / `isPermissionError` still work.

**The rendering rule** (`ErrorState` and `Alert` both come from `src/components/ui`; `Alert`'s
`onClose` prop is dead — use `onDismiss`):

- loading, nothing loaded yet → spinner, as before
- `error` and nothing loaded → `<ErrorState onRetry={refetch} />` **in place of the list**, with
  the page header, filter bar and search left mounted, **and the stat cards not rendered at all**
  — a €0 tile is a claim about the money, not a description of an empty table
- `error` with data still on screen → keep the data, and put a dismissible
  `<Alert variant="error">` with a retry button above it
- inside a modal or a card → `<ErrorState compact />`, or the modal's existing inline `Alert`
  (the bank-invoice and land-purchase forms use the latter)

**Partial loads.** `usePayments` (five parallel fetches) and `useAccountingCustomers` (one fetch
per customer) use `Promise.allSettled`, so one failure no longer empties the page: what resolved
is shown, and `error` drives the alert. `useAccountingCustomers` also exposes `partial`, and the
Customers page hides its totals whenever `error` is set, because a total summed over a partial
list reads as the whole book.

**Exports are gated on a clean load.** `useDebtStatus` returns `canExport`
(`!debtError && debtData.length > 0`); the Excel and PDF buttons are disabled when it is false and
both handlers return early. An exported "no debt" spreadsheet outlives the screen it came from.

Services in this module **throw**; they never return `[]` on failure. `calendarService`
(`fetchInvoices`, `fetchBudgets`) and `customerService` (`fetchCustomerInvoices`,
`fetchCustomerProperties`) used to swallow, which hid the failure below the hook where no page
could see it.

Still outstanding (deferred with the rest of the batch): the fetches written inline inside
components — `Suppliers/forms/RetailSupplierModal.tsx`,
`Suppliers/forms/LinkSupplierToProjectModal.tsx`, `Banks/forms/BankCreditFormModal.tsx` — and
`invoiceService.fetchData`, which logs but does not throw for the bank-account and credit
sub-queries, so those two dropdowns can still be silently empty.

## Sub-modules

---

### Approvals
**Path:** `Approvals/`

Manages approved invoices that are pending processing. Supports bulk hide/select operations.

#### Services

### approvalsService.ts
- `fetchApprovedInvoices()` — fetches approved invoices from subcontractors and retail tables
- `hideInvoice(invoiceId, userId)` — marks a single invoice as hidden
- `bulkHideInvoices(invoiceIds, userId)` — marks multiple invoices as hidden in one operation
- **Depends on:** supabase client

#### Hooks

### useApprovals.ts
- `useApprovals()` — manages approved invoice list, search filtering, selection state, and hide actions
- **Calls:** approvalsService.ts
- **Returns:** invoices, filteredInvoices, stats, loading, error, refetch, dismissError, searchTerm, selectedIds, toggleSelect, toggleSelectAll, allFilteredSelected, selectedCount, selectedTotal, hideInvoice, bulkHide
- `error` non-null with `invoices` empty means "we don't know", never "everything is processed" —
  the page then renders `ErrorState` instead of the empty state and drops the stat cards

#### Views

### index.tsx (AccountingApprovals)
- Approved invoice table with search, column toggle, and bulk hide
- The status column shows the invoice's **payment** status through the shared
  `getInvoiceStatusVariant` / `getInvoiceStatusLabel` (see `invoiceHelpers.ts`). There is no
  "Approved" badge: every row is approved by construction (`fetchApprovedInvoices` filters
  `approved = true`), so it said the same thing on every row
- **Uses hooks:** useApprovals
- **Uses Ui:** Table, SearchInput, ColumnMenuDropdown, useToast

---

### Banks
**Path:** `Banks/`

Bank account management, credit line tracking, and bank-linked invoice creation.

#### Services

### bankService.ts
- `fetchProjects()` — fetches all projects
- `fetchCompanies()` — fetches all companies (`id, name, oib`)
- `fetchBanksWithCredits()` — fetches banks joined with credit lines; fetches all credits in a single batched `.in('bank_id', ...)` query and buckets them per bank (previously a per-bank N+1 loop)
- `createCredit(newCreditForm)` — inserts a new bank credit record
- `updateCredit(creditId, newCreditForm)` — updates an existing credit
- `deleteCredit(creditId)` — removes a credit record
- `calculateRateAmount(credit)` — computes periodic interest/principal amounts
- `getPaymentFrequency(type)` — returns payment frequency label for a credit type
- `calculatePayments(credit)` — generates payment schedule for a credit
- `fetchCompanyBankAccounts(companyId)` — fetches bank accounts for a company
- **Depends on:** supabase client

### bankeCreditsService.ts
- `fetchBankeCreditsData()` — single entry point that loads everything the Banks overview needs: banks, credits (joined to bank/project/company), per-credit allocations (with refinancing company/bank enrichment), and per-credit disbursed amounts; returns a `BankeCreditsData` struct
- Exports the row types `BankeBank`, `BankeCredit`, `BankeCreditAllocation`, and the `BankeCreditsData` aggregate
- Internal helpers (not exported): `fetchBanks()`, `fetchCredits()`, `fetchDisbursedAmounts(creditIds)`, `fetchAllocationsByCredits(creditIds)`
- **Depends on:** supabase client

### bankInvoiceFormDataService.ts
- `fetchBanksForInvoice()` — fetches banks for the invoice form bank select
- `fetchCreditsForBank(bankId)` — fetches credit lines for a selected bank
- `fetchMyCompaniesForInvoice()` — fetches own companies from `accounting_companies`
- `fetchActiveInvoiceCategories()` — fetches active invoice categories ordered by sort order
- `fetchCreditAllocations(creditId)` — fetches allocations (joined to project) for a credit line
- **Depends on:** supabase client

#### Hooks

### useBanks.ts
- `useBanks()` — manages credit form state and CRUD actions for bank credits
- **Calls:** bankService.ts
- **Returns:** banks, projects, companies, loading, showCreditForm, editingCredit, newCredit, setNewCredit, addCredit, handleEditCredit, handleDeleteCredit, resetCreditForm

### useBankeCredits.ts
- `useBankeCredits()` — fetches bank credits with allocations and disbursed amounts for display
- **Uses services:** bankeCreditsService.ts (`fetchBankeCreditsData`)
- **Returns:** banks, credits, allocations, disbursedAmounts, loading, creditsByBank, refetch

### useBankInvoiceData.ts
- `useBankInvoiceData(bankId, creditId?)` — loads all reference data needed for the bank invoice form; refetches credits when `bankId` changes and allocations when `creditId` changes
- Every list here is a dropdown, so one `error` slot covers them all and `BankInvoiceFormModal`
  renders it as an inline `Alert` above the fields
- `fetchMyCompanies` **rethrows** after recording the error (it used to return `[]`): the modal
  preselects the first company from it, so a silent empty list read as "this company has none".
  The modal's own `initializeCompany` catches it — the `Alert` is the report
- **Uses services:** bankInvoiceFormDataService.ts
- **Returns:** banks, credits, creditAllocations, myCompanies, invoiceCategories, error, dismissError, fetchMyCompanies

#### Forms

### BankCreditFormModal.tsx
- Form for creating and editing bank credit facilities
- ⚠️ **Currently unreachable.** `Banks/index.tsx` renders it but never destructures
  `setShowCreditForm` or `handleEditCredit` from `useBanks`, and those are the only callers of
  `setShowCreditForm(true)` — so `showCreditForm` can never become true and the modal never
  opens. The equivalent live screen is `Funding/Investors` (`CreditFormModal` +
  `PaymentSchedulePreview`). Either wire up an entry point or delete this modal and the
  credit-form half of `useBanks`; do not assume edits here change anything on screen.
- **Uses hooks:** useBanks
- **Uses Ui:** Modal, Button, Select

### BankInvoiceFormModal.tsx
- Form for creating bank invoices (incoming, outgoing, or expense types)
- Multi-VAT support (up to 4 VAT rates)
- **Uses hooks:** useBankInvoiceData
- **Uses Ui:** Modal, Button, Select, useToast

#### Views

### index.tsx (AccountingBanks)
- Displays bank investments, credit lines, and credit allocations with progress indicators
- `bank_credits.maturity_date` is nullable (credits created from Funding may omit it): the credit card shows `—` unless `isValidDate()` passes, and `useBanks.handleEditCredit` loads a null maturity into the form as `''`
- Expandable sections per bank and per credit
- **Uses hooks:** useBanks, useBankeCredits
- **Uses Ui:** Card, Table

---

### Calendar
**Path:** `Calendar/`

Monthly calendar view showing scheduled invoice payments and due dates. Supports monthly budget setting.

#### Services

### calendarService.ts
- `fetchInvoices()` — fetches all invoices for calendar display. **Throws** on failure (it used to
  swallow into `[]`, which drew a month with nothing due)
- `fetchBudgets()` — fetches monthly budget records. Also throws
- `handleSaveBudgets(year, budgetFormData, budgets)` — upserts 12-month budget entries for a year
- **Depends on:** supabase client

#### Hooks

### useCalendar.ts
- `useCalendar()` — manages calendar navigation, date selection, daily invoice display, and budget state
- A failed invoice load clears `invoices` and sets `error`; the page then replaces the whole
  calendar (grid, stat cards and the net figure are all derived from it) with `ErrorState`, and
  shows an `Alert` when only the budgets failed
- **Calls:** calendarService.ts
- **Returns:** currentDate, invoices, loading, error, refetch, selectedDate, selectedInvoices, budgets, showBudgetModal, budgetYear, budgetFormData, getDaysInMonth, getInvoicesForDate, getMonthStats, handlePreviousMonth, handleNextMonth, handleDateClick, handleOpenBudgetModal, getCurrentMonthBudget

#### Forms

### BudgetModal.tsx
- 12-month budget entry form with year selection and annual total calculation
- **Uses hooks:** useCalendar
- **Uses Ui:** Modal, Button

#### Views

### index.tsx (AccountingCalendar)
- Monthly grid calendar with per-day invoice indicators and net amount (income − expenses)
- Daily invoice list modal on date click
- **Uses hooks:** useCalendar
- **Uses Ui:** Modal, Card

---

### Companies
**Path:** `Companies/`

Legal entity management. Tracks company financial summaries, bank accounts, and credit lines.

#### Services

### companyService.ts
- `fetchCompaniesWithStats()` — fetches companies with aggregated financial stats
- `fetchBankAccountsForCompany(companyId)` — fetches bank accounts for a company
- `createCompany(formData)` — inserts a new company record with bank accounts
- `updateCompany(companyId, formData)` — updates company and bank account records
- `deleteCompany(companyId)` — removes a company
- `fetchCompanyDetails(companyId)` — fetches bank accounts, credits, recent invoices, and cesija data
- `recalculateBankAccountBalance(bankAccountId, resetAt)` — recomputes running balance from all payments, loans, and cesija transactions
- **Depends on:** supabase client

#### Hooks

### useCompanies.ts
- `useCompanies()` — manages company list, CRUD actions, details modal, and financial totals
- **Calls:** companyService.ts
- **Returns:** companies, loading, searchTerm, showAddModal, showDetailsModal, selectedCompany, editingCompany, formData, handleOpenAddModal, handleCloseAddModal, handleSubmit, handleDelete, handleViewDetails, handleCloseDetailsModal, handleAccountCountChange, handleBankAccountChange, handleFormDataChange, filteredCompanies, totalBalance, totalRevenue, totalProfit

#### Forms

### CompanyFormModal.tsx
- Add/edit company with multiple bank accounts (dynamic count)
- Balance reset date field for editing
- **Uses hooks:** useCompanies
- **Uses Ui:** Modal, Button

#### Modals

### CompanyDetailsModal.tsx
- Read-only view of company bank accounts, credits, and last 100 invoices
- **Uses Ui:** Modal, Table

#### Views

### index.tsx (AccountingCompanies)
- Company grid with stat cards, search, and edit/delete/details actions
- **Uses hooks:** useCompanies
- **Uses Ui:** Card, SearchInput

---

### Components (shared within Cashflow)
**Path:** `components/`

Shared UI sub-components reused across Cashflow forms and views.

### CesijaPaymentFields.tsx
- Renders conditional cesija (debt assignment) company and bank account selection fields
- Handles source selection (bank_account or credit) and credit allocation display
- **Uses Ui:** Select

### PaymentMethodField.tsx
- Payment method select shared by both payment forms. Offers only `allowedPaymentMethods(source, isCesija)` and renders nothing for kompenzacija (no method). A stored method that is no longer allowed (an older row being edited) stays listed so the select shows what is saved; `validatePaymentForm` then rejects it
- **Uses Ui:** FormField, Select

### ColumnMenuDropdown.tsx
- Dropdown menu for toggling table column visibility
- **Uses Ui:** Button

### InvoiceEntityFields.tsx
- Dynamic supplier/customer selector used in invoice forms
- Adapts fields based on invoice direction (incoming vs outgoing)
- **Uses Ui:** Select

---

### Customers
**Path:** `Customers/`

Accounting-side customer records (distinct from Sales CRM customers). Tracks invoices and properties per customer.

#### Services

### customerService.ts
- `fetchCustomers()` — fetches all accounting customers
- `fetchCustomerInvoices(customerId)` — fetches all invoices for a customer. **Throws**; it used to
  drop its error, which made a failed query read as "this customer has paid nothing"
- `fetchCustomerProperties(customerId)` — fetches linked apartments, garages, and repositories. Also throws
- `buildCustomerStats(customer)` — aggregates all customer data into a stats summary
- **Depends on:** supabase client

#### Hooks

### useAccountingCustomers.ts
- `useAccountingCustomers()` — manages customer list, search, details modal, and aggregated totals
- Per-customer stats are gathered with `Promise.allSettled`, so one customer's failing invoice
  query no longer empties the table and all four stat cards. `partial` is true when some
  customers loaded and others did not
- **Calls:** customerService.ts
- **Returns:** customers, loading, error, partial, refetch, dismissError, searchTerm, showDetailsModal, selectedCustomer, isIncomeInvoice, handleOpenDetails, handleCloseDetails, filteredCustomers, totalStats

#### Views

### index.tsx (AccountingCustomers)
- Customer list with stats, contact info, invoice tracking, and detail modal
- The stat grid is hidden whenever `error` is set — a total over a partial list would read as the
  whole book — and the table area shows `ErrorState` when nothing loaded at all
- **Uses hooks:** useAccountingCustomers
- **Uses Ui:** Card, Table, SearchInput, ErrorState, Alert

---

### DebtStatus
**Path:** `DebtStatus/`

Aggregated supplier debt overview. Shows total unpaid and paid amounts per supplier across projects.

#### Services

### debtService.ts
- `formatEuropeanNumber(num)` — formats a number using Croatian locale (delegates to `formatEuropean` from utils/formatters.ts)
- `fetchProjects()` — fetches site and retail projects for project filter
- `fetchDebtData(projectId?)` — aggregates debt from invoices grouped by supplier name
- **Depends on:** supabase client, utils/formatters.ts

### debtExport.ts
- `exportToExcel(data, totalUnpaid, totalPaid, projectName)` — exports debt table to .xlsx
- `exportToPDF(data, totalUnpaid, totalPaid, totalSuppliers, suppliersWithDebt, projectName)` — exports debt report to PDF
- **Depends on:** xlsx, jsPDF

#### Hooks

### useDebtStatus.ts
- `useDebtStatus()` — manages debt data, project filter, column sorting, and aggregated totals
- **Calls:** debtService.ts
- **Returns:** debtData, loading, error, refetch, dismissError, canExport, sortBy, sortOrder, sortedData, totalUnpaid, totalPaid, totalSuppliers, suppliersWithDebt, projects, selectedProjectId, setSelectedProjectId, handleSort
- Debt and project errors are tracked separately so a debt reload cannot clear a failed project
  list; `error` is whichever is set. A failed debt load also clears `debtData`, so the previous
  project's figures never stand in for the one that failed
- `canExport` is `false` whenever the debt load failed or there is nothing to export

#### Views

### index.tsx (DebtStatus)
- Supplier debt summary table with project filter, sortable columns, and Excel/PDF export
- Export buttons are `disabled={!canExport}` **and** both handlers return early on `!canExport`;
  the stat cards are not rendered when the load failed with nothing loaded, and the table area
  carries `ErrorState` instead of the "no debt" empty state
- **Uses hooks:** useDebtStatus
- **Uses services:** debtExport
- **Uses Ui:** Table, Button, Select, ErrorState, Alert

---

### Invoices
**Path:** `Invoices/`

Core invoicing — the most complex sub-module. Handles standard invoices, retail invoices, bank invoices, and land purchase invoices with multi-VAT support.

#### Services

### invoiceService.ts
- `fetchData(filterType, filterStatus, filterCompany, searchTerm, currentPage, pageSize, sortField?, sortDirection?)` — paginated invoice fetch with filters via the `get_filtered_invoices` RPC. Sorting (`'due_date' | 'invoice_number'`, `'asc' | 'desc'`) is done **server-side** so it spans every page; `p_sort_field`/`p_sort_dir` are only sent when a sort is active, so the unsorted list still works against a database without the sort migration (see Notes)
- `handleSubmit(formData, editingInvoice, isOfficeInvoice)` — creates or updates an invoice
- `handlePaymentSubmit(paymentFormData, invoice)` — records a payment against an invoice. Builds the row with `Payments/services/paymentPayload.ts` `buildPaymentData`, the same builder the Payments page uses
- `handleDelete(invoiceId)` — deletes an invoice
- `fetchCreditAllocations(creditId)` — fetches allocations for a credit line
- `createBankInvoice(invoiceData)` — inserts a bank invoice record
- `fetchMilestones(contractId)` — fetches milestone list for a contract
- **Depends on:** supabase client, invoiceFormDefaults.ts

### invoiceFormDefaults.ts
- `getDefaultInvoiceFormData()` — returns blank invoice form state
- `getDefaultPaymentFormData()` — returns blank payment form state
- **Depends on:** (none, pure data)

### landPurchaseService.ts
- Handles creation and fetching of land purchase invoices
- **Depends on:** supabase client

### landPurchaseFormDataService.ts
- Reference-data loader for the land purchase form; every function branches on `invoiceType` (`'projects' | 'retail'`) and reads the corresponding site or retail tables
- `fetchLandPurchaseCompanies()` — fetches own companies from `accounting_companies`
- `fetchLandPurchaseSuppliers(invoiceType)` — fetches suppliers that have at least one contract (`subcontractors` / `retail_suppliers`)
- `fetchLandPurchaseProjects(invoiceType, supplierId)` — fetches distinct projects the supplier is contracted on
- `fetchLandPurchasePhases(invoiceType, supplierId, projectId)` — fetches distinct phases for the supplier/project
- `fetchLandPurchaseContracts(invoiceType, supplierId, projectId, phaseId)` — fetches contracts with a positive base/contract amount
- Exports row types `Company`, `Supplier`, `Project`, `Phase`, `Contract`, and the `LandPurchaseInvoiceType` union
- **Depends on:** supabase client

### retailInvoiceFormDataService.ts
- `fetchRetailInvoiceInitialData()` — parallel-loads companies, retail projects, active invoice categories, and refunds into a `RetailInvoiceInitialData` struct (categories/refunds fail soft to `[]`)
- `fetchRetailSuppliers()` — fetches retail suppliers
- `fetchRetailCustomers()` — fetches retail customers
- `fetchRetailContracts(projectId, entityType, entityId)` — fetches contracts for the selected project and supplier/customer
- `fetchRetailMilestones(contractId)` — fetches milestones for a retail contract
- **Depends on:** supabase client

#### Hooks

### useInvoices.ts
- `useInvoices()` — manages the full invoice list with pagination, filters, sorting, column visibility, and all modal states
- Sort field/direction are fetch dependencies; changing the sort (like changing a filter) resets to page 1. A request counter drops responses from superseded fetches so a slow earlier response cannot overwrite the current page
- `hasLoaded` flips after the first fetch settles; the view shows the full-page spinner only while `loading && !hasLoaded`
- `setFilterDirection` also resets the category to `ALL` when it does not exist for the new direction (`isInvoiceCategoryValidForDirection`), so the list never requests a type like `OUTGOING_INVESTMENT`
- `handlePaymentSubmit` validates with `validatePaymentForm` (shared with usePayments); failures toast `payments.form.error_save`
- **Calls:** invoiceService.ts, invoiceFormDefaults.ts, invoiceHelpers.ts, Payments/services/paymentValidation.ts
- **Returns:** invoices, companies, companyBankAccounts, companyCredits, creditAllocations, refunds, suppliers, officeSuppliers, customers, banks, projects, contracts, milestones, customerSales, customerApartments, invoiceCategories, loading, hasLoaded, currentPage, totalCount, filteredTotalCount, filteredUnpaidAmount, totalUnpaidAmount, pageSize, searchTerm, debouncedSearchTerm, filterType, filterDirection, filterCategory, filterStatus, filterCompany, sortField, sortDirection, showColumnMenu, showInvoiceModal, isOfficeInvoice, showRetailInvoiceModal, showBankInvoiceModal, showLandPurchaseModal, editingInvoice, viewingInvoice, showPaymentModal, payingInvoice, formData, paymentFormData, visibleColumns, setters, handlers

### useInvoiceColumns.ts
- `useInvoiceColumns()` — manages column visibility state for the invoice table
- **Returns:** visibleColumns, toggleColumn, showColumnMenu, setShowColumnMenu

### useLandPurchaseFormData.ts
- `useLandPurchaseFormData(invoiceType, supplierId, projectId, phaseId, isOpen)` — cascading reference-data loader for the land purchase modal; each select level refetches when its parent selection changes (only while `isOpen`)
- **Uses services:** landPurchaseFormDataService.ts
- **Returns:** companies, suppliers, projects, phases, availableContracts

### useRetailInvoiceData.ts
- `useRetailInvoiceData(formData)` — loads reference data for retail invoice creation; reloads suppliers/customers, contracts, and milestones as the relevant `formData` fields change
- **Uses services:** retailInvoiceFormDataService.ts
- **Returns:** companies, suppliers, customers, projects, contracts, milestones, invoiceCategories, refunds, error, setError

#### Forms

### InvoiceFormModal.tsx
- Form for creating and editing standard invoices (supplier, customer, or office)
- Multi-VAT support (up to 4 VAT rate rows)
- **Uses hooks:** useInvoices
- **Uses components:** InvoiceFormFields, InvoiceVATSummary, InvoiceEntityFields, CesijaPaymentFields
- **Uses Ui:** Modal, Button, Select

### InvoiceFormFields.tsx
- Reusable field set for invoice base data (dates, number, amounts, category)
- **Uses Ui:** Select, Textarea

### InvoiceVATSummary.tsx
- Displays computed VAT breakdown (base amounts × VAT rates) for up to 4 rows
- **Uses Ui:** (plain JSX)

### RetailInvoiceFormModal.tsx
- Form for creating retail project invoices
- **Uses hooks:** useRetailInvoiceData
- **Uses components:** RetailInvoiceFormFields, RetailInvoiceCalculationSummary
- **Uses Ui:** Modal, Button, Select

### RetailInvoiceFormFields.tsx
- Field set specific to retail invoice creation (project, supplier, parcel)
- **Uses Ui:** Select

### RetailInvoiceCalculationSummary.tsx
- Displays calculated totals for a retail invoice
- **Uses Ui:** (plain JSX)

### LandPurchaseFormModal.tsx
- Form for creating land purchase invoices
- **Uses hooks:** useLandPurchaseFormData
- **Uses Ui:** Modal, Button, Select, useToast

#### Views

### InvoiceTable.tsx
- Paginated, sortable invoice table with column toggle support. Clicking the Broj / Dospijeće headers only sets the sort state; rows arrive already ordered from the server — there is no client-side re-sort
- In `index.tsx` the table and pagination sit in a wrapper that is dimmed (`opacity-60 pointer-events-none`, `aria-busy`) during refetches, so the filter bar and search box stay mounted and keep focus
- **Uses hooks:** useInvoices
- **Uses Ui:** Table

### InvoiceDetailView.tsx
- Full detail modal for a single invoice including payment history
- **Uses Ui:** Modal

### services/invoiceValidation.ts
Pure validation helpers, kept out of `invoiceService.ts` so they can be reasoned about (and
tested) without Supabase.
- `validateInvoice(...)` — field-level validation; the VAT-base rule rejects an invoice whose summed VAT bases are zero
- `getCounterpartyColumn(...)` → `InvoiceCounterpartyColumn` — resolves which counterparty column (supplier / customer / company) applies for a given invoice type and direction
- `checkDuplicateInvoiceNumber({...})` — pre-flight duplicate check
- `isInvoiceNumberDuplicateError(error)` — recognises the unique-constraint violation when the pre-flight check races

### InvoiceStats.tsx
- Summary stat cards (total invoices, unpaid amount, etc.)
- **Uses Ui:** StatGrid

### InvoiceFilters.tsx
- Filter controls: search, category, status, company, incoming/outgoing toggle
- Category options come from `INVOICE_CATEGORIES_BY_DIRECTION[filterDirection]`, so only real types for the chosen direction are offered. "Clear" also resets the direction to incoming
- **Uses Ui:** SearchInput, Select, Button

### InvoicePagination.tsx
- Page navigation controls for the invoice table
- **Uses Ui:** Button

### InvoicePreview.tsx
- Preview panel shown before invoice submission
- **Uses Ui:** (plain JSX)

### InvoiceActionButtons.tsx
- Buttons for launching invoice creation modals (standard, retail, bank, land purchase)
- **Uses Ui:** Button

### index.tsx (AccountingInvoices)
- Top-level invoice view: table, filters, stats, and all modal orchestration
- **Uses hooks:** useInvoices, useInvoiceColumns
- **Uses components:** InvoiceTable, InvoiceFilters, InvoiceStats, InvoiceActionButtons, InvoicePagination, InvoiceDetailView, all form modals
- **Uses Ui:** Card

---

### Loans
**Path:** `Loans/`

Inter-company loan and transfer tracking.

#### Services

### loanService.ts
- `fetchLoans()` — fetches all company loan/transfer records
- `fetchCompanies()` — fetches companies for form selects
- `fetchBankAccounts()` — fetches bank accounts for source/destination selection
- `createLoan(loanData)` — inserts a new loan record
- `deleteLoan(loanId)` — removes a loan record
- **Depends on:** supabase client

#### Hooks

### useLoans.ts
- `useLoans()` — manages loan list, company/account selects, and add/delete actions
- **Calls:** loanService.ts
- **Returns:** loans, companies, bankAccounts, loading, searchTerm, showAddModal, formData, setFormData, handleAddLoan, handleDeleteLoan, resetForm, getFromCompanyAccounts, getToCompanyAccounts, filteredLoans

#### Views

### index.tsx (AccountingLoans)
- Loan/transfer table with search, add, and delete
- **Uses hooks:** useLoans
- **Uses Ui:** Table, SearchInput, Button, Modal

---

### OfficeSuppliers
**Path:** `OfficeSuppliers/`

Suppliers for operational/office expenses, separate from project-linked suppliers.

**Net vs gross.** `OfficeSupplierWithStats` carries both bases and they must not be mixed:
`total_amount` is Σ`base_amount` (NET, "Osnovica"), while `gross_amount`, `paid_amount` and
`remaining_amount` are all GROSS (s PDV). Only the gross three reconcile —
`gross_amount − paid_amount = remaining_amount`. The card and the summary tiles show the gross
figures with unqualified labels (matching `Suppliers`, which is also gross); the net figure is a
secondary "Osnovica" line. Do not put "(bez PDV)" back on a label unless the number under it is
`total_amount`.

#### Services

### officeSupplierService.ts
- `fetchSuppliersWithStats()` — fetches office suppliers and aggregates per-supplier invoice stats via a single batched `.in('office_supplier_id', ...)` query (previously a per-supplier N+1 loop); returns net (`total_amount`) and gross (`gross_amount`) side by side
- `createSupplier(formData)` — inserts an office supplier (logs `office_supplier.create`)
- `updateSupplier(id, formData)` — updates an office supplier
- `deleteSupplier(id)` — removes an office supplier (logs `office_supplier.delete`)
- `fetchSupplierInvoices(supplierId)` — fetches all invoices for a supplier
- **Depends on:** supabase client, activityLog.ts

#### Hooks

### useOfficeSuppliers.ts
- `useOfficeSuppliers()` — manages supplier list, search, invoice modal, and CRUD actions
- **Calls:** officeSupplierService.ts
- **Returns:** suppliers, loading, searchTerm, showModal, editingSupplier, showInvoicesModal, selectedSupplier, supplierInvoices, loadingInvoices, formData, filteredSuppliers, handlers

#### Forms

### OfficeSupplierFormModal.tsx
- Add/edit office supplier form
- **Uses hooks:** useOfficeSuppliers
- **Uses Ui:** Modal, Button

#### Views

### index.tsx (OfficeSuppliers)
- Supplier cards with contact info, invoice history modal, and CRUD actions
- **Uses hooks:** useOfficeSuppliers
- **Uses Ui:** Card, Table, SearchInput

---

### Payments
**Path:** `Payments/`

Payment records linked to invoices. Supports wire, cash, check, card, kompenzacija, and cesija payment flows.

#### Services

### paymentService.ts
- `fetchData()` — fetches payments with joined invoice and company data
- `fetchPayments()` — fetches raw payment records
- `fetchInvoices()` — fetches invoices for payment form selects
- `createPayment(paymentData)` — inserts a new payment
- `updatePayment(paymentId, paymentData)` — updates an existing payment
- `deletePayment(paymentId)` — removes a payment
- **Depends on:** supabase client

#### Hooks

### usePayments.ts
- `usePayments()` — manages payment list, filters (method, invoice type, date range), column visibility, and modal states
- `handleSubmit` validates with `validatePaymentForm`, passing the edited payment's old amount as `originalAmount` (the invoice's `remaining_amount` already excludes it, so editing a payment on a fully paid invoice used to fail); failures toast `payments.form.error_save`
- Create, update and delete each toast on success (`payments.toast.*`). Before this the only
  signal was the whole page flashing a spinner, so a save and a no-op looked the same
- `fetchData` uses `Promise.allSettled` across its five fetches: whatever resolved is shown and
  `error` carries the first rejection, so a failing credit list no longer blanks the payments table
- **Calls:** paymentService.ts, paymentValidation.ts
- **Returns:** payments, invoices, companies, companyBankAccounts, companyCredits, loading, error, refetch, dismissError, searchTerm, filterMethod, filterInvoiceType, dateFrom, dateTo, showColumnMenu, showPaymentModal, editingPayment, viewingPayment, formData, visibleColumns, handlers

#### Forms

### AccountingPaymentFormModal.tsx
- Payments page form (create/edit, invoice picked in the form) supporting all source types: bank_account, credit, kompenzacija, gotovina
- Cesija (debt assignment) fields via CesijaPaymentFields
- Once an invoice is picked: total/paid/remaining summary, max-amount helper and partial-payment alert. When editing, the payable amount is `remaining_amount` + the payment's old amount
- Amount is a `CurrencyInput` (accepts `1.234,56`); balances use `formatCurrency`; invoice type labels come from `getInvoiceTypeLabelKey` (all nine types)
- **Uses components:** CesijaPaymentFields, PaymentMethodField, PaymentInvoiceSummary
- **Uses Ui:** Modal, Button, Select, Input, Textarea, FormField, Form

### PaymentFormModal.tsx
- Invoices page form ("pay this invoice"), create only
- Kept separate from AccountingPaymentFormModal on purpose (the ERP plan's phase 5 may remove in-app authoring), but aligned with it: same validator, payload builder, method rules, summary and partial alert
- Ticking cesija resets the source to `bank_account` and clears own/cesija credit fields, as AccountingPaymentFormModal does
- **Uses components:** CesijaPaymentFields, PaymentMethodField, PaymentInvoiceSummary
- **Uses Ui:** Modal, Button, Select, Input, Textarea, FormField, Form

Both forms route source and cesija changes through a `changeForm` wrapper that snaps the method with `snapPaymentMethod`, so a source change can never leave a method it does not allow.

### PaymentInvoiceSummary.tsx
- `PaymentInvoiceSummary` — total / paid / remaining box for the invoice being paid
- `PartialPaymentAlert({ amount, payableAmount })` — "will be paid in full" vs "remaining after payment" info alert
- **Uses Ui:** Alert

#### Views

### PaymentTable.tsx
- Payment list table with column visibility toggle
- **Uses Ui:** Table

### services/paymentPayload.ts
- `buildPaymentData(formData, createdBy)` — turns the payment form state into the row that gets inserted, branching on payment source: bank account, credit, **kompenzacija**, **gotovina**, and **cesija** each null out and populate different columns. Kompenzacija stores `payment_method = 'WIRE'` as a placeholder (the column is `NOT NULL` with a CHECK); the UI shows "—"
- Used by both `paymentService.createPayment/updatePayment` and `invoiceService.handlePaymentSubmit`
- Pure and unit-tested (`paymentPayload.test.ts`, 12 tests) — this is where the Croatian payment-source column rules are pinned down, so change it there rather than inline in a form

### services/paymentValidation.ts
- `validatePaymentForm(formData, { remainingAmount?, originalAmount? })` — returns the i18n key of the first problem or `null`. Checks: amount > 0; amount ≤ `remainingAmount + originalAmount` (in cents; skipped when the invoice is unknown); bank account / credit / credit allocation for the own source; paying company, cesija bank account / credit / allocation for cesija; and the method against `allowedPaymentMethods` (`payments.form.error_method_mismatch`, skipped for kompenzacija)
- Shared by `useInvoices.handlePaymentSubmit` and `usePayments.handleSubmit`; unit-tested in `paymentValidation.test.ts`

### PaymentStatsCards.tsx
- Summary stat cards for payment totals
- **Uses Ui:** StatGrid

### PaymentDetailView.tsx
- Read-only detail modal for a single payment record
- **Uses Ui:** Modal

### index.tsx (AccountingPayments)
- Payment list with filters, stats, column toggle, and detail/edit modal
- **Uses hooks:** usePayments
- **Uses components:** PaymentTable, PaymentStatsCards, PaymentDetailView, AccountingPaymentFormModal
- **Uses Ui:** Card, FilterBar

---

### Šifrarnici
**Path:** `Sifrarnici/`

> ⏸️ **Hidden — the ERP integration is on hold.** Neither this screen nor ErpImport
> below has a route or a menu entry while `ERP_INTEGRATION_ENABLED` in
> `src/lib/featureFlags.ts` is off, and the views they read are not in any
> database. See [`erp-integration/PROGRESS.md`](./erp-integration/PROGRESS.md) → "On hold".

ERP code mappings. Tells the 4D Wand importer what each ERP code means in
Cognilion terms, so imported invoices classify themselves without a human.
Part of the ERP integration rewrite — see [`erp-integration/SPEC.md`](./erp-integration/SPEC.md) §7.

Reads and writes through the `erp_*` views in `public`; the underlying tables
live in the `erp` schema, which PostgREST does not expose. The three mapping
views are plain (one table, no joins) so Postgres keeps them auto-updatable —
adding a join would silently make the screen read-only.

#### Services

### sifrarniciService.ts
- `fetchAccountRows()` / `fetchCostCenterRows()` / `fetchPartnerRows()` — code list left-joined with its mapping, in memory
- `fetchInvoiceCategories()`, `fetchBanks()`, `fetchProjectTargets()` — mapping targets
- `fetchPartnerTargets(kind)` — entities of one partner kind, fetched on demand rather than loading all seven tables up front
- `saveAccountMapping()` / `saveCostCenterMapping()` / `savePartnerMapping()` — upserts
- `deleteAccountMapping()` / `deleteCostCenterMapping()` / `deletePartnerMapping()`
- **Depends on:** supabase client, activityLog

#### Hooks

### useSifrarnici.ts
- `useSifrarnici()` — tab state, all three code lists with their mappings, search and unmapped filtering, per-tab unmapped counts, and save/clear actions that reload only the affected list
- `save*` / `clear*` and `ensurePartnerTargets` all reject on failure — the view is what reports.
  `error` is an `Error` (was a string) and `reload` is also exposed as `refetch`
- **Calls:** sifrarniciService.ts
- **Returns:** activeTab, loading, error, dismissError, searchTerm, onlyUnmapped, accounts, costCenters, partners, filtered*, unmappedCounts, categories, banks, projects, retailProjects, partnerTargets, ensurePartnerTargets, save*, clear*, reload, refetch

#### Views

### index.tsx (Sifrarnici)
- Three tabs — Konta, Mjesta troška, Komitenti — with inline editing and an "only unmapped" filter
- Account rows pick a `role` (what part the account plays in a posting: gross liability, net expense, VAT, bank …) which then decides what the "maps to" column offers: a category, a VAT rate, or a bank
- Empty until the reference-data feeds land in phase 2, so each tab has a real empty state — which
  is why a failed load may not fall through to it: with all three lists empty the page renders
  `ErrorState` with a retry instead, and shows a dismissible `Alert` when some data did load
- Every mapping save and clear is awaited and reported: `toast.success` on success,
  `toast.error(toErrorMessage(e, …))` on failure (`sifrarnici.toast.*`). Previously these were
  `void s.save*(…)` / `void s.clear*(…)` and a failed save only snapped the select back
- **Uses hooks:** useSifrarnici
- **Uses Ui:** Tabs, Table, Select, SearchInput, ToggleSwitch, EmptyState, ErrorState, Alert, PageHeader, Card, Badge, Button, useToast

---

### ErpImport
**Path:** `ErpImport/`

> ⏸️ **Hidden — the ERP integration is on hold.** See the note under Šifrarnici above.

Uploads 4D Wand feed exports. Part of the ERP integration rewrite — see
[`erp-integration/SPEC.md`](./erp-integration/SPEC.md) §2.1 and
[`erp-integration/AGENT.md`](./erp-integration/AGENT.md).

The browser **uploads the file rather than parsing it**: the `import-erp` edge
function owns the parser, the validation rules and the audit trail, so a manual
upload and an agent push are handled identically. The screen therefore doubles
as the run log for agent-pushed files. Nothing here reaches
`accounting_invoices` — files are parsed, validated and staged; promotion is a
later phase.

#### Services

### erpImportService.ts
- `uploadFeedFile(feed, file)` — POSTs multipart to `/functions/v1/import-erp` with the user's JWT; Content-Type is deliberately unset so the browser adds the multipart boundary
- `fetchImportRuns(limit)` — run history from `public.erp_import_runs`
- `fetchRunProblems(runId)` — per-row validation failures from `public.erp_staging_problems`
- `fetchReviewQueue()` — documents held for classification, from `public.erp_review_queue`
- `reclassifyRun(runId)` — re-runs resolve + promote via the role-gated `public.erp_reclassify` RPC (the `erp.*` functions are service-role only)
- **Depends on:** supabase client, activityLog

#### Hooks

### useErpImport.ts
- `useErpImport()` — selected feed, upload state, last result, run history, and lazily-loaded per-run problem lists
- **Calls:** erpImportService.ts
- **Returns:** runs, loading, uploading, feed, setFeed, lastResult, error, upload, reload, expandedRunId, problems, problemsLoading, toggleProblems

#### Views

### index.tsx (ErpImport)
- Feed picker, file picker, and a result summary listing the first ten rejected rows with their errors
- Run history table with an expandable problem list per run
- Review-queue section listing documents that imported cleanly but could not be classified, with a per-run "re-run classification" action. Promotion is all-or-nothing per document, so one unmapped code holds the whole invoice — the fix is to map it in Šifrarnici and re-run here rather than re-exporting the file
- Reference feeds (accounts, cost centres, partners) must be imported before invoices and payments; the hint text under the picker says which kind is selected
- **Uses hooks:** useErpImport
- **Uses Ui:** PageHeader, Card, Select, Button, Alert, Badge, Table, EmptyState, LoadingSpinner

---

### Services (Cashflow-level helpers)
**Path:** `services/`

Shared utilities used across multiple Cashflow sub-modules.

### invoiceHelpers.ts
- `getStatusColor(status)` — returns CSS class for invoice status badge
- **The shared invoice-status renderer** — use it rather than a local switch (the copies had
  drifted: UNPAID yellow on Approvals and red elsewhere, a lowercase `'paid'` check that never
  matched, the raw enum shown as the label):
  - `getInvoiceStatusVariant(status)` → `Badge` variant: PAID `green`, PARTIALLY_PAID `yellow`,
    UNPAID `red`, anything else `gray`
  - `getInvoiceStatusLabelKey(status)` → `common.paid` / `common.partial` / `common.unpaid`, or
    `null` for an unknown status
  - `getInvoiceStatusLabel(status, t)` → the translated label; an unknown status is shown as-is,
    a missing one as `—`
  - Used by Approvals, Supervision's `InvoicesModal` and `PaymentHistoryModal`, Retail's
    `RetailInvoicesModal` and `RetailPaymentHistoryModal`, and Funding's `CreditInvoiceSection`
    and `AllocationRow`. Other invoice screens (the main invoice list via `getStatusColor`,
    Customers, Suppliers, Office Suppliers, Cashflow Calendar, Retail/Supervision invoice lists)
    still render status their own way
- `paymentDirection(invoiceType)` → `'IN' | 'OUT' | null` — which way cash moves when an invoice
  of that type is paid: `OUTGOING_*` (we issued it — a sale, a credit drawdown) is money **in**,
  `INCOMING_*` (we received it — a supplier bill, a repayment, credit fees) is money **out**. Same
  sign convention as the bank-balance trigger. Used by Funding → Payments. Note that it puts
  `INCOMING_INVESTMENT` on the OUT side, as the trigger does, whereas the accounting dashboard and
  `getTypeColor` treat it as incoming cash
- `getTypeColor(type)` — returns CSS class for invoice type badge
- `getTypeLabel(type)` — returns Croatian label for invoice type
- `INVOICE_CATEGORIES_BY_DIRECTION` — per direction, the categories that exist (`${direction}_${value}` is always one of the nine `accounting_invoices_invoice_type_check` values) with their `invoice_type.*` label key. Unit-tested in `invoiceHelpers.test.ts` against the CHECK list
- `isInvoiceCategoryValidForDirection(direction, category)` / `getInvoiceTypeLabelKey(type)` — lookups on that matrix
- `getSupplierCustomerName(invoice)` — resolves display name from invoice entity fields
- `getCustomerProjects(customerId, projects, customerSales)` — returns projects linked to a customer
- `getCustomerApartmentsByProject(customerId, projectId, customerApartments)` — returns apartments for a customer in a project
- `getSupplierProjects(supplierId, projects, contracts)` — returns projects linked to a supplier
- `getSupplierContractsByProject(supplierId, projectId, contracts)` — returns contracts for a supplier in a project
- `getMilestonesByContract(contractId, milestones)` — returns milestones for a contract
- `isOverdue(dueDate, status)` — returns true if unpaid invoice is past due date. Compares whole local days via `daysFromToday`, so an invoice due today is not yet overdue
- `columnLabels` — Croatian display names for invoice table columns
- **Depends on:** `utils/dateOnly` (pure helpers)

### paymentHelpers.ts
- `allowedPaymentMethods(source, isCesija)` — bank_account → WIRE/CARD/CHECK, credit → WIRE, gotovina → CASH, kompenzacija → none, cesija (any source) → WIRE; unknown source → all four
- `snapPaymentMethod(method, source, isCesija)` — keeps the method if allowed, else the first allowed one (`'WIRE'` placeholder for kompenzacija)
- `getPaymentMethodLabel(method, source?)` — returns Croatian label for payment method; "—" when the source is kompenzacija
- `getPaymentMethodColor(method, source?)` — returns CSS class for payment method badge (neutral for kompenzacija)
- Unit-tested in `paymentHelpers.test.ts`
- `columnLabels` — Croatian display names for payment table columns
- **Depends on:** (none, pure helpers)

---

### Suppliers
**Path:** `Suppliers/`

Project-linked vendor management. Supports linking suppliers to projects/phases, retail supplier creation, and detailed invoice/payment history.

#### Services

### supplierService.ts
- `fetchSuppliers()` — fetches site (`subcontractors`) and retail (`retail_suppliers`) suppliers with aggregated contract/invoice/payment stats; also aggregates each supplier's distinct `project_names` (via joined `projects` / `retail_project_phases → retail_projects`) for the new project filter
- `fetchProjects()` / `fetchPhases(projectId)` — projects/phases for the add-supplier form
- `createSupplier(formData)` — inserts a supplier (and an auto-numbered draft contract when project+phase given); logs `supplier.create`
- `updateSupplier(id, formData)` — updates a supplier; logs `supplier.update`
- `deleteSupplier(supplier)` — removes a site or retail supplier; logs `supplier.delete`
- `fetchSupplierDetails(supplier)` — fetches supplier contracts and invoices with payment rollups
- Link-modal / retail-supplier helpers: `fetchSuppliersForLinking()`, `fetchProjectsForLinking()`, `fetchPhasesForProject(projectId)`, `generateSupplierContractNumber(projectId)`, `createSupplierContract(...)`, `fetchRetailSupplierTypes()`, `fetchRetailProjectsForSupplier()`, `fetchRetailPhasesForProject(projectId)`, `createRetailSupplierWithContract(...)`
- **Depends on:** supabase client, activityLog.ts

#### Hooks

### useSuppliers.ts
- `useSuppliers()` — manages the supplier list, add/edit/details/retail/link modal states, project/phase data for the add form, and pending-delete confirmation. Filtering, sorting, view-mode, and the project filter are handled in the view (via `useListPreferences`), not here — the hook no longer paginates
- **Calls:** supplierService.ts
- **Returns:** suppliers, loading, showAddModal, showDetailsModal, selectedSupplier, editingSupplier, showRetailModal, setShowRetailModal, showLinkModal, formData, setFormData, projects, phases, loadingProjects, fetchData, handleOpenAddModal, handleCloseAddModal, handleSubmit, handleDelete, confirmDelete, cancelDelete, pendingDeleteSupplier, deleting, handleViewDetails, handleCloseDetailsModal, handleOpenLinkModal, handleCloseLinkModal

#### Components

### SupplierCard.tsx
- Card representation of a single supplier for the card view: source badge (`site`/`retail`), contact, contract/invoice counts, contract value, paid/remaining amounts, and a payment-progress bar
- Edit action is shown only for `site` suppliers; delete is always shown
- **Props:** supplier, onSelect, onEdit, onDelete
- **Uses Ui:** Card, Badge

#### Forms

### SupplierFormModal.tsx
- Add/edit supplier form
- **Uses hooks:** useSuppliers
- **Uses Ui:** Modal, Button

### RetailSupplierModal.tsx
- Retail-specific supplier creation form
- **Uses Ui:** Modal, Button

### LinkSupplierToProjectModal.tsx
- Associates an existing supplier with a project and phase
- **Uses hooks:** useSuppliers (for projects/phases)
- **Uses Ui:** Modal, Button, Select, useToast

#### Modals

### SupplierDetailsModal.tsx
- Read-only supplier detail view: contracts, invoices, and payments
- **Uses Ui:** Modal, Table

#### Views

### index.tsx (AccountingSuppliers)
- Supplier list with stats cards, search, source/status filter chips, a project filter, sort dropdown, and a card/table view toggle. Client-side filtering and sorting live here; persisted via `useListPreferences` under `suppliers.prefs`
- **Uses hooks:** useSuppliers, useListPreferences
- **Uses components:** SupplierCard
- **Uses Ui:** Card, Table, SearchInput, StatGrid, StatCard, FilterBar, FilterChip, SortDropdown, ListViewToggle, ConfirmDialog, EmptyState, Badge

---

## Notes
- **Payment edits and cached balances — migration `20260917100000_payment_update_balance_triggers.sql` (written, NOT yet applied; apply manually, dev/e2e project first).** Before it, editing a payment left `company_bank_accounts.current_balance` stale on the account the payment was moved *off* (the trigger recomputed only `NEW.*` accounts), and never touched `credit_allocations.used_amount` at all (its trigger was INSERT/DELETE only). The migration extracts the balance recompute verbatim into `recalc_company_bank_account_balance(uuid)` (EXECUTE revoked from public/anon/authenticated) and recomputes every distinct old and new account; the allocation trigger stays incremental (`used_amount` also carries OUTGOING_BANK invoice totals from `update_credit_allocation_used_amount_from_invoice`) and gains an UPDATE branch (undo OLD, apply NEW) on `UPDATE OF amount, credit_allocation_id, cesija_credit_allocation_id`. It does not repair existing drift — its header has read-only drift-check queries for both tables
- **Invoice list sorting lives in SQL.** Migration `20260915120000_invoice_list_server_sort.sql` replaces the 6-argument `get_filtered_invoices` with an 8-argument version (`p_sort_field text DEFAULT NULL`, `p_sort_dir text DEFAULT 'asc'`). Sort values are whitelisted via `CASE` (unknown values fall back to `issue_date DESC, id`, which also stays as the tie-breaker); `invoice_number` uses the ICU collation `public.natural_numeric` (`und-u-kn-true`) so `INV-2` sorts before `INV-10`; both directions are `NULLS LAST`. **This migration must be applied manually** (dev/e2e project first) — until it is, sorting a column makes the RPC call fail, while the unsorted list keeps working. Security model unchanged: the function is still `SECURITY DEFINER` without a role check (unlike `get_invoice_statistics`)
- `retailInvoiceTypes.ts` inside `Invoices/` defines types that bridge Cashflow and Retail invoice structures — handle carefully when modifying
- Multi-VAT support uses separate `base_amount_1–4`, `vat_rate_1–4`, `vat_amount_1–4` fields for up to 4 VAT rates per invoice (Croatian accounting requirement)
- Cesija is tracked with `is_cesija`, `cesija_company_id`, and `cesija_bank_account_id` fields on invoices and payments
- **Security note.** The Cashflow password modal (`Layout.tsx`) and `CashflowRoute` (`App.tsx`) gate UI navigation only. RLS on cashflow tables enforces role-based access (`Director`, `Accounting`) and does NOT depend on the password flag. A user with one of those roles and a valid Supabase JWT can query cashflow data directly via supabase-js without entering the password. This is a known limitation tracked as **SEC-001** in [`docs/SECURITY_BACKLOG.md`](./SECURITY_BACKLOG.md).
  - As of migration `20260526084700_tighten_cashflow_rls.sql` (2026-05-26), five tables that previously had blanket `USING (true)` policies (`accounting_payments`, `accounting_companies`, `bank_credits`, `company_loans`, `company_bank_accounts`) are now role-gated, with scoped exceptions for the Sales workflow (sales-related invoices/payments) and broad SELECT on `accounting_companies` (names + OIB are treated as reference data). `bank_credits` SELECT additionally allows `Investment`. The companion migration `20260526084701_get_invoice_statistics_role_check.sql` adds a defense-in-depth role check inside the SECURITY DEFINER `get_invoice_statistics` RPC. These close the blanket-open gap but do NOT couple data access to the password flag, so SEC-001 remains open.
- All delete confirmation dialogs use `ConfirmDialog` from `src/components/ui/` via the pending-item hook pattern — never use `window.confirm()` or `confirm()`
