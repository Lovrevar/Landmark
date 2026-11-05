# Backlog — Funding and TIC

Bank credits, investors, drawdowns, allocations and the TIC cost structure. Ids: `FUND-n` (next
free: `FUND-23`). Entry format and rules are in [README.md](./README.md).

## Open

### FUND-22 · Medium · New equity is created with its whole amount as outstanding
- **Check:** Code reading (Step 7 planning, 2026-10-21)
- **Where:** `Funding/Investors/services/equityService.ts` ~21 inserts `outstanding_balance = amount`. The
  trigger (baseline ~1144-1148) defines outstanding as `used − repaid` and recalculates only when
  a payment touches the credit. Investor credits start at 0 (`Investors/services/creditService.ts`
  ~34).
- **What happens:** until its first payment, an equity facility counts as fully outstanding
  wherever `outstanding_balance` is summed over every credit: the Cashflow Banks totals, and the
  Investors cards and concentration (FUND-21). The portfolio debt figures leave equity out, and
  equity is created with no `project_id`, so per-project debt is unaffected.
- **Fix direction:** insert `outstanding_balance = 0` (or let the trigger compute it). Then a
  one-off recalculation of the existing equity rows, checked on production first.

### FUND-21 · Low · Debt, headroom, the interest rate and funders are defined three ways across the dashboards
- **Check:** Code reading (Step 7 item 1, 2026-10-21). The General report and the Director dashboard
  now share one set of functions, `src/utils/fundingFigures.ts`: debt is outstanding on live,
  non-equity credits, equity is the equity facilities, and the rate is weighted over live debt
  (GEN-2)
- **Where / what happens:**
  - `dashboards/services/investmentDashboardService.ts`:
    - Debt is `max(0, Σ used − Σ repaid)` over every credit, equity included.
    - Available credit is clamped on the total instead of summed per credit.
    - The weighted rate runs over every credit, equity and repaid ones included.
    - Equity and D/E are hard-coded to 0.
  - Investors and funders: the Director dashboard counts banks of live credits, equity included,
    with no allocation needed. The General report counts banks of credits that have an allocation,
    whatever their status.
  - Per-project debt: the Director dashboard sums `outstanding_balance` over every credit of the
    project, equity included. The General report sums face value (GEN-27).
    `Funding/Projects/services/investmentService.ts` splits allocations by credit type.
- **Fix direction:** one per-project and one portfolio definition in `fundingFigures.ts`, which the
  Investment dashboard calls too. Where a figure stays different, its label says what it counts.
- **Also found while planning (2026-10-21):**
  - The Investment dashboard's available credit (`investmentDashboardService.ts` ~86) differs from
    `creditLineTotals` only by clamping at 0. Σ(amount − used) is Σ amount − Σ used, so "clamped
    on the total instead of summed per credit" above overstates the gap.
  - Its average rate counts equity, whose `interest_rate` holds the expected return
    (`Funding/Investors/services/equityService.ts` ~17).
  - Cashflow Banks (`Cashflow/Banks/services/bankService.ts` ~63) and the Investors cards and
    concentration (`Funding/Investors/services/bankService.ts` ~52) sum `outstanding_balance`
    over every credit, equity and paid ones included.
  - Funders are counted seven ways:
    - `activeFunderCount`;
    - the Director's live banks, equity included;
    - `banks.length` on the Investment dashboard and in the General report's `active_banks`;
    - per project, banks across allocations (`investmentService.ts` ~55, `siteFundingService.ts`
      ~47);
    - the Sales report's bank names;
    - the Director's `funded_projects`.
  - Utilisation is computed three ways: over every credit (Investment dashboard and PDF), over
    live debt (Director), and per bank (Investors).
  - Upcoming maturities are computed two ways: over every credit (Investment) and over live debt
    (Director).
  - `investmentService.ts` ~42 counts an allocation with no credit as debt.
  - `useCreditManagement.ts` ~131 computes unallocated without `disbursed_to_account`;
    `creditUsage.ts` ~59 accounts for it.
  - `investmentReportPdf.ts` ~398, ~409 hard-code utilisation colours instead of
    `utilisationToneRgb`.
- **Plan:** Step 7 item 5. The Investment dashboard, Cashflow Banks and Investors call
  `fundingFigures`. Wherever a figure stays different, its label says what it counts.

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
