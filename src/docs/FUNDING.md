# Module: Funding

**Path:** `src/components/Funding/`

## Overview
Manages the investment and funding side of the business: investor relationships, credit facilities, disbursements, repayments, and TIC (likely Troškovnik Investicijskih Credits or similar).

## Sub-modules

### Investors
**Path:** `Funding/Investors/`
- Investor registry with credit facility and equity tracking.
- `useBankData.ts` — bank accounts linked to investors
- `useBankForm.ts` — bank form state
- `useCreditForm.ts` — credit facility form state
- `useEquityForm.ts` — equity investment form state
- `creditCalculations.ts` — repayment schedule and interest calculations
- Cards: `InvestorCard`, `CreditFacilityCard`, `PaymentSchedulePreview`
- Modals: `InvestorFormModal`, `InvestorDetailModal`, `CreditFormModal`, `EquityFormModal`

### Investments
**Path:** `Funding/Investments/`
- Detailed credit management: disbursements, expenses, repayments, and invoice linking per credit.
- `useCreditManagement.ts` — full credit lifecycle state
- `useLazySection.ts` — lazy-loads heavy sections on demand
- `creditService.ts` — CRUD for credit records
- `allocationService.ts` — allocates credit funds to cost categories
- Views: `CreditDisbursements`, `CreditExpenses`, `CreditRepayments`, `CreditInvoiceSection`, `AllocationRow`

### Payments
**Path:** `Funding/Payments/`
- Wire payment processing and payment notifications for investors, banks, and subcontractors.
- `usePaymentsData.ts` — payment list
- `usePaymentNotifications.ts` — pending notification state
- `paymentNotificationService.ts` — notification CRUD
- `PaymentNotifications.tsx` — notification feed
- Modals: `WirePaymentModal`, `BankWirePaymentModal`, `InvestorWirePaymentModal`, `NotificationPaymentModal`, `SubcontractorNotificationPaymentModal`

### Projects
**Path:** `Funding/Projects/`
- Investment project registry (links funding to General/Projects).
- `investmentService.ts` — project-level investment queries
- `InvestmentProjectModal.tsx` — create/edit investment project

### TIC
**Path:** `Funding/TIC/`
- **Total Investment Cost** (Struktura Troškova Investicije) — a structured cost breakdown table per project showing own funds (*vlastita sredstva*) vs. credit funds (*kreditna sredstva*) in EUR with percentages, exported for investors.
- `useTIC.ts` — fetches/saves TIC line items per project, manages totals and grand total
- `TICExport.ts` — exports the TIC table to Excel and PDF
- `ticFormatters.ts` — number and percentage formatting helpers for TIC output

## Notes
- Shared investment TypeScript types live in `src/types/investment.ts`
- `lib/Deleted/` contains old credit components that were refactored into this module — do not restore
