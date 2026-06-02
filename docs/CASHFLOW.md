# Module: Cashflow

**Path:** `src/components/Cashflow/`

## Overview

The largest module. Manages the full accounting lifecycle: invoices (multi-VAT), payments (with cesija and kompenzacija), bank accounts and credit lines, suppliers, office suppliers, customers, loans, approvals, and debt reporting. All financial flows pass through this module.

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
- **Returns:** invoices, filteredInvoices, stats, loading, searchTerm, selectedIds, toggleSelect, toggleSelectAll, allFilteredSelected, selectedCount, selectedTotal, hideInvoice, bulkHide

#### Views

### index.tsx (AccountingApprovals)
- Approved invoice table with search, column toggle, and bulk hide
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
- **Uses services:** bankInvoiceFormDataService.ts
- **Returns:** banks, credits, creditAllocations, myCompanies, invoiceCategories, fetchMyCompanies

#### Forms

### BankCreditFormModal.tsx
- Form for creating and editing bank credit facilities
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
- Expandable sections per bank and per credit
- **Uses hooks:** useBanks, useBankeCredits
- **Uses Ui:** Card, Table

---

### Calendar
**Path:** `Calendar/`

Monthly calendar view showing scheduled invoice payments and due dates. Supports monthly budget setting.

#### Services

### calendarService.ts
- `fetchInvoices()` — fetches all invoices for calendar display
- `fetchBudgets()` — fetches monthly budget records
- `handleSaveBudgets(year, budgetFormData, budgets)` — upserts 12-month budget entries for a year
- **Depends on:** supabase client

#### Hooks

### useCalendar.ts
- `useCalendar()` — manages calendar navigation, date selection, daily invoice display, and budget state
- **Calls:** calendarService.ts
- **Returns:** currentDate, invoices, loading, selectedDate, selectedInvoices, budgets, showBudgetModal, budgetYear, budgetFormData, getDaysInMonth, getInvoicesForDate, getMonthStats, handlePreviousMonth, handleNextMonth, handleDateClick, handleOpenBudgetModal, getCurrentMonthBudget

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
- `fetchCustomerInvoices(customerId)` — fetches all invoices for a customer
- `fetchCustomerProperties(customerId)` — fetches linked apartments, garages, and repositories
- `buildCustomerStats(customer)` — aggregates all customer data into a stats summary
- **Depends on:** supabase client

#### Hooks

### useAccountingCustomers.ts
- `useAccountingCustomers()` — manages customer list, search, details modal, and aggregated totals
- **Calls:** customerService.ts
- **Returns:** customers, loading, searchTerm, showDetailsModal, selectedCustomer, isIncomeInvoice, handleOpenDetails, handleCloseDetails, filteredCustomers, totalStats

#### Views

### index.tsx (AccountingCustomers)
- Customer list with stats, contact info, invoice tracking, and detail modal
- **Uses hooks:** useAccountingCustomers
- **Uses Ui:** Card, Table, SearchInput

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
- **Returns:** debtData, loading, sortBy, sortOrder, sortedData, totalUnpaid, totalPaid, totalSuppliers, suppliersWithDebt, projects, selectedProjectId, setSelectedProjectId, handleSort

#### Views

### index.tsx (DebtStatus)
- Supplier debt summary table with project filter, sortable columns, and Excel/PDF export
- **Uses hooks:** useDebtStatus
- **Uses services:** debtExport
- **Uses Ui:** Table, Button, Select

---

### Invoices
**Path:** `Invoices/`

Core invoicing — the most complex sub-module. Handles standard invoices, retail invoices, bank invoices, and land purchase invoices with multi-VAT support.

#### Services

### invoiceService.ts
- `fetchData(filterType, filterStatus, filterCompany, searchTerm, currentPage, pageSize)` — paginated invoice fetch with filters
- `handleSubmit(formData, editingInvoice, isOfficeInvoice)` — creates or updates an invoice
- `handlePaymentSubmit(paymentFormData, invoice)` — records a payment against an invoice
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
- **Calls:** invoiceService.ts, invoiceFormDefaults.ts
- **Returns:** invoices, companies, companyBankAccounts, companyCredits, creditAllocations, refunds, suppliers, officeSuppliers, customers, banks, projects, contracts, milestones, customerSales, customerApartments, invoiceCategories, loading, currentPage, totalCount, filteredTotalCount, filteredUnpaidAmount, totalUnpaidAmount, pageSize, searchTerm, debouncedSearchTerm, filterType, filterDirection, filterCategory, filterStatus, filterCompany, sortField, sortDirection, showColumnMenu, showInvoiceModal, isOfficeInvoice, showRetailInvoiceModal, showBankInvoiceModal, showLandPurchaseModal, editingInvoice, viewingInvoice, showPaymentModal, payingInvoice, formData, paymentFormData, visibleColumns, setters, handlers

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
- Paginated, sortable invoice table with column toggle support
- **Uses hooks:** useInvoices
- **Uses Ui:** Table

### InvoiceDetailView.tsx
- Full detail modal for a single invoice including payment history
- **Uses Ui:** Modal

### InvoiceStats.tsx
- Summary stat cards (total invoices, unpaid amount, etc.)
- **Uses Ui:** StatGrid

### InvoiceFilters.tsx
- Filter controls: type, direction, category, status, company, search
- **Uses Ui:** FilterBar, SearchInput, Select

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

#### Services

### officeSupplierService.ts
- `fetchSuppliersWithStats()` — fetches office suppliers and aggregates per-supplier invoice stats via a single batched `.in('office_supplier_id', ...)` query (previously a per-supplier N+1 loop)
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
- **Calls:** paymentService.ts
- **Returns:** payments, invoices, companies, companyBankAccounts, companyCredits, loading, searchTerm, filterMethod, filterInvoiceType, dateFrom, dateTo, showColumnMenu, showPaymentModal, editingPayment, viewingPayment, formData, visibleColumns, handlers

#### Forms

### AccountingPaymentFormModal.tsx
- Full payment form supporting all source types: bank_account, credit, kompenzacija, gotovina
- Cesija (debt assignment) fields via CesijaPaymentFields
- **Uses components:** CesijaPaymentFields
- **Uses Ui:** Modal, Button, Select

### PaymentFormModal.tsx
- Simplified payment form for standard invoice payments
- **Uses Ui:** Modal, Button, Select

#### Views

### PaymentTable.tsx
- Payment list table with column visibility toggle
- **Uses Ui:** Table

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

### Services (Cashflow-level helpers)
**Path:** `services/`

Shared utilities used across multiple Cashflow sub-modules.

### invoiceHelpers.ts
- `getStatusColor(status)` — returns CSS class for invoice status badge
- `getTypeColor(type)` — returns CSS class for invoice type badge
- `getTypeLabel(type)` — returns Croatian label for invoice type
- `getSupplierCustomerName(invoice)` — resolves display name from invoice entity fields
- `getCustomerProjects(customerId, projects, customerSales)` — returns projects linked to a customer
- `getCustomerApartmentsByProject(customerId, projectId, customerApartments)` — returns apartments for a customer in a project
- `getSupplierProjects(supplierId, projects, contracts)` — returns projects linked to a supplier
- `getSupplierContractsByProject(supplierId, projectId, contracts)` — returns contracts for a supplier in a project
- `getMilestonesByContract(contractId, milestones)` — returns milestones for a contract
- `isOverdue(dueDate, status)` — returns true if unpaid invoice is past due date
- `columnLabels` — Croatian display names for invoice table columns
- **Depends on:** (none, pure helpers)

### paymentHelpers.ts
- `getPaymentMethodLabel(method)` — returns Croatian label for payment method
- `getPaymentMethodColor(method)` — returns CSS class for payment method badge
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
- `retailInvoiceTypes.ts` inside `Invoices/` defines types that bridge Cashflow and Retail invoice structures — handle carefully when modifying
- Multi-VAT support uses separate `base_amount_1–4`, `vat_rate_1–4`, `vat_amount_1–4` fields for up to 4 VAT rates per invoice (Croatian accounting requirement)
- Cesija is tracked with `is_cesija`, `cesija_company_id`, and `cesija_bank_account_id` fields on invoices and payments
- **Security note.** The Cashflow password modal (`Layout.tsx`) and `CashflowRoute` (`App.tsx`) gate UI navigation only. RLS on cashflow tables enforces role-based access (`Director`, `Accounting`) and does NOT depend on the password flag. A user with one of those roles and a valid Supabase JWT can query cashflow data directly via supabase-js without entering the password. This is a known limitation tracked as **SEC-001** in [`docs/SECURITY_BACKLOG.md`](./SECURITY_BACKLOG.md).
  - As of migration `20260526084700_tighten_cashflow_rls.sql` (2026-05-26), five tables that previously had blanket `USING (true)` policies (`accounting_payments`, `accounting_companies`, `bank_credits`, `company_loans`, `company_bank_accounts`) are now role-gated, with scoped exceptions for the Sales workflow (sales-related invoices/payments) and broad SELECT on `accounting_companies` (names + OIB are treated as reference data). `bank_credits` SELECT additionally allows `Investment`. The companion migration `20260526084701_get_invoice_statistics_role_check.sql` adds a defense-in-depth role check inside the SECURITY DEFINER `get_invoice_statistics` RPC. These close the blanket-open gap but do NOT couple data access to the password flag, so SEC-001 remains open.
- All delete confirmation dialogs use `ConfirmDialog` from `src/components/ui/` via the pending-item hook pattern — never use `window.confirm()` or `confirm()`
