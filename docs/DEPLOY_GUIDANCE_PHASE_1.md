# Deploy checklist — user guidance phase 1 and the CASH-7 fix

**Branch:** `feat/user-guidance-phase-1` · **Written:** 2026-10-05 · **Production figures measured read-only the same day**

> ## State on 2026-10-06 — read this first
>
> **Eight migrations were pushed to production on 2026-10-06, before the frontend.** `supabase db
> push` was run from `feat/user-guidance-phase-1` with the CLI linked to production (`Landmark`).
> Applied there now: the five `20260930…` migrations and `20261005100000`, `…110000`, `…120000`.
> LandmarkDev has the same eight. LandmarkDemo has none of them.
>
> What that means until the new frontend is live:
>
> - **Chat attachments do not load in production.** `20260930100000` made the bucket private and
>   the frontend on `main` still asks for public links. Deploying the new frontend fixes it; so
>   does making the bucket public again in the meantime (a decision, not done).
> - Everything else the old frontend does still works: the other changes are additive or tighten
>   rights the UI already hides.
>
> **Not applied anywhere yet**, and needed by the code now on this branch:
> `20261001100000`–`20261001100300` (from `fix/backlog-batch-2`, PR #48) and
> `20261006100000_company_statistics_final`. They sort *before* migrations already applied, so a
> plain `supabase db push` refuses them — it needs `--include-all`. `20261001100000` carries a
> guard so it does not fail on a database that already has the newer view.
>
> `main` also carries a revert of this branch (PR #49 merged by mistake, reverted in PR #51). When
> `development` is merged to `main`, **revert that revert first**, or Git will leave this
> branch's changes out.

Sections 1 to 3 below describe the release as it was planned. Section 2 lists all thirteen
migrations; the "applied" column says where each one stands today.

## 1. Order of work from here

1. Merge `feat/user-guidance-phase-1` into `development` (the conflicts with PR #48 are resolved
   on the branch). Build the frontend from the result.
2. With the CLI linked to the target project — **check `supabase/.temp/project-ref` first** — run
   `supabase db push --include-all`. On production and LandmarkDev that applies the five
   remaining migrations; on a fresh project, all of them in order.
3. Deploy the frontend immediately after, in the same sitting.
4. Deploy the `ai-chat` edge function so the assistant gets the rebuilt help index.
5. Run the checks in section 6.

> **Never apply `20260930100000_security_hardening` without its frontend.** It makes the chat
> attachments bucket private. That is what happened to production on 2026-10-06.

## 2. Migrations, in order

| # | File | What it does | Applied (prod / dev) |
|---|---|---|---|
| 1 | `20260930100000_security_hardening` | Role policies on 18 tables; chat attachments bucket private; activity-log rows stamped with the real user | yes / yes |
| 2 | `20260930100100_auth_user_created_trigger` | Recreates a sign-up trigger production already had | yes / yes |
| 3 | `20260930100200_sales_price_and_sale_rpc` | Price per m² kept in step; one-transaction "complete sale" | yes / yes |
| 4 | `20260930100300_cashflow_balances_and_stats` | One bank-balance formula; balance-reset function; invoice counts match the list | yes / yes |
| 5 | `20260930100400_funding_rename_and_tic_writes` | Investor rename fixed; TIC saves for Director, Accounting, Investment | yes / yes |
| 6 | `20261001100000_company_statistics_direction` | PR #48: view respects RLS (`security_invoker`); its own income/expense lists. Guarded: skips its view definition where the newer one exists | **no / no** |
| 7 | `20261001100100_credit_monthly_debt_service` | PR #48: `monthly_payment` under the equal-principal repayment model | **no / no** |
| 8 | `20261001100200_phase_budget_used_contract_status` | PR #48: completed and terminated contracts count against the phase budget | **no / no** |
| 9 | `20261001100300_seed_izvodaci_document_category` | PR #48: seeds a document category if missing | **no / no** |
| 10 | `20261005100000_activity_log_exclude_prefix` | Activity Log can hide help-usage events | yes / yes |
| 11 | `20261005110000_company_statistics_incoming_investment_expense` | ULAZNI (INV) from income to expense | yes / yes |
| 12 | `20261005120000_company_statistics_operating_only` | Income and expense are operating types only; two financing columns | yes / yes |
| 13 | `20261006100000_company_statistics_final` | The view's final definition: migration 12's lists and columns **with** migration 6's `security_invoker` | **no / no** |

Right now production and LandmarkDev have the view from migration 12 **without** `security_invoker`
— as it was before any of this, so no new exposure, but the RLS fix from PR #48 is not in effect
until 13 is applied.

## 3. Which migrations depend on which frontend

| Migration | Old frontend + new database | New frontend + old database |
|---|---|---|
| `20260930100000` security hardening | **Chat attachments break**: the old client shows public URLs of a bucket that is now private | Works, but the gaps stay open |
| `20260930100100` auth trigger | Fine | Fine |
| `20260930100200` sales | Fine | **"Complete sale" fails**: the client calls an RPC that does not exist |
| `20260930100300` cashflow | Fine | **Balance reset on the Companies screen fails** (missing RPC) |
| `20260930100400` funding | Fine | TIC saves keep failing for Accounting and Investment, as today |
| `20261005100000` activity log | Fine | Fine: the page falls back to the old call and hides the checkbox |
| `20261005110000`, `…120000`, `20261006100000` company statistics | Companies cards change (section 4) | Fine: the cards keep the old classification |

This table is why the release is one step: the new frontend needs the sales and cashflow
migrations, and the security migration needs the new frontend. The four PR #48 migrations are
needed by PR #48's own code (repayment model, contract status), which is on `development`. It is here for diagnosis if something goes wrong halfway, not
as permission to split the release.

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

### General report — as soon as the frontend is deployed

**Cash-flow section.** The table is now two tables, **Poslovne aktivnosti** and **Financijske
aktivnosti**, plus a total. Credit drawdowns, repayments and credit fees used to be absent.
Drawdowns and repayments are now under financing; credit fees are an operating outflow.

| All payments to date | Before | After |
|---|---|---|
| Operating inflow | €125.000,00 | unchanged |
| Operating outflow | €3.807.870,43 | €3.975.021,04 (credit fees added) |
| Financing inflow (drawdowns) | not shown | €4.522.708,80 |
| Financing outflow (repayments) | not shown | €100.000,00 |
| Net | −€3.682.870,43 | +€572.687,76 |

A report covers a date range, so a given report shows only its months. In 2026 so far there is one
financing payment, a €100.000,00 drawdown. The latest payment in production is dated 2026-03-12,
so a report for April–September 2026 is empty before and after. The two charts above the table
plot the total net and move accordingly.

**Expenses and profit.** Credit fees now count as a cost. Total expenses paid to date rise from
€3.807.870,43 to €3.975.021,04 (+€167.150,61), and profit and margin fall by the same amount.
Per-project expenses do not change: none of the 40 credit-fee invoices is tied to a project.

### Director dashboard — as soon as the frontend is deployed

Same change, same amount: portfolio expenses +€167.150,61, profit lower by that much. Per-project
costs and margins do not change.

### Companies screen — with migrations 11 and 12 (already applied to production)

**"Promet" and "Dobit/Gubitak" now mean operations only.** Until now the cards counted every
bank-type invoice as an expense — including credit *drawdowns*, which are money received, and
repayments of principal. Those two leave income and expense. Credit fees stay in expense: they
are a cost. Companies with credits get a new line under "Dobit/Gubitak":
**"Financiranje (primljeno / otplaćeno)"**.

Income figures ("Izdano", "Promet", "Neplaćeno (prihod)") do not change for any company. Three of
the 14 companies have drawdowns (14 invoices), one of them also a repayment:

| | B-Mark d.o.o. | Bio4you d.o.o. | Landmark group d.o.o. |
|---|---|---|---|
| Expense invoices | 36 → 34 | 34 → 33 | 557 → 545 |
| Expense paid ("Plaćeno") | €1.560.929,93 → €810.929,93 | €686.416,60 → €86.416,60 | €6.315.569,32 → €3.042.860,52 |
| Neplaćeno (rashod) | €40.742,87 (unchanged) | €20.288,15 (unchanged) | €7.727.913,12 → €7.382.913,12 |
| Dobit/Gubitak | −€1.560.929,93 → −€810.929,93 | −€686.416,60 → −€86.416,60 | −€6.315.569,32 → −€3.042.860,52 |
| Financiranje, primljeno | €750.000,00 | €600.000,00 | €3.172.708,80 |
| Financiranje, otplaćeno | €0,00 | €0,00 | €100.000,00 |

All 14 companies together (the stat cards at the top of the screen):

| | Before | After |
|---|---|---|
| Ukupan promet (income invoiced) | €127.813,76 | unchanged |
| Income paid | €125.000,00 | unchanged |
| Expense invoices | 824 | 809 |
| Expense invoiced | €17.180.426,61 | €12.212.717,81 |
| Expense paid | €8.756.047,84 | €4.133.339,04 |
| Expense unpaid | €8.582.696,77 | €8.237.696,77 |
| Dobit/Gubitak | −€8.631.047,84 | −€4.008.339,04 |
| Financing received / repaid | not shown | €4.522.708,80 / €100.000,00 |

What to tell users: the loss shown on these cards shrinks by €4.622.708,80 because loans drawn
(€4.522.708,80) and one repayment of principal (€100.000,00) were being counted as costs. Nothing
was paid or received; credit principal is now on its own line.

### Bank balances — after migration 4 (already applied to production), gradually

The new formula adds credits flagged "disbursed to account". The migration does not recalculate
every account; a balance changes the next time something is posted to that account. After
applying, run the query at the end of that migration file to list accounts whose opening balance
may already have been lost, and correct them on the Companies screen.

### What does not move

- ULAZNI (INV): production has no invoices of this type, so the Accounting dashboard, Director
  dashboard, General report expenses, VAT card and invoice colours show the same figures as before.
- ULAZNI (INV) aside, the Accounting dashboard's cash figures and VAT card do not move: it already
  had credit fees, drawdowns and repayments on the right sides.
- Per-project costs and margins anywhere.

**Decided with accounting, nothing open:** a cost is every operating invoice the company pays —
supplier, office, ULAZNI (INV) and credit fees. Repaying principal is not a cost. Summary for the
accountant: [ACCOUNTING_REVIEW_CASH7.md](./ACCOUNTING_REVIEW_CASH7.md).

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
- [ ] Companies cards for B-Mark, Bio4you and Landmark group match the table in section 4, including the Financiranje line; a company with no credits shows no such line.
- [ ] Cashflow calendar, November 2025: seven credit-fee invoices are in "Ulazni računi (plaćeno)".
- [ ] General report for 2025: the financing table shows drawdowns and the repayment, credit fees are in the operating table; the three total lines add up.
- [ ] Activity Log: help events hidden; the checkbox shows them.
- [ ] Sign in as a Sales user: no Cashflow in the profile list; the "?" on Budget Control opens its guide.
- [ ] Ask the assistant "što je cesija" and confirm it answers from the article.
