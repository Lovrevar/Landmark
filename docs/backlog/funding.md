# Backlog — Funding and TIC

Bank credits, investors, drawdowns, allocations and the TIC cost structure. Ids: `FUND-n` (next
free: `FUND-19`). Entry format and rules are in [README.md](./README.md).

## Open

### FUND-18 · Low · Funding labels and hardcoded strings
- **Check:** Code reading
- Validation messages in `useCreditManagement.ts:119-134` are literals; `AllocationRow.tsx` has a
  delete button with no `title`/`aria-label` and prints `N/A`; `InvestorCard` and the Loans page
  have icon-only buttons without labels.
- "Investicije" names two different menu items; `funding.investments.title` is "Investicije" in
  the English file too; "investitor" and "banka" are used for the same party.
- The Funding menu shows Plaćanja to the Investment role, which reads no payments (SEC-A10).

### FUND-13 · Low · The TIC Excel export drops classifications
- **Where:** `ticExport.ts`. Phases are exported and re-imported since 2026-10-08
  (`fix/figures-and-tic-export`, with a phased round-trip test). A line's `classification_id` is
  still not written; on import it is re-derived from the row's name, so a classification the user
  chose by hand for a renamed row is lost.
- **Fix direction:** a classification column, read back by the importer. The sheet layout is a
  frozen contract, so change both together.
- Also: TIC messages are hard-coded Croatian.

### FUND-8 · Low · `recalculate_bank_credit_fields` ignores `disbursed_to_account`
- It can overwrite the `used_amount = amount` set by the disbursement trigger.
- **ERP:** gains weight; a disbursed credit would be counted twice once the ERP feeds drawdowns
  (Q17).

### FUND-15 · Low · Investment role sees credits but no money movements
- Drawdown, repayment and fee sections come back empty for that role. Needs the decision in
  SEC-A10 / SEC-004 ([security.md](./security.md)).

### FUND-6 · Low · "Disbursed to account" without an account gives a generic error
- The account is marked required but not validated; the database CHECK rejects the save.

### FUND-7 · Low · Equity form drops fields
- `percentage_stake`, `notes` and custom schedules are shown but not stored.

### FUND-9 · Low · Funding payments register filters oddly
- The project column uses the legacy `bank_credits.project_id` (usually empty); "Nedavno" filters
  by `created_at`; rows with null bank, project and notes never match, even with an empty search;
  supplier payments drawn from a credit are not listed.

### FUND-10 · Low · Investment projects screen
- The "debt" list includes equity; opex and refinancing allocations are invisible. (The budget
  not being gated on the TIC was fixed on `fix/figures-and-tic-export`, 2026-10-08.)

### FUND-12 · Low · Allocation invoice list does not reconcile
- It lists payments with `credit_allocation_id` only; `OUTGOING_BANK` drawdowns counted in the
  allocation's `used_amount` are missing.

### FUND-14 · Low · Orphan function
- `update_overdue_notifications()` references the removed `payment_notifications` table.

### FUND-16 · Low · TIC page scrolls sideways
- **Check:** Seen in the guidance visual check ([../screenshots/guidance-phase-1/README.md](../screenshots/guidance-phase-1/README.md), finding 8).
- **Where:** `Funding/TIC/components/InvestmentTable.tsx` inside `Funding/TIC/index.tsx`.
- **What happens:** at 390px the whole page is 973px wide (1262px with phase columns); at 1440px
  it overflows once two phase columns exist. The header, tabs and buttons scroll away with the
  table.
- **Fix direction:** the table scrolls inside its card (`overflow-x-auto` on a wrapper, `min-w-0`
  up the flex chain) instead of widening the document.

## Resolved

### FUND-17 · Medium · Funding payments register labels a drawdown PRIHOD and a repayment RASHOD
- Fixed on `fix/audit-medium-findings` (2026-10-07): `paymentKind` in `invoiceHelpers.ts` names a drawdown ISPLATA KREDITA
  and a repayment OTPLATA GLAVNICE, on the Funding register, its export and the Cashflow payments
  table. The Cashflow totals are CASH-29.
