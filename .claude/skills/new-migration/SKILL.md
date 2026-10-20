---
name: new-migration
description: Use when a change needs a new Supabase migration (table, column, policy, RPC, trigger, grant). Writes the file in this repo's style; never applies it.
argument-hint: "[what the migration does]"
---

# Write a migration

Latest migrations:

!`ls supabase/migrations | tail -5`

**Write the file; never apply it.** Do not run `supabase db push`, `migration up`, `psql` or any
SQL against a project unless the user asks for exactly that. The local Docker stack
(`supabase start`, `supabase db reset`, `npm run test:db`) is not a project: use it freely.

## Before writing

- `task*` tables, RPCs or policies → read `docs/SHARED_SCHEMA.md` first (shared with the mobile app)
- Invoices, payments, bank balances → read `docs/erp-integration/` first
- Check the existing policies on the tables you touch in the latest migration that defines them
- Replacing a function, view, trigger, index or policy that an older migration created: run
  `npx vitest run src/lib/migrationSupersession.test.ts`. A failure names the older test that
  reads the old file — check the new definition still does what it asserts, then re-point the
  test and its row

## The file

- Name: `supabase/migrations/YYYYMMDDHHMMSS_snake_case_summary.sql`, later than the newest above.
  Same-day migrations step by `100` (`…100000`, `…100100`)
- Open with a `/* … */` block saying **why** — the problem, the backlog id it fixes (`SALES-10`),
  and anything the operator must do by hand after applying
- Idempotent: `CREATE … IF NOT EXISTS`, `DROP POLICY IF EXISTS` before `CREATE POLICY`,
  `CREATE OR REPLACE FUNCTION`
- New tables: `ENABLE ROW LEVEL SECURITY`, policies `TO authenticated` using
  `public.app_user_role()` (and `public.app_can_access_project(project_id)` for Supervision), and
  explicit `REVOKE`/`GRANT` so the grants say the same as the policies
- `COMMENT ON` new tables and non-obvious columns
- `SECURITY DEFINER` functions set `search_path` and check the role themselves

## Test it in SQL

Every new function, policy or trigger gets a pgTAP test in `supabase/tests/database/`, named after
its backlog id (`sales_10_cancel_sale.test.sql`), in the same commit. How to write one:
`docs/TESTING.md` → Database tests; the existing files there are the examples.

1. Write the test first. With the migration moved out of `supabase/migrations/`, run
   `supabase db reset && npm run test:db` and see it fail
2. Put the migration back, `supabase db reset && npm run test:db`, see it pass
3. Test as each role that matters (set the role and JWT claims), and assert the outcome a user
   would see: the rows they get back, the error code, what is left after a refused delete
4. Do not write a new test that reads the migration's text

The local stack needs Docker and `supabase start`. Resetting it is local only; it never touches a
linked project. If Docker is not available, say so and leave the test for the user to run.

## After writing

- Add an unticked "Apply `<name>`" item to `docs/backlog/release.md` with the check to run after
  applying, dev first
- Say that `src/types/database.ts` needs `/db-types` once it is applied
- Update the module's doc in `docs/` if the data model changed
