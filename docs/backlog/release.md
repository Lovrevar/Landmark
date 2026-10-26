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
- [ ] **Apply `20261012100000_contracts_project_scope`** (SEC-004, AUTH-4), dev first.
  Then, as the dev Supervision user (`e2e-supervision@mail.com`, assigned to "E2E Anchor
  Project"): Site management shows that project's contracts and milestones and no other
  project's, and adding a contract there works. As Director: every project still shows.
  **Before production:** assign the Supervision user to their projects (`project_managers`). On
  2026-10-12 production had one Supervision user and no assignments, so that user already sees
  no projects or phases, and after this migration no contracts either.
- [ ] **Apply `20261012100100_cancel_apartment_sale`** (SALES-10). On dev as Director: sell an
  apartment that has a linked garage, cancel the sale, and check the apartment and garage are
  Available, the sale has left the Sales dashboard, and the activity log shows "Prodaja
  poništena". Then enter an invoice to the buyer for a sold apartment and check the cancel is
  refused with the invoice message. As Sales: no "Poništi prodaju" button.
- [ ] **Apply `20261012100200_unique_unit_numbers`** (SALES-9). It stops with a list if a
  duplicate has appeared since 2026-10-12 (none then, in any database). Afterwards, try to add a
  unit with a number already in the building and a building with a name already in the project:
  both are refused with a message that says so.
- [ ] **Apply `20261026100000_voice_calls`** (voice assistant, `feature/voice-assistant` only).
  **Dev: done 2026-10-26 by running its SQL directly** (not recorded in `schema_migrations`, so
  other branches can still push; dev has no pg_cron, so the sweep is not scheduled). Production
  only when the voice feature ships, and before `VOICE_CALLS_ENABLED` is flipped on (without the
  migration the flag breaks the chat history list). Afterwards: `select jobname from
  cron.job where jobname = 'voice-calls-sweep'` returns one row; as a signed-in user,
  `select * from voice_calls` is refused; existing chat sessions show `channel = 'chat'`. Then
  `/db-types`.
- [ ] **Apply `20261015100000_unphased_tic_phase_budgets`** (GEN-22), dev first, and **before the
  client from 2026-10-15 ships**: that client no longer recognises the old "phase 1 holds the whole
  plan" shape, so on an unmigrated database Budget Control would measure such a project as phase 1
  alone. First list the projects it changes (unphased TIC, more than one phase):
  `select p.name, count(ph.id) from projects p join tic_cost_structures t on t.project_id = p.id
  join project_phases ph on ph.project_id = p.id where not exists (select 1 from
  tic_phase_totals(t.line_items)) group by p.name having count(ph.id) > 1;`
  Then, on dev:
  1. Faze i ugovori on such a project shows "TIC nije raspoređen po fazama — budžet … vrijedi za
     cijeli projekt" and no orange "Budžet nije postavljen".
  2. Budget Control's planned budget equals the TIC.
  3. Add a phase in Site Management to a single-phase project with an unphased TIC: both phases
     show "—" and the note. Delete it again: the remaining phase has the whole budget back.
  4. Add a phase to a project with a phased TIC: the other phases keep their budgets, the new one
     shows 0.
  5. Delete a test project that has phases: it goes without an error.
  Then apply it to LandmarkDemo, whose Jarun project is such a project, and retake
  `HELP_SHOTS_ONLY=projekt-faze-i-ugovori,kontrola-proracuna,upravljanje-gradilistem npm run help:shots`.
  Not before: on the unmigrated demo the new client measures Jarun phase by phase, which is the
  wrong CPI GEN-22 fixed, and Budget Control's shot would show it.
- [ ] **Apply `20261015100100_organization_settings`** (GEN-19) before the client from
  2026-10-15 ships — that client reads the table, and the General report and Sales PDFs fail
  to load without it. Dev first. Then set each database's name with SQL:
  `update organization_settings set name = 'Landmark Group';` on production,
  `'Adriatic Development'` on LandmarkDemo (re-seeding does it too). With no name the reports
  print only their titles. Check as Director and as Sales: the General report header and its PDF
  cover, header band and footer, and both Sales report PDFs.
- [ ] **Walk [../test/11-pre-merge-ui-audit.md](../test/11-pre-merge-ui-audit.md).** 80 unticked
  checks, over a dozen marked blocker. Steps 0.4 and 0.5 follow the migrations directly: log in as
  Sales and Supervision and open the invoice screens; edit an existing payment's amount and bank
  account and check the balance follows.
- [x] **Check bank accounts that were already wiped** (2026-10-09, read-only on production).
  See "Bank accounts check" below: no account matches the CASH-1 pattern; four balances are stale.
- [ ] **Tell Budget Control users the figures move** (GEN-23, `fix/gen-23-evm-uncontracted`) when
  that branch ships. Earned value no longer credits uncontracted work: on production on
  2026-10-20 the 10 projects with contracts had only about 15% of their phase budgets contracted,
  so the old CPIs (Precko Zapad 115,58) were inflated. No paid contract on production has
  milestones, so after the release **every production project shows "—" for CPI, EAC and VAC**,
  with "Plaćeni ugovori nemaju prekretnice" or, for four projects paid only through suppliers
  without a contract, "Samo plaćanja bez ugovora". CPI comes back per project once its contracts
  get milestones (GEN-8) — tell the site team. Also check Precko Zapad's €600.000.000 plan is
  real. After it reaches the demo, retake `HELP_SHOTS_ONLY=kontrola-proracuna npm run help:shots`.
- [ ] **Try TIC saves on dev** (FUND-2): a first-time save, and a save as Accounting and as
  Investment. The fix was made from reading the code; its migration `20260930100400` is applied
  everywhere since 2026-10-06, so nothing blocks this.
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
