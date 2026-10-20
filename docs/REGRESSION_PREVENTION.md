# Stopping fixed bugs from coming back

**Written:** 2026-10-20 · **Status:** in progress — see the [checklist](#checklist)

Fixed problems keep resurfacing after later fixes. This plan finds the gaps in how changes are
checked and closes them one at a time. Each step is independent, ordered by value for effort, and
ends with a "done when" line, so you can stop after any step and still be better off.

| # | Step | Effort | Catches |
|---|---|---|---|
| 0 | ~~CI on every push to `development`~~ (done, PR #63) | — | Direct commits that never ran the tests |
| 1 | [A failing test first, for every fix with an id](#step-1--a-failing-test-first-for-every-fix-with-an-id) | 1 h + habit | A fix that never really fixed the symptom (GEN-22 → GEN-23) |
| 2 | [Make CI a required check](#step-2--make-ci-a-required-check-on-github) | 10 min | Merging while the tests are red |
| 3 | [Run checks when Claude finishes a turn](#step-3--run-checks-automatically-when-claude-finishes) | 30 min | "Done" said while typecheck or a related test is red |
| 4 | [Stop tests being weakened](#step-4--stop-tests-being-weakened-quietly) | 30 min | An assertion deleted or loosened to get green |
| 5 | [Warn when a later migration replaces a tested function](#step-5--warn-when-a-later-migration-replaces-a-tested-function) | 1 h | A database fix overwritten by a later `CREATE OR REPLACE` |
| 6 | [Real database tests in CI (pgTAP)](#step-6--real-database-tests-in-ci-pgtap) | ½–1 day | Broken RLS, functions and triggers; migrations that no longer apply |
| 7 | [One calculation, one place](#step-7--one-calculation-one-place) | ongoing | The same figure fixed on one screen and wrong on another |
| 8 | [Commit, branch and review habits](#step-8--commit-branch-and-review-habits) | habit | Fixes lost in merges, unreviewable batches |
| 9 | [Working with Claude](#step-9--working-with-claude) | habit | Fixes made from a stale or overloaded context |

---

## Why fixes come back here

What the repository showed on 2026-10-20:

- **Tests assert a step, not the symptom.** The GEN-22 fix shipped with a test for exactly the
  failing case (`src/utils/evm.test.ts`, "uses the project span … before the later phases have
  contracts"). It checks only PV. The bug was in EV/CPI/EAC, which nothing asserted, so it came
  straight back as GEN-23.
- **The SQL "tests" never run SQL.** Seven test files (`src/lib/cancelSaleFunction.test.ts`,
  `contractsScopePolicies.test.ts`, …) read a migration file and look for text. When a later
  migration redefines the function with `CREATE OR REPLACE` — which is how database fixes get
  undone — the old file is unchanged and the test still passes. Since August, 7 functions have
  been redefined in more than one migration. `20261015100000` even warns that its `CREATE OR
  REPLACE` resets settings `20260930100400` had applied.
- **CI didn't run on direct commits to `development`.** It ran on pull requests only. 10 of the 17
  changes landed on `development` since 1 October were direct commits. Fixed by PR #63.
- **The same figure is computed in many places.** Fix commits since 1 September:
  `Reports/services/generalReportService.ts` 13, `Reports/GeneralReports.tsx` 12,
  `Supervision/WorkLogs/index.tsx` 10, `Supervision/SiteManagement/index.tsx` 10,
  `ProjectDetail.tsx` 9. Most of them have no tests. GEN-9 ("Director and Sales dashboards define
  sales differently") is the pattern in one line.
- **Large batch commits and long-lived parallel branches.** For example "small backlog batch — two
  dashboard figures, allocation drawdowns, role-gated buttons, payment filter and detail". Also
  backlog ids handed out twice on two branches (CASH-21..23), and PR #49 merged, reverted and
  reapplied.

The outside advice agrees on the main point. The most useful thing you can give an AI agent is a
way to verify its own work. A check the agent cannot edit is worth more than a rule in CLAUDE.md.
See [Sources](#sources).

---

## Step 1 — A failing test first, for every fix with an id

**The rule:** before fixing a backlog item, write a test that reproduces the *symptom the user
saw*, and watch it fail. Then fix the code until it passes. Name the test after the id, so a
regression names itself when it fails.

- "Symptom the user saw" means the figure on screen: CPI, the forecast, a total, a row count. A
  test of an intermediate value (PV, a helper's return) can pass while the screen is wrong.
- A test that never failed proves nothing. Run it before the fix and confirm it is red.
- Database fixes get the same rule, through Step 6. Until Step 6 exists, write down the check you
  ran on LandmarkDev in the commit message.

### 1a. Do it once now: GEN-23

1. In `src/utils/evm.test.ts`, inside the unphased `describe` (the block with `const tic = 1000`),
   add:

   ```ts
   it('GEN-23: a phase with no contracts yet counts as not started, not as done', () => {
     // Phase 1 is finished and paid (200 of the 1000 plan); phase 2 has nothing contracted yet.
     const m = calculateProjectEVM(phases, [contracts[0]], [], now, tic)
     expect(m.EV).toBeCloseTo(200)   // what has been earned, not the whole plan
     expect(m.CPI).toBeCloseTo(1)    // paid 200 for 200 of work
     expect(m.EAC).toBeCloseTo(1000) // so the forecast is the plan, not paid-to-date
   })
   ```

2. Run `npx vitest run src/utils/evm.test.ts`. It must **fail**: today EV is 1000, CPI 5 and EAC
   200.
3. **Decide the semantics before changing the code.** Two existing tests in the same file encode
   the same flaw in a milder form, and will have to change on purpose:
   - "does not count the whole budget as earned…" expects EV 437,5. That spreads the 200 of
     uncontracted plan at the contracted rate. Under the GEN-23 rule (uncontracted scope is not
     started) EV is 200 + 600×25% = 350, CPI 1, EAC 1000.
   - "leaves a phased plan alone" expects 550. Phase 1's 400 budget is fully earned although its
     only contract is worth 200. Under the same rule it is 200 + 150 = 350.

   The recommended rule is EV = Σ(contract amount × physical %), capped at the plan, for phased
   and unphased plans alike. Uncontracted work counts as 0 % done. If you agree, update those two
   expectations **in the same commit as the fix**, with a comment naming GEN-23. That is a
   legitimate test change: the old expectation was the bug.
4. Fix `calculateProjectEVM` in `src/utils/evm.ts` until the file is green. Then run `npm test`.
5. Also cover the schedule half of GEN-23: phases 2+ without dates must make
   `scheduleAvailable` false, not shorten the span. Add that test first, see it fail, then fix.
6. Close GEN-23 with `/backlog`, retake the Budget Control help shot
   (`HELP_SHOTS_ONLY=kontrola-proracuna npm run help:shots`) and look at it: the Jarun forecast
   should no longer sit below the contracted amount.

### 1b. Make it the rule

1. **`.claude/skills/done/SKILL.md`** — in "## 2. Housekeeping", add as the first bullet:

   ```markdown
   - **Regression test:** a fix for a backlog id has a test named after the id (`it('GEN-23: …')`)
     that asserts the figure or behaviour the user saw, and that failed before the fix. Say in the
     report that you saw it fail. If a test could not be written (pure SQL before Step 6, a
     layout bug), say what was checked instead and where
   - **Changed tests:** any existing assertion that was removed or loosened is named in the report
     with the reason. "It was failing" is not a reason
   ```

2. **`.claude/rules/backlog.md`** — add:

   ```markdown
   - **A bug that was fixed before and is back** gets a new id whose title ends with
     "(regression of GEN-22)", and the old entry in `## Resolved` gets "Came back as GEN-23" — so
     repeat offenders are visible. Before closing an item, check its test fails without the fix
   ```

3. **A new path-scoped rule, [`.claude/rules/testing.md`](../.claude/rules/testing.md)** (done; the
   version in the repository grew two more rules from the GEN-23 work). It loads only when `src/`
   or migrations are touched, which keeps CLAUDE.md short. First draft:

   ```markdown
   ---
   paths:
     - "src/**"
     - "supabase/tests/**"
   ---

   # Tests

   - Fixing a bug: write the failing test first (named after the backlog id), run it, see it fail,
     then fix. Assert what the user sees — the total, the CPI, the row count — not a helper's
     intermediate value
   - Never delete, skip or loosen an existing assertion to get to green. If an expectation is
     genuinely wrong, change it in its own clearly-labelled step and say why in the report
   - A function or policy fix in SQL is tested in `supabase/tests/database/` (pgTAP), not by
     reading the migration's text
   ```

**Done when:** GEN-23 is fixed with a test that failed first, and `/done` asks for regression
tests.

---

## Step 2 — Make CI a required check on GitHub

Done for `main` (2026-10-20): **Tests / test** and **Database tests / db** are required there.
`development` deliberately has no rule, so small fixes can still go straight in. CI runs on
those pushes too, but a red one only shows afterwards: check the commit's status before building
on it.

CI now runs the production-dependency audit (`npm audit --omit=dev --audit-level=high`),
typecheck, lint, unit tests and the edge-function tests on every push and pull request. Nothing stops a red pull request from being merged, though.

1. GitHub → the repository → **Settings → Branches** (or **Rules → Rulesets**) → add a rule for
   `main` and one for `development`.
2. Tick **Require status checks to pass before merging** and pick the **Tests / test** job (it
   appears once it has run on a pull request). Add **Database tests / db** after Step 6.
3. For `main`, also tick **Require a pull request before merging**. For `development`, decide
   whether small fixes may still go straight in. If they may, CI still runs on the push, but a red
   push only shows up afterwards. Check the commit's status before building on it.
4. Optional, once there is a second regular contributor: add a `.github/CODEOWNERS` that names you
   for `*.test.ts`, `supabase/tests/` and `.github/workflows/`, and tick "Require review from Code
   Owners". Then a weakened test cannot merge unseen.

**Done when:** a pull request into `main` with a failing test cannot be merged.

---

## Step 3 — Run checks automatically when Claude finishes

CLAUDE.md asks Claude to run `/done`, but that is advice. A **Stop hook** is enforced by the
harness: when Claude is about to end a turn, the hook runs. If it exits with code 2, Claude
receives the hook's output and keeps working instead of stopping (Claude Code hooks reference).

This hook runs only when `src/` has uncommitted changes. It runs the typecheck (about 15 s here)
and the tests related to the changed files (`vitest related`, a few seconds). It skips the run if
nothing changed since the last green run, and it blocks only once per turn, so it cannot loop. CI
remains the full check.

1. ~~Create the script and register it~~ — done (2026-10-20): **[`.claude/hooks/stop-verify.mjs`](../.claude/hooks/stop-verify.mjs)**,
   registered under `"hooks" → "Stop"` in `.claude/settings.json` with a 300 s timeout. It
   keeps a stamp of the last green run in `node_modules/.cache/stop-verify`, so an unchanged tree
   costs under 0,1 s. On its first run it caught a real type error in a new test file.
2. To switch it off for one session, use `/hooks`; to remove it, delete the `Stop` entry.
3. Test it. In a scratch session, ask Claude to add `const x: number = 'a'` to any file in `src/`
   and stop. The turn should continue with the typecheck error. Then ask it to revert.

**Done when:** a session cannot end its turn on a red typecheck or a red related test without
having been shown the failure.

---

## Step 4 — Stop tests being weakened quietly

Agents under pressure to get to green edit the test instead of the code: they delete an
assertion, loosen `toBe` to `toBeDefined`, or add `.skip`. Instructions alone don't prevent this.
A check the agent cannot get around does (see Sources). The hook below doesn't forbid test edits:
adding new tests to an existing file is the normal case. It **asks you** whenever an edit
*removes or changes* an existing assertion, or adds `.skip`/`.only`.

1. ~~Create the script and register it~~ — done (2026-10-20): **[`.claude/hooks/guard-tests.mjs`](../.claude/hooks/guard-tests.mjs)**,
   registered under `"hooks" → "PreToolUse"` with matcher `Edit|Write`. It returns
   `permissionDecision: "ask"` with the removed lines quoted, so you approve or refuse each one.
2. It also covers pgTAP files in `supabase/tests/` once Step 6 adds them.
3. Test it. Ask Claude to delete one `expect(...)` line from `src/utils/evm.test.ts`. You should
   get a permission prompt that quotes the line. Ask it to add a new `it(...)` at the end of the
   same file: no prompt.

4. A blind spot to know about: an agent can also "fix" a test by changing the *code the test
   relies on* — a fixture, a mock, a helper — instead of the behaviour. Step 8's fresh-context
   review is the defence. Ask the reviewer to look at test and fixture diffs specifically.

**Done when:** you are asked every time an existing assertion is about to be removed or changed.

---

## Step 5 — Warn when a later migration replaces a tested function

Until Step 6 runs real SQL, the text-matching tests can be kept honest cheaply. If a newer
migration redefines a function, or changes the policies on a table that a text test covers, fail
and say which file to look at. The fix is deliberate: re-point the text test at the new file, after
checking the new definition still does what the old test demanded.

1. ~~Write the test~~ — done (2026-10-20): **[`src/lib/migrationSupersession.test.ts`](../src/lib/migrationSupersession.test.ts)**.
   It covers every object the seven text tests read (functions, policies, indexes, the trigger,
   the `company_statistics` view), 19 rows, plus a check that each pattern really matches its
   own file so a typo cannot pass for ever. A throwaway migration redefining
   `cancel_apartment_sale` and a `contracts` policy turned exactly those two rows red.
2. ~~Add the step to the new-migration skill~~ — done.
3. Every new text test adds its row there; `.claude/rules/testing.md` says so.

**Done when:** redefining any text-tested function in a new migration makes `npm test` fail with
the name of the file to look at.

---

## Step 6 — Real database tests in CI (pgTAP)

This is the biggest single step. Supabase's own recommended route: `supabase start` applies every
migration to a fresh local database. Then `supabase test db` runs the pgTAP files in
`supabase/tests/` against it. Each file is wrapped in its own transaction and rolled back. This
tests the *final* state after all migrations, which is what the text tests cannot do. It also
proves the migrations still apply from scratch.

### 6a. Locally first

Items 1–4 done (2026-10-20). How to run and write the tests is now in
[`TESTING.md` → Database tests](./TESTING.md#database-tests-pgtap); `npm run test:db` runs them.

1. ~~Start the local stack~~ — done. All 369 migrations apply from scratch with no error, so a
   fresh project can be built from the repository. Two snags, both fixed and documented in
   `TESTING.md`:
   - Docker Desktop was running but WSL couldn't reach it: its WSL integration proxy wasn't
     running in Ubuntu until Docker Desktop's WSL side was restarted.
   - Another local Supabase project (`bi-platform`) held the default ports 5432x. This
     project's local stack now uses 5442x (`supabase/config.toml`).
2. ~~Create the folder and a first, schema-wide test~~ — done, **[`supabase/tests/database/00_rls_enabled.test.sql`](../supabase/tests/database/00_rls_enabled.test.sql)**:

   ```sql
   begin;
   create extension if not exists pgtap with schema extensions;
   select plan(1);

   -- Every table in public has RLS on. True on dev and production on 2026-10-20; this keeps it so.
   select is_empty(
     $$ select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity $$,
     'every public table has row level security enabled'
   );

   select * from finish();
   rollback;
   ```

3. ~~Turn the strongest text test into a real one~~ — done, **[`supabase/tests/database/sec_004_contracts_scope.test.sql`](../supabase/tests/database/sec_004_contracts_scope.test.sql)**, as drafted below.
   - It relies on the sign-up trigger (`handle_new_user`): inserting into `auth.users` with a role
     in `raw_app_meta_data` creates the `public.users` row.
   - To act as a user, switch to the `authenticated` role and set the JWT claims, as Supabase's
     testing guide does.

   ```sql
   begin;
   create extension if not exists pgtap with schema extensions;
   select plan(4);

   -- Fixtures, as the database owner (RLS does not apply).
   insert into auth.users (id, email, raw_app_meta_data) values
     ('00000000-0000-0000-0000-0000000000a1', 'sup@test.local', '{"provider":"email","role":"Supervision"}'),
     ('00000000-0000-0000-0000-0000000000a2', 'dir@test.local', '{"provider":"email","role":"Director"}');

   insert into public.projects (id, name, location, start_date) values
     ('00000000-0000-0000-0000-0000000000b1', 'Assigned', 'Zagreb', '2026-01-01'),
     ('00000000-0000-0000-0000-0000000000b2', 'Other',    'Split',  '2026-01-01');
   insert into public.subcontractors (id, name, contact)
     values ('00000000-0000-0000-0000-0000000000c1', 'Test d.o.o.', 'test');
   insert into public.contracts (project_id, subcontractor_id, job_description) values
     ('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000c1', 'on assigned'),
     ('00000000-0000-0000-0000-0000000000b2', '00000000-0000-0000-0000-0000000000c1', 'on other');
   insert into public.project_managers (user_id, project_id)
     select id, '00000000-0000-0000-0000-0000000000b1' from public.users
     where auth_user_id = '00000000-0000-0000-0000-0000000000a1';

   -- As the Supervision user.
   set local role authenticated;
   set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}';

   select results_eq(
     $$ select job_description from public.contracts order by 1 $$,
     array['on assigned'],
     'SEC-004: Supervision sees only contracts on projects it is assigned to'
   );
   select throws_ok(
     $$ insert into public.contracts (project_id, subcontractor_id, job_description)
        values ('00000000-0000-0000-0000-0000000000b2', '00000000-0000-0000-0000-0000000000c1', 'sneaky') $$,
     '42501', null,
     'SEC-004: Supervision cannot add a contract to a project it is not assigned to'
   );

   -- As the Director.
   set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000a2","role":"authenticated"}';
   select results_eq(
     $$ select count(*) from public.contracts $$,
     array[2::bigint],
     'Director sees every contract'
   );

   reset role;
   select is((select count(*) from public.contracts where job_description = 'sneaky'), 0::bigint, 'nothing was written');

   select * from finish();
   rollback;
   ```

4. ~~Run it, then break it on purpose~~ — done. Both files green (5 tests). A scratch migration
   then recreated the old `USING (true)` SELECT policy on `contracts` and switched RLS off on
   `subcontractors`. After `supabase db reset && supabase test db`, both files went red for the
   right reason: Supervision saw the `on other` contract, and the RLS check failed. The same
   scratch file also turned Step 5's `migrationSupersession.test.ts` red on "policies on
   contracts". The scratch migration was deleted and the database reset; green again.
5. Write the next ones in this order (tracked as 6c in the checklist). Each replaces or backs a text test:
   - `sales_10_cancel_sale.test.sql`: Sales gets `42501`; a sale with an `OUTGOING_SALES` invoice
     gets `P0001`; a successful cancel frees the linked garage and storage unit.
   - `sec_a12_document_delete.test.sql`: a Sales user cannot delete another user's object in
     `documents`; the uploader can. The policies are on `storage.objects`.
   - `gen_22_unphased_tic.test.sql`: an unphased TIC on three phases leaves all three NULL; deleting
     two leaves the last one with the whole plan.
   - `sales_9_unique_numbers.test.sql`: `"A-101"` and `" a-101 "` in one building fails with
     `23505`.

   When all four exist, delete the matching text tests and their rows in
   `migrationSupersession.test.ts`.

   ~~Done~~ (2026-10-20, as 6c): all four written, each seen red against a scratch migration
   that undid its fix. The SEC-004 file was extended to cover the rest of its text test:
   - updates and moves;
   - milestones;
   - Director-only delete;
   - the dropped AUTH-4 overload;
   - each function's SECURITY DEFINER, search path and grants.

   The five text tests and their 16 supersession rows are deleted. Two text tests remain
   (`organizationSettings`, `invoiceCashDirection`), and the supersession check still covers
   them.

### 6b. In CI

~~Create the workflow~~ — done (2026-10-20): **[`.github/workflows/db-tests.yml`](../.github/workflows/db-tests.yml)**,
as drafted below. Its first run was green in under 2 minutes: 1 min 36 s to start the stack and
apply every migration, 3 s for the tests. That is fast enough to leave every service running.
Still open: make it a required check (Step 2).

Create **`.github/workflows/db-tests.yml`**:

```yaml
name: Database tests

on:
  push:
    branches: [main, development]
  pull_request:
    branches: [main, development]
  workflow_dispatch:

concurrency:
  group: db-tests-${{ github.ref }}
  cancel-in-progress: true

jobs:
  db:
    runs-on: ubuntu-latest
    timeout-minutes: 20
    steps:
      - uses: actions/checkout@v4

      - uses: supabase/setup-cli@v1
        with:
          version: 2.99.0   # the version used locally; bump both together

      - name: Start Supabase (applies every migration)
        run: supabase start

      - name: Run database tests
        run: supabase test db
```

- The first runs will take a few minutes, mostly pulling images. Once it is green, you can speed
  it up by excluding services the tests don't need with `supabase start -x <services>`. Check
  `supabase start --help` for the names your CLI version accepts. Keep the storage and auth
  services: the tests use `storage.objects` and `auth.users`.
- No secrets are needed. Everything runs inside the GitHub runner, and nothing touches
  LandmarkDev or production.
- After it has run once, add **Database tests / db** to the required checks (Step 2).

### 6c. Make it the habit

~~Done~~ (2026-10-20): the new-migration skill has a "Test it in SQL" section, and
`.claude/rules/testing.md` no longer allows new text tests. First draft:

Add to `.claude/skills/new-migration/SKILL.md`: "Every new function, policy or trigger gets a
pgTAP test in `supabase/tests/database/`, named after its backlog id, in the same commit. Write
it first and see it fail on `supabase db reset` without the migration."

**Done when:** a migration that undoes an earlier RLS or function fix turns CI red on the pull
request.

---

## Step 7 — One calculation, one place

A figure computed in three places gets fixed in one. The remedy is to give each business figure a
single pure function in `src/lib/` or `src/utils/` with its own tests, and have every screen,
report and export call it. This is already the direction ("one package total", "one balance
formula"); this step makes it systematic.

1. **Pin before you move.** Before touching one of the most-fixed files, write
   *characterization tests*: tests that record what the current code returns for a few
   realistic inputs. Then extract the calculation into the shared function. If a pinned output
   changes, you either found a bug (log it) or broke something.
2. **Order of work,** by fix count since 1 September and missing tests:
   1. `Reports/services/generalReportService.ts` (13 fix commits, 592 lines, 83 `reduce`/`filter`
      calls): pull each figure (income, expense, financing, sales totals) into tested functions.
   2. GEN-9: one definition of "a sale" and "sales revenue" shared by the Director and Sales
      dashboards and the Sales report.
   3. Site management (`SiteManagement/index.tsx`, `ProjectDetail.tsx`): budget, committed and
      paid per project and phase come from one helper, the one Budget Control uses.
   4. `Sales/SalesProjects/UnitsGrid.tsx`: package totals and status rules, already partly
      shared.
3. **Find duplicates when you fix a figure.** When fixing any figure, first grep for the other
   places that compute it (`rg "budget_realized" src/`, for example) and fix them all in the same
   change, or log the ones you leave.
4. Add to `.claude/rules/architecture.md`: "A business figure (a total, a balance, a budget, EVM)
   is computed in one tested function in `src/lib` or `src/utils`. Screens and reports call it;
   they never re-derive it inline."

**Done when:** each of the four areas above reads its figures from tested shared functions.

---

## Step 8 — Commit, branch and review habits

1. **One problem per commit, one theme per branch.** A batch of five fixes in one commit can't be
   reverted piece by piece, and `git bisect` can't tell which one broke something. Batch the
   *release* (`development` → `main`), not the fix.
2. **Short-lived branches from a fresh `development`.** Pull before branching. Merge or rebase
   `development` into the branch the day you finish, not a week later. If two branches touch the
   same function or migration, finish one before starting the other.
3. **Squash-merge fix and feature pull requests into `development`.** That makes one commit per
   change, so it reverts and bisects cleanly. Keep a merge commit for the release pull request
   into `main`, so the release stays one visible unit.
4. **Review in a fresh context before committing.** The context that wrote a fix is the worst
   placed to find its mistakes. A separate context window, even with the same model, finds bugs
   the writer missed. In this repo:
   - `convention-reviewer` agent — "use the convention-reviewer agent on this diff" — for the
     project's own rules
   - `/code-review` for correctness on the branch or pull request
   - Tell the reviewer to look at **test and fixture diffs** in particular (Step 4's blind spot)
5. **Before a release,** do what was done on 2026-10-20: a read-only review of `main..development`
   split by area, plus the preflight queries against production. Keep the runbook in
   `docs/backlog/release.md`.

---

## Step 9 — Working with Claude

From the Claude Code best-practice collection and its sources:

- **New task, new session.** Fix one backlog item per session. A session that has worked through
  five fixes carries stale assumptions about the code it changed earlier. Above roughly 40 % of
  context, quality drops; `/clear` between unrelated tasks.
- **Plan mode for wrong-figure bugs.** Start in plan mode: "find every place this figure is
  computed, and the test that should have caught it". Approve the plan, then implement.
- **Ask for proof, not assurance.** "Show me the test failing before the fix and passing after",
  or "diff the figure between `main` and this branch on LandmarkDev".
- **Rewind rather than correct.** When an attempt goes wrong, rewind (Esc Esc) and re-prompt with
  what you learned, instead of piling corrections into the same context.
- **Turn repeated mistakes into enforced checks.** When Claude makes the same mistake twice, add
  a line to the matching path-scoped rule in `.claude/rules/`. Do the same when a review comment
  repeats. If a check can be automated (a lint rule, a test, a hook), prefer that: settings and
  hooks are enforced, CLAUDE.md is advice. Keep CLAUDE.md itself short: it is 163 lines now, and
  the guidance is under 200.

---

## Checklist

- [x] 0. CI on every push to `development` (PR #63, 2026-10-20)
- [x] 1a. GEN-23 test written, seen failing, fixed, closed (`fix/gen-23-evm-uncontracted`, 2026-10-20)
- [x] 1b. `/done`, `rules/backlog.md`, `rules/testing.md`, new-migration skill updated (2026-10-20)
- [x] 2. Required status checks on `main`; `development` deliberately left open (2026-10-20)
- [x] 3. Stop hook installed and tried (2026-10-20)
- [x] 4. Test-guard hook installed and tried (2026-10-20)
- [x] 5. `migrationSupersession.test.ts` covering every text test (2026-10-20)
- [x] 6a. `supabase start` applies all migrations locally; first two pgTAP tests green, and seen red (2026-10-20)
- [x] 6b. `db-tests.yml` green in CI and required on `main` (2026-10-20)
- [x] 6c. Four text tests replaced by pgTAP (five deleted, with SEC-004's); new-migration skill updated (2026-10-20)
- [ ] 7. Shared, tested figures for reports, sales, site management, units
- [ ] 8–9. Habits: one fix per commit, squash merges, fresh-context review, one task per session

---

## Sources

- Claude Code hooks reference — Stop and PreToolUse semantics, exit code 2, `permissionDecision`,
  `stop_hook_active`, `$CLAUDE_PROJECT_DIR`, timeouts: https://code.claude.com/docs/en/hooks
- Claude Code best-practice collection (verification loops, fresh-context review, CLAUDE.md as a
  mistake log, context hygiene, small squash-merged PRs):
  https://github.com/shanraisshan/claude-code-best-practice — in particular
  `tips/claude-boris-13-tips-03-jan-26.md`, `tips/claude-boris-10-tips-01-feb-26.md`,
  `tips/claude-boris-2-tips-10-mar-26.md`, `tips/claude-thariq-tips-17-mar-26.md`
- Supabase testing overview (pgTAP, `supabase test db`, GitHub Actions example, testing RLS as a
  user): https://supabase.com/docs/guides/local-development/testing/overview
- Supabase database testing and pgTAP:
  https://supabase.com/docs/guides/database/testing ·
  https://supabase.com/docs/guides/database/extensions/pgtap ·
  https://supabase.com/docs/reference/cli/supabase-test
- Agents editing tests to pass, and read-only checks as the defence:
  https://dev.to/penloom_studio_829b7817d3/your-ai-agent-will-pass-any-test-its-allowed-to-edit-51fo ·
  https://developertoolkit.ai/en/workflows/test/protect-the-oracle/
- Stop hooks that gate completion on tests (third-party; semantics checked against the reference
  above): https://codeongrass.com/blog/claude-code-hooks-done-means-tests-passed/ ·
  https://knightli.com/en/2026/07/10/claude-code-hooks-auto-run-tests/
