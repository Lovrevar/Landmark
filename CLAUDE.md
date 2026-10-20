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
| `npm run test:db` | pgTAP tests in `supabase/tests/database/` against the local stack (`supabase start` first, needs Docker) — see [`docs/TESTING.md`](./docs/TESTING.md) |
| `npm run test:e2e` | Playwright; refuses to run unless `VITE_SUPABASE_URL` equals `E2E_ALLOWED_SUPABASE_URL` — see [`docs/TESTING.md`](./docs/TESTING.md) |
| `npm run build` | Production build |
| `npm run kb:build` | Rebuilds the AI assistant's help index from `help-kb/*.md` |
| `npm run help:shots` | Retakes the help articles' screenshots (`help-kb/img/`) from LandmarkDemo; needs `.env.demo` — see [`docs/HELP.md`](./docs/HELP.md) |
| `npm run help:check` | Visual check of the in-app guidance on LandmarkDemo: phone, dark mode, English — see [`docs/HELP.md`](./docs/HELP.md) |
| `npm run db:types` | Regenerates the database types — use `/db-types`, it checks the linked project first |

Before calling work done, run `/done`: typecheck, `npm test`, lint on the changed files, and the
housekeeping below. CI runs typecheck, lint and the unit tests on every push to `development`.

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

**ERP integration is on hold** (since 2026-09-14, merged but switched off). 4D Wand is meant to
become the source of truth for invoices, payments and bank balances. Until it resumes, do not
build new invoice or payment authoring UI without checking
[`docs/erp-integration/`](./docs/erp-integration/README.md) first. Details load from
`.claude/rules/erp.md` when you touch the ERP or Cashflow code.

## Data Layer

- Migrations in `supabase/migrations/` are a 2026-05-15 baseline plus later ones. Write new ones with
  `/new-migration` — but **never execute or apply migrations without being explicitly asked**
- All tables use RLS (Row Level Security) — always respect existing policies
- Never bypass auth context when writing queries
- **Check which project the Supabase CLI is linked to** before `db:types`, `db push` or anything
  else that uses the link: it may be left on the demo project, and the production ref is not
  recorded in the repo. The demo setup is in [`docs/DEMO_ENVIRONMENT.md`](./docs/DEMO_ENVIRONMENT.md)
- The `tasks` tables are shared with a standalone mobile app on the same production database —
  read [`docs/SHARED_SCHEMA.md`](./docs/SHARED_SCHEMA.md) before changing any `task*` table, RPC
  or policy. Never run anything in `todoMigrations/` against this database

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
- **Confirmations use `ConfirmDialog`**, never `window.confirm` (ESLint enforces it)
- **Every mutation is logged** with `logActivity()` from `src/lib/activityLog.ts` — it also keeps
  the dashboards fresh. The rules load from `.claude/rules/activity-log.md` when you touch a
  service; the full reference is [`docs/ACTIVITY_LOG.md`](./docs/ACTIVITY_LOG.md)
- **i18n:** always ask before translating ambiguous strings, and never translate Croatian
  domain/legal terms. The rest loads from `.claude/rules/i18n.md`

Module layout and layer rules load from `.claude/rules/architecture.md` when you touch `src/`.
Cross-module rules and per-file notes are in [`docs/CODEBASE_INDEX.md`](./docs/CODEBASE_INDEX.md)
and [`docs/CORE.md`](./docs/CORE.md). When working in a module, read its doc in `docs/` (e.g.
`docs/SALES.md`) first. Reference module: `src/components/Sales/`.

## Shared UI Library

There is a shared component library at `src/components/ui/`. Check it before creating any new UI
primitive — the full list with props is in [`docs/UI.md`](./docs/UI.md).

**Six are not in the barrel file** and must be imported by path: `AvatarStack`,
`InlineLoadError`, `MarkdownView`, `SearchableSelect`, `ToggleSwitch`, and `Toast` (which you
never import directly — use `useToast()` from `src/contexts/ToastContext`). Everything else
comes from `src/components/ui`.

## Keeping docs, help and the backlog current

- **Help articles:** the AI assistant, the `/help` page and `InfoHint` popovers all read
  `help-kb/*.md`. When you change what a screen shows or does, update its article — use
  `/help-article`. Never put production figures in an article
- **Docs:** after creating new files or doing major updates, update the relevant docs
- **Backlog** ([`docs/backlog/`](./docs/backlog/README.md), one file per area):
  1. Before working in a module, read its backlog file — the bug may be known, decided or
     waiting on the ERP integration
  2. Add what you find and do not fix — a bug, a wrong figure, a missing guard, dead code, a doc
     that disagrees with the code, or an open decision — in the same change. Use `/backlog`.
     Never leave it only in a chat reply or a code comment

## graphify

`graphify-out/` is a code-only graph, rebuilt by git hooks. Use it only to find *where* something
lives; trust only `imports_from` edges between uniquely-named files, and grep before deleting
anything. Why, and how to rebuild for uncommitted changes: [`docs/GRAPHIFY.md`](./docs/GRAPHIFY.md).
