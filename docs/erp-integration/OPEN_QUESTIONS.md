# Open questions

> **2026-08-31 — the two blockers are gone.** Accounting confirmed cost centres
> will be booked and OIBs populated, and confirmed we choose the export format.
> Q1, Q2, Q3, Q9 and Q11 are closed; the importer now consumes invoice-shaped
> feeds rather than reconstructing them from the ledger.

Status: 🔴 blocking · 🟡 needed soon · 🟢 nice to have · ✅ answered

Most of these need **accounting**, not code. Ordered by how much they hold up.

---

## ✅ Closed 2026-08-31

Cost centres and OIBs will be entered. We choose the export format, so the
feeds are defined in SPEC.md §4–§5 rather than discovered. Outgoing invoices
are part of that contract via the `direction` column.

<details><summary>Original wording</summary>


### ✅ Q1 — Will cost centres (`MjTr`) start being booked?
`MjTr` is empty in all 76 sampled postings, as are the `D1`–`D3` analytical
dimensions. Automatic project assignment was to come from the cost centre.
Without it every imported invoice lands in the review queue with no project,
and manual classification becomes permanent rather than exceptional.

Options, best first:
1. Accounting starts booking one cost centre per project. Much the best
   outcome and cheap if adopted before the ledger grows — but it changes their
   daily routine and cannot be imposed from here.
2. Derive the project from the account, if the chart is subdivided per project
   (see Q3).
3. Manual project assignment forever.

**This is the most important question in the project.** Until it is settled the
value of the whole integration is capped: invoices import, but they do not
reach projects on their own. *Owner: accounting.*

### ✅ Q2 — Can we get a *komitenti* (partners) export?
The GL export identifies partners only by an internal numeric `Kom.` id plus a
name — **there is no OIB anywhere**. Without a partner list carrying
`Kom.` → OIB, name and IBAN, no invoice can be attributed to a supplier at all.
*Owner: accounting.*

### ✅ Q12 — Where are outgoing invoices?
No `IRA`/`IFA` rows in the sample; it appears to be supplier-side only. Sales
invoices must come from the ERP, so we need this feed, and confirmation that
apartment buyers appear as partners. *Owner: accounting.*

</details>

## 🟡 Needed soon

### Q11 — Can 4D Wand export the URA/IRA books directly?
The books are already invoice-shaped, unlike the GL. This would remove the
document-reconstruction logic entirely — **the single largest simplification
available**, and worth asking before that code is written. *Owner: accounting.*

### Q3 — Is the chart of accounts subdivided per project?
`0572 Ulaganja u građevine u izgradnji` (capitalised construction cost) hints
that it might be. If so it is a fallback route to project assignment (Q1
option 2). The sample is too small to tell. *Owner: accounting.*

### Q4 — How are kompenzacija and cesija posted?
As `IZV` lines, or as separate journals? Neither appears in the sample, and
both are first-class concepts in Cognilion with their own columns and trigger
logic. *Owner: accounting.*

### Q9 — CSV rather than XLSX, with the §3 conventions?
The sample is `.xlsx`. CSV is preferable: no cell-type coercion, no Excel
date/timezone drift (sample dates arrive as `2026-08-20T22:00:00Z`, shifted a
day by the local offset), and trivially diffable for the snapshot comparison.
We can choose the format — confirm 4D Wand can emit it. *Owner: us + accounting.*

### Q10 — Is the export windowed and repeatable?
A full snapshot of a rolling window is needed, not a hand-picked date range
someone re-selects each time. *Owner: accounting.*

### Q13 — Why does the base/VAT split not match the nominal rate?
6.77 against 0.81 on the 13% account. Presumably partial deductibility, but it
needs confirming, because it determines whether imported VAT can be validated
at all. See [DECISIONS.md](./DECISIONS.md) D8. *Owner: accounting.*

### Q8 — Advance invoices (`UFB`) — how should they surface?
They have no contract or milestone, and konto 1250/1251 is a receivable rather
than a cost. *Owner: us.*

## 🟢 Nice to have

### Q5 — Do bank fees and loan interest carry a credit-facility identifier?
`4650 Troškovi platnog prometa` appears, but nothing ties it to a facility.
Without one, the `bank_credits` link stays manual forever. *Owner: accounting.*

### Q6 — What do the journal (`Nal.`) numbers mean, and are they stable?
The sample has 5 (UFA), 6 (UFB), 7 (IZV), 8 (PDV). If that is a convention
rather than coincidence it is a cheap routing signal. *Owner: accounting.*

### Q7 — Can the export carry a control total per run?
Would make the reconciliation in SPEC §11 far stronger. *Owner: accounting.*

## Product decisions for us

### Q14 — Do buyer payments for apartments come from the ERP too? 🔴
Outgoing sales invoices will. If payments follow, `sales.total_paid` and
`remaining_amount` become derived and the Sales payments UI goes read-only —
consistent, but it widens the rewrite into the Sales module. If they do not,
the same money is recorded in two places and will drift.

**Not yet decided**, and it materially changes the scope of the Sales work.
Needs settling before phase 3. *Owner: us.*

*Update 2026-09-30 (`fix/defect-backlog`):* the Sales payments screen is already
read-only — buyer payments are entered in Cashflow — and every apartment-level
screen now reads "paid" as the payments on the apartment's `OUTGOING_SALES`
invoices. `sales.total_paid` / `remaining_amount` are documented as a snapshot at
sale time. So if payments come from the ERP, Sales needs no further change beyond
someone linking the imported invoices to the apartment (`apartment_id` stays
manual).

### Q15 — Export cadence? 🟡
Drives the staleness-alarm threshold and how fresh dashboards actually are.

### Q16 — How far back does the historical import go? 🟡
Determines the phase 4 cutover window.

### Q17 — Which in-app money records survive once the ERP feeds bank movements? 🟡
The derived bank balance (and, until phase 6, the only balance) would count some
money twice:
- A credit flagged **"disbursed to account"** adds its full amount to the account
  (`recalc_company_bank_account_balance`). If the ERP books the drawdown as a payment
  on an `OUTGOING_BANK` invoice into the same account, it counts twice.
- An **intercompany transfer** (`company_loans`, Cashflow ▸ Pozajmice) moves both
  accounts. The same transfer arrives from the ERP as bank payments.

Likely answer: `disbursed_to_account` keeps setting the credit's own used/outstanding
figures but stops moving the balance, and `company_loans` becomes a record of the
loan that no longer moves balances — both once ERP payments are flowing. Needs
confirming with accounting how 4D Wand books drawdowns and transfers.
Found in the September audit (KNOWN_ISSUES.md §2; DEFECT_BACKLOG CASH-9, FUND-8).
*Owner: us + accounting.*

### Q18 — Bank accounts: created by hand or from the ERP? 🟡
BANK payments and the `bank_balances` feed are matched by IBAN, and no screen
captures `company_bank_accounts.account_number` (KNOWN_ISSUES ERP-5). Since bank
account management moves to the ERP, the proposal is to create or match accounts
from the `bank_balances` feed (company by OIB, account by IBAN) instead of adding an
IBAN field to the company form; the form's balance fields go in phase 5 anyway.
*Owner: us.*

### Q19 — Is `INCOMING_INVESTMENT` money in or money out? ✅
**Answered 2026-10-05: always money out.** The app now reads one map
(`src/utils/invoiceCashDirection.ts`); `company_statistics` follows in migration
`20261005110000` (not yet applied). The income/expense view's treatment of the
bank-credit types is still open (DEFECT_BACKLOG CASH-7). Original question:

The resolver reads `INCOMING` as a received bill, so an `INCOMING_INVESTMENT` from an
investor partner is a payable — money out when paid. The balance trigger and the
payments list agree; the Accounting dashboard and the general report count it as
money in, and `company_statistics` counts it as income. Proposal: cash-flow screens
use the prefix rule (`OUTGOING_*` in, `INCOMING_*` out) and the income/expense view
leaves out the bank-credit types. Confirm with accounting what an investment invoice
represents before changing (DEFECT_BACKLOG CASH-7). *Owner: us + accounting.*

### Q20 — Where do overhead costs go? 🟢
Every invoice line needs a cost centre mapped to exactly one project (KNOWN_ISSUES
ERP-9). Office rent, accounting fees and other company-level costs have no project.
Options: allow a cost centre to map to "no project" (the invoice imports with
`project_id` null), or keep a per-company overhead project. The first matches how
the in-app office invoices work today. *Owner: us.*

---

## ✅ Answered by the sample export

- **Header or line-level booking?** Line level — and more than that, a full
  general ledger. One invoice is several postings.
- **Can one payment settle several invoices?** Yes. A 235.54 transfer settles
  six in the sample.
- **Does 4D Wand expose bank statements?** Yes, as `IZV` journals.
- **Are storna identifiable?** Yes, as negative postings.
- **Is payment status available?** Yes — `Otvoreno` on the liability line, so
  it comes free with the invoice feed rather than being derived from payments.
