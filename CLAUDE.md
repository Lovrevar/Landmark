# Cognilion — Claude Code Context

## What This Project Is

Cognilion is a full-lifecycle real estate and construction project management platform for Croatian development companies. It covers land acquisition, construction, sales, accounting, and financial reporting. Built on React 18 + TypeScript + Vite frontend with Supabase (PostgreSQL) backend.

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

Each profile renders a different navigation menu and dashboard. Profile ≠ role.

## Application Modules

| Module | Path | Description |
|---|---|---|
| General | `src/components/General/` | Project lifecycle, milestones, budget control/EVM, activity log |
| Sales | `src/components/Sales/` | CRM, unit inventory, buyer tracking, payments |
| Supervision | `src/components/Supervision/` | Construction site, subcontractors, work logs |
| Cashflow | `src/components/Cashflow/` | Invoices, payments, suppliers, companies, banks, ERP import, Šifrarnici |
| Retail | `src/components/Retail/` | Land development, parcels, retail buyers |
| Funding | `src/components/Funding/` | Bank loans, investors, drawdowns, TIC structure |
| Dashboards | `src/components/dashboards/` | Per-profile home pages (lowercase directory) |
| Reports | `src/components/Reports/` | PDF/Excel reports across all modules |
| Tasks | `src/components/Tasks/` | Org-wide task list, comments, attachments; schema shared with a mobile app |
| Calendar | `src/components/Calendar/` | Events, RSVP, recurrence, per-user task overlay |
| Chat | `src/components/Chat/` | 1:1 and group conversations, attachments, realtime unread badge |
| AI Chat | `src/components/AiChat/` | Floating Claude assistant (SSE streaming, tool calling, document generation) |
| Documents | `src/components/Documents/` | Document browser and category tree; auto-classified emailed documents |
| Auth | `src/components/Auth/` | Login form (email/password + Microsoft Entra ID) |
| Common | `src/components/Common/` | Layout, profile switcher, language switcher, shared inputs |

## Key Domain Concepts

These are business-specific — do not simplify or generalize them:

- **Multi-VAT invoices** — a single invoice can have up to 4 different VAT rates (Croatian accounting requirement)
- **Cesija (Assignment of debt)** — third-party payments where company A pays on behalf of company B; a legally specific Croatian concept
- **Kompenzacija (Compensation)** — mutual debt offset between two parties
- **Cashflow profile** — gated by Director/Accounting role at the database level (RLS policies on `accounting_payments`, `accounting_companies`, `bank_credits`, `company_loans`, `company_bank_accounts`, plus role-gated `get_invoice_statistics` RPC). A `VITE_CASHFLOW_PASSWORD` UX speedbump exists in the React UI to reduce accidental data exposure during screen-shares, but it is **not a security boundary** — the bundled JS ships the password, and RLS is the real enforcement
- **Unit types** — `stan` (apartment), `garaža` (garage), `repozitorij` (storage unit); these are linked to each other
- **Credit allocation** — bank credit lines can be allocated across multiple projects/contracts
- **TIC** — Troškovna Informatička Struktura, a cost breakdown structure for investment projects

## ERP Integration (in progress)

The financial section is being rewritten so that **4D Wand** — the ERP the company adopted —
becomes the source of truth for invoices, payments and bank balances. Cognilion stops
authoring them and becomes a consumer that imports, classifies and links. Everything
downstream keeps reading `accounting_invoices` / `accounting_payments` unchanged; what is
changing is *who writes* those two tables.

- Phases 0–3 (foundation, reference data, ingestion, classification/promotion) are done;
  phase 4 (historical re-import) is next. **Phase 5 removes the in-app creation UI and locks
  writes to the service role** — do not build new invoice/payment authoring UI without
  checking the plan first
- Lives in the `erp` Postgres schema, surfaced through `security_invoker` views in `public`
  (`erp` is not exposed via PostgREST). UI at `/sifrarnici` (mappings) and `/erp-import`
- Ingestion is the `import-erp` edge function; `npm run erp:smoke` exercises the chain
- Read [`docs/erp-integration/`](./docs/erp-integration/README.md) before touching invoices,
  payments, or bank balances

## Data Layer

- 340+ Supabase migrations (342 as of Sept 2026) — never execute migration files without being explicitly asked
- All tables use RLS (Row Level Security) — always respect existing policies
- Never bypass auth context when writing queries
- `npm run db:types` regenerates `src/types/database.ts` from the linked project
  (both the `public` and `erp` schemas) and mirrors it into `supabase/functions/_shared/`

## Architecture Pattern

```
UI Component → Custom Hook → Service Layer → Supabase → Database
```

## Shared UI Library

There is a shared component library at `src/components/ui/` with 30 components. Check it before
creating any new UI primitive — the full list with props is in [`docs/UI.md`](./docs/UI.md).

**Five are not in the barrel file** and must be imported by path: `AvatarStack`,
`MarkdownView`, `SearchableSelect`, `ToggleSwitch`, and `Toast` (which you never import
directly — use `useToast()` from `src/contexts/ToastContext`). Everything else comes from
`src/components/ui`.

### Rules for i18n work

1. **Always ask before translating ambiguous strings** — do not guess or auto-translate;
   batch questions by component and wait for confirmation
2. Strings that appear in multiple components must use a `common.*` shared key
3. Croatian domain/legal terms are **never translated** — keep them as literal string values
   in both locale files
4. After any i18n change, re-scan the affected components for missed hardcoded strings
5. The language switcher respects the user's stored preference; browser locale is the fallback


## Activity Log

Every mutation (create, update, delete, bulk, import, export) must be logged via `logActivity()` from `src/lib/activityLog.ts`. This is a fire-and-forget call that never blocks the user's operation.

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

- `src/components/Sales/` — well-organised feature module

## Codebase Index
Full module map with per-file descriptions: [`docs/CODEBASE_INDEX.md`](./docs/CODEBASE_INDEX.md).
When working in a specific module, read the relevant file in `docs/` (e.g. `docs/SALES.md`, `docs/FUNDING.md`) before making changes.
After creating new files or doing major updates, update the relevant docs.

## graphify

This project has a graphify knowledge graph at `graphify-out/`. It indexes **code only**
(~1830 nodes over ~580 files) — docs are not in it, so doc edits never require a rebuild.

Rules:
- After modifying code files in this session, run
  `python3 -c "from graphify.watch import _rebuild_code; from pathlib import Path; _rebuild_code(Path('.'))"`
  to keep it current. Takes about 5 seconds
- `.graphifyignore` at the repo root controls what gets indexed. graphify does **not** read
  `.gitignore`, so anything gitignored that still contains parseable source has to be listed there
- Use it to find *where* something lives — locating a symbol, seeing what a module's call graph
  touches. Verify anything it claims about relationships against the code before acting on it

### What this graph cannot tell you

Extraction is pure AST with no model in the loop (`0 input · 0 output` tokens), and node IDs are
built from **filename stem + symbol name with no path**. Two consequences, both load-bearing:

- **Same-named symbols in different files are merged into one node.** This manufactures call edges
  that do not exist. Every entry in the report's *"Surprising Connections"* section is currently a
  false positive of this kind — e.g. it claims `Tasks/index.tsx`'s `confirmDelete()` calls
  `refreshCounts()` in `Documents/index.tsx`; `Tasks/index.tsx` does not contain that string. Treat
  that whole section as noise, not as findings
- **Same-named files collide, and the loser gets no file-level node.** `Supervision/…/PhaseCard.tsx`
  is absent because `Retail/Projects/PhaseCard.tsx` claimed the id; 46 TS/JS files are missing this
  way, mostly `types.ts` and `index.tsx`. A file's absence from the graph means nothing

The *God Nodes* list ranks by raw edge count, so it surfaces short common helper names rather than
core abstractions — `str()`, a local coercion helper in `import-erp/feeds.ts`, currently tops it.
Community cohesion scores of 0.01–0.05 mean the clustering found little structure there; they are
not a signal that a module needs splitting.

Neither limitation is configurable — `path.stem` is hardcoded in graphify's extractor. Do not patch
`site-packages` to work around it.

### Stale files in graphify-out/

Only `graph.json`, `GRAPH_REPORT.md` and `cache/` are refreshed by the rebuild command above.
`graph.html`, `manifest.json` and `cost.json` are left at whatever the last full `graphify` run
produced (currently April 2026, 369 files) — **do not read them as current**.
