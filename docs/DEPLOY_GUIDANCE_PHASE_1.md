# Deploy checklist — user guidance phase 1 and the CASH-7 fix

**Branch:** `feat/user-guidance-phase-1` · **Written:** 2026-10-05 · **Production figures measured read-only the same day**

Production (`Landmark`) has migrations applied up to `20260917100000`. Eight in the repo are not
applied there: five from `fix/defect-backlog` (merged to `development` in PR #46) and three from
this branch. Nothing here has been applied anywhere by this work.

Re-run the counts before release if time has passed: every "what moves" number below is a
snapshot.

## 1. Order of work

1. Merge the branch and build the frontend from it.
2. Apply the migrations in the order of section 2 (file-name order). `supabase db push` does this;
   **check which project the CLI is linked to first** — it is normally linked to `LandmarkDev`.
3. Deploy the frontend straight after the migrations, not hours later (section 3 says why).
4. Deploy the `ai-chat` edge function so the assistant gets the rebuilt help index
   (`supabase/functions/_shared/help-kb-index.json`).
5. Run the checks in section 5.

## 2. Migrations, in order

| # | File | What it does | What users see |
|---|---|---|---|
| 1 | `20260930100000_security_hardening` | Removes blanket "any signed-in user" write policies on 18 tables and replaces them with role policies; makes the `chat-attachments` bucket private; stamps the real user on every activity-log row; stops anonymous reads of the user roster; maintains `project_phases.budget_used` by trigger | Actions a role should never have had stop working (the UI already hides most of them). Chat images load through signed links |
| 2 | `20260930100100_auth_user_created_trigger` | Recreates the `auth.users` → `handle_new_user()` trigger, which production already has but no migration recorded | Nothing |
| 3 | `20260930100200_sales_price_and_sale_rpc` | Trigger keeping `price_per_m2 = price / size` on apartments, garages and storage units, with a backfill of rows where it was 0; new `complete_apartment_sale()` RPC that records a sale in one transaction | Units that showed €0/m² show a real figure. "Complete sale" is all-or-nothing |
| 4 | `20260930100300_cashflow_balances_and_stats` | One bank-balance formula that also counts credits disbursed to an account; `reset_company_bank_account_balance()` RPC; backfill of opening balances that only existed in `current_balance`; invoice statistics matching the invoice list; Directors can manage invoice categories | Invoice counts above the list match the rows. A bank balance can change the next time that account is recalculated (see section 4) |
| 5 | `20260930100400_funding_rename_and_tic_writes` | Drops a trigger that made renaming an investor fail; TIC can be saved by Director, Accounting and Investment only; the budget sync runs with owner rights | Renaming an investor works. Accounting and Investment can save a TIC; Sales no longer can |
| 6 | `20261005100000_activity_log_exclude_prefix` | Adds an optional "exclude this action prefix" parameter to `get_activity_logs` (the function is dropped and recreated) | Activity Log hides help-usage events by default and shows a checkbox to include them |
| 7 | `20261005110000_company_statistics_incoming_investment_expense` | `company_statistics`: ULAZNI (INV) moves from income to expense | Nothing today — production has no such invoices |
| 8 | `20261005120000_company_statistics_cash_direction` | `company_statistics`: income is every outgoing invoice type, expense every incoming one. Moves credit drawdowns from expense to income | Companies cards change — section 4 |

## 3. Which migrations depend on which frontend

| Migration | Old frontend + new database | New frontend + old database |
|---|---|---|
| 1 security hardening | **Chat attachments break**: the old client shows public URLs of a bucket that is now private | Works, but the gaps stay open |
| 2 auth trigger | Fine | Fine |
| 3 sales | Fine | **"Complete sale" fails**: the client calls an RPC that does not exist |
| 4 cashflow | Fine | **Balance reset on the Companies screen fails** (missing RPC) |
| 5 funding | Fine | TIC saves keep failing for Accounting and Investment, as today |
| 6 activity log | Fine | Fine: the page falls back to the old call and hides the checkbox |
| 7, 8 company statistics | Companies cards change (section 4) | Fine: the cards keep the old classification |

So: migrations 2, 5, 6, 7 and 8 are safe on their own at any time. 3 and 4 are safe to apply
early. Migration 1 must go out together with the frontend. None of the five September migrations
needs this branch; this branch needs none of them beyond what `development` already needs.

## 4. Figures that will move for real data

Tell users about these before release. Amounts are production totals on 2026-10-05.

### Cashflow calendar — as soon as the frontend is deployed

Credit fees are now counted. They were left out of both monthly sums.

- 40 credit-fee invoices, spread over 15 months (January 2025 – October 2026 by due date).
- **"Ulazni računi (plaćeno)"**: +€161.767,05 in total across those months
  (all months together: €3.557.860,43 → €3.719.627,48).
- **"Ulazni računi (neplaćeno)"**: +€66.487,85 (€8.171.208,92 → €8.237.696,77).
  Months with unpaid fees: 2025-01, 2026-01, 2026-02, 2026-10.
- **"NETO"** drops by the paid amount in each affected month, and **"Razlika od budžeta"** moves
  with it, because the monthly budget is compared with incoming paid.

### General report, cash-flow section — as soon as the frontend is deployed

The table is now two tables, **Poslovne aktivnosti** and **Financijske aktivnosti**, plus a total.
Credit drawdowns, repayments and credit fees used to be absent; they are now under financing.

| All payments to date | Before | After |
|---|---|---|
| Operating inflow / outflow | €125.000,00 / €3.807.870,43 | unchanged |
| Financing inflow (drawdowns) | not shown | €4.522.708,80 |
| Financing outflow (repayments, fees) | not shown | €267.150,61 |
| Net | −€3.682.870,43 | +€572.687,76 |

A report covers a date range, so a given report shows only its months. In 2026 so far there is one
financing payment, a €100.000,00 drawdown. The latest payment in production is dated 2026-03-12,
so a report for April–September 2026 is empty before and after. The two charts above the table
plot the total net and move accordingly.

### Companies screen — only after migration 8

"Plaćeno" (income and expense tiles), **"Promet"**, **"Dobit/Gubitak"** and the two "Neplaćeno"
lines change for the three companies that have credit drawdowns:

| Company | Drawdowns moved from expense to income | Of which paid | Unpaid |
|---|---|---|---|
| B-Mark d.o.o. | €750.000,00 (2 invoices) | €750.000,00 | — |
| Bio4you d.o.o. | €600.000,00 (1) | €600.000,00 | — |
| Landmark group d.o.o. | €3.517.708,80 (11) | €3.172.708,80 | €345.000,00 |

For each: income paid rises and expense paid falls by the "paid" amount, so **"Dobit/Gubitak"
rises by twice that amount**; "Promet" rises by the invoiced amount; "Neplaćeno (prihod)" rises
and "Neplaćeno (rashod)" falls by the unpaid amount. Across all 14 companies:

| | Before | After |
|---|---|---|
| Income invoiced ("Ukupan promet") | €127.813,76 | €4.995.522,56 |
| Income paid | €125.000,00 | €4.647.708,80 |
| Expense invoiced | €17.180.426,61 | €12.312.717,81 |
| Expense paid | €8.756.047,84 | €4.233.339,04 |

**Decide before applying migration 8:** the screen still says "Promet" and "Dobit/Gubitak". After
the migration those are cash received and net cash, and include loans drawn. Either reword the
labels first, or hold migration 8 back — 7 can go without it.

### Bank balances — after migration 4, gradually

The new formula adds credits flagged "disbursed to account". The migration does not recalculate
every account; a balance changes the next time something is posted to that account. After
applying, run the query at the end of that migration file to list accounts whose opening balance
may already have been lost, and correct them on the Companies screen.

### What does not move

- ULAZNI (INV): production has no invoices of this type, so the Accounting dashboard, Director
  dashboard, General report expenses, VAT card and invoice colours show the same figures as before.
- What counts as a **cost** is unchanged and still being confirmed with accounting: supplier,
  office and ULAZNI (INV) invoices. Credit fees and repayments are not costs (CASH-7, open).

## 5. Other visible changes to mention

- A **"?"** in the top bar opens the new **Pomoć** page; a "?" beside a page title opens that
  page's guides in a new tab; small "?" hints sit on Budget Control, the invoice Tip column, both
  payment forms, TIC and credit allocations.
- **Cashflow profile** is offered only to Director and Accounting. Other roles no longer see it in
  the profile list.
- **Apartment import**: instructions corrected, a template can be downloaded, and a date typed
  into an amount column (U–Z) now rejects the row with a message naming the column.
- **Retail invoice form**: "Kupac" can be chosen only for an outgoing invoice.
- Invoice details show "Djelomično" where they showed "Djelomično plaćeno"; the calendar and
  payment details use the same invoice-type wording as the invoice form.
- Strings awaiting sign-off: [GUIDANCE_PHASE_1_REVIEW.md](./GUIDANCE_PHASE_1_REVIEW.md). Help
  article corrections proposed there are **not** applied.

## 6. Checks after release

- [ ] Chat: an old image attachment and a new one both display.
- [ ] Sales: complete a sale on a test apartment, then confirm the unit, the sale and the buyer.
- [ ] Companies: open a company, reset a balance, confirm it holds after a payment is added.
- [ ] Companies cards for B-Mark, Bio4you and Landmark group match the table above (after migration 8).
- [ ] Cashflow calendar, November 2025: seven credit-fee invoices are in "Ulazni računi (plaćeno)".
- [ ] General report for 2025: the financing table shows drawdowns and fees; totals add up.
- [ ] Activity Log: help events hidden; the checkbox shows them.
- [ ] Sign in as a Sales user: no Cashflow in the profile list; the "?" on Budget Control opens its guide.
- [ ] Ask the assistant "što je cesija" and confirm it answers from the article.
