# Stopping fixed bugs from coming back

**Written:** 2026-10-20 · **Status:** plan, nothing below is implemented yet unless ticked

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

3. **A new path-scoped rule, `.claude/rules/testing.md`.** It loads only when tests or `src/` are
   touched, which keeps CLAUDE.md short:

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

CI now runs typecheck, lint, unit tests and the edge-function tests on every push and pull
request. Nothing stops a red pull request from being merged, though.

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

1. Create **`.claude/hooks/stop-verify.mjs`**:

   ```js
   #!/usr/bin/env node
   // Stop hook: before Claude ends a turn that changed src/, run the typecheck and the tests
   // related to the changed files. On failure, exit 2 — Claude receives stderr and carries on.
   // Blocks at most once per turn (stop_hook_active); CI is the full check.
   import { execSync, spawnSync } from 'node:child_process'
   import { createHash } from 'node:crypto'
   import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'

   const input = JSON.parse(readFileSync(0, 'utf8') || '{}')
   if (input.stop_hook_active) process.exit(0)

   const git = (args) => execSync(`git ${args}`, { encoding: 'utf8' })
   const changed = [
     ...git('diff --name-only HEAD').split('\n'),
     ...git('ls-files --others --exclude-standard').split('\n'),
   ].filter((f) => /^src\/.*\.(ts|tsx)$/.test(f) && existsSync(f))
   if (changed.length === 0) process.exit(0)

   // Skip when nothing changed since the last green run.
   const stampDir = 'node_modules/.cache'
   const stampFile = `${stampDir}/stop-verify`
   const hash = createHash('sha1').update(git('diff HEAD -- src')).update(changed.join('\n')).digest('hex')
   if (existsSync(stampFile) && readFileSync(stampFile, 'utf8') === hash) process.exit(0)

   const tail = (s, n = 60) => s.split('\n').slice(-n).join('\n')
   const run = (cmd, args) => spawnSync(cmd, args, { encoding: 'utf8', shell: process.platform === 'win32' })

   const tsc = run('npm', ['run', '-s', 'typecheck'])
   if (tsc.status !== 0) {
     process.stderr.write(`Typecheck fails — fix it before finishing:\n${tail(tsc.stdout + tsc.stderr)}\n`)
     process.exit(2)
   }

   const tests = run('npx', ['vitest', 'related', '--run', ...changed])
   if (tests.status !== 0) {
     process.stderr.write(`Tests related to your changes fail — fix the code, not the test, unless the test is wrong (then say why):\n${tail(tests.stdout + tests.stderr)}\n`)
     process.exit(2)
   }

   mkdirSync(stampDir, { recursive: true })
   writeFileSync(stampFile, hash)
   process.exit(0)
   ```

2. Register it in **`.claude/settings.json`**, as a new top-level `"hooks"` key next to
   `"permissions"`:

   ```json
   "hooks": {
     "Stop": [
       {
         "hooks": [
           { "type": "command", "command": "node \"$CLAUDE_PROJECT_DIR/.claude/hooks/stop-verify.mjs\"", "timeout": 300 }
         ]
       }
     ]
   }
   ```

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

1. Create **`.claude/hooks/guard-tests.mjs`**:

   ```js
   #!/usr/bin/env node
   // PreToolUse hook (Edit|Write): if an edit to an existing test file removes or rewrites an
   // assertion, or adds .skip/.only, ask the user before it is applied. Additions pass silently.
   import { existsSync, readFileSync } from 'node:fs'

   const input = JSON.parse(readFileSync(0, 'utf8') || '{}')
   const file = input.tool_input?.file_path ?? ''
   if (!/\.test\.(ts|tsx)$|\/supabase\/tests\/.*\.sql$/.test(file) || !existsSync(file)) process.exit(0)

   const before = input.tool_name === 'Edit' ? input.tool_input.old_string ?? '' : readFileSync(file, 'utf8')
   const after = input.tool_name === 'Edit' ? input.tool_input.new_string ?? '' : input.tool_input.content ?? ''

   const assertion = /\b(expect|it|test|describe|ok|is|isnt|results_eq|throws_ok|lives_ok|is_empty)\b[\w.]*\s*\(/
   const lines = (s) => s.split('\n').map((l) => l.trim()).filter((l) => assertion.test(l))
   const kept = new Set(lines(after))
   const removed = lines(before).filter((l) => !kept.has(l))
   const skipped = /\.(skip|only|todo)\s*\(/.test(after) && !/\.(skip|only|todo)\s*\(/.test(before)

   if (removed.length === 0 && !skipped) process.exit(0)

   const reason = [
     `This edit to ${file.replace(process.env.CLAUDE_PROJECT_DIR + '/', '')} ${skipped ? 'adds .skip/.only/.todo' : 'removes or changes existing assertions'}:`,
     ...removed.slice(0, 6).map((l) => `  - ${l}`),
     'Approve only if the old expectation was wrong, not because it was failing.',
   ].join('\n')
   process.stdout.write(JSON.stringify({
     hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'ask', permissionDecisionReason: reason },
   }))
   process.exit(0)
   ```

2. Add to the `"hooks"` block in `.claude/settings.json`:

   ```json
   "PreToolUse": [
     {
       "matcher": "Edit|Write",
       "hooks": [
         { "type": "command", "command": "node \"$CLAUDE_PROJECT_DIR/.claude/hooks/guard-tests.mjs\"" }
       ]
     }
   ]
   ```

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

1. Create **`src/lib/migrationSupersession.test.ts`**:

   ```ts
   import { describe, it, expect } from 'vitest'
   import { readdirSync, readFileSync } from 'node:fs'
   import { resolve } from 'node:path'

   /**
    * The *.test.ts files under src/lib read a migration's text. That only proves something while
    * the migration is the LAST one to define what it tests. When a newer migration replaces the
    * function or the table's policies, this fails: read the new definition, check it still does
    * what the old test asserts, then point the old test (and the entry here) at the new file.
    */
   const dir = resolve(process.cwd(), 'supabase/migrations')
   const migrations = readdirSync(dir)
     .filter((f) => f.endsWith('.sql'))
     .sort()
     .map((f) => ({ f, sql: readFileSync(resolve(dir, f), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/--.*$/gm, '') }))

   const lastTouching = (pattern: RegExp) => migrations.filter((m) => pattern.test(m.sql)).at(-1)?.f

   const fn = (name: string) =>
     new RegExp(`(create\\s+(or\\s+replace\\s+)?|alter\\s+|drop\\s+)function\\s+(if\\s+exists\\s+)?("?public"?\\.)?"?${name}"?\\s*\\(`, 'i')
   const policiesOn = (table: string) =>
     new RegExp(`(create|alter|drop)\\s+policy\\s+(if\\s+exists\\s+)?"[^"]+"\\s+on\\s+("?public"?\\.)?"?${table}"?\\b`, 'i')

   // What each text test covers → the migration it reads. Update both together.
   const COVERED: Array<[string, RegExp, string]> = [
     ['cancel_apartment_sale()', fn('cancel_apartment_sale'), '20261012100100_cancel_apartment_sale.sql'],
     ['app_can_access_project()', fn('app_can_access_project'), '20261012100000_contracts_project_scope.sql'],
     ['policies on contracts', policiesOn('contracts'), '20261012100000_contracts_project_scope.sql'],
     ['policies on subcontractor_milestones', policiesOn('subcontractor_milestones'), '20261012100000_contracts_project_scope.sql'],
     ['apply_unphased_tic_budget()', fn('apply_unphased_tic_budget'), '20261015100000_unphased_tic_phase_budgets.sql'],
     ['sync_project_from_tic()', fn('sync_project_from_tic'), '20261015100000_unphased_tic_phase_budgets.sql'],
     ['policies on organization_settings', policiesOn('organization_settings'), '20261015100100_organization_settings.sql'],
   ]

   describe('text-tested migrations are still the latest definition', () => {
     it.each(COVERED)('%s', (_label, pattern, file) => {
       expect(lastTouching(pattern), `a newer migration redefines this — re-check its test`).toBe(file)
     })
   })
   ```

2. Run `npx vitest run src/lib/migrationSupersession.test.ts`. All entries should pass today. If
   one fails right away, a later migration already redefines it, which is exactly the case to
   look at.
3. Add the rows for `storageDocumentPolicies.test.ts`, `uniqueUnitNumbers.test.ts` and
   `invoiceCashDirection.test.ts`. Their objects are storage policies, indexes and a view: use a
   pattern for `create policy … on storage.objects` restricted to the policy names, `create …
   index … apartments_unique_number_per_building`, and `create … view … company_statistics`.
4. Add a line to the new-migration skill (`.claude/skills/new-migration/SKILL.md`): "If the
   migration replaces a function, view or policy, run `npx vitest run src/lib` — a
   supersession failure means an older test needs re-pointing."

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

1. Start Docker Desktop on Windows (it is installed in WSL but not running by default), then:

   ```bash
   supabase start          # applies all migrations to a local database; first run pulls images
   ```

   If a migration fails here, stop and fix that first. It means a fresh project (a new test or
   demo environment) can't be built from the repository either. Note the baseline gap in
   `docs/` (non-`public` objects were not dumped). It is the likeliest cause.
2. Create the folder and a first, schema-wide test, **`supabase/tests/database/00_rls_enabled.test.sql`**:

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

3. Turn the strongest text test into a real one: **`supabase/tests/database/sec_004_contracts_scope.test.sql`**.
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

4. Run `supabase test db`. Then break it on purpose to see it go red: in a scratch migration,
   recreate the old `USING (true)` SELECT policy on `contracts` and run `supabase db reset &&
   supabase test db`. Delete the scratch migration afterwards.
5. Write the next ones in this order. Each replaces or backs a text test:
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

### 6b. In CI

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
- [ ] 1a. GEN-23 test written, seen failing, fixed, closed
- [ ] 1b. `/done`, `rules/backlog.md`, `rules/testing.md` updated
- [ ] 2. Required status checks on `main` and `development`
- [ ] 3. Stop hook installed and tried
- [ ] 4. Test-guard hook installed and tried
- [ ] 5. `migrationSupersession.test.ts` covering every text test
- [ ] 6a. `supabase start` applies all migrations locally; first two pgTAP tests green
- [ ] 6b. `db-tests.yml` green in CI and required
- [ ] 6c. Four text tests replaced by pgTAP; new-migration skill updated
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
