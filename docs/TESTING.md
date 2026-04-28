# Cognilion — Testing

Two complementary layers:

1. **Automated E2E suite** — Playwright, runs against the dev Supabase project, green suite required before release. Covers critical paths across Auth, Cashflow, Sales, Funding, Retail, Supervision.
2. **Manual testing cheat sheet** — module-by-module walkable checklists under [./test/](./test/). Source of truth for edge cases, uncommon flows, and UX regressions not yet worth automating.

Run E2E first to catch the blunt-force regressions, then walk the relevant manual sheet for the module you touched.

---

## E2E suite

**Location:** [`e2e/`](../e2e/). Strategy write-up: [`docs/test/e2e-testing-strategy.md`](./test/e2e-testing-strategy.md). Day-to-day commands live in [`e2e/README.md`](../e2e/README.md).

### Current coverage (25 tests)

| Module | Spec | Tests |
|---|---|---|
| Auth | `auth/login.spec.ts` | 6 (5 valid-credential logins + 1 invalid password) — runs `describe.serial` to avoid Supabase auth rate limits |
| Auth | `auth/permissions.spec.ts` | 4 — Sales user redirected from `/accounting-invoices`, `/accounting-payments`, `/accounting-approvals`, `/debt-status` |
| Auth | `auth/session.spec.ts` | 2 — logout clears session + Cashflow flag; reload on a protected route stays authenticated |
| Cashflow | `cashflow/approvals.spec.ts` | 1 — Director hides an approved invoice; row lands in `hidden_approved_invoices` |
| Cashflow | `cashflow/unlock.spec.ts` | 2 — wrong password keeps modal open with `aria-invalid`; correct password sets the sessionStorage flag and opens `/accounting-invoices` |
| Funding | `funding/access.spec.ts` | 2 — Investment user reaches `/banks` + `/funding-credits` |
| Retail | `retail/customers.spec.ts` | 1 — Director creates a retail customer via the form; admin client verifies the row |
| Sales | `sales/customers.spec.ts` | 1 — Sales user creates a customer via the form; admin client verifies the row |
| Supervision | `supervision/work-logs.spec.ts` | 1 — Supervision user reaches `/work-logs` and the E2E anchor project appears in the project select (exercises `project_managers` RLS) |
| Smoke | `smoke.spec.ts` | 5 — every role's authenticated app shell loads |

Total runtime on a warm system: **~1 minute**.

### Architecture highlights

- **Framework:** Playwright (`@playwright/test`), Chromium only, parallel by default capped to 2 workers locally (matches CI).
- **webServer:** Playwright boots `npm run build && npm run e2e:serve` (Vite preview against the production bundle). Dev server was too slow for cold-compiled routes; preview serves a single pre-built bundle so every navigation finishes in <1 s. See [`playwright.config.ts`](../playwright.config.ts).
- **Auth:** `globalSetup` logs in each of the 5 pre-provisioned test users and writes `storageState` to `e2e/.auth/{role}.json`. Specs declare their role via `test.use({ storageState })`.
- **Isolation:** shared dev DB, no wipes. Each run gets a `runId = e2e-${Date.now()}-${uuid}`. Each test gets `ns = runId-{slug}` via the `ns` fixture. Any row a test creates must carry `ns` in a namespace-able text column (invoice_number, name, etc.). A per-test `afterEach` plus a `globalTeardown` safety net delete every row matching the prefix via the service-role admin client.
- **Namespaced tables:** registered in [`e2e/support/cleanup.ts`](../e2e/support/cleanup.ts) — currently `accounting_invoices.invoice_number`, `customers.name`, `retail_customers.name`. FK cascades handle dependent rows (e.g. `hidden_approved_invoices` cascades with its parent invoice).
- **Factories:** helpers under [`e2e/support/factories/`](../e2e/support/factories/) seed rows that require schema-specific coupling (e.g. [`cashflowInvoices.ts`](../e2e/support/factories/cashflowInvoices.ts) picks an existing subcontractor to satisfy `check_invoice_entity_type`).
- **Prod-safety:** [`e2e/support/env.ts`](../e2e/support/env.ts) hard-fails on load if `VITE_SUPABASE_URL !== E2E_ALLOWED_SUPABASE_URL`. Both come from `.env` + `.env.test`.
- **Base URL pinned to `http://127.0.0.1:5173`** — on WSL2, `localhost` resolves to `::1` but Vite binds to `127.0.0.1`; Chromium hangs on the IPv6 attempt. Override via `E2E_BASE_URL` in other environments.
- **Page.goto override:** the `page` fixture wraps `page.goto` to default to `waitUntil: 'commit'` so navigations return as soon as response headers arrive; subsequent selectors gate on real UI readiness. Prevents hangs on dev servers that never fire `load` for deeply-imported SPA entry points.

### Test users (pre-provisioned in the dev Supabase project)

| Email | Password | Role |
|---|---|---|
| `e2e-director@mail.com` | `e2e123` | Director |
| `e2e-cashflow@mail.com` | `e2e123` | Accounting |
| `e2e-sales@mail.com` | `e2e123` | Sales |
| `e2e-supervision@mail.com` | `e2e123` | Supervision |
| `e2e-funding@mail.com` | `e2e123` | Investment |

### Anchor data

One-time dev-DB seed (idempotent) at [`e2e/support/anchor-setup.sql`](../e2e/support/anchor-setup.sql): creates `E2E Anchor Project` and links `e2e-supervision@mail.com` via `project_managers`. Run once per dev Supabase project before the first test run.

### Running

```bash
npm run test:e2e           # headless, full suite
npm run test:e2e:ui        # Playwright UI mode
npm run test:e2e:debug     # headed with inspector
npx playwright test smoke  # smoke only — fastest validation of the setup
```

First run builds the app (~10–15 s) before starting the preview server. Subsequent runs reuse the running preview if `reuseExistingServer` is on (default locally, off in CI).

### CI

GitHub Actions workflow [`e2e.yml`](../.github/workflows/e2e.yml) runs on PRs to `main` / `development` and on `workflow_dispatch`. Secrets required: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `CASHFLOW_PASSWORD`, `E2E_ALLOWED_SUPABASE_URL`. Failed runs upload `playwright-report/` and `test-results/` with 14-day retention.

### Adding a test

1. Mirror the module layout: `e2e/<module>/<feature>.spec.ts`.
2. `import { test, expect } from '../support/fixtures'` — don't import raw `@playwright/test` unless you specifically need to bypass the shared fixtures (the Cashflow unlock spec is the only current case, because it needs `sessionStorage.cashflow_unlocked` to start empty).
3. If the test writes data, namespace it: `${ns}-something`. Register the new table in [`cleanup.ts`](../e2e/support/cleanup.ts) if it isn't already.
4. Keep specs scoped: one user flow per `test(...)`, one spec per feature. Pick selectors by role / accessible name; fall back to scoped positional selectors inside a portaled modal when FormField-style unlinked label-input pairs make `getByLabel` unreliable.

---

## Manual testing cheat sheet

A walkable checklist per module. Walk it top-to-bottom; tick each line as you go.

> The module sections live as separate files under [./test/](./test/). This file keeps the preamble and the table of contents; each entry below links out to its own section file.

### Status markers

Each test line ends with a single-character marker in parentheses:

| Marker | Meaning |
|---|---|
| `(+)` | Pass — behaved as expected |
| `(-)` | Fail — file a bug with a reference to this line |
| `( )` | Not yet tested |
| `(~)` | Blocked — missing test data, staging unavailable, dependency broken |
| `(N/A)` | Not applicable for the current role/profile |

### Test environment assumptions

Before starting, confirm you have:

- **Staging URL** reachable, with a clean or predictable dataset. Destructive actions (delete, bulk-delete, imports) are listed throughout — **do not run them on production**.
- **Demo accounts** for each of the 5 roles: `Director`, `Accounting`, `Sales`, `Supervision`, `Investment`. Default to `Director` unless a test line requires otherwise.
- **Cashflow profile password** on hand — the Cashflow profile is password-gated.
- **Language** set to English unless the line is inside the Language switcher section of [Foundations](./test/01-foundations.md).
- **Two browser sessions** (e.g. normal + incognito) available for realtime tests (Chat unread badge, Calendar RSVP).
- Sample assets for uploads: a valid PDF (~200 KB), an oversized file (>10 MB), an invalid type (`.exe` or `.zip`), a sample Excel for imports, images for task attachments.

### Reading a test line

```
add an invoice with all of the fields entered   (+)
add an invoice with the invoice number missing  ( )
add an invoice with VAT rates that don't sum    ( )
```

Per action group you'll typically find:
- **One golden-path line** — all fields valid
- **One line per required field left empty**
- **One or two invalid-input lines** — bad format, out-of-range, future date, negative number, duplicates, Croatian characters, very long strings
- **One cancel/close line** where relevant (Esc, X button, backdrop)
- **One permission line** for roles/profiles that shouldn't see the feature

### Croatian domain terms

`cesija`, `kompenzacija`, `stan`, `garaža`, `repozitorij`, `TIC`, `OIB` are **kept in Croatian** throughout this doc — do not mentally translate them; they are legally/domain-specific concepts.

### Preconditions

Each action group starts with an italic line listing any preconditions. Example:

> _Role: Director. Profile: Cashflow. Needs: at least one supplier, one company, one project._

### Seeding helpers

- [`test/seed-tasks.sql`](./test/seed-tasks.sql) — ~25 representative tasks (overdue, today, upcoming, done, private, no-due-date) plus a few comments. Safe to re-run — uses `ON CONFLICT DO NOTHING` on titles. Picks the first 3 users + first 2 projects from the target DB, so run it against a DB that has them.
- [`test/seed-calendar.sql`](./test/seed-calendar.sql) — ~15 representative events (past/today/tomorrow/later, meeting/personal/deadline/reminder, private, all-day multi-day, two recurring masters with exceptions + a per-occurrence RSVP override). Re-runnable — every seeded event description starts with `[calendar-seed]` and the script deletes rows with that marker before inserting (cascades wipe participants/exceptions/occurrence_responses).
- [`test/reset.sh`](./test/reset.sh) — destructive local reset helper; read the script before running.

---

## Table of contents

1. [Foundations](./test/01-foundations.md) — auth, profile switcher, language switcher, layout & navigation, shared UI behaviours
2. [Cashflow](./test/02-cashflow.md) — Invoices, Payments, Approvals, Debt Status, Banks, Suppliers, Office Suppliers, Customers, Companies, Loans, Cashflow Calendar
3. [Sales](./test/03-sales.md) — Sales Projects → Buildings → Units, Apartments, Customers, Payments
4. [Retail](./test/04-retail.md) — Projects, Land Plots, Customers, Invoices, Sales
5. [Funding](./test/05-funding.md) — Investors, Investments, Projects, Payments / Disbursements, TIC
6. [Supervision](./test/06-supervision.md) — Site Management, Subcontractors, Work Logs, Invoices, Payments
7. [General, Reports & Dashboards](./test/07-general-reports-dashboards.md) — General → Projects, Budget Control, Activity Log, Reports, Dashboards per profile
8. [Collaboration](./test/08-collaboration.md) — Calendar, Chat, Tasks
9. [Cross-cutting](./test/09-cross-cutting.md) — permissions matrix, Activity Log verification sweep, i18n sweep, release smoke list
10. [Appendix: format conventions recap](./test/10-appendix.md)
