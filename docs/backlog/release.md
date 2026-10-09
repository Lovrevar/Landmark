# Backlog — before the next release

Work that is not new code: fixes that are written but not live, and checks nobody has run yet.
Do these before anything else in the backlog. No ids; tick an item off and date it. Rules are in
[README.md](./README.md).

- [x] **Apply the twelve pending migrations** (2026-10-06). Verified read-only on 2026-10-06:
  production, LandmarkDev and (since 2026-10-08) LandmarkDemo carry all 363 migrations, through
  `20261006100000_company_statistics_final`.
- [ ] **Apply `20261009100000_storage_document_delete_policies`** (SEC-A12): dev first, then
  production. Until then any signed-in user can still delete any stored document file. After
  applying, as a Sales user delete a document you uploaded (works) and try one uploaded by
  someone else (refused).
- [ ] **Walk [../test/11-pre-merge-ui-audit.md](../test/11-pre-merge-ui-audit.md).** 80 unticked
  checks, over a dozen marked blocker. Steps 0.4 and 0.5 follow the migrations directly: log in as
  Sales and Supervision and open the invoice screens; edit an existing payment's amount and bank
  account and check the balance follows.
- [x] **Check bank accounts that were already wiped** (2026-10-09, read-only on production).
  See "Bank accounts check" below: no account matches the CASH-1 pattern; four balances are stale.
- [ ] **Try TIC saves on dev** once `20260930100400` is applied: a first-time save, and a save as
  Accounting and as Investment (FUND-2). The fix was made from reading the code.
- [ ] **Run drift check 2 from migration `20260917100000`** after the cesija sign is decided
  (CASH-6 in [cashflow.md](./cashflow.md)).

## Bank accounts check (2026-10-09)

Read-only on production, all 28 `company_bank_accounts`, stored `current_balance` against
`recalc_company_bank_account_balance()`'s formula.

- **CASH-1 (opening balance wiped):** no candidates. Every account has a `balance_reset_at`; the
  query at the end of migration `20260930100300` returns nothing.
- **CASH-16 (reset on company save):** 23 accounts were reset on 24 or 25 February 2026, the day
  their company was last edited — the signature of that bug. But their opening balances are
  specific amounts (49,40; 27,21; 492,08 …), which reads as balances typed in from statements on
  those two days rather than as accidental resets. **Accounting has to confirm** that the opening
  balances are the real bank balances as of 24/25 February 2026. If they are, payments dated
  earlier are rightly left out.
- **Four balances are stale.** Their opening balance and reset date were set before the recompute
  function existed and nothing has posted to them since, so the stored figure still includes
  payments from before the reset:

  | Account | Shown now | Formula gives | Difference |
  |---|---|---|---|
  | Bio4you d.o.o. / Zagrebačka banka | 513.883,14 | 299,74 | +513.583,40 (15 payments) |
  | Terra Supero d.o.o. / Zagrebačka banka | −109.936,39 | 63,61 | −110.000,00 (2 payments) |
  | Projekt Maksimus d.o.o. / Erste banka | −1.804,23 | 140,52 | −1.944,75 (7 payments) |
  | Projekt Maksimus d.o.o. / Agram banka | −976,16 | 55,99 | −1.032,15 (3 payments) |

  The next payment on any of them recomputes it without a word.

  **Decided 2026-10-09: leave them.** Bank balances will come from the ERP once the integration
  resumes, which makes the derived balance a drift check only. No repair migration is kept in the
  repo — a file in `supabase/migrations/` is applied by the next `db push` whatever its header
  says. To correct one by hand in the meantime, reset its balance on the Companies screen.
