# Cognilion — Claude Code Context

## What This Project Is

Cognilion is a full-lifecycle real estate and construction project management platform for Croatian development companies. It covers land acquisition, construction, sales, accounting, and financial reporting. Built on React 18 + TypeScript + Vite frontend with Supabase (PostgreSQL) backend.

## Commands

| Command | What it does |
|---|---|
| `npm run dev` | Vite dev server |
| `npm run typecheck` | `tsc --noEmit -p tsconfig.app.json` |
| `npm run lint` | ESLint |
| `npm test` | Vitest unit tests (`src/**/*.test.ts`, no `.env` needed) |
| `npm run test:functions` | Deno tests for the edge functions (needs `deno`) |
| `npm run test:e2e` | Playwright; refuses to run unless `VITE_SUPABASE_URL` equals `E2E_ALLOWED_SUPABASE_URL` — see [`docs/TESTING.md`](./docs/TESTING.md) |
| `npm run build` | Production build |
| `npm run kb:build` | Rebuilds the AI assistant's help index from `help-kb/*.md` |
| `npm run db:types` | Regenerates the database types (see Data Layer) |

Before calling work done: `npm run typecheck`, `npm test` and `npm run lint` on the changed files.

## Git Workflow

Feature and fix branches are created from `development` and merged back into `development`.

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, TypeScript, Vite |
| Styling | Tailwind CSS |
| Database | Supabase (PostgreSQL with RLS policies) |
| Routing | React Router DOM |
| Icons | Lucide React |
| PDF | jsPDF (client-side, no server) |
| Excel | `@e965/xlsx` (maintained SheetJS fork — **not** the `xlsx` package) |
| Charts | Recharts |
| i18n | i18next + react-i18next (hr default, en fallback) |
| Dates | date-fns; `rrule` for calendar recurrence |

## User Roles & Profiles

**5 roles** with different permissions: `Director`, `Accounting`, `Sales`, `Supervision`, `Investment`

**6 switchable profiles** (user can switch mid-session): `General`, `Supervision`, `Sales`, `Funding`, `Cashflow` (password-protected), `Retail`

Each profile renders a different navigation menu and dashboard. Profile ≠ role: the role decides what the database lets a user do (RLS), the profile only what they look at. The `Supervision` role gets a fixed three-item menu whatever profile is selected.

## Application Modules

| Module | Path | Description |
|---|---|---|
| General | `src/components/General/` | Project lifecycle, milestones, budget control/EVM, activity log |
| Sales | `src/components/Sales/` | CRM, unit inventory, buyer tracking, payments |
| Supervision | `src/components/Supervision/` | Construction site, subcontractors, work logs |
| Cashflow | `src/components/Cashflow/` | Invoices, payments, suppliers, companies, banks, ERP import and Šifrarnici (both hidden — ERP integration on hold) |
| Retail | `src/components/Retail/` | Land development, parcels, retail buyers |
| Funding | `src/components/Funding/` | Bank loans, investors, drawdowns, TIC structure |
| Dashboards | `src/components/dashboards/` | Per-profile home pages (lowercase directory) |
| Reports | `src/components/Reports/` | PDF/Excel reports across all modules |
| Tasks | `src/components/Tasks/` | Org-wide task list, comments, attachments; schema shared with a mobile app |
| Calendar | `src/components/Calendar/` | Events, RSVP, recurrence, per-user task overlay |
| Chat | `src/components/Chat/` | 1:1 and group conversations, attachments, realtime unread badge |
| Help | `src/components/Help/` | `/help` page over `help-kb/`, the "?" beside page titles, `InfoHint` popovers — see [`docs/HELP.md`](./docs/HELP.md) |
| AI Chat | `src/components/AiChat/` | Floating Claude assistant (SSE events, tool calling, document generation) |
| Documents | `src/components/Documents/` | Document browser and category tree; auto-classified emailed documents |
| Auth | `src/components/Auth/` | Login form (email/password + Microsoft Entra ID), password reset |
| Common | `src/components/Common/` | Layout, profile switcher, language switcher, shared inputs |

## Key Domain Concepts

These are business-specific — do not simplify or generalize them:

- **Multi-VAT invoices** — a single invoice can have up to 4 different VAT rates (Croatian accounting requirement)
- **Cesija (Assignment of debt)** — third-party payments where company A pays on behalf of company B; a legally specific Croatian concept
- **Kompenzacija (Compensation)** — mutual debt offset between two parties
- **Cashflow profile** — gated by Director/Accounting role at the database level (RLS policies on `accounting_payments`, `accounting_companies`, `bank_credits`, `company_loans`, `company_bank_accounts`, plus the role-checked `get_invoice_statistics` and `get_filtered_invoices` RPCs). A `VITE_CASHFLOW_PASSWORD` UX speedbump exists in the React UI to reduce accidental data exposure during screen-shares, but it is **not a security boundary** — the bundled JS ships the password, and RLS is the real enforcement
- **Unit types** — `stan` (apartment), `garaža` (garage), `repozitorij` (storage unit); garages and storage units are linked to an apartment and sold with it as a package
- **Credit allocation** — bank credit lines can be allocated across multiple projects/contracts
- **TIC** — Troškovna Informatička Struktura, a cost breakdown structure for investment projects. **It is the only writer of planned budget**: a trigger derives `projects.budget`, phase budgets and per-classification budgets from it. A project without a TIC shows "budget not set", never €0

## ERP Integration (⏸️ on hold)

> **On hold since 2026-09-14 — merged but switched off.** The screens are hidden behind
> `ERP_INTEGRATION_ENABLED` in `src/lib/featureFlags.ts`, the migrations are parked in
> `supabase/parked-migrations/erp/` (never apply them from there), and `import-erp` is not
> deployed anywhere. Resume only via the checklist in
> [`docs/erp-integration/PROGRESS.md`](./docs/erp-integration/PROGRESS.md) → "On hold", and fix
> ERP-1 to ERP-5 in [`KNOWN_ISSUES.md`](./docs/erp-integration/KNOWN_ISSUES.md) first.

The financial section is being rewritten so that **4D Wand** — the ERP the company adopted —
becomes the source of truth for invoices, payments and bank balances. Cognilion stops
authoring them and becomes a consumer that imports, classifies and links. Everything
downstream keeps reading `accounting_invoices` / `accounting_payments` unchanged; what is
changing is *who writes* those two tables.

- Phases 0–3 (foundation, reference data, ingestion, classification/promotion) are done;
  phase 4 (historical re-import) is next. **Phase 5 removes the in-app creation UI and locks
  writes to the service role** — do not build new invoice/payment authoring UI without
  checking the plan first
- Lives in the `erp` Postgres schema, surfaced through `security_invoker` views in `public`;
  the parked migrations also expose `erp` to PostgREST (decision D13). UI at `/sifrarnici`
  (mappings) and `/erp-import`
- Ingestion is the `import-erp` edge function; `npm run erp:smoke` exercises the chain
- Read [`docs/erp-integration/`](./docs/erp-integration/README.md) before touching invoices,
  payments, or bank balances

## Data Layer

- 350+ Supabase migrations (a 2026-05-15 baseline plus later ones) — write new migration files
  freely, but **never execute or apply migrations without being explicitly asked**
- All tables use RLS (Row Level Security) — always respect existing policies
- Never bypass auth context when writing queries
- **Check which project the Supabase CLI is linked to** before `db:types`, `db push` or anything
  else that uses the link: it may be left on the demo project, and the production ref is not
  recorded in the repo. The demo setup is in [`docs/DEMO_ENVIRONMENT.md`](./docs/DEMO_ENVIRONMENT.md)
- `npm run db:types` regenerates `src/types/database.ts` from the linked project
  (both the `public` and `erp` schemas) and mirrors it into `supabase/functions/_shared/`.
  While the ERP integration is on hold no project has the `erp` schema, so regenerating
  drops the ERP types that `import-erp` needs — restore them from git afterwards

## Architecture and Conventions

```
UI Component → Custom Hook → Service Layer → Supabase → Database
```

- **Services throw** on failure — never return `[]` or `0` in place of an error. Loader hooks
  return `error` and `refetch`
- **A failed load is not an empty result.** Show `ErrorState` (or stale rows with an `Alert`),
  and render failed figures as `—`, never as zeros
- **RLS refuses an UPDATE or DELETE silently** — PostgREST reports success with zero rows. A write
  that must hit a row chains `.select('id')` and passes the result to `assertRowsAffected`
  (`src/lib/dbErrors.ts`); hide actions the user's role cannot perform (`src/utils/permissions.ts`)
- **PostgREST returns at most 1000 rows per request, without saying so.** Any list that can grow
  past that pages through `fetchAllRows` (`src/lib/fetchAllRows.ts`) with a stable order
- **Dates:** parse SQL `date` columns with `src/utils/dateOnly.ts` (`parseLocalDate`,
  `daysFromToday`), never `new Date('yyyy-mm-dd')`, which is UTC and shifts the day in Croatia
- **Money and dates on screen** go through `src/utils/formatters.ts` (`formatEuro`, `formatDate`, …)
- **PDF and Excel exports are always Croatian** (`exportT()` in `src/utils/exportLanguage.ts`)
- **Confirmations use `ConfirmDialog`**, never `window.confirm`

Module conventions, cross-module rules and per-file notes are in
[`docs/CODEBASE_INDEX.md`](./docs/CODEBASE_INDEX.md) and [`docs/CORE.md`](./docs/CORE.md).

## Shared UI Library

There is a shared component library at `src/components/ui/` with 31 components. Check it before
creating any new UI primitive — the full list with props is in [`docs/UI.md`](./docs/UI.md).

**Six are not in the barrel file** and must be imported by path: `AvatarStack`,
`InlineLoadError`, `MarkdownView`, `SearchableSelect`, `ToggleSwitch`, and `Toast` (which you
never import directly — use `useToast()` from `src/contexts/ToastContext`). Everything else
comes from `src/components/ui`.

## i18n

1. **Always ask before translating ambiguous strings** — do not guess or auto-translate;
   batch questions by component and wait for confirmation
2. Strings that appear in multiple components must use a `common.*` shared key
3. Croatian domain/legal terms are **never translated** — keep them as literal string values
   in both locale files
4. After any i18n change, re-scan the affected components for missed hardcoded strings
5. The language switcher respects the user's stored preference; browser locale is the fallback

## AI Assistant Help Articles

The AI assistant answers "how do I…" questions from `help-kb/*.md`, and the same articles are
shown to users on the `/help` page and linked from `InfoHint` popovers. When you change what a screen
shows or does, update its article and run `npm run kb:build` — stale articles make the assistant
give wrong answers.

## Activity Log

Every mutation (create, update, delete, bulk, import, export) must be logged via `logActivity()` from `src/lib/activityLog.ts`. This is a fire-and-forget call that never blocks the user's operation. It also clears the dashboard/report cache (`useCachedData`), so logged mutations are what keep dashboards fresh.

### Rules for new features

1. **Always add logging** — after every successful `supabase.from().insert/update/delete`, add a `logActivity()` call
2. **Action naming** — format is `entity.verb` (e.g. `invoice.create`, `apartment.bulk_price_update`). Use the table name (singular) as the entity prefix
3. **Capture entity IDs** — for inserts, chain `.select('id').maybeSingle()` to capture the new ID and pass it as `entityId`
4. **Severity levels** — `low` for reads/links, `medium` for standard creates/updates, `high` for deletes/financial/bulk/imports
5. **Metadata conventions** — creates include `entity_name`, updates include `changed_fields: Object.keys(updates)`, deletes include `entity_name` when available, bulk ops include `count`
6. **Never use `.catch()` on Supabase builder** — it returns `PromiseLike`, not `Promise`. Use async/await with try/catch
7. **Register entity routes** — add new entities to `ENTITY_ROUTE_MAP` in `src/components/General/ActivityLog/types.ts`
8. **Add i18n keys** — add action labels under `activity_log.actions` in both locale files

Full documentation: [`docs/ACTIVITY_LOG.md`](./docs/ACTIVITY_LOG.md)

## Reference Implementations

- `src/components/Sales/` — folder layout of a feature module (`index.tsx`, `types.ts`,
  `components/`, `forms/`, `modals/`, `hooks/`, `services/`). Copy the structure; for data
  handling follow the conventions above

## Codebase Index

Full module map with per-file descriptions: [`docs/CODEBASE_INDEX.md`](./docs/CODEBASE_INDEX.md).
When working in a specific module, read the relevant file in `docs/` (e.g. `docs/SALES.md`, `docs/FUNDING.md`) before making changes.
Known defects and the decisions still open are tracked in [`docs/DEFECT_BACKLOG.md`](./docs/DEFECT_BACKLOG.md).

The `tasks` tables are **shared with a standalone mobile task app** that points at the same
production database. This repo owns that schema. Before changing any `task*` table, RPC or
policy, read [`docs/SHARED_SCHEMA.md`](./docs/SHARED_SCHEMA.md) — it records the contracts
both clients depend on and the assumptions the other app gets wrong. Never run anything in
`todoMigrations/` against this database.
After creating new files or doing major updates, update the relevant docs.

## graphify

A code-only knowledge graph lives in `graphify-out/` (docs and SQL are not in it). Git hooks
rebuild it after every commit and branch switch; to query uncommitted changes, run
`python3 -c "from graphify.watch import _rebuild_code; from pathlib import Path; _rebuild_code(Path('.'))"`
from the repo root.

Use it to find *where* something lives. Trust only `imports_from` edges between files whose names
are unique in the repo, reading direction from `_src`/`_tgt`. Cross-file `calls` edges are false,
same-named files are merged into one fake hub, barrel and Deno imports are missing — so **a file's
absence or lack of importers proves nothing**; grep before deleting anything. Details and the
evidence: [`docs/GRAPHIFY.md`](./docs/GRAPHIFY.md).
