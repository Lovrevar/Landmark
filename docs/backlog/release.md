# Backlog — before the next release

Work that is not new code: fixes that are written but not live, and checks nobody has run yet.
Do these before anything else in the backlog. No ids; tick an item off and date it. Rules are in
[README.md](./README.md).

- [x] **Apply the twelve pending migrations** (2026-10-06). Verified read-only on 2026-10-06:
  production, LandmarkDev and (since 2026-10-08) LandmarkDemo carry all 363 migrations, through
  `20261006100000_company_statistics_final`.
- [x] **Apply the six October migrations** (2026-11-05). Verified read-only on 2026-11-05 in
  `supabase_migrations.schema_migrations`: production, LandmarkDev and LandmarkDemo carry
  `20261009100000_storage_document_delete_policies` (SEC-A12),
  `20261012100000_contracts_project_scope` (SEC-004, AUTH-4),
  `20261012100100_cancel_apartment_sale` (SALES-10), `20261012100200_unique_unit_numbers`
  (SALES-9), `20261015100000_unphased_tic_phase_budgets` (GEN-22) and
  `20261015100100_organization_settings` (GEN-19). They were on production before the client
  from 2026-10-15 shipped on 2026-10-20; nobody had ticked them. Checked on production on
  2026-11-05: `organization_settings` carries the name, and the Supervision user has projects in
  `project_managers`. The demo's phase shots were retaken on 2026-10-20 (`0f306f6f`).
- [x] **Apply `20261027100000_meeting_rooms` and `20261027100100_room_reservation_attendees`**
  (2026-11-05). LandmarkDev since 2026-10-26. Production on 2026-11-05: the task app's `main`
  had read the three tables since 2026-10-26, so its Sastanci screen failed until then. Both
  files ran in one transaction in the SQL editor and were inserted into `schema_migrations` by
  hand, because a `db push` from `development` would also have applied `voice_calls`. `send-push`
  was deployed to production the same day. Not on LandmarkDemo, which no task app uses.
- [x] **Deploy `ai-chat`** (2026-11-05) from `main` after the release of 2026-11-05 (PR #77), to production
  (`--project-ref xhlgviunhitdgzkeucxc`) and LandmarkDemo (`asvuyvmuzroyrzlgyzij`). The release
  streams the model's answer and dispatches a turn's tool calls concurrently; the frontend works
  with the old function too. It needs no migration: `channel: 'chat'` is configuration, not the
  `ai_sessions.channel` column `voice_calls` adds. Afterwards ask the assistant a question that
  uses a tool and check the answer streams in.
- [x] **Bring `demo` up to `main`** (2026-11-05) (a PR from `main` into `demo`, as #66): the demo ran
  the client from 2026-10-20.
- [ ] **Apply `20261026100000_voice_calls`** (voice assistant, `feature/voice-assistant` only).
  **Dev: done** — its SQL ran directly on 2026-10-26 and `supabase db push` recorded it on
  2026-10-27, after the merge. Dev has no pg_cron, so the sweep is not scheduled (enable pg_cron,
  then run the migration's last DO block). Production
  only when the voice feature ships, and before `VOICE_CALLS_ENABLED` is flipped on (without the
  migration the flag breaks the chat history list). Afterwards: `select jobname from
  cron.job where jobname = 'voice-calls-sweep'` returns one row; as a signed-in user,
  `select * from voice_calls` is refused; existing chat sessions show `channel = 'chat'`. Then
  `/db-types`.
  **Production's history ends at `20261027100100`** (the meeting-room migrations, recorded by
  hand on 2026-11-05; `20261110100100` once the two task-app items below are done), which is
  newer than this file, so a plain `supabase db push` refuses it: push with `--include-all`,
  after a `--dry-run` that lists only this file.
- [ ] **Apply `20261110100000_task_subtask_deadlines`** (the task app's request of 2026-11-10,
  part 1: `task_subtasks.deadline` and the optional `deadline` key on `p_subtasks`).
  **Production: applied by hand on 2026-11-10**, before the PR merged and before dev — check
  that its `schema_migrations` row was inserted. **Dev: done 2026-11-10** by `supabase db push`
  from `development`. Dev
  (`nxvbglegqcgxlxvyfuht`) first, then production (`xhlgviunhitdgzkeucxc`). A plain `db push`
  refuses it while `voice_calls` is older and unapplied, and `--include-all` would drag
  `voice_calls` along, so do what the meeting-room item did: run the file in the SQL editor
  and insert its row into `supabase_migrations.schema_migrations` by hand. Check:
  `select column_name from information_schema.columns where table_name = 'task_subtasks' and
  column_name = 'deadline'` returns one row, and `npm run test:db` was green locally before
  this. **Tell the task app after dev** — it runs `/schema-refresh` and finishes its client —
  **and after production**, because its `main` names `deadline` in the subtask embed of
  `TASK_SELECT`, and PostgREST fails that whole query on an unknown column: a task-app bundle
  naming the column before production has it takes the Zadaci tab dark. It holds its
  `dev` → `main` merge until this is confirmed. Then `/db-types` here (from dev it drops the
  `erp` schema — splice the two new columns in by hand).
- [ ] **Apply `20261110100100_task_app_only_users`** (part 2: `profiles.external`, and
  `handle_new_user()` skips `public.users` for an auth user with
  `app_metadata.task_app_only = true`). **Production: applied by hand on 2026-11-10** (check
  the `schema_migrations` row). **Dev: done 2026-11-10.** Found not to work through the Auth
  admin API — COLLAB-18,
  fixed by `20261110100200` below; the one person created that way was kept as a Supervision
  user with no projects instead. Independent of part 1, same procedure for dev: SQL
  editor plus a `schema_migrations` row by hand, then production. Check on dev: create an
  auth user through the dashboard (or the task app's `manage-users` with `external: true`)
  carrying that app_metadata, then `select external from public.profiles where id = …` is
  `true` and `select count(*) from public.users where auth_user_id = …` is 0; a user created
  without the flag still gets a `Sales` roster row. Then `/db-types` (same splice note as
  above).
- [ ] **Apply `20261110100200_task_app_only_admin_api` and deploy `manage-users`** (COLLAB-18:
  the Auth admin API merges `app_metadata` after the insert, so a second trigger undoes the
  roster row). **Dev: done 2026-11-10** — `supabase db push` and
  `supabase functions deploy manage-users` from `development`; an external person added from
  the task app's Settings on dev came out as the profiles row only, `external = true`.
  **Production pending:** SQL editor plus the `schema_migrations` row by hand (same reason as
  above: `voice_calls` is older and unapplied), then, from this repo, `supabase functions deploy
  manage-users --project-ref xhlgviunhitdgzkeucxc`; the task app's copy of the function is retired
  once this is live (its repo's `supabase/functions/manage-users`, README, `CLAUDE.md` and
  `docs/ARCHITECTURE.md` point here afterwards). Check on each project: from the task app's
  Settings add an external person, then
  `select 'users', username, role from public.users where auth_user_id = '<id>' union all
  select 'profiles', name, external::text from public.profiles where id = '<id>'` returns the
  **profiles row only**, external `true`, named as entered; signing in to Landmark with that
  account is refused; a `DELETE ?id=<staff id>` through the function answers 400. Before
  production is done the task app must not ship its "Dodaj vanjskog suradnika" form.
- [x] **Walk [../test/11-pre-merge-ui-audit.md](../test/11-pre-merge-ui-audit.md).** (2026-11-05,
  before the release.) 80
  checks, over a dozen marked blocker. Steps 0.4 and 0.5 follow the migrations directly: log in as
  Sales and Supervision and open the invoice screens; edit an existing payment's amount and bank
  account and check the balance follows.
- [x] **Check bank accounts that were already wiped** (2026-10-09, read-only on production).
  See "Bank accounts check" below: no account matches the CASH-1 pattern; four balances are stale.
- [x] **Tell Budget Control users the figures move** (2026-11-05) (GEN-23, `fix/gen-23-evm-uncontracted`). It
  shipped to production on 2026-11-05 (PR #77); the demo's `kontrola-proracuna.png` was retaken
  the same day (Jarun's EAC went from €4.980.839,06 to €7.382.237,49). Earned value no longer credits uncontracted work: on production on
  2026-10-20 the 10 projects with contracts had only about 15% of their phase budgets contracted,
  so the old CPIs (Precko Zapad 115,58) were inflated. No paid contract on production has
  milestones, so after the release **every production project shows "—" for CPI, EAC and VAC**,
  with "Plaćeni ugovori nemaju prekretnice" or, for four projects paid only through suppliers
  without a contract, "Samo plaćanja bez ugovora". CPI comes back per project once its contracts
  get milestones (GEN-8) — tell the site team. Also check Precko Zapad's €600.000.000 plan is
  real.
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
