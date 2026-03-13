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
- `fetchCredits()` — fetches all bank credits with allocations and company/bank info
- `fetchAllocationsForCredit(creditId)` — fetches all allocations for a specific credit
- `fetchDisbursedAmounts(creditIds)` — fetches disbursed amounts for a list of credits
- `fetchProjects()` — fetches projects for allocation form
- `fetchCompanies()` — fetches companies for credit selection
- `fetchBanks()` — fetches banks for credit selection
- `createAllocation(allocationData)` — creates a new credit allocation
- `deleteAllocation(allocationId)` — removes a credit allocation
- **Depends on:** supabase client

### allocationService.ts
- `fetchAllocationInvoices(allocationId)` — fetches invoices linked to a credit allocation
- **Depends on:** supabase client

#### Hooks

### useCreditManagement.ts
- `useCreditManagement()` — manages credit list, allocation state, expanded credit/allocation sets, and form state
- **Calls:** creditService.ts
- **Returns:** credits, allocations, disbursedAmounts, expandedCredits, expandedAllocations, loading, projects, companies, banks, showAllocationModal, selectedCredit, allocationForm, setAllocationForm, toggleCredit, toggleAllocation, openAllocationModal, closeAllocationModal, handleCreateAllocation, handleDeleteAllocation

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
- **Uses Ui:** Table, Badge

---

### Investors
**Path:** `Investors/`

Bank and investor registry. Manages credit facilities and equity investments per bank/investor, with payment schedule previews.

#### Hooks

### useBankData.ts
- `useBankData()` — fetches banks with their credits and manages bank CRUD
- **Returns:** banks, loading, refetch, handleAddBank, handleDeleteBank

### useBankForm.ts
- `useBankForm()` — manages bank add/edit form state
- **Returns:** formData, setFormData, resetForm

### useCreditForm.ts
- `useCreditForm()` — manages credit facility form state including bank account loading
- **Returns:** formData, setFormData, bankAccounts, loadBankAccounts, resetForm

### useEquityForm.ts
- `useEquityForm()` — manages equity investment form state
- **Returns:** formData, setFormData, resetForm

#### Forms

### InvestorFormModal.tsx
- Add/edit bank or investor record form
- **Uses hooks:** useBankForm
- **Uses Ui:** Modal, Button

### CreditFormModal.tsx
- Form for creating/editing a credit facility with bank and company selection
- **Uses hooks:** useCreditForm
- **Uses Ui:** Modal, Button, Select

### EquityFormModal.tsx
- Form for recording equity investments
- **Uses hooks:** useEquityForm
- **Uses Ui:** Modal, Button, Select

#### Modals

### InvestorDetailModal.tsx
- Detail view of a bank/investor showing their credits list
- **Uses Ui:** Modal, Table

#### Views

### InvestorCard.tsx
- Card for a bank/investor with credit summary and action buttons

### CreditFacilityCard.tsx
- Card for displaying a credit facility with key financial metrics

### PaymentSchedulePreview.tsx
- Preview table for a computed payment schedule (principal + interest)

### index.tsx (InvestorsManagement)
- Bank/investor cards with add investor, credit, and equity buttons; orchestrates all modals
- **Uses hooks:** useBankData, useBankForm, useCreditForm, useEquityForm
- **Uses components:** InvestorCard, CreditFacilityCard, PaymentSchedulePreview
- **Uses Ui:** Card, Button

---

### Payments
**Path:** `Payments/`

Wire payment processing and payment notifications for bank credits, investors, and subcontractors.

#### Services

### paymentNotificationService.ts
- Creates and manages payment notification records for scheduled credit repayments
- **Depends on:** supabase client

#### Hooks

### usePaymentsData.ts
- `usePaymentsData()` — fetches and aggregates payment data with stats (totalPayments, totalAmount, paymentsThisMonth, amountThisMonth)
- **Returns:** payments, stats, loading, refetch

### usePaymentNotifications.ts
- `usePaymentNotifications()` — manages pending payment notification state and actions
- **Calls:** paymentNotificationService.ts
- **Returns:** notifications, loading, handleDismiss, handleMarkPaid, refetch

#### Views

### PaymentNotifications.tsx
- Displays pending payment notification alerts for upcoming credit repayments
- **Uses hooks:** usePaymentNotifications
- **Uses Ui:** Card, Badge

#### Modals

### NotificationPaymentModal.tsx
- Records a payment against a credit repayment notification
- **Uses Ui:** Modal, Button, Select

### BankWirePaymentModal.tsx
- Form for bank wire payment entry
- **Uses Ui:** Modal, Button, Select

### InvestorWirePaymentModal.tsx
- Form for investor wire payment entry
- **Uses Ui:** Modal, Button, Select

### SubcontractorNotificationPaymentModal.tsx
- Records a payment against a subcontractor payment notification
- **Uses Ui:** Modal, Button, Select

### index.tsx (FundingPaymentsManagement)
- Payment list with search, status/date filters, CSV export, and stats cards
- **Uses hooks:** usePaymentsData, usePaymentNotifications
- **Uses components:** PaymentNotifications, all payment modals
- **Uses Ui:** Card, Table, SearchInput, Button

---

### Projects
**Path:** `Projects/`

Investment project registry — links funding sources (banks, investors) to General/Projects.

#### Services

### investmentService.ts
- `fetchInvestmentProjects()` — fetches projects with equity, debt, ROI, and funding source details
- **Depends on:** supabase client

#### Modals

### InvestmentProjectModal.tsx
- Detail modal for a project showing financing breakdown, funding progress, and funders list
- **Uses Ui:** Modal, Table

#### Views

### index.tsx (InvestmentProjects)
- Project cards with equity/debt/ROI/funding status, progress bars, and detail modal
- **Uses services:** investmentService
- **Uses Ui:** Card, Button

---

### TIC
**Path:** `TIC/`

Troškovna Informatička Struktura (TIC) — structured cost breakdown table per project showing own funds (vlastita sredstva) vs credit funds (kreditna sredstva) in EUR with percentages. Exported for investors.

#### Services

### TICExport.ts
- `exportToExcel(lineItems, investorName, documentDate, totals, grandTotal, projectName)` — exports TIC table to .xlsx
- `exportToPDF(lineItems, investorName, documentDate, totals, grandTotal, projectName)` — exports TIC table to PDF
- **Depends on:** xlsx, jsPDF

#### Hooks

### useTIC.ts
- `useTIC()` — fetches TIC line items per project, manages edits, totals, grand total, and save
- **Calls:** supabase client
- **Returns:** projects, lineItems, setters, saving, message, totals, grandTotal, saveTIC

#### Utilities

### ticFormatters.ts
- `formatNumber(value)` — formats a number for TIC display
- `formatPercentage(value)` — formats a percentage for TIC display
- `calculateRowPercentages(row, grandTotal)` — computes vlastita/kreditna percentage columns for a row

#### Views

### index.tsx (TICManagement)
- Project selector, editable line item table with vlastita/kreditna columns, and Excel/PDF export
- **Uses hooks:** useTIC
- **Uses services:** TICExport
- **Uses Ui:** Card, Button, Select, Table

---

## Notes
- Shared investment TypeScript types live in `src/types/investment.ts`
- `lib/Deleted/` contains old credit components that were refactored into this module — do not restore
