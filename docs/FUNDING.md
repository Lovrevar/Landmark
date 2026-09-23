# Module: Funding

**Path:** `src/components/Funding/`

## Overview

Manages the investment and funding side of the business: bank credit facilities, investor relationships, credit allocations, disbursements, repayments, and TIC (Troškovna Informatička Struktura — structured investment cost breakdown).

## Money formatting

Amounts go through `src/utils/formatters.ts` — `formatEuro` (exact cents), `formatEuroRounded`
(aggregates), `formatEuroCompact` (dashboard-style tiles) — with the **€ first** (`€1.234,56`),
never the viewer's browser locale. Investor cards no longer divide by a million by hand, which
used to render €450.000 as "€0.5M" and €45.000 as "€0.0M"; `formatEuroCompact` keeps a five-figure
amount readable (`€45K`) and only abbreviates to `M` at seven figures.

TIC keeps its own `formatNumber` from `TIC/utils/ticFormatters.ts` (0 decimals, hr-HR, unit-tested
against the spreadsheet layout) — use it for TIC numbers, but write the `€` in front of it, not
after.

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
- `error` is an `Error | null` (was a hardcoded Croatian string) and `credits` is left as it was on a failed load; `refetch` re-runs `loadData`. The screen had always ignored this `error` and rendered the "no recorded investments" empty state over a failed read of the whole credit register
- `confirmDeleteAllocation` closes the `ConfirmDialog` **only on success** (it used to close in `finally`, so a refused delete looked identical to a completed one), toasts `funding.investments.allocation_delete_success` when it lands and `…allocation_delete_failed` (through `toErrorMessage`) when it does not
- **Calls:** creditService.ts
- **Returns:** credits, allocations, disbursedAmounts, expandedCredits, expandedAllocations, loading, **error**, **refetch**, projects, companies, banks, showAllocationModal, selectedCredit, allocationForm, setAllocationForm, toggleCredit, toggleAllocation, openAllocationModal, closeAllocationModal, handleCreateAllocation, handleDeleteAllocation, **fieldErrors**

### useLazySection.ts
- `useLazySection<T>(fetchFn)` — generic hook for lazy-loading a section's data on first expand
- **Returns:** expanded, loading, fetched, **error**, items, toggle, **retry**
- A failure used to be cached as success: the hook did `.catch(console.error)` and set `fetched`
  in `finally`, while `toggle` only fetched when `!fetched`. The section then read "(0)" and
  showed its "nothing here" message for the rest of the component's life. It now records `error`,
  leaves `fetched` false so a retry can run, and exposes `retry`

#### Views

### index.tsx (CreditsManagement)
- Expandable credit cards with allocation modal, disbursement, repayment, and expense sections
- Destructures `error` / `refetch`: with no credits loaded an `ErrorState` with a retry takes the place of the empty state; with credits on screen a dismissible `Alert variant="error"` sits above them
- The credit card's badges, tiles and details grid come from `CreditSummary.tsx`, **shared with
  `Cashflow/Banks`** — the two screens render the same credits and had drifted apart. This one
  keeps its own chrome: the expander and the "Namjena Investicije" button
- The allocation modal's "Nealocirano:" runs through the same `calculateCreditUsage` as the tile
  behind it. It used to leave direct drawdowns out and clamp nothing, so it offered money the
  tile had already spent
- Maturity date renders `—` when the credit has none (guarded with `isValidDate()` from `src/utils/dateOnly.ts`), instead of formatting `new Date(null)` as Jan 01, 1970
- **Uses hooks:** useCreditManagement
- **Uses components:** CreditSummary (CreditBadges / CreditUsageTiles / CreditDetailsGrid), AllocationRow, CreditDisbursements, CreditRepayments, CreditExpenses, CreditInvoiceSection
- **Uses Ui:** Modal, Button, EmptyState, ErrorState, Alert, Form, ConfirmDialog

### CreditSummary.tsx
The credit card's shared middle, rendered identically by `Funding/Investments` and
`Cashflow/Banks`. Three exports:

- `CreditBadges({ credit })` — the equity marker (`funding.equity`, was a hardcoded "EQUITY") and
  the translated status from `Investors/utils/creditStatus.ts`
- `CreditUsageTiles({ credit, totalAllocated, usedInAllocations, unallocatedDisbursements })` —
  four tiles (Alocirano, Iskorišteno, Dug, Nealocirano), the two-segment progress bar and the
  over-commitment warning. The duplicate "Iznos investicije" tile is gone; the header already
  shows it
- `CreditDetailsGrid({ credit })` — terms and dates. The type is translated through
  `getCreditTypeLabelKey`; dates are `dd.MM.yyyy` parsed with `parseLocalDate` (`'MMM dd, yyyy'`
  printed English month names, and `new Date(ymd)` is UTC, which can show the previous day)

Two rules it fixes and now enforces in one place:

- **"Dug" is coloured by the figure it prints** — `outstanding_balance > 0`, red while debt
  remains and neutral at zero. Both copies coloured it from a local `netUsed` that added the
  drawdowns a second time (they are already inside `used_amount`, via
  `recalculate_bank_credit_fields`), so a fully repaid credit showed a red "€0,00"
- **One quantity, one name, one colour**: money drawn from the line is "Iskorišteno" in orange on
  the tile, in the bar, in the bar's legend and in `AllocationRow`. It used to be "Isplaćeno" in
  orange on the tile and "Iskorišteno" in the legend beside it, for the same number, while
  `AllocationRow` called it "Isplaćeno" in green

### utils/creditUsage.ts
- `calculateCreditUsage({ amount, disbursedToAccount, totalAllocated, usedInAllocations, unallocatedDisbursements })`
  → `{ used, remainingAllocated, unallocated, overCommitted, overCommittedBy, usedPercent, remainingAllocatedPercent, totalUsagePercent }`
- **"Nealocirano" is signed**: `amount − allocations − direct drawdowns`, no `Math.max(0, …)`. The
  clamp printed a tidy €0 over an over-committed line and left the red branch below it unreachable
- **Over-commitment counts drawdowns**, not allocations alone: money paid straight out of the
  credit used to go over the facility in silence
- Deliberately does **not** compute "Dug" — that is `outstanding_balance`, maintained by the
  database. Pure and unit-tested (`creditUsage.test.ts`, 9 tests)

### AllocationRow.tsx
- Displays allocation details with nested invoice table, lazy-loaded on expand
- Spent money is "Iskorišteno:" in orange in both branches — including the `disbursed_to_account`
  one, which called the same quantity "Isplaćeno:" in green. Available is green, or red when the
  allocation is overspent. Amounts render through `formatEuro`
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
- Status badges (here and in `AllocationRow`) come from the shared `getInvoiceStatusVariant` /
  `getInvoiceStatusLabel` in `Cashflow/services/invoiceHelpers.ts`. The module's own
  `Investments/constants.ts` (`INVOICE_STATUS_CONFIG`, with hardcoded Croatian labels) is gone
- Props: creditId, invoiceType, title, totalLabel, paymentAmountLabel, emptyMessage, accentColor, icon, showAllocation?
- A failed load renders `ErrorState compact` with a retry in place of `emptyMessage` — "this
  credit has no drawdowns" and "we could not read them" are opposite answers
- **Uses hooks:** useLazySection
- **Calls:** creditService.fetchCreditInvoices
- **Uses Ui:** Badge, LoadingSpinner, ErrorState

---

### Investors
**Path:** `Investors/`

Bank and investor registry. Manages credit facilities and equity investments per bank/investor, with payment schedule previews.

#### Services

### bankService.ts
- `fetchFundingBanksData()` — fetches banks (with credit aggregates: total, used, outstanding, available, utilization) plus companies
  - The Σ`credit.amount` aggregate is `credit_total` — the **facilities approved**, not the amount
    drawn. It used to be called `credit_utilized` and was rendered under "Iskorišten kredit" on
    `InvestorCard` and in `InvestorDetailModal`, so every investor looked fully drawn; it is also
    the denominator of `credit_utilization`, which made the two figures contradict each other.
    Σ`credit.used_amount` is now exposed as `credit_used` and is what "Iskorišteno" shows
- `createBank(payload)` — inserts a new bank/investor record
- `updateBank(bankId, payload)` — updates a bank/investor record
- `fetchBankCreditIds(bankId)` — returns the ids of the bank's credit facilities (used to size and perform the invoice detach)
- `deleteBank(bankId)` — detaches invoices from all the bank's credit facilities, then deletes the bank/investor record
- **Depends on:** supabase client, activityLog, creditService (`detachInvoicesFromCredits`)

### creditService.ts
- `fetchCompanyBankAccounts(companyId)` — fetches a company's bank accounts for disbursement selection
- `createCredit(newCredit, computed)` — inserts a new bank credit facility (with computed type/seniority/monthly payment)
- `updateCredit(creditId, newCredit, computed)` — updates a credit facility. Like `createCredit`, it sends an empty maturity date as `null` (`bank_credits.maturity_date` is a nullable `date`; `''` would be rejected)
- `countInvoicesForCredits(creditIds)` — how many invoices still reference these facilities (drives the delete-confirmation warning)
- `detachInvoicesFromCredits(creditIds)` — clears `accounting_invoices.bank_credit_id`, returns the number detached; also imported by `Cashflow/Banks/services/bankService.ts` and by `bankService.deleteBank`
- `deleteCredit(creditId)` — detaches linked invoices, then deletes the credit facility
- **Depends on:** supabase client, activityLog
- _Note: distinct from `Investments/services/creditService.ts`; this one handles facility CRUD for the investor registry._

### equityService.ts
- `createEquityInvestment(equity)` — records an equity investment as an `equity`-type bank credit row
- **Depends on:** supabase client, activityLog, date-fns

#### Hooks

### useBankData.ts
- `useBankData()` — fetches banks (with credits) and companies, and manages bank create/update/delete with pending-delete confirmation state
- Returns `error` (plus `refetch`, an alias of `fetchData`). An empty card grid would otherwise say this company has no investors and no credit facilities, so `InvestorsManagement` renders an `ErrorState` in the grid area when nothing loaded, and a dismissible `Alert` above the cards when something did
- **Calls:** bankService.ts
- **Returns:** banks, companies, loading, error, fetchData, refetch, addBank, updateBank, deleteBank, confirmDeleteBank, cancelDeleteBank, pendingDeleteId, pendingDeleteInvoiceCount, deleting

### useBankForm.ts
- `useBankForm()` — manages bank add/edit form state
- **Returns:** showBankForm, setShowBankForm, editingBank, newBank, setNewBank, handleEditBank, resetBankForm

### useCreditForm.ts
- `useCreditForm(onSaved)` — manages credit facility add/edit form state, lazy-loads company bank accounts, computes the annuity payment, and persists create/update/delete with confirmation state
- **Calls:** creditService.ts (Investors)
- **Uses utils:** creditCalculations (calculateAnnuityPayment, parseCreditTypeAndSeniority)
- **Returns:** showCreditForm, setShowCreditForm, editingCredit, newCredit, setNewCredit, companyBankAccounts, loadingAccounts, handleEditCredit, resetCreditForm, addCredit, handleDeleteCredit, confirmDeleteCredit, cancelDeleteCredit, pendingDeleteId, pendingDeleteInvoiceCount, deleting

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
- Card for a bank/investor with total / used / outstanding metrics, a utilisation bar, and
  select/edit/delete actions
- The three figures are `credit_total` (neutral), `credit_used` (green) and `outstanding_debt`
  (red) — the card used to print `credit_total` alone, labelled "Iskorišten kredit"
- The utilisation percentage and its bar both take their colour from `utilisationTone`
- The edit button is a real pencil (`Edit2`); it was `CreditCard as Edit2`, a credit-card glyph
  aliased to look like an edit icon
- Props: bank, onSelect, onEdit, onDelete
- **Uses utils:** creditCalculations (utilisationTone)
- **Uses Ui:** Button

### CreditFacilityCard.tsx
- Card for displaying a credit facility with key financial metrics
- **Maturity** reads through `daysFromToday`: "USKORO DOSPIJEVA" for 0–90 days and only while the
  credit is `active`; past maturity and still active gets a red "DOSPJELO"
  (`funding.investors.credit_facility_card.past_maturity`); a repaid credit gets neither. The old
  `differenceInDays(maturity, now) <= 90` was also true for credits that matured years ago and
  ignored the status, so a repaid one wore "maturing soon" for life. The date renders `dd.MM.yyyy`
- One type badge, from `getCreditTypeLabelKey` / `getCreditTypeBadgeVariant`: the hardcoded
  "EQUITY", the local copy of the variant map, and `credit_type.replace('_', ' ')` — which printed
  "LINE OF_CREDIT", `String.replace` having replaced only the first underscore — are gone. The
  separate seniority badge went with them: the type label already carries it (the credit form only
  offers junior for a line of credit)
- Status comes from `utils/creditStatus.ts`, not a local map missing `paid` and the raw
  `status.toUpperCase()` as its label
- Edit uses a real pencil (`Edit2`); it was `CreditCard as Edit2`, a credit-card glyph aliased to
  look like one

### PaymentSchedulePreview.tsx
- Preview block for a computed payment schedule (principal + interest, frequencies, start date)
- Props: calculation (PaymentScheduleResult | null), gracePeriodMonths

### utils/creditStatus.ts
- `getCreditStatusDisplay(status)` → `{ labelKey, variant }` or `null`; `getCreditStatusVariant(status)`;
  `CREDIT_STATUS_DISPLAY`, the map itself
- The one renderer for `bank_credits.status`, whose CHECK allows exactly `active | paid | defaulted`
  (baseline_schema.sql:2814) — **active green, paid gray, defaulted red**. Every screen had its own
  map built around `'active' | 'pending' | 'closed'`, so a *defaulted* credit fell through to a calm
  blue badge while the pending/closed branches could never run, and the raw English enum was the
  label in a Croatian UI. An unrecognised value keeps a neutral badge and is shown as-is rather
  than hidden
- Labels: `funding.credit_status.active | paid | defaulted`
- Kept out of `creditCalculations.ts` on purpose: that file is financial maths, this is display
  mapping. Pure and unit-tested (`creditStatus.test.ts`, 6 tests)
- Used by `CreditFacilityCard` and, through `Investments/CreditSummary`, by both credit pages

### utils/creditCalculations.ts
The module's pure-maths layer, and the most heavily unit-tested file in the codebase
(42 tests in `creditCalculations.test.ts`). No Supabase, no React — extract new financial
maths here rather than inlining it in a hook.

- `calculateAnnuityPayment({...})` — standard annuity instalment
- `calculatePaymentSchedule(params)` → `PaymentScheduleResult | null` — the full schedule
  driving `PaymentSchedulePreview`. Its `principalFrequency` / `interestFrequency` are the
  **stored repayment type** (`monthly` / `quarterly` / …), not a label: they were English nouns
  that `banks.credit_form.every_frequency` interpolated into "Svakih month". Croatian needs a
  whole phrase per frequency, so the preview picks one from
  `banks.credit_form.frequency_every.*`
- `calculateEquityCashflow(equity)` / `calculateMoneyMultiple(equity)` — equity return maths.
  Both return an `EquityPreview` (`{ status: 'ok', value }` / `{ status: 'incomplete' }` /
  `{ status: 'invalid_range' }`), **not** a display string. They used to return the reason as an
  English sentence ("Enter amount, dates, and IRR to calculate") that a Croatian user read
  verbatim; `EquityFormModal` supplies the words from `funding.equity_form.preview_*`
- `getPaymentFrequency(type)` — payments per year for `monthly` / `quarterly` / `biyearly` / `yearly`
- `parseCreditTypeAndSeniority(combined)` — splits the combined form value back into its two fields
- `getCreditRiskLevel(utilization)` → `{ level, className }` where `level` is a `RISK_LEVEL` key
  (`Low` / `Medium` / `High`), not a label. `InvestorDetailModal` renders it through
  `statusLabel(RISK_LEVEL, …)` from `src/utils/statusDisplay.ts`, so the investor modal says
  "Visok" where every other screen does. **The > 80 / > 60 bands are unchanged** — they are
  deliberately looser than `utilisationTone`'s ≥ 90 / ≥ 70
- `getCreditTypeBadgeVariant(creditType)` — badge colour per credit type
- `utilisationTone(percent)` → `{ text, bar }` and `utilisationToneRgb(percent)` — **the one
  utilisation colour scale**: ≥ 90 red, ≥ 70 orange, else green, with a `dark:` pair on every
  class. Five screens each had their own thresholds (`InvestorCard` > 80 / > 60,
  `InvestmentCreditsTable` ≥ 90 / ≥ 70 over blue, `CompanyDetailsModal` ≥ 90 / ≥ 70,
  `investmentReportPdf` the same in RGB) and inside `InvestmentProjectModal` the percentage and
  its own bar disagreed — at 92% the figure was orange while the bar beside it was red. All five
  read from here now. Distinct from `getCreditRiskLevel`, which keeps its own looser bands
- `getCreditTypeLabelKey(creditType, seniority?)` — i18n key for a stored `credit_type`, reusing the
  credit form's `banks.credit_form.*` option labels (a `line_of_credit` picks `loc_senior` /
  `loc_junior` by seniority; `equity` → `funding.equity`); `null` for anything else, where callers
  show the value with every `_` replaced
- Exports `PaymentScheduleParams` and `PaymentScheduleResult`

> The tests assert the code's **actual** output, including a known 119-vs-120 off-by-one in the
> monthly-payment count. If you change that behaviour, change the test deliberately — don't
> "fix" the test to match new output.

### index.tsx (InvestorsManagement)
- Bank/investor cards with add investor, credit, and equity buttons; orchestrates all modals
- **Uses hooks:** useBankData, useBankForm, useCreditForm (passed `fetchData`), useEquityForm (passed `fetchData`)
- **Uses components:** InvestorCard
- **Uses modals:** InvestorFormModal, CreditFormModal, InvestorDetailModal, EquityFormModal
- **Uses Ui:** PageHeader, LoadingSpinner, Button, ConfirmDialog

---

### Payments
**Path:** `Payments/`

Read-only history of accounting payments made against bank credits.

> The payment-notification UI (`PaymentNotifications`, its hook and service) and the bank /
> investor / subcontractor wire-payment modals were removed on 2026-09-14. Nothing had rendered
> them since the November 2025 Funding overview rewrite, and migration
> `20260518110001_deprecate_remaining_unused_tables` had already dropped the `payment_notifications`
> table and its triggers. One orphan remains in the database: `update_overdue_notifications()`
> still references that table and would fail if called — nothing calls it.

#### Services

### bankPaymentsService.ts
- `fetchBankPayments()` — fetches accounting payments tied to bank credits, enriched with bank name, credit type and seniority, project name, the invoice's `invoice_type`, and a `direction` (`'IN' | 'OUT'`, from `paymentDirection` in `Cashflow/services/invoiceHelpers.ts`). A drawdown (`OUTGOING_BANK`) is money **in**; a repayment (`INCOMING_BANK`) or credit fee (`INCOMING_BANK_EXPENSES`) is money **out**
- **Depends on:** supabase client

#### Hooks

### usePaymentsData.ts
- `usePaymentsData()` — fetches bank payments and computes `stats.all` and `stats.thisMonth`, each a `PaymentTotals` (`{ inflow, outflow, net, count }`). "This month" is the current calendar month by `monthKey`, so future-dated payments are not counted in it
- Returns `error` instead of toasting; the stats are left alone rather than recomputed from nothing, and the page withholds its four stat cards on a failed read rather than reporting €0 disbursed
- **Calls:** bankPaymentsService.ts
- **Returns:** payments, stats, loading, error, refetch

#### Views

#### Utilities

> `paymentTotals.ts` **moved** to `Cashflow/services/paymentTotals.ts` and `bankPaymentTotals` was
> renamed `paymentTotalsByDirection`: the Cashflow payments screen needed the same maths, and it
> was never bank-specific. The direction amount classes and `formatSignedEuro` moved there with
> it, so both payment screens render a direction identically. See `docs/CASHFLOW.md` → Services.

### index.tsx (FundingPaymentsManagement)
- Payment list with search, status/date filters, CSV export, and stats cards
- Stat cards: total disbursements (in), total repayments and fees (out), net, and this month's net. There is no single "total amount" and no payment-count card
- The type column is the direction (PRIHOD green / RASHOD red, the Cashflow payment screen's `payments.table.income` / `expense` wording), and the amount takes the same colour. The CSV's Type column carries the same label. The credit type column is translated through `getCreditTypeLabelKey`
- The filtered-results footer shows the count, in, out and net of the filtered rows. The "Large (> €50k)" filter is by magnitude, whichever way the money went
- Three-way list area: `EmptyState` only for a genuinely empty result, `ErrorState` with a retry when the read failed and nothing loaded, and a dismissible `Alert` over stale rows. The filter bar stays mounted in every case
- **Uses hooks:** usePaymentsData
- **Uses Ui:** PageHeader, StatGrid, StatCard, SearchInput, Select, Button, FormField, Input, Badge, EmptyState, ErrorState, Alert, Table

---

### Projects
**Path:** `Projects/`

Investment project registry — links funding sources (banks, investors) to General/Projects.

**There is no ROI here.** The percentage on the project card and in the modal is
`avg_interest_rate` — the **cost of debt**, not a return. It was called `expected_roi`, shown in
green next to a "Return Analysis" heading, and computed as a plain mean of `credit.interest_rate`
over *all* allocations, so an interest-free equity row pulled it toward zero. Do not restore the
"Očekivani ROI" label or style the number as a gain; a real ROI would need revenue, which this
module does not hold.

#### Services

### investmentService.ts
- `fetchInvestmentProjects()` — fetches projects with equity, debt, average interest rate, risk level, and funding source details. `debt_allocations` carries every allocation row with its credit (name, type, dates, bank), which is what the detail modal's Funding tab is now derived from
- `risk_level`'s time-overrun input is `-daysFromToday(end_date)`; it was
  `differenceInDays(new Date(), new Date(end_date))`, and `new Date('YYYY-MM-DD')` parses as UTC
  midnight, so a project counted as overrun from 01:00 on its own end date
- `fetchFundingUtilization(projectId)` was **removed**: it re-queried `credit_allocations` on
  every click of the modal's Funding tab for rows the page already had
- **Calls:** weightedInterestRate.weightedAverageInterestRate
- **Depends on:** supabase client, dateOnly

#### Utils

### weightedInterestRate.ts
- `weightedAverageInterestRate(allocations)` — average `credit.interest_rate` weighted by
  `allocated_amount`; pass **debt allocations only**. Returns 0 rather than `NaN` when the weights
  sum to zero. €1M @ 3% + €3M @ 5% → 4,5% (the unweighted mean would say 4%)
- Pure and unit-tested (`weightedInterestRate.test.ts`), deliberately split out of
  `investmentService.ts` so the maths is testable without the supabase client

#### Modals

### InvestmentProjectModal.tsx
- Detail modal for a project showing financing breakdown, funding progress, and funders list
- The average interest rate appears **once**, on the teal tile; the "Analiza prinosa" panel holds
  only the investment period and risk level
- The **Funding tab is derived**, not fetched: a `useMemo` over `project.debt_allocations`, which
  the page already loaded. It used to call `fetchFundingUtilization` on every tab click with no
  loading state and a `catch` that only reached the console, so the tab read "Nema izvora
  financiranja za ovaj projekt" until the query resolved and for ever if it failed
- Each source's badge is its **credit type** through `getCreditTypeLabelKey` /
  `getCreditTypeBadgeVariant`, which is what distinguishes debt from equity. It was a constant
  green "BANKA" on every row, because the removed service hardcoded `type: 'bank'`
- Dates and windows go through `dateOnly`: "Preostali dani" prints `days_left` or `days_overdue`
  wording instead of a negative number, and "expiring soon" is `0 ≤ days ≤ 30` with a separate
  red "ISTEKLO" badge and "expired N days ago" line. `<= 30` alone was also true for periods that
  had already run out, which produced "USKORO ISTJEČE" beside "istječe za -12 dana"
- Utilisation text and bar both come from `utilisationTone`; they used to disagree at ≥ 90
- **Uses utils:** creditCalculations (utilisationTone, getCreditTypeLabelKey, getCreditTypeBadgeVariant), dateOnly
- **Uses Ui:** Modal, Badge, StatGrid, EmptyState

#### Views

### index.tsx (InvestmentProjects)
- Project cards with equity/debt/average-interest-rate/funding status, progress bars, and detail modal
- Loads through `useCachedData('funding:investment-projects', …)`. It used to be an inline
  `useEffect` loader whose `catch` only reached the console, leaving `projects: []` and rendering
  the page header over an empty div. The content area is now three-way: `ErrorState` with a retry
  on a failed load, `EmptyState` for a genuinely empty portfolio, the cards otherwise — the header
  stays mounted in every case. Note the hook's 5-minute cache (`invalidateCachedData` to drop it)
- **Calls:** investmentService.fetchInvestmentProjects (via useCachedData)
- **Uses components:** InvestmentProjectModal
- **Uses Ui:** PageHeader, LoadingSpinner, StatGrid, Badge, Button, EmptyState, ErrorState

---

### TIC
**Path:** `TIC/`

Troškovna Informatička Struktura (TIC) — structured cost breakdown per project showing own funds (vlastita sredstva) vs credit funds (kreditna sredstva) in EUR with percentages. Exported for investors.

Two tabs, mirroring the two sheets of the standard client workbook:
- **Investicija** — a flat list of cost categories (`line_items` jsonb)
- **Građenje** — a hierarchical construction breakdown: sections `A)` / `B)` / `C)` each holding roman-numeral items (`construction_sections` jsonb, added by migration `20260907120000`)

Both tabs are fully editable per project — rows and sections can be renamed, added, removed and reordered. The hardcoded defaults in `constants.ts` are only the starting point for a project that has no saved TIC yet. Section subtotals (`Ukupno`) and the grand totals (`UKUPNO:` / `SVEUKUPNO:`) are **always derived from the items, never stored**.

The two tabs are deliberately independent: the Građenje grand total is not written into the Investicija `Građenje` row, even though the two normally match in the source workbook.

#### The TIC is the only source of planned budget

Since migrations `20260909130000` and `20260909140000`, saving a TIC is what sets a project's
plan. Nothing else writes one — the project form, the phase setup modal and the classification
budgets modal all display budget read-only, and a project with no TIC reads **"budget not set"**
rather than showing a zero that looks like a real figure.

Saving `tic_cost_structures` fires `sync_project_from_tic(project_id)`, which derives:

| Target | From |
|---|---|
| `projects.budget` | the Investicija grand total |
| `project_phases` | the phases the TIC itself names |
| `project_phases.budget_allocated` | that phase's share of the plan |
| `phase_classification_budgets` | the (phase × classification) grid |

Three rules the function encodes, each protecting against a way this could destroy data:

- **An all-zero TIC changes nothing.** Every project shows the default template whether or not
  anything was filled in, so saving an untouched one is easy to do by accident; without the
  guard it would zero the budget and take EVM, funding ratios and every dashboard with it.
- **A phase with contracts or work logs is never deleted**, only zeroed, even when the TIC stops
  planning it. Both FKs are `ON DELETE SET NULL`, so deleting one would silently detach real work.
- **Only Investicija rows feed budgets.** Građenje is a breakdown of the single `Građenje` line —
  in both real workbooks its `SVEUKUPNO` equals that line exactly — so counting it too would
  double the largest item in the plan.

`phase_classification_budgets` is replaced wholesale on each sync rather than merged: the TIC is
the only author, so a row it no longer contains no longer exists. There are deliberately **no
client-side write helpers** for that table.

#### Two dimensions on a line item

Each Investicija row carries two optional fields beyond its amounts:

- **`classification_id`** — which cost classification the money belongs to, so the TIC can drive
  `phase_classification_budgets`. Seeded from `ticClassificationMap.ts` for the 16 canonical row
  names and editable per row, so a project that files Konzalting under preparation rather than
  control just changes it there. A row left unmapped shows as *unmapped* and contributes to no
  classification. **The defaults are mirrored in the backfill in migration `20260909130000`;
  change the two together.**
- **`phases`** — `[{ phase_number, vlastita, kreditna }]` when the cost is spread across phases,
  **absent when it is incurred once for the whole project**. That distinction is not cosmetic:
  in `1908_TIC_Osijek.xlsx` "Vrijednost zemljišta" prints its full 4.000.000 against each of
  three phase columns, and summing those would invent 8.000.000 of budget. An unphased line is
  shown as "—" in each phase column and counted once in the project total.

A TIC with no phased line at all is *unphased* and describes one undifferentiated project.

#### Editing the phase split

Phases used to arrive only from an Excel import; they are now authored on the screen itself.

- **Add phase** (under the Investicija table) appends a column. A column no row has an amount in
  lives only in `useTIC`'s `phaseColumns` — it is somewhere to type, and the database never hears
  about it.
- **Clicking a phase cell** opens `PhaseSplitModal` for that row: the choice between *project-level
  cost* and *split across phases*, a `vlastita`/`kreditna` pair per phase, a **Split evenly** helper
  that gives the rounding remainder to the last phase, and a live comparison of the split against
  the row it divides.
- **Removing a phase** (the bin in the column header) takes it out of every row and renumbers the
  ones after it, behind a confirm dialog.

Two rules the editor is built around:

- **The ordinals stay contiguous.** `sync_project_from_tic` counts the phases a TIC names and then
  deletes every project phase numbered above that count — so a TIC naming phases 1 and 3 would
  create phase 3 and delete it in the same call. Removing a phase renumbers, and `saveTIC` runs
  `normalizePhaseNumbers` over the rows before they reach the database, which closes a gap an
  imported sheet (a missing `FAZA 2` column) could still open.
- **A mismatch is shown, never reconciled.** Editing a row's own funds after splitting it pulls the
  two apart; `hasPhaseSplitMismatch` puts a warning next to the row total and the modal spells out
  the difference. Neither side is corrected automatically, because only the author knows which of
  the two is wrong — the same stance the importer takes with a sheet whose columns do not add up.

Clearing a split drops the `phases` key entirely rather than storing an empty array or zeros: a
zeroed split reads as "planned at nothing", which is not what "not attributed to a phase" means.

#### Services

### ticService.ts
- `fetchTICProjects()` — fetches projects (id, name) for the TIC project selector
- `fetchTICForProject(projectId)` — fetches the saved TIC cost structure for a project (or null); `construction_sections` defaults to `[]` for records saved before the Građenje tab existed
- `createTIC(payload)` — inserts a new TIC cost structure, returns the new id
- `updateTIC(ticId, payload, projectId)` — updates an existing TIC cost structure
- **Depends on:** supabase client, activityLog

### ticImport.ts
- `parseTICWorkbook(sheets)` — pure parser mapping a workbook's sheets onto the two tabs; returns `{ investment, construction, investorName, documentDate, errors }`
- `parseSheet(sheetName, rows)` — parses one sheet, throwing `missing_header` / `no_rows`
- `parseTICFile(file)` — browser entry point; dynamically imports `@e965/xlsx` and delegates to `parseTICWorkbook`
- Parsing is **layout-driven, not column-index-driven**: the header row is found by looking for `NAMJENA`, and the money columns by looking for `VLASTITA SREDSTVA`. This absorbs the one-column offset between the two sheets. A gap of ≥2 columns between the two headers marks the sheet as hierarchical.
- Blank spacer rows are skipped; `Ukupno` / `SVEUKUPNO:` rows are discarded (recomputed); names are trimmed. Percentage columns are ignored.
- Sheets are matched by name (`INVESTICIJ*` / `GRAĐENJ*`, diacritic-insensitive), falling back to the detected shape, so renamed and single-sheet files still import.
- **Depends on:** `@e965/xlsx` (dynamic import), `src/utils/excelParsers.ts` (`parseNumber`, `parseDate`)

### ticExport.ts
- `exportToExcel(data: TICExportData)` — async; writes a real `.xlsx` with two sheets (`INVESTICIJA`, `GRAĐENJE`) laid out in the source workbook's shape, so an export re-imports cleanly (covered by `ticExport.test.ts`)
- `exportToPDF(data: TICExportData)` — two-page landscape A4 PDF, one page per tab; row height is derived from the row count so a long Građenje breakdown is not clipped
- `buildInvestmentSheet(data)` / `buildConstructionSheet(data)` — pure AOA builders, exported for the round-trip test
- **Depends on:** `@e965/xlsx` (dynamic import), jsPDF, activityLog
- _Note: this previously emitted an HTML table blob named `.xls`, which the docs already described as `.xlsx`; it now genuinely is `.xlsx`._

#### Hooks

### useTIC.ts
- `useTIC()` — loads projects and the selected project's line items **and construction sections**, manages edits/investor/date, computes both tabs' totals, applies Excel imports, and saves (create or update)
- **Calls:** ticService.ts
- **Uses utils:** ticFormatters (calculateTotals, calculateConstructionTotals, toRomanNumeral, toSectionCode)
- **Returns:** projects, lineItems, constructionSections, investorName, documentDate, selectedProjectId, loading, saving, message, totals, grandTotal, constructionTotals, constructionGrandTotal, `isDirty`, saveTIC, `applyImport`, and the row/section/phase mutators (`addLineItem`, `updateLineItem`, `removeLineItem`, `moveLineItem`, `setLineItemPhases`, `addPhase`, `removePhase`, `addSection`, `updateSection`, `removeSection`, `moveSection`, `addConstructionItem`, `updateConstructionItem`, `removeConstructionItem`, `moveConstructionItem`)
- `isDirty` compares a serialized snapshot of the four saved fields against the baseline taken on load and re-taken on save — what the screen arms the unsaved-changes guard from
- `saveTIC()` resolves `true` on success and `false` on failure. The boolean is not for the Save button but for the guard's "save and leave", which must not navigate away from a save that failed; the error message on screen is still `saveTIC`'s own doing
- `applyImport(parsed, fileName)` replaces the on-screen tables only and logs `tic.import_excel`; nothing reaches the database until the user presses Save

#### Constants

### constants.ts
- `defaultLineItems` — the 16 default Investicija rows (moved out of `useTIC.ts`)
- `defaultConstructionSections` — the 3 default Građenje sections (28 items) from the standard workbook

#### Utilities

### ticFormatters.ts
- `formatNumber(num)` — formats a number for TIC display (hr-HR, no decimals)
- `formatPercentage(num)` — formats a percentage for TIC display (hr-HR, 2 decimals)
- `calculateRowPercentages(value, total)` — computes a value's percentage of a total (0 when total is 0)
- `calculateTotals(lineItems)` — sums vlastita and kreditna across line items
- `calculateSectionTotals(section)` — one Građenje section's `Ukupno` row
- `calculateConstructionTotals(sections)` — the `SVEUKUPNO:` row across all sections
- `toRomanNumeral(n)` / `toSectionCode(i)` — next numeral/code when appending an item or section
- Types: `LineItem`, `ConstructionItem`, `ConstructionSection`, `TICTotals`, `LineItemPhaseAmount`
- `LineItem` carries the optional `classification_id` and `phases` described above; an absent or
  empty `phases` means the line is **not** phased, never "phased with nothing in it"

### ticBudget.ts
Pure derivation of everything the budget sync and the TIC screen display. All tested against the
real Savska Opatovina and Osijek figures in `ticBudget.test.ts`.
- `lineItemTotal(item)` / `ticGrandTotal(items)` — vlastita + kreditna, per row and overall
- `totalsByClassification(items)` — `{ byClassification: Map, unmapped, total }`; what the phase
  budgets are populated from
- `isPhased(item)` — whether a line carries per-phase amounts at all
- `phaseTotals(items)` — `{ byPhase: Map, notPhased }`; `notPhased` is the money that belongs to
  the project but to no single phase, and is the only thing explaining why the phase budgets stop
  short of the project total
- `lineItemPhaseTotal(item, n)` / `phaseClassificationTotals(items)` / `budgetMatrix(items, order)`
- `remainingFromTIC(planned, committed)`
- `phaseSplitCheck(item)` / `hasPhaseSplitMismatch(item)` — whether a row's split still adds up to
  the row, to a cent's tolerance; an unphased row is never a mismatch
- `ticPhaseCount(items)` — the highest ordinal used, so a phase left empty in the middle still counts
- `normalizePhaseNumbers(items)` — closes a gap in the ordinals, returning the same array by
  identity when there is none. Guards `sync_project_from_tic`, which deletes every project phase
  numbered above the count of phases the TIC names

### ticClassificationMap.ts
- `defaultClassificationForLine(name, classifications)` — canonical row name → seeded classification
- `applyDefaultClassifications(items, classifications)` — stamps the defaults onto rows that have
  none, which is what stops an Excel import from emptying the mapping
- `CANONICAL_TIC_LINE_NAMES` — the 16 names the defaults cover

#### Modals

### PhaseSplitModal.tsx
- Edits one investment row's per-phase split: project-level vs phased, a `vlastita`/`kreditna` pair
  per phase, **Split evenly**, and the split compared against the row it divides
- Kept out of the table because a split is two figures per phase — inline, three phases would add
  six inputs to every row
- **Uses utils:** ticFormatters, ticBudget
- **Uses Ui:** Modal, Button, Input, Alert

### ExcelImportTICModal.tsx
- 3-step wizard (upload + format help → preview → summary) following `Sales/SalesProjects/modals/ExcelImportGaragesModal.tsx`
- The preview names which sheet mapped to which tab, lists skipped sheets with their reason, and warns that the import replaces both tables
- **Uses services:** ticImport
- **Uses Ui:** Modal, Button, Alert

#### Views

### index.tsx (TICManagement)
- Project selector, tab switcher, Save / Import Excel / Export Excel / Export PDF toolbar, and the shared investor/signature/date footer
- Both exports run through `useAsyncExport` (`src/hooks/useAsyncExport.ts`), which owns the
  per-button `loading` flag and toasts `tic.export_error` on failure. The Excel export used to
  swallow its error in a `catch` that only reached the console, and the PDF button called the
  synchronous `exportToPDF` with no `try/catch` at all — a throw took the click with it and left
  the button looking idle
- **Uses hooks:** useTIC, useAsyncExport
- **Uses services:** ticExport
- **Uses components:** InvestmentTable, ConstructionTable
- **Uses modals:** ExcelImportTICModal
- **Uses Ui:** LoadingSpinner, Button, FormField, Select, Input, Alert, Card, EmptyState, Tabs
- Arms the app-wide unsaved-changes guard (`useUnsavedChanges(isDirty, saveTIC)`, see `docs/UI.md`)
  and puts the project selector behind it, because switching project reloads both tables over the
  top of whatever is on screen. Handing it `saveTIC` is what gives the dialog its **Spremi i izađi**
  button

### components/InvestmentTable.tsx, components/ConstructionTable.tsx
- Presentational tables — they take items plus handlers as props and never touch Supabase
- Per-row controls: move up / move down / delete, with an "Add row" (and "Add section") button
- `ConstructionTable` confirms section deletion via `ConfirmDialog` because it removes the section's items too
- `InvestmentTable` owns the phase columns: a bin per column header (confirmed, because it clears
  that phase from every row and renumbers the rest), an "Add phase" button, phase cells that open
  `PhaseSplitModal`, and a warning beside the row total when a split no longer adds up

---

## Language, dates and enums (September 2026 i18n sweep)

- **Nothing in this module formats a date itself.** `formatDate` / `formatMonthYear` from
  `src/utils/formatters.ts` take `i18n.language` explicitly: `05.01.2026.` in Croatian,
  `Jan 05, 2026` in English. That covers the twelve sites that were split between English
  `'MMM dd, yyyy'` (Projects, `InvestmentProjectModal`, Payments, `PaymentSchedulePreview`) and a
  hardcoded Croatian `'dd.MM.yyyy'` (Investments, `CreditFacilityCard`, `CreditSummary`) — the
  latter never showed an English month but also never followed the language switcher. `date`
  columns are passed as strings so `parseLocalDate` keeps them on the day they say.
- **Risk and project status come from `src/utils/statusDisplay.ts`.** `Projects/index.tsx` read
  "**High Rizik**" (raw enum then the word "Rizik") and now reads "Rizik: Visok"; the project
  status badge beside it and `InvestmentProjectModal`'s risk row use the same maps. The **stored
  value stays English** and is still what the code compares against — only the label is mapped.
- **Hook toasts are translated.** The fourteen English `toast.warning` / `toast.error` strings in
  `useBankData`, `useCreditForm` and `useEquityForm` are keys under `funding.investors.error_*`
  and `funding.equity_form.*`. `useEquityForm` gained `useTranslation` for this.
- **`bankPaymentsService` returns `null`, not an English placeholder.** `bank_name` and
  `project_name` were `'Unknown Bank'` / `'No Project'`; the table labels the gap with
  `funding.investments.unknown_bank` and `common.no_project`, and the CSV writes an empty cell.
- **Two things are deliberately still English and should not be "fixed" here:**
  `equityService.createEquityInvestment` writes `credit_name: "Equity Investment <MMM yyyy>"` — a
  **stored** column, not a display string, so translating it would make the data depend on whoever
  created the row; and `Funding/TIC/**` is hardcoded **Croatian** domain vocabulary (cost
  classifications, sheet headings), which is a convention gap rather than a user-visible bug and
  belongs to a later batch. `ticExport.ts` is frozen anyway — `ticImport.ts` reads its output back.
- `CreditFormModal`'s `e.g., Kozara Construction Loan 2024` placeholder is left in English: the
  example is a business call, per the sweep's rule on ambiguous strings.

---

## Notes
- Shared investment TypeScript types live in `src/types/investment.ts`
- `lib/Deleted/` contains old credit components that were refactored into this module — do not restore
- All delete confirmation dialogs use `ConfirmDialog` from `src/components/ui/` via the pending-item hook pattern — never use `window.confirm()` or `confirm()`
- Architecture follows UI Component → Custom Hook → Service Layer → Supabase. The May 2026 audit refactor extracted Supabase query logic out of hooks into dedicated `services/*.ts` files; hooks own state and call the services
- There are two distinct `creditService.ts` files: `Investments/services/creditService.ts` (credit list, allocations, credit invoices) and `Investors/services/creditService.ts` (facility CRUD + company bank accounts)
- The audit refactor also lowercased the `Modals/`→`modals/` and `Services/`→`services/` directories in Payments, Projects, and TIC
- Pure calculation/formatting helpers have colocated unit tests: `Investors/utils/creditCalculations.test.ts`, `TIC/utils/ticFormatters.test.ts`, `TIC/services/ticImport.test.ts` and `TIC/services/ticExport.test.ts` (the last verifies an Excel export re-imports byte-for-byte)
- All service mutations log via `logActivity()` (fire-and-forget)
- **Failed loads are not empty states.** Investments, Investors and Payments expose `error` + `refetch` and render `ErrorState` (from `src/components/ui`) in the content area with the page header kept mounted; money tiles fed by a failed read are withheld rather than shown as €0. `useTIC` was left as it is: it already reports both load failures through its own on-screen message banner, and `loadClassifications` documents why it tolerates a failure (the classification column falls back to "unmapped", which is visible and recoverable). `Projects/index.tsx` moved onto `useCachedData` (ErrorState + retry, EmptyState for a real empty list) and `useLazySection` gained `error` + `retry`, so `CreditInvoiceSection` shows a compact `ErrorState` instead of caching a failure as "(0)". `AllocationRow.tsx` still fetches inline and is what is left of the deferred in-component set
- **Deleting a credit facility or an investor detaches invoices first.** `accounting_invoices.bank_credit_id` is the only `ON DELETE RESTRICT` reference to `bank_credits`, so a bare delete fails with Postgres `23503` whenever an invoice is attached (and, for investors, aborts the `bank_credits` cascade). `creditService.detachInvoicesFromCredits()` clears the FK — the invoices are kept, only unlinked — and both delete paths call it before deleting. The confirmation dialog reports the count via `countInvoicesForCredits()`, and the hooks fall back to `isForeignKeyViolation()` from `src/lib/dbErrors.ts` for a readable toast if some other constraint blocks the delete
