# Backlog — Cashflow

Invoices, payments, companies, bank accounts, loans, cesija and kompenzacija. Ids: `CASH-n` (next
free: `CASH-21`). Entry format and rules are in [README.md](./README.md).

Phase 5 of the ERP integration removes in-app invoice and payment creation. Each entry says how
that changes it; do not build new authoring UI here without reading
[../erp-integration/](../erp-integration/README.md) first.

## Open

### CASH-6 · Medium · Cesija from a credit decreases the allocation's usage
- **Check:** Runtime check needed. **Blocked on an accounting decision.**
- **Where:** `update_credit_allocation_used_amount()` subtracts the amount for
  `cesija_credit_allocation_id`, while `recalculate_bank_credit_fields` adds cesija to the
  credit's `used_amount`. Migration `20260917100000` kept the sign deliberately, with no recorded
  reason.
- **What happens:** one of the two signs is likely wrong, so allocation usage is off for every
  cesija paid from a credit allocation.
- **Fix direction:** ask accounting whether such a cesija adds to or subtracts from the
  allocation's `used_amount`; fix the sign; run drift check 2 from migration `20260917100000`.
- **ERP:** ERP cesija payments never set `cesija_credit_*`, so after phase 5 this matters for
  historical rows only.

### CASH-9 · Low · Loans have no sanity checks
- No check that the source and target differ, or that the source has the balance.
- **ERP:** gains weight. Once the ERP feeds bank movements, an intercompany transfer arrives as
  ERP payments and is also a `company_loans` row, so it would count twice in the derived balance
  (ERP question Q17).

### CASH-17 · Low · Sticky actions cell cuts the overdue tint on desktop
- **Where:** `src/components/ui/Table.tsx` (sticky cell is `bg-white`),
  `Cashflow/Invoices/InvoiceTable.tsx`.
- **Fix direction:** let the sticky cell inherit the row tint.

### CASH-18 · Low · Invoice types are named and coloured differently per screen
- **Where:** the hardcoded list in `Cashflow/services/invoiceHelpers.ts`, the Cashflow Calendar's
  own `getTypeLabel` (no BANK types, so a raw `INCOMING_BANK` shows) and `PaymentDetailView.tsx`.
- **What happens:** the same type reads "ULAZNI (DOB)", "Ulazni (Dobavljač)", "Ulazni dobavljač",
  "RASHOD" or "Ulazni"; status is carried four ways in the Calendar.
- **Fix direction:** `getInvoiceTypeLabelKey` everywhere; one status carrier. See UI-3 in
  [ui.md](./ui.md).

### CASH-19 · Low · Land purchase form uses hand-rolled controls
- **Where:** `Cashflow/Invoices/forms/LandPurchaseFormModal.tsx`: a hand-rolled Ulazni/Izlazni
  toggle with a hardcoded "Retail", five raw selects, and a disabled submit with no explanation.
- **ERP:** the form goes in phase 5.

### CASH-20 · Low · `N/A` fallbacks in Cashflow are English literals
- Left over from GEN-12, which fixed the Sales dashboard and General report ones.

### CASH-14 · Low · VAT rates are fixed per slot, and only the trigger says so
- `calculate_invoice_amounts()` hard-codes 25 / 13 / 0 / 5 % by slot and ignores `vat_rate_n`.
  Intended; document it in [../CASHFLOW.md](../CASHFLOW.md).

## Waiting on the ERP integration

These turn into ERP work or disappear in phase 5. Do not fix them in the app.

### CASH-13 · Low · `company_bank_accounts.account_number` is never captured
- No UI writes it. It blocks ERP payment resolution (ERP-5). Plan: create or match accounts from
  the `bank_balances` feed rather than adding an IBAN field (Q18).

### CASH-11 · Low · Kompenzacija has no link to its counter-invoice
- The two sides are entered as independent payments; nothing checks they match.
  `kompenzacija_reference` is staged by the importer but not stored on the payment.

### CASH-10 · Low · Two lookup failures leave dropdowns silently empty
- Bank-account and credit lookups in `invoiceService.fetchData` only log errors. Moot after
  phase 5: the invoice form loses these dropdowns.

### CASH-15 · Low · Dead code
- `BankCreditFormModal` in Cashflow/Banks is rendered but has no entry point. Removed in phase 5.

### Remove in phase 5
- `reset_company_bank_account_balance()` and the balance fields on the company form (CASH-1,
  CASH-16): the ERP balance becomes authoritative.
- The invoice-edit change that keeps `approved` and `created_by` (CASH-3), and the hidden invoice
  delete for non-Directors (SEC-A7): the forms go and writes are locked to the service role.
