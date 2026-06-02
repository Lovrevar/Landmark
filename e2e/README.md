# E2E tests

Playwright end-to-end tests running against the shared dev Supabase project. See [`docs/e2e-testing-strategy.md`](../docs/e2e-testing-strategy.md) for the full rationale; this file is just how to run things.

## First-time setup (per developer machine)

1. **Install Playwright browsers** (dev dependencies are already in `package.json`):
   ```bash
   npx playwright install chromium
   ```
   On CI and on fresh Linux machines you may also need the OS packages:
   ```bash
   npx playwright install-deps chromium
   ```

2. **Create `.env.test`** in the repo root from the template:
   ```bash
   cp .env.test.example .env.test
   ```
   The only value that must be set is `E2E_ALLOWED_SUPABASE_URL`, which must equal `VITE_SUPABASE_URL` in your `.env`. The prod-safety check hard-fails on mismatch.

3. **Seed the dev DB with anchor data (one-time, per dev Supabase project):**
   Open Supabase Studio for the dev project, load the SQL editor, paste [`support/anchor-setup.sql`](./support/anchor-setup.sql), and run it (anchor project + the Supervision `project_managers` link). Idempotent — safe to re-run. The test **users** are *not* created here — `globalSetup` provisions them automatically (see below).

## Test users (auto-provisioned by globalSetup)

`globalSetup` creates these idempotently via the Supabase Admin API (`auth.admin.createUser` with `email_confirm` + `app_metadata.role`, then upserts the `public.users` role) on every run — so a fresh or reset dev Supabase project needs **no** manual user setup; the first `npm run test:e2e` provisions them.

| Email | Password | Role | Notes |
|---|---|---|---|
| `e2e-director@mail.com` | `e2e123` | Director | |
| `e2e-cashflow@mail.com` | `e2e123` | Accounting | |
| `e2e-sales@mail.com` | `e2e123` | Sales | |
| `e2e-supervision@mail.com` | `e2e123` | Supervision | |
| `e2e-funding@mail.com` | `e2e123` | Investment | |
| `e2e-logout@mail.com` | `e2e123` | Director | Dedicated to `auth/session.spec` (see "Writing new tests"); recreated cleanly each run. |

The five role users are created only when missing (they may carry dependent data); the logout user is recreated from scratch each run.

## Running tests locally

```bash
npm run test:e2e           # headless, full suite
npm run test:e2e:ui        # Playwright UI mode, pick tests interactively
npm run test:e2e:debug     # headed, Playwright inspector
```

The first run will start the Vite dev server via Playwright's `webServer` and reuse it on subsequent runs (outside CI). If you already have `npm run dev` running, Playwright reuses it.

A successful first run writes storage states to `e2e/.auth/*.json` (gitignored). These are session files per role (plus the logout user); tests reuse them so we log in once, not per test.

## Smoke test only

The smoke test logs in as every role and verifies the app shell loads. Running it alone is the fastest way to validate setup:

```bash
npx playwright test smoke
```

## When a test fails

On CI: the HTML report and per-test traces/videos/screenshots are uploaded as GitHub Actions artifacts (`playwright-report`), 14-day retention.

Locally: `npx playwright show-report` after a failing run opens the HTML report with traces inline.

## Writing new tests

- Mirror the `src/components/<module>/` layout under `e2e/<module>/`.
- Import `test, expect` from `./support/fixtures` (not directly from `@playwright/test`) so every spec gets the `ns` and `admin` fixtures and the auto-cleanup `afterEach`.
- Use `ns` in any record your test creates: `invoice_number: ns + '-001'`, etc. Factories applying this automatically live in [`support/factories.ts`](./support/) — add to them as you go.
- When a new table becomes testable, register its namespaced column in [`support/cleanup.ts`](./support/cleanup.ts) so teardown removes the test's rows.
- **A spec that signs the session out (or otherwise destroys a session) must use a dedicated user, never a shared role.** The app's logout is a global-scope `signOut` that revokes *every* session for that user; under parallel workers that would invalidate the shared role session another spec is mid-flow on (it surfaced as intermittent drops to `/login`). `auth/session.spec` uses the dedicated `e2e-logout` user — add another via `LOGOUT_USER`/`SETUP_USERS` in [`support/auth.ts`](./support/auth.ts) if you write another destructive-session spec.

## Troubleshooting

- **`Prod-safety check failed`** — `.env.test` is missing or `E2E_ALLOWED_SUPABASE_URL` doesn't match `VITE_SUPABASE_URL`. Fix `.env.test`.
- **`Missing required env var: SUPABASE_SERVICE_ROLE_KEY`** — it's in `.env` as of the E2E setup, but if you cloned fresh you may need to ask for the key.
- **globalSetup fails** — it first provisions users via the Admin API (`ensureSeedUsers`), then logs each in (a screenshot is written to `e2e/.auth/<role>-login-failure.png` on a login failure). If provisioning errors, the service-role key likely lacks Admin API access, or an existing `auth.users` row is malformed — raw-SQL-seeded auth users can wedge the GoTrue admin API (e.g. `Database error finding users`); delete the offending row via SQL and re-run.
- **Tests leave rows behind** — a crashed test may leak. The `globalTeardown` safety net sweeps by `runId` prefix; if that also fails you can manually delete rows matching `e2e-%` from the affected table via Supabase Studio.
