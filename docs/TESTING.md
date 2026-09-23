# Cognilion — Testing

Three complementary layers:

1. **Unit suite** — Vitest, runs in-process with no DB, fast feedback. Covers pure functions (formatters, VAT calculations, price/credit math, TIC formatters, tree helpers).
2. **Automated E2E suite** — Playwright, runs against the dev Supabase project, green suite required before release. Covers critical paths across Auth, Cashflow, Sales, Funding, Retail, Supervision.
3. **Manual testing cheat sheet** — module-by-module walkable checklists under [./test/](./test/). Source of truth for edge cases, uncommon flows, and UX regressions not yet worth automating.

Run the unit suite for instant feedback on the logic you touched, then E2E to catch the blunt-force regressions, and finally walk the relevant manual sheet for the module you touched.

---

## Unit suite

**Runner:** [Vitest](https://vitest.dev/) (`vitest` ^1.6.1). Config: [`vitest.config.ts`](../vitest.config.ts). Tests run in-process — no Supabase, no browser, no network.

### What it covers

Pure functions only — the deterministic calculation and formatting helpers that back the financial/UI layers. Component rendering and integration flows are left to the E2E suite.

| Target | File | Covers |
|---|---|---|
| Formatters | [`src/utils/formatters.test.ts`](../src/utils/formatters.test.ts) | `formatFileSize`, `formatEuropean` (hr-HR locale, U+2212 minus), `formatEuro`, `formatEuroRounded` (ragged-decimal cure), `formatEuroCompact` (M/K thresholds, never €0.0M), and the nullish/NaN → dash contract on all four |
| VAT calculations | [`src/utils/vatCalculations.test.ts`](../src/utils/vatCalculations.test.ts) | `CROATIAN_VAT_RATES`, `calculateVatBreakdown` — the 4-slot multi-VAT engine (25/13/0/5%), null-safe, total = sum of subtotals invariant |
| Sales price utils | [`src/components/Sales/utils/priceUtils.test.ts`](../src/components/Sales/utils/priceUtils.test.ts) | `calculateAdjustedPriceRange` — increase/decrease with clamp-to-zero |
| Credit calculations | [`src/components/Funding/Investors/utils/creditCalculations.test.ts`](../src/components/Funding/Investors/utils/creditCalculations.test.ts) | annuity payments, equity cashflow, money multiple, payment schedules, risk levels, badge variants |
| TIC formatters | [`src/components/Funding/TIC/utils/ticFormatters.test.ts`](../src/components/Funding/TIC/utils/ticFormatters.test.ts) | `calculateRowPercentages`, `calculateTotals` (vlastita/kreditna), `formatNumber`, `formatPercentage` |
| Documents tree helpers | [`src/components/Documents/utils/treeHelpers.test.ts`](../src/components/Documents/utils/treeHelpers.test.ts) | `buildIdMap`, `buildDescendantsMap`, `rollupCounts`, `flattenTree` |
| EVM | [`src/utils/evm.test.ts`](../src/utils/evm.test.ts) | `calculatePhaseEVM` and `calculateProjectEVM` — PV/EV/AC, CPI/SPI, CV/SV, EAC/VAC, and the phase→project aggregation |
| Payment payload | [`src/components/Cashflow/Payments/services/paymentPayload.test.ts`](../src/components/Cashflow/Payments/services/paymentPayload.test.ts) | `buildPaymentData` across all five payment methods (bank account, credit, kompenzacija, gotovina, cesija), plus empty-string→null normalisation and passthrough fields |

### Configuration ([`vitest.config.ts`](../vitest.config.ts))

- **Plugins:** `@vitejs/plugin-react` (shares the Vite transform pipeline; TS/JSX handled out of the box).
- **Environment:** `node` — these are pure-function tests, no DOM needed. No globals (`describe`/`it`/`expect` are imported explicitly from `vitest` in each spec) and no setup file.
- **Include:** `src/**/*.test.ts`.
- **Exclude:** `e2e/**`, `node_modules/**` — keeps the Playwright specs out of the Vitest run.
- **Coverage:** v8 provider (`@vitest/coverage-v8`), reporters `text` + `html`, measured over `src/**/*.ts`.

### Conventions

- Tests live **next to the code** as `*.test.ts`, in whichever folder the code itself lives in — usually the module's `utils/` (e.g. `src/components/Funding/TIC/utils/ticFormatters.test.ts` sits beside `ticFormatters.ts`), but `services/` where the pure helper was extracted out of a service (`paymentPayload.test.ts`).
- Targets are **pure functions** — deterministic, dependency-free, no Supabase/React. If a helper needs a DB row or a rendered component, it belongs in E2E, not here.
- Croatian domain terms (`vlastita`, `kreditna`, the 4 VAT slots) stay in Croatian in the test data, matching the codebase.
- Assertions are anchored to the code's **actual** output, not the textbook ideal — several specs document real quirks (e.g. the `calculatePaymentSchedule` 119-vs-120 monthly-payment off-by-one, hr-HR's U+2212 minus sign).

### Running

```bash
npm test               # one-shot run (vitest run)
npm run test:watch     # watch mode (vitest)
npm run test:coverage  # one-shot run with v8 coverage (text + html report)
```

---

## ERP pipeline smoke test

`npm run erp:smoke` — [`scripts/erp-pipeline-smoke.mjs`](../scripts/erp-pipeline-smoke.mjs)

> ⏸️ **Cannot run while the ERP integration is on hold.** No project has the ERP
> migrations or the `import-erp` function. The Deno unit tests below still run.
> See [`erp-integration/PROGRESS.md`](./erp-integration/PROGRESS.md) → "On hold".

Exercises the ERP import chain end to end against a **live dev project**:
upload → parse → stage → resolve → promote, plus the review queue and the
fix-a-mapping-then-reclassify loop. 25 checks. It writes real rows and cleans up
after itself, and refuses to run against production.

#### Setting `ERP_IMPORT_SECRET`

The script authenticates as the on-prem agent would, so it needs the same shared
secret the `import-erp` function checks. Supabase stores that secret write-only —
it cannot be read back — so it has to be set in **two** places with the same
value:

```sh
SECRET="dev-$(openssl rand -hex 16)"
supabase secrets set ERP_IMPORT_SECRET="$SECRET" --project-ref <dev ref>
echo "ERP_IMPORT_SECRET=$SECRET" >> .env      # gitignored
```

If `.env` loses it, generate a new one and repeat both steps — there is no way
to recover the old value. Rotating it is harmless: nothing else depends on it.

The project also needs the e2e anchor rows (`accounting_companies`,
`subcontractors`, `projects`); `e2e/support/anchor-setup.sql` creates them.

It exists because the ERP promotion logic lives in SQL and interacts with ~20
existing triggers, which unit tests cannot reach. It has already caught three
defects that were invisible to them — most importantly a partially-resolved
invoice being promoted from only its resolvable lines. **Run it after touching
anything under `erp.` or the promotion functions.**

The parsing and validation logic has its own Deno unit tests
(`cd supabase/functions && deno test import-erp/`, 38 tests).

## AI chat characterisation tests

`supabase/functions/ai-chat/tests/` (106 tests) runs the **real** `ai-chat` edge function
in-process against fakes of the Anthropic Messages API and of Supabase (GoTrue, PostgREST,
Storage). No network, no project, no key. It pins what the function does today: SSE wire format,
persisted rows and their parent chain, failure and cancellation paths, and the money-question rules
(TIC as the only budget source, phase vs cost classification, `budget_used` never reaching the
model). It runs as part of `npm run test:functions`, and so in CI.

```bash
cd supabase/functions && deno test --allow-net --allow-env ai-chat/tests/
```

It is **characterisation**, not specification: some tests pin behaviour that is logged as a
suspected bug (`[OQ-n]` tags, see `docs/voice/open-questions.md`). Change those only together with a
decision on the open question. The scenario list, the coverage map and the rules for the voice
refactor are in [voice/03-characterisation-tests.md](./voice/03-characterisation-tests.md).

## E2E suite

**Location:** [`e2e/`](../e2e/). Strategy write-up: [`docs/test/e2e-testing-strategy.md`](./test/e2e-testing-strategy.md). Day-to-day commands live in [`e2e/README.md`](../e2e/README.md).

### Current coverage (28 tests)

| Module | Spec | Tests |
|---|---|---|
| Auth | `auth/login.spec.ts` | 6 (5 valid-credential logins + 1 invalid password) — runs `describe.serial` to avoid Supabase auth rate limits |
| Auth | `auth/permissions.spec.ts` | 6 — Sales user redirected from `/accounting-invoices`, `/accounting-payments`, `/accounting-approvals`, `/debt-status`, `/sifrarnici`, `/erp-import` (the last two are hidden while the ERP integration is on hold, so they pass via the catch-all redirect rather than `CashflowRoute`) |
| Auth | `auth/session.spec.ts` | 2 — logout clears session + Cashflow flag; reload on a protected route stays authenticated |
| Cashflow | `cashflow/approvals.spec.ts` | 1 — Director hides an approved invoice; row lands in `hidden_approved_invoices` |
| Cashflow | `cashflow/unlock.spec.ts` | 2 — wrong password keeps modal open with `aria-invalid`; correct password sets the sessionStorage flag and opens `/accounting-invoices` |
| Funding | `funding/access.spec.ts` | 2 — Investment user reaches `/banks` + `/funding-credits` |
| Retail | `retail/customers.spec.ts` | 1 — Director creates a retail customer via the form; admin client verifies the row |
| Sales | `sales/customers.spec.ts` | 1 — Sales user creates a customer via the form; admin client verifies the row |
| Sales | `sales/complete-sale.spec.ts` | 1 — selling an apartment marks it Sold, records sale + buyer, and sells linked units |
| Supervision | `supervision/work-logs.spec.ts` | 1 — Supervision user reaches `/work-logs` and the E2E anchor project appears in the project select (exercises `project_managers` RLS) |
| Smoke | `smoke.spec.ts` | 5 — every role's authenticated app shell loads |

Total runtime on a warm system: **~1 minute**.

### Architecture highlights

- **Framework:** Playwright (`@playwright/test`), Chromium only, parallel by default capped to 2 workers locally (matches CI).
- **webServer:** Playwright boots `npm run build && npm run e2e:serve` (Vite preview against the production bundle). Dev server was too slow for cold-compiled routes; preview serves a single pre-built bundle so every navigation finishes in <1 s. See [`playwright.config.ts`](../playwright.config.ts).
- **Auth:** `globalSetup` first provisions all test users via the Supabase Admin API (idempotent — a reset dev DB re-seeds itself), then logs each in and writes `storageState` to `e2e/.auth/{role}.json`. Specs declare their role via `test.use({ storageState })`. The session-lifecycle spec (`auth/session.spec`) uses a **dedicated** `e2e-logout` user, because the app's logout is a global-scope `signOut` that revokes every session for that user — sharing it with another spec would drop that spec to `/login` mid-test under parallel workers.
- **Isolation:** shared dev DB, no wipes. Each run gets a `runId = e2e-${Date.now()}-${uuid}`. Each test gets `ns = runId-{slug}` via the `ns` fixture. Any row a test creates must carry `ns` in a namespace-able text column (invoice_number, name, etc.). A per-test `afterEach` plus a `globalTeardown` safety net delete every row matching the prefix via the service-role admin client.
- **Namespaced tables:** registered in [`e2e/support/cleanup.ts`](../e2e/support/cleanup.ts) — currently `accounting_invoices.invoice_number`, `customers.name`, `retail_customers.name`. FK cascades handle dependent rows (e.g. `hidden_approved_invoices` cascades with its parent invoice).
- **Factories:** helpers under [`e2e/support/factories/`](../e2e/support/factories/) seed rows that require schema-specific coupling (e.g. [`cashflowInvoices.ts`](../e2e/support/factories/cashflowInvoices.ts) picks an existing subcontractor to satisfy `check_invoice_entity_type`).
- **Prod-safety:** [`e2e/support/env.ts`](../e2e/support/env.ts) hard-fails on load if `VITE_SUPABASE_URL !== E2E_ALLOWED_SUPABASE_URL`. Both come from `.env` + `.env.test`.
- **Base URL pinned to `http://127.0.0.1:5173`** — on WSL2, `localhost` resolves to `::1` but Vite binds to `127.0.0.1`; Chromium hangs on the IPv6 attempt. Override via `E2E_BASE_URL` in other environments.
- **Page.goto override:** the `page` fixture wraps `page.goto` to default to `waitUntil: 'commit'` so navigations return as soon as response headers arrive; subsequent selectors gate on real UI readiness. Prevents hangs on dev servers that never fire `load` for deeply-imported SPA entry points.

### Test users (auto-provisioned by globalSetup)

Created idempotently via the Supabase Admin API — no manual setup, and a reset dev DB re-seeds on the next run. `e2e-logout` is dedicated to `auth/session.spec` so its global-scope signOut can't invalidate a shared role session under parallel workers.

| Email | Password | Role |
|---|---|---|
| `e2e-director@mail.com` | `e2e123` | Director |
| `e2e-cashflow@mail.com` | `e2e123` | Accounting |
| `e2e-sales@mail.com` | `e2e123` | Sales |
| `e2e-supervision@mail.com` | `e2e123` | Supervision |
| `e2e-funding@mail.com` | `e2e123` | Investment |
| `e2e-logout@mail.com` | `e2e123` | Director (session-lifecycle spec only) |

### Anchor data

One-time dev-DB seed (idempotent) at [`e2e/support/anchor-setup.sql`](../e2e/support/anchor-setup.sql): creates `E2E Anchor Project` and links `e2e-supervision@mail.com` via `project_managers` — public-schema data only (the test users themselves are auto-provisioned by globalSetup). The PM link populates once the Supervision user exists (i.e. after globalSetup has run once).

### Running

```bash
npm run test:e2e           # headless, full suite
npm run test:e2e:ui        # Playwright UI mode
npm run test:e2e:debug     # headed with inspector
npx playwright test smoke  # smoke only — fastest validation of the setup
```

First run builds the app (~10–15 s) before starting the preview server. Subsequent runs reuse the running preview if `reuseExistingServer` is on (default locally, off in CI).

### CI

GitHub Actions workflow [`e2e.yml`](../.github/workflows/e2e.yml) runs on PRs to `main` / `development` and on `workflow_dispatch`. After `npm ci` it runs the unit suite (`npm test`) first, then asserts the required secrets are present before the E2E run. Secrets required: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `CASHFLOW_PASSWORD`, `E2E_ALLOWED_SUPABASE_URL`. Failed runs upload `playwright-report/` and `test-results/` with 14-day retention.

### Adding a test

1. Mirror the module layout: `e2e/<module>/<feature>.spec.ts`.
2. `import { test, expect } from '../support/fixtures'` — don't import raw `@playwright/test` unless you specifically need to bypass the shared fixtures (the Cashflow unlock spec is the only current case, because it needs `sessionStorage.cashflow_unlocked` to start empty).
3. If the test writes data, namespace it: `${ns}-something`. Register the new table in [`cleanup.ts`](../e2e/support/cleanup.ts) if it isn't already.
4. Keep specs scoped: one user flow per `test(...)`, one spec per feature. Pick selectors by role / accessible name; fall back to scoped positional selectors inside a portaled modal when FormField-style unlinked label-input pairs make `getByLabel` unreliable.
5. If your spec signs the session out (or otherwise destroys it), give it a **dedicated user** — see `LOGOUT_USER`/`SETUP_USERS` in [`e2e/support/auth.ts`](../e2e/support/auth.ts) — never a shared role. The app's `signOut` is global-scope and revokes the user's other sessions, which flakes any parallel spec sharing that user.

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
- [`../scripts/seed-demo-data.mjs`](../scripts/seed-demo-data.mjs) — **the whole-database demo dataset**, for showcasing the app rather than testing it. Paired with [`../scripts/seed-demo-users.mjs`](../scripts/seed-demo-users.mjs), which provisions the five demo logins it depends on; the full deployment runbook is [`DEMO_ENVIRONMENT.md`](./DEMO_ENVIRONMENT.md). Run with `node --env-file=.env scripts/seed-demo-data.mjs`. Refuses to run unless `VITE_SUPABASE_URL` points at the dev/test project (`EXPECTED_PROJECT`), because it **wipes every business table** first; users, `document_categories` and the cost-classification lookup survive. The `E2E Anchor Project` is re-created **only when the target is LandmarkDev**, so the Playwright suite keeps its fixture without that row showing up in a demo. Seeds a coherent Croatian dataset across General, Supervision, Sales, Cashflow, Funding, Retail, Tasks, Documents, Chat and Calendar, and leaves derived values (invoice status, contract realizacija, account balances) to the DB triggers.
  - **Documents** are real generated PDFs uploaded to the `documents` Storage bucket, so a document opens instead of 404-ing. The bucket is emptied on each run — otherwise every reseed orphans the previous run's objects. Two rows carry `source = 'email_import'` with a `content_hash` and a Claude-style classification note, mirroring the [email pipeline](./EMAIL_DOCUMENT_SORTING.md).
  - **Chat and Calendar are anchored to the real current week**, unlike the fixed 2026 dates everywhere else — a demo calendar that opens on an empty month is worse than one whose dates drift. It leaves the Director with 2 unread messages and 1 pending invitation so the header badges are non-zero.
  - It **wipes `calendar_events`**, so it and [`test/seed-calendar.sql`](./test/seed-calendar.sql) overwrite each other. Run the demo seeder first if you want both.

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
11. [Pre-merge check: the UI audit batches](./test/11-pre-merge-ui-audit.md) — release-specific, not a module section. Everything the UI-audit work changed that no person has clicked through yet: the Supervision payment gate, the one "overdue" rule, the corrected money figures on the Retail/Sales/Director dashboards and the credit pages, failed-load behaviour, and the three migrations that must reach prod with the merge
