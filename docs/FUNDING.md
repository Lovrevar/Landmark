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
- `deleteBank(bankId)` — deletes a bank/investor record
- **Depends on:** supabase client, activityLog

### creditService.ts
- `fetchCompanyBankAccounts(companyId)` — fetches a company's bank accounts for disbursement selection
- `createCredit(newCredit, computed)` — inserts a new bank credit facility (with computed type/seniority/monthly payment)
- `updateCredit(creditId, newCredit, computed)` — updates a credit facility
- `deleteCredit(creditId)` — deletes a credit facility
- **Depends on:** supabase client, activityLog
- _Note: distinct from `Investments/services/creditService.ts`; this one handles facility CRUD for the investor registry._

### equityService.ts
- `createEquityInvestment(equity)` — records an equity investment as an `equity`-type bank credit row
- **Depends on:** supabase client, activityLog, date-fns

#### Hooks

### useBankData.ts
- `useBankData()` — fetches banks (with credits) and companies, and manages bank create/update/delete with pending-delete confirmation state
- **Calls:** bankService.ts
- **Returns:** banks, companies, loading, fetchData, addBank, updateBank, deleteBank, confirmDeleteBank, cancelDeleteBank, pendingDeleteId, deleting

### useBankForm.ts
- `useBankForm()` — manages bank add/edit form state
- **Returns:** showBankForm, setShowBankForm, editingBank, newBank, setNewBank, handleEditBank, resetBankForm

### useCreditForm.ts
- `useCreditForm(onSaved)` — manages credit facility add/edit form state, lazy-loads company bank accounts, computes the annuity payment, and persists create/update/delete with confirmation state
- **Calls:** creditService.ts (Investors)
- **Uses utils:** creditCalculations (calculateAnnuityPayment, parseCreditTypeAndSeniority)
- **Returns:** showCreditForm, setShowCreditForm, editingCredit, newCredit, setNewCredit, companyBankAccounts, loadingAccounts, handleEditCredit, resetCreditForm, addCredit, handleDeleteCredit, confirmDeleteCredit, cancelDeleteCredit, pendingDeleteId, deleting

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

Troškovna Informatička Struktura (TIC) — structured cost breakdown table per project showing own funds (vlastita sredstva) vs credit funds (kreditna sredstva) in EUR with percentages. Exported for investors.

#### Services

### ticService.ts
- `fetchTICProjects()` — fetches projects (id, name) for the TIC project selector
- `fetchTICForProject(projectId)` — fetches the saved TIC cost structure for a project (or null)
- `createTIC(payload)` — inserts a new TIC cost structure, returns the new id
- `updateTIC(ticId, payload, projectId)` — updates an existing TIC cost structure
- **Depends on:** supabase client, activityLog

### ticExport.ts
- `exportToExcel(lineItems, investorName, documentDate, totals, grandTotal, projectName)` — exports TIC table to .xlsx
- `exportToPDF(lineItems, investorName, documentDate, totals, grandTotal, projectName)` — exports TIC table to PDF
- **Depends on:** xlsx, jsPDF, activityLog
- _Note: renamed from `TICExport.ts` (`Services/`) to `ticExport.ts` (`services/`) in the audit refactor._

#### Hooks

### useTIC.ts
- `useTIC()` — loads projects and the selected project's TIC line items, manages edits/investor/date, computes totals + grand total, and saves (create or update)
- **Calls:** ticService.ts
- **Uses utils:** ticFormatters (calculateTotals)
- **Returns:** projects, lineItems, setLineItems, investorName, setInvestorName, documentDate, setDocumentDate, selectedProjectId, setSelectedProjectId, loading, saving, message, totals, grandTotal, saveTIC

#### Utilities

### ticFormatters.ts
- `formatNumber(num)` — formats a number for TIC display (hr-HR, no decimals)
- `formatPercentage(num)` — formats a percentage for TIC display (hr-HR, 2 decimals)
- `calculateRowPercentages(value, total)` — computes a value's percentage of a total (0 when total is 0)
- `calculateTotals(lineItems)` — sums vlastita and kreditna across line items

#### Views

### index.tsx (TICManagement)
- Project selector, editable line item table with vlastita/kreditna columns, and Excel/PDF export
- **Uses hooks:** useTIC
- **Uses services:** ticExport
- **Uses utils:** ticFormatters (formatNumber, formatPercentage, calculateRowPercentages)
- **Uses Ui:** LoadingSpinner, Button, FormField, Select, Input, Alert, Card, EmptyState

---

## Notes
- Shared investment TypeScript types live in `src/types/investment.ts`
- `lib/Deleted/` contains old credit components that were refactored into this module — do not restore
- All delete confirmation dialogs use `ConfirmDialog` from `src/components/ui/` via the pending-item hook pattern — never use `window.confirm()` or `confirm()`
- Architecture follows UI Component → Custom Hook → Service Layer → Supabase. The May 2026 audit refactor extracted Supabase query logic out of hooks into dedicated `services/*.ts` files; hooks own state and call the services
- There are two distinct `creditService.ts` files: `Investments/services/creditService.ts` (credit list, allocations, credit invoices) and `Investors/services/creditService.ts` (facility CRUD + company bank accounts)
- The audit refactor also lowercased the `Modals/`→`modals/` and `Services/`→`services/` directories in Payments, Projects, and TIC
- Pure calculation/formatting helpers have colocated unit tests: `Investors/utils/creditCalculations.test.ts` and `TIC/utils/ticFormatters.test.ts`
- All service mutations log via `logActivity()` (fire-and-forget)
