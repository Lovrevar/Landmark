# E2E Testing Strategy

This document defines how end-to-end tests are built, organised, and run against Cognilion. It is the source of truth for Step 2 (infrastructure) and every module suite that follows; if something is ambiguous here, resolve it and update this doc before writing code.

## Why E2E, why now

Cognilion has zero automated tests. Validation today relies on [docs/test/](./test/) — ten manual checklists walked through by a human before each release. That's slow, error-prone, and doesn't catch the class of bug we actually ship: cross-cutting interactions between auth, RLS, queries, and UI.

The target is roughly 20–40 real E2E tests covering critical user journeys across Auth, Cashflow, Sales, Funding, Retail, and Supervision. "Critical" means: a bug there means money miscounted, permissions bypassed, or data lost. Everything cosmetic or edge-of-edge is out of scope. If the suite goes green, a release is safe to ship.

These tests run against the **shared dev Supabase project** — the same one developers use day to day. That's by design: we want to exercise the real auth layer, real RLS policies, and real schema, not a mocked stand-in.

## 1. Framework and tooling

**Playwright** (`@playwright/test`, latest stable). Rationale:
- First-class fixtures that let us inject per-test namespaces and an admin Supabase client cleanly.
- Storage-state reuse — log in once per role, reuse the session across every test.
- Auto-waiting eliminates the flakiness class that kills hand-rolled E2E.
- Trace viewer is the single best debugging tool available; worth the suite on its own.
- Parallel by default, with `webServer` integration that starts Vite for us.

**Browsers**: Chromium only. Cognilion is used on desktop Chromium; cross-browser coverage is not worth the runtime cost for a suite this size.

**Playwright features in use**:
- `globalSetup` — logs in as each role once, writes `storageState` files.
- Fixtures via `test.extend()` — `ns` (per-test namespace), `admin` (service-role Supabase client), factory helpers.
- `webServer` in `playwright.config.ts` — boots `npm run dev` before tests; reuses existing server if already running.
- `trace: 'on-first-retry'`, `video: 'retain-on-failure'`, `screenshot: 'only-on-failure'`.

**Runner**: `npx playwright test` locally; GitHub Actions in CI.

## 2. Repository layout

All E2E code lives at the repo root under `e2e/`:

```
e2e/
  playwright.config.ts
  tsconfig.json                 # extends tsconfig.app.json, scopes to e2e/
  .auth/                        # gitignored — storage states written by globalSetup
    director.json
    accounting.json
    sales.json
    supervision.json
    investment.json
  support/
    supabase-admin.ts           # service-role client (cleanup only)
    namespace.ts                # runId + testId generator
    factories.ts                # createInvoice(), createCustomer(), etc.
    cleanup.ts                  # deleteByNamespace(runId|testId)
    auth.ts                     # loginAs(role) used by globalSetup
    env.ts                      # loads .env.test, asserts prod-safety
    fixtures.ts                 # test.extend() — auth + ns + admin + factories
  auth/
    login.spec.ts
    permissions.spec.ts
    session.spec.ts
  cashflow/
    invoices.spec.ts
    approvals.spec.ts
    payments.spec.ts
  sales/
    sales-flow.spec.ts
    units-link.spec.ts
  funding/
    credits.spec.ts
    drawdowns.spec.ts
  retail/
    land-plots.spec.ts
    invoices.spec.ts
  supervision/
    work-logs.spec.ts
  smoke.spec.ts                 # login-as-each-role, app loads (Step 2 deliverable)
```

Spec files mirror `src/components/` at the module level. Shared code lives in `e2e/support/`.

## 3. Shared-database isolation

This is the most important section. The dev Supabase project is shared with developers doing manual work, so the rules are strict.

### The rules

- **Tests must not wipe, truncate, or reset any table.**
- **Tests must not delete any record they did not create.**
- **Tests must not assert on global state** (total counts, full listings). Every assertion is scoped to data the test owns.
- **No test, ever, runs against prod Supabase.** Playwright hard-fails on load if the target URL isn't the dev URL allowlisted in `.env.test`.

### The approach: per-run namespace prefix + service-role cleanup

Every test run generates a `runId`:

```
runId = `e2e-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`
// e.g. e2e-1714320000000-a3f8c2d1
```

Within a run, each test gets a `testId`:

```
testId = `${runId}-${slug(testTitle)}`
// e.g. e2e-1714320000000-a3f8c2d1-invoice-multi-vat
```

Every user-visible text field that tests write — invoice number, customer name, project name, work-log note, land plot label, subcontractor name, description fields — is prefixed with the `testId`. Factory helpers in `e2e/support/factories.ts` apply the prefix automatically so test authors can't forget.

This gives us three layers of isolation, from loosest to tightest:
1. **By test user** — each role has its own pre-provisioned account with its own `auth_user_id`.
2. **By run** — everything a run creates carries the same `runId`. Another concurrent run (local dev + CI) has a different one. They can't collide.
3. **By test** — each test's records match `testId%`, so per-test cleanup touches only that test's rows.

### Cleanup

Two layers, for defence in depth:

**Per-test `afterEach` (fixture hook)** — deletes rows matching `testId%` from tables the test's factories touched. Runs even if the test failed. Uses the service-role admin client so it bypasses RLS (which does not consistently allow cross-user deletes).

**`globalTeardown` safety net** — sweeps every test-involved table for any row matching `${runId}%`. Catches rows orphaned by crashed tests, aborted runs, or factories that touched an untracked table.

Both layers are additive; the per-test path is the hot path, global teardown exists so a failure can't leave the DB dirtier than the test that caused it.

### Why these alternatives were ruled out

- **Wipe the DB between tests** — impossible; other developers are using it.
- **Transactional rollback** — Supabase exposes only HTTP, no transactional wrapping from the client side.
- **Test-only user data solely via RLS** — RLS is inconsistently owner-scoped in Cognilion's policies; some tables would permit deletes, others wouldn't. A namespace prefix is the only reliable cross-table contract.

### What about data other people create during a test run?

Developers doing manual work in dev create rows that our tests can see. That's fine, as long as:
- Tests filter by the `ns` prefix on any read that depends on order or count.
- Tests never assert on "the first invoice in the list" without scoping the list.
- Tests never assert on absolute totals across a table.

Every fixture returning a list must accept a namespace filter.

## 4. Environment variables and prod-safety

`.env.test` is gitignored. It contains:

```
VITE_SUPABASE_URL=https://ktfaimjkcvhkftwbnnwy.supabase.co
VITE_SUPABASE_ANON_KEY=<dev anon key>
VITE_CASHFLOW_PASSWORD=admin
SUPABASE_SERVICE_ROLE_KEY=<dev service-role key>
E2E_ALLOWED_SUPABASE_URL=https://ktfaimjkcvhkftwbnnwy.supabase.co
```

`playwright.config.ts` loads `.env.test` and **throws** before any test runs if `VITE_SUPABASE_URL !== E2E_ALLOWED_SUPABASE_URL`. The allowlist is explicit — we check that the target *is* the dev URL, rather than checking it *isn't* prod. That failure mode is safer: a misconfigured env that doesn't match the allowlist fails closed.

In CI, the same variables are provided as GitHub Actions secrets. The workflow asserts they are non-empty before calling `playwright test`.

> **Pre-existing concern, flagged separately:** the repo's `.env` currently contains `VITE_SERVICE_ROLE_KEY` with a `VITE_` prefix, which means Vite will inline it into the client bundle. That's a production security issue independent of this work, but worth tracking. The E2E infra should use a non-prefixed `SUPABASE_SERVICE_ROLE_KEY` loaded only by Node (Playwright support code), never the `VITE_` one.

## 5. Test users and roles

Five users have been provisioned in the dev Supabase project, all with password `e2e123`:

| Email | Role | Used by |
|---|---|---|
| `e2e-director@mail.com` | Director | Cross-cutting admin paths, Cashflow |
| `e2e-supervision@mail.com` | Supervision | Work logs, site management |
| `e2e-cashflow@mail.com` | Accounting | Cashflow invoices and approvals |
| `e2e-funding@mail.com` | Investment | Funding credits and drawdowns |
| `e2e-sales@mail.com` | Sales | Sales flow, customers |

Role strings as defined in [src/contexts/AuthContext.tsx:22](src/contexts/AuthContext.tsx#L22): `'Director' | 'Accounting' | 'Sales' | 'Supervision' | 'Investment'`.

Profiles are distinct from roles (see [src/contexts/AuthContext.tsx:22](src/contexts/AuthContext.tsx#L22)): `'General' | 'Supervision' | 'Sales' | 'Funding' | 'Cashflow' | 'Retail'`. The Cashflow profile is password-gated by `VITE_CASHFLOW_PASSWORD` (default `'admin'`) and stored in `sessionStorage` under `cashflow_unlocked`, enforced by the `CashflowRoute` wrapper in [src/App.tsx](src/App.tsx).

## 6. Auth helpers and storage state

`globalSetup.ts` runs once before the suite:
1. For each of the 5 users, launch a headless browser, navigate to the login page, sign in via the real login form (exercises `signInWithPassword` end-to-end).
2. After login, for Director and Accounting sessions, set `sessionStorage.setItem('cashflow_unlocked', 'true')` so Cashflow-scoped tests don't repeat the password flow on every test.
3. Save `storageState` to `e2e/.auth/{role}.json`.

Spec files declare their role at the top of the file or describe:

```ts
test.use({ storageState: 'e2e/.auth/director.json' })
```

That's all a test author needs to know — the session is ready, the Cashflow gate is open where relevant.

Why not log in per test? Speed. A single login round-trip is ~1–2s. Across 20–40 tests, per-test login costs a minute of suite time for no additional coverage; we already have a dedicated login spec that exercises the real flow.

## 7. Fixtures

Defined in `e2e/support/fixtures.ts`, exposed via `test.extend()`:

- `ns: string` — per-test namespace (`testId`). Auto-generated from the test title + runId. Every factory applies this to its inputs.
- `admin: SupabaseClient` — service-role client. Only used in support code; test bodies must not touch it (they drive the UI).
- Factory helpers: `createInvoice`, `createCustomer`, `createApartment`, `createCredit`, `createLandPlot`, `createWorkLog`. Each returns the created row and registers it for cleanup.
- `afterEach` fixture hook automatically deletes every registered row via the admin client, filtering on `testId`.

Factories talk directly to Supabase via the admin client to set up preconditions fast. They are not the flow under test — UI-driven creation is what specs assert against. Use factories when the test needs "an invoice already exists pending approval" as a precondition, not when the test is *about* creating an invoice.

## 8. Selectors and test structure

**No Page Object Model.** For a suite this size, POM is overhead with no payoff. Instead: **selectors-as-helpers**. Each module has a `selectors.ts` that exposes small typed functions returning `Locator`:

```ts
// e2e/cashflow/selectors.ts
export const invoiceRow = (page: Page, invoiceNumber: string) =>
  page.getByRole('row').filter({ hasText: invoiceNumber })

export const approveButton = (row: Locator) =>
  row.getByRole('button', { name: /approve/i })
```

Tests compose these. Flat, discoverable, no inheritance.

**Selector priority**, in order:
1. `getByRole` with accessible name (buttons, links, headings, dialogs).
2. `getByLabel`, `getByPlaceholder` for form inputs.
3. `getByText` (exact) for unambiguous UI elements.
4. `data-testid` — add to the app only where options 1–3 aren't feasible (icon-only buttons inside table rows, for instance). Every new `data-testid` is documented in the spec introducing it, and the component change ships in the same PR.

**Naming**: spec files `*.spec.ts`. Test titles describe a user outcome, not an implementation: "creates a multi-VAT invoice with correct totals", not "calls insertInvoice with vat_rate_1 = 0.25".

**Parallelism**: all tests parallel by default. Any spec that can't be is marked `test.describe.serial` with a comment explaining why. At time of writing, no serial specs are foreseen — the namespace prefix makes every test independent.

## 9. Anchor data (one-time dev-DB setup)

A small set of permanent, non-prefixed records must exist in the dev DB before tests can run. These are created once by a one-time SQL script shipped in Step 2 (`e2e/support/anchor-setup.sql`), documented in `e2e/README.md`, and never deleted by tests.

Required:
- **`E2E Anchor Project`** — a single row in `projects` that Supervision, Funding, and Retail tests attach work under. Avoids re-creating project records and re-assigning managers every run.
- **`project_managers`** row linking `e2e-supervision@mail.com` to the anchor project so work-log tests pass RLS.

Likely (decided in Step 2 once the smoke test reveals what's actually blocked by missing references):
- **`E2E Anchor Bank`** — for Funding credit tests.
- **`E2E Anchor Supplier`** — for Retail invoice tests.
- **`E2E Anchor Customer`** — retail customer for Retail invoice tests.

Everything else (invoices, payments, customers created in the test, sales records, work logs, land plots, credits, drawdowns) is per-test and fully cleaned up.

## 10. Per-module test plans

Each suite is 3–6 tests targeting critical journeys only. Total: **21 tests**, comfortably inside the 20–40 window with room to grow by ~2 per module.

### Auth and permissions — 5 tests (establishes the template)
1. Login as each of 5 roles lands on the correct dashboard (parameterised over the 5 users; each assertion checks the dashboard URL and a role-specific heading).
2. Login with a wrong password shows the expected error and does not redirect.
3. Logout clears the Supabase session, clears `cashflow_unlocked`, and redirects to login. A subsequent navigation to a protected route redirects back to login.
4. Session persists across a full page reload when valid — reloading on a protected route keeps the user on that route.
5. Sales role cannot reach `/cashflow/*` by URL (redirected) and does not see the Cashflow menu item in the nav.

### Cashflow — 5 tests
1. Director creates an invoice with two VAT rates (25% + 13%) via the UI; totals render correctly in the summary; after save, the row appears in the invoice list with the computed total.
2. Submitting an invoice where the summed VAT bases are zero is rejected by `invoiceValidation` and no row is created (per [src/components/Cashflow/Invoices/services/invoiceValidation.ts](src/components/Cashflow/Invoices/services/invoiceValidation.ts)).
3. Director (or Accounting) approves an invoice in the approval queue. The invoice leaves the queue, and `activity_log` contains a new row with the expected action string (`invoice.hide` — the string emitted by `approvalsService.ts`) and the correct `entity_id`.
4. Recording a payment against an invoice via `PaymentFormModal` reduces the invoice's `remaining_amount` by the payment amount and increments `paid_amount`.
5. Cashflow profile unlock: with `sessionStorage.cashflow_unlocked` cleared, switching to the Cashflow profile prompts for password; a wrong password is rejected; the correct password unlocks; logging out clears the flag.

### Sales — 4 tests
1. Create a customer via the UI, then create a sale for an existing apartment linking that customer. The apartment status flips to `Sold`; the customer status flips to `buyer`.
2. Link a garage + storage unit to an apartment. After navigating away and returning, the associations persist and display under the apartment.
3. Completing a sale writes a `sale.create` entry to `activity_log` with the correct `entity_id` pointing at the new sale row.
4. Sales role cannot access Funding or Cashflow routes (URL redirect) and does not see those menu items.

### Funding — 4 tests
1. Director creates a credit facility linked to a bank + the anchor project. The credit appears in the credit list scoped to that project.
2. Creating a credit allocation against the facility with an allocated amount ≤ facility amount succeeds; allocation > facility is rejected.
3. Recording a drawdown (an `OUTGOING_BANK` invoice tied to the credit) via the UI decreases the credit's remaining balance by the drawdown amount.
4. Sales role cannot access Funding routes.

### Retail — 3 tests
1. Create a land plot and link it to a retail project. The plot appears under the project.
2. Create a retail invoice tied to that plot, linking one customer and one supplier. The invoice appears in the retail invoice list.
3. Approving a retail invoice writes an `invoice.approve` entry to `activity_log` with `severity: 'high'` (per [src/components/Retail/Invoices/services/retailInvoiceService.ts](src/components/Retail/Invoices/services/retailInvoiceService.ts)).

### Supervision — 4 tests
1. Create a work log with `work_finished` status against the anchor project. The row appears in the work-log list.
2. Submitting a work log with `blocker` status but no `blocker_details` is rejected; with details, it succeeds.
3. Updating a work log from `blocker` to `work_finished` via the UI clears `blocker_details` on the row.
4. The Supervision user sees only projects listed in `project_managers` for their `auth_user_id` — the anchor project is visible, arbitrary other projects are not.

## 11. Activity log assertions

Several tests above assert on `activity_log` rows. Notes for test authors:

- The Cashflow **approvals** flow emits `invoice.hide` / `invoice.bulk_hide`, not `invoice.approve` (per [src/components/Cashflow/Approvals/services/approvalsService.ts](src/components/Cashflow/Approvals/services/approvalsService.ts)).
- The Retail **approvals** flow emits `invoice.approve` (per [src/components/Retail/Invoices/services/retailInvoiceService.ts](src/components/Retail/Invoices/services/retailInvoiceService.ts)).
- Assertions scope by `entity_id` matching the test's created record, not by action string alone — there may be unrelated rows for the same action elsewhere in the log from other users.
- Tests read `activity_log` via the `admin` fixture (service role) so they bypass read-side RLS and can assert reliably.

## 12. CI strategy

- **GitHub Actions**. Workflow: `.github/workflows/e2e.yml`.
- **Triggers**: pull requests to `main` and `development`; `workflow_dispatch` for ad-hoc runs.
- **Runtime environment**: `ubuntu-latest`, Node 20, `npx playwright install --with-deps chromium`.
- **Secrets**: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `CASHFLOW_PASSWORD`, `E2E_ALLOWED_SUPABASE_URL`. Workflow asserts each is non-empty before running tests.
- **Sharding**: start single-shard. If the suite exceeds 8 minutes, split into 2 shards via Playwright's `--shard=i/n` with a GitHub matrix. Not needed at the 21-test baseline.
- **Artifacts**: upload `playwright-report/` and `test-results/` on failure, 14-day retention. Traces, videos, and screenshots are sufficient to debug any failure without re-running.
- **Estimated runtime**: 4–6 minutes at the 21-test baseline (globalSetup ~10s, 21 tests × ~8–15s parallel across workers). Well under the 10-minute target.

## 13. Constraints recap

Pulled into one place because they are load-bearing:

- **Deterministic** — no time-dependent assertions without a fixed clock, no manual waits beyond Playwright's auto-waiting, no reliance on network timing.
- **Parallel by default** — anything serial is marked with a comment.
- **Namespace-scoped cleanup** — tests remove only what they created, matched by `testId` prefix.
- **Prod-safety** — Playwright hard-fails on load unless `VITE_SUPABASE_URL` matches the dev allowlist.
- **Runtime target** — full suite ≤ 10 minutes on CI.

## 14. Open questions for Step 2

These are ambiguities the infra step will resolve by running the smoke test — not blockers for this strategy, but decisions to document when they land:

1. **RLS coverage per test user**. Each test user is expected to be able to read and write the tables its journeys touch. The login-as-each-role smoke test + the first real spec per module will surface any policy that blocks a test user from doing its job; fixes go in the dev DB (policy update) or in test design (use a higher-privileged user).
2. **Anchor record completeness**. The list in section 9 is best-guess. The Step 2 smoke test will reveal which anchor records are actually required; the README will land with the final list.
3. **Concurrency in practice**. The strategy permits overlapping runs (dev + local + CI) because each has its own `runId`. If two runs happen to both touch the anchor project simultaneously, the namespace prefix still isolates their data, but contention-sensitive assertions (e.g., "my work log is the newest") must be scoped to the run's namespace. Tests must prefer `.filter({ hasText: ns })` over "most recent" assertions.

## 15. Deliverables for the next step

Step 2 ships:
- `playwright.config.ts`, `e2e/tsconfig.json`
- `e2e/support/` — env, namespace, admin client, auth, factories, cleanup, fixtures
- `e2e/.auth/` (gitignored) produced by globalSetup
- `e2e/smoke.spec.ts` — one test per role, logs in, asserts dashboard loads
- `e2e/support/anchor-setup.sql` — one-time dev-DB seeding script
- `e2e/README.md` — how to run tests locally, how to set up the dev DB the first time
- `.github/workflows/e2e.yml` — CI pipeline
- `package.json` script: `"test:e2e": "playwright test"`
- `.gitignore` entries for `e2e/.auth/`, `.env.test`, `playwright-report/`, `test-results/`

Then stop and wait for review before writing module tests in Step 3 (Auth & permissions).
