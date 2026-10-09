# Backlog — Cashflow

Invoices, payments, companies, bank accounts, loans, cesija and kompenzacija. Ids: `CASH-n` (next
free: `CASH-31`). Entry format and rules are in [README.md](./README.md).

Phase 5 of the ERP integration removes in-app invoice and payment creation. Each entry says how
that changes it; do not build new authoring UI here without reading
[../erp-integration/](../erp-integration/README.md) first.

## Open

### CASH-28 · Low · Cashflow wording, hardcoded strings and unused keys
- **Check:** Code reading
- Hardcoded: `columnLabels` and the row-action tooltips in the payments table; `SupplierCard.tsx`
  builds a label by cutting a translated string.
- Wording: "Resetuj datume" is not Croatian usage ("Poništi datume"); `payments.form.cesija_hint`
  does not mention paying from a credit; "Ugovor o cesiji" is used for something that is not a
  cesija contract; the bank invoice form is called Investitor, Novi Račun Banka and Investicije in
  three places; capitalisation of button labels varies.
- `Cashflow/Customers/index.tsx` hand-builds its money (UI-1) and prints `N/A` (CASH-20).
- Unused keys: `invoices.filters.all_projects|all_suppliers|date_from|date_to`,
  `cashflow_calendar.title|subtitle`.
- **Rule:** the wording items need someone from accounting to choose the term.

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
- **Fix direction:** let the sticky cell inherit the row tint. Not a one-liner: the dark-mode tint
  is translucent (`dark:bg-red-900/20`), so an inherited background would let the columns
  scrolling underneath show through. The cell needs a solid base with the tint painted over it.

### CASH-18 · Low · Invoice types are named and coloured differently per screen
- **Check:** Mostly fixed on `feat/user-guidance-phase-1`: one short label set (`invoice_type.*`)
  and one spelled-out set (`invoice_type_long.*`) from `invoiceHelpers.ts`, used by the invoice
  list and details, payment details and the Cashflow Calendar (which now labels the bank types);
  colour comes from the cash-direction map; invoice status is one `Badge` everywhere.
- **What is left:** the Calendar still tints the whole row by status as well as showing the
  badge, and Retail's `RetailInvoicesModal` keeps its own three labels.
- **Fix direction:** drop the row tint or make it the only carrier; point the Retail modal at
  `getInvoiceTypeLongLabel`. See UI-3 in [ui.md](./ui.md).

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

## Resolved

### CASH-30 · Low · Payments table cuts the last digits of the amount
- Closed on `fix/backlog-batch-3` (2026-10-08): nothing was cut — the table is wider than the screen and the column
  had scrolled under the sticky "Akcije" cell. Sticky cells in `ui/Table.tsx` now carry a soft
  edge so it reads as an overlay. The table's width is UI-8.

### CASH-25 · Low · Payment detail view shows the wrong direction cues
- Fixed on `fix/backlog-small-batch` (2026-10-08): "Cesija" comes from the locale file and the amount takes the
  direction's colour.

### CASH-26 · Low · Banks page has a delete button that does nothing and a modal nothing opens
- Fixed on `fix/backlog-small-batch` (2026-10-08): `AllocationRow`'s delete is optional and the read-only Banks page passes
  none. The unreachable `BankCreditFormModal` stays under CASH-15.

### CASH-27 · Low · Payments date filter parses the dates as UTC
- Fixed on `fix/backlog-small-batch` (2026-10-08): the filter compares `yyyy-mm-dd` text, day against day.

### CASH-29 · Medium · Cashflow payments totals count credit principal as income and expense
- Fixed on `fix/figures-and-tic-export` (2026-10-08): `paymentTotalsByCategory` keeps credit principal out of Prihod / Rashod /
  Neto; the cards and the "Filtrirano" line show it as "Financiranje (primljeno / otplaćeno)".

### CASH-24 · Medium · Calendar "Neplaćeno" card leaves out partly paid invoices
- Fixed on `fix/audit-medium-findings` (2026-10-07): the month figures moved to `Calendar/utils/monthStats.ts`, where every
  invoice that is not `PAID` counts as unpaid.

### CASH-7 · Medium · Income and expense are classified four different ways
- Decided 2026-10-01 (money out) and extended 2026-10-05 with accounting: every invoice type has
  one direction and one category in `src/utils/invoiceCashDirection.ts`. `INCOMING_INVESTMENT`
  and credit fees are operating costs; only credit principal (drawdowns, repayments) is
  financing, shown apart and never as income or expense. Read by every screen and report;
  `company_statistics` follows in migration `20261006100000`, which supersedes `20261001100000`,
  `20261005110000` and `20261005120000`. Figures: [../ACCOUNTING_REVIEW_CASH7.md](../ACCOUNTING_REVIEW_CASH7.md).
  Earlier history is in [archive/DEFECT_BACKLOG.md](./archive/DEFECT_BACKLOG.md).

### CASH-21 · Low · Companies stat cards clip their amounts on a phone
- Fixed on `fix/budget-diff-and-decimals` in the shared `StatCard`: on a narrow card the value
  takes the full width, shrinks with the card and wraps as a last resort, keeping "−€" together;
  nothing is truncated (`.stat-card` in `index.css`, `statCardFit.test.ts`).

### CASH-22 · Low · Companies cards show ragged decimals
- Fixed on `fix/budget-diff-and-decimals`: every amount on the cards, the stat cards, the
  financing line and `CompanyDetailsModal` goes through `formatEuro` (`companyMoney.test.ts`).

### CASH-23 · Low · Calendar "Razlika od budžeta" shows an overrun as a positive amount
- Fixed on `fix/budget-diff-and-decimals`: the row shows the signed difference
  (`Calendar/utils/budgetDifference.ts`). With it, `formatEuro`, `formatEuroRounded` and
  `formatEuroCompact` print the minus before the euro sign ("−€1.234,56") everywhere, and all the
  calendar's amounts use `formatEuro`.
