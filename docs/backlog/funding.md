# Backlog — Funding and TIC

Bank credits, investors, drawdowns, allocations and the TIC cost structure. Ids: `FUND-n` (next
free: `FUND-21`). Entry format and rules are in [README.md](./README.md).

## Open

### FUND-20 · Low · Help says Investment can open Funding payments; the app redirects them
- **Check:** Confirmed (pre-release review, 2026-10-20)
- **Where:** `help-kb/funding-payments.md:19` and `help-kb/role-cannot-see-cashflow.md:16`; the code
  in `Funding/Payments/index.tsx:66` and `Common/Layout.tsx:189`
- **What happens:** both articles say an Investment user can open the page and sees an empty list.
  Since `1693baf1` the menu item is hidden and the route redirects them. The first article
  contradicts itself two lines earlier, and the AI assistant repeats the stale claim.
- **Fix direction:** reword both lines (Investment has no access to Funding payments), then
  `npm run kb:build`.

### FUND-18 · Low · Funding labels and hardcoded strings
- **Check:** Code reading
- Validation messages in `useCreditManagement.ts:119-134` are literals; `AllocationRow.tsx` has a
  delete button with no `title`/`aria-label` and prints `N/A`; `InvestorCard` and the Loans page
  have icon-only buttons without labels.
- "Investicije" names two different menu items; `funding.investments.title` is "Investicije" in
  the English file too; "investitor" and "banka" are used for the same party.

### FUND-19 · Low · TIC messages are hard-coded Croatian
- Split off FUND-13 when the export was fixed. `useTIC.ts` and the import preview build their
  messages as literals instead of locale keys.

### FUND-8 · Low · `recalculate_bank_credit_fields` ignores `disbursed_to_account`
- It can overwrite the `used_amount = amount` set by the disbursement trigger.
- **ERP:** gains weight; a disbursed credit would be counted twice once the ERP feeds drawdowns
  (Q17).

### FUND-7 · Low · Equity form drops fields
- `percentage_stake`, `notes` and custom schedules are shown but not stored.

### FUND-9 · Low · Funding payments register filters oddly
- The project column uses the legacy `bank_credits.project_id` (usually empty); "Nedavno" filters
  by `created_at`; rows with null bank, project and notes never match, even with an empty search;
  supplier payments drawn from a credit are not listed.

### FUND-10 · Low · Investment projects screen
- The "debt" list includes equity; opex and refinancing allocations are invisible. (The budget
  not being gated on the TIC was fixed on `fix/figures-and-tic-export`, 2026-10-08.)

### FUND-14 · Low · Orphan function
- `update_overdue_notifications()` references the removed `payment_notifications` table.

## Resolved

### FUND-16 · Low · TIC page scrolls sideways
- Not reproduced on 2026-10-09: at 390px the page stays 390px wide and the table (993px) scrolls
  inside its card. Fixed at some point since the phase 1 visual check; closed with the mobile pass.

### FUND-13 · Low · The TIC Excel export drops phases and classifications
- Fixed in two steps: phases on `fix/figures-and-tic-export` (2026-10-08), classifications on
  `fix/backlog-batch-4` (2026-10-09). The INVESTICIJA sheet's last column `KLASIFIKACIJA` carries each line's
  classification code; the importer reads it back, an empty cell staying unmapped. Both round
  trips are pinned in `ticExport.test.ts`. The hard-coded messages are FUND-19.

### FUND-15 · Low · Investment role sees credits but no money movements
- Fixed on `fix/storage-policies-sec-a12` (2026-10-09) with SEC-A10: the Funding "Plaćanja" menu item, the register page and the
  drawdown, repayment, fee and allocation-invoice sections show to Director and Accounting only.

### FUND-6 · Low · "Disbursed to account" without an account gives a generic error
- Fixed on `fix/backlog-batch-3` (2026-10-08): the Funding credit form checks the account before saving.

### FUND-12 · Low · Allocation invoice list does not reconcile
- Fixed on `fix/backlog-small-batch` (2026-10-08): `fetchAllocationInvoices` also returns the `OUTGOING_BANK` invoices booked
  against the allocation, labelled "Isplata kredita".

### FUND-17 · Medium · Funding payments register labels a drawdown PRIHOD and a repayment RASHOD
- Fixed on `fix/audit-medium-findings` (2026-10-07): `paymentKind` in `invoiceHelpers.ts` names a drawdown ISPLATA KREDITA
  and a repayment OTPLATA GLAVNICE, on the Funding register, its export and the Cashflow payments
  table. The Cashflow totals are CASH-29.
