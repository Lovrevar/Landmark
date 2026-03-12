# Module: Cashflow

**Path:** `src/components/Cashflow/`

## Overview
The largest module. Manages the full accounting lifecycle: invoices, payments, bank accounts, suppliers, customers, loans, and approval workflows. Likely maps to one or more companies tracked in the system.

## Sub-modules

### Approvals
**Path:** `Approvals/`
- Approval workflow for invoices or payments requiring sign-off.
- `useApprovals.ts` — fetches pending/approved items
- `approvalsService.ts` — submit, approve, reject actions

### Banks
**Path:** `Banks/`
- Bank account management and bank-linked invoices/credits.
- `useBanks.ts` — bank list and CRUD
- `useBankCredits.ts` — credit lines per bank
- `useBankInvoiceData.ts` — invoices linked to bank transactions
- `bankService.ts` — Supabase queries for banks
- `BankCreditFormModal.tsx` — add/edit credit
- `BankInvoiceFormModal.tsx` — add/edit bank invoice

### Calendar
**Path:** `Calendar/`
- Budget calendar view — likely shows scheduled payments or due dates by month.
- `useCalendar.ts` — fetches budget/payment schedule
- `BudgetModal.tsx` — create/edit budget entry

### Companies
**Path:** `Companies/`
- Legal entities / companies in the system.
- `useCompanies.ts` — company list and CRUD
- `CompanyFormModal.tsx` — create/edit company
- `CompanyDetailsModal.tsx` — view company details

### Components (shared within Cashflow)
**Path:** `Components/`
- `CesijaPaymentFields.tsx` — fields for Cesija payments: paying an invoice belonging to one company using the bank account of a different company (assignment of payment)
- `InvoiceEntityFields.tsx` — reusable entity selector for invoice forms
- `ColumnMenuDropdown.tsx` — table column visibility toggle

### Customers
**Path:** `Customers/`
- Accounting-side customer records (distinct from Sales customers).
- `useAccountingCustomers.ts` — customer list
- `customerService.ts` — Supabase queries

### DebtStatus
**Path:** `DebtStatus/`
- Tracks outstanding debts and overdue statuses.
- `useDebtStatus.ts` — debt overview data
- `debtService.ts` — debt queries
- `debtExport.ts` — export debt report

### Invoices
**Path:** `Invoices/`
- Core invoicing — the most complex sub-module. Handles standard invoices, retail invoices, and land purchase invoices.
- `useInvoices.ts` — main invoice list with filters and pagination
- `useRetailInvoiceData.ts` — retail-specific invoice data
- `useLandPurchaseFormData.ts` — land purchase form state
- `useInvoiceColumns.ts` — configurable table columns
- `invoiceService.ts` — CRUD for standard invoices
- `landPurchaseService.ts` — land purchase invoice logic
- `invoiceFormDefaults.ts` — default values for invoice forms
- Key views: `InvoiceTable`, `InvoiceDetailView`, `InvoiceStats`, `InvoicePreview`, `InvoiceFilters`, `InvoicePagination`

### Loans
**Path:** `Loans/`
- Loan tracking — amounts, terms, repayment status.
- `useLoans.ts` — loan list
- `loanService.ts` — Supabase queries

### OfficeSuppliers
**Path:** `OfficeSuppliers/`
- Suppliers for office/operational expenses (separate from project suppliers).
- `useOfficeSuppliers.ts` — supplier list and CRUD
- `officeSupplierService.ts` — Supabase queries

### Payments
**Path:** `Payments/`
- Payment records linked to invoices. Supports both standard and accounting-specific payment flows.
- `usePayments.ts` — payment list with stats
- `paymentService.ts` — CRUD
- `PaymentTable`, `PaymentStatsCards`, `PaymentDetailView` — main views
- `PaymentFormModal.tsx` — standard payment
- `AccountingPaymentFormModal.tsx` — accounting-specific payment

### Services (Cashflow-level helpers)
**Path:** `Services/`
- `invoiceHelpers.ts` — shared invoice calculation/formatting helpers
- `paymentHelpers.ts` — shared payment calculation helpers

### Suppliers
**Path:** `Suppliers/`
- Project-linked suppliers and vendor management.
- `useSuppliers.ts` — supplier list and CRUD
- `supplierService.ts` — Supabase queries
- `SupplierFormModal.tsx` — create/edit supplier
- `RetailSupplierModal.tsx` — retail-specific supplier
- `LinkSupplierToProjectModal.tsx` — associate supplier with a project
- `SupplierDetailsModal.tsx` — view supplier details

## Notes
- `retailInvoiceTypes.ts` inside `Invoices/` bridges Cashflow and Retail invoice types — handle carefully
- Cashflow has active uncommitted changes
