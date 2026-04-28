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
| Excel | xlsx library |

## User Roles & Profiles

**5 roles** with different permissions: `Director`, `Accounting`, `Sales`, `Supervision`, `Investment`

**6 switchable profiles** (user can switch mid-session): `General`, `Supervision`, `Sales`, `Funding`, `Cashflow` (password-protected), `Retail`

Each profile renders a different navigation menu and dashboard. Profile ≠ role.

## Application Modules

| Module | Path | Description |
|---|---|---|
| Projects | `src/components/Projects/` | Central project lifecycle, milestones, budget tracking |
| Sales | `src/components/Sales/` | CRM, unit inventory, buyer tracking, payments |
| Supervision | `src/components/Supervision/` | Construction site, subcontractors, work logs |
| Accounting | `src/components/Accounting/` | Invoices, payments, suppliers, companies, banks |
| Retail | `src/components/Retail/` | Land development, parcels, retail buyers |
| Funding | `src/components/Funding/` | Bank loans, investors, drawdowns, TIC structure |
| Dashboards | `src/components/Dashboard/` | Per-profile home pages |
| Reports | `src/components/Reports/` | PDF/Excel reports across all modules |

## Key Domain Concepts

These are business-specific — do not simplify or generalize them:

- **Multi-VAT invoices** — a single invoice can have up to 4 different VAT rates (Croatian accounting requirement)
- **Cesija (Assignment of debt)** — third-party payments where company A pays on behalf of company B; a legally specific Croatian concept
- **Kompenzacija (Compensation)** — mutual debt offset between two parties
- **Cashflow profile** — password-protected sensitive module; never bypass this protection
- **Unit types** — `stan` (apartment), `garaža` (garage), `repozitorij` (storage unit); these are linked to each other
- **Credit allocation** — bank credit lines can be allocated across multiple projects/contracts
- **TIC** — Troškovna Informatička Struktura, a cost breakdown structure for investment projects

## Data Layer

- 200+ Supabase migrations — never execute migration files without being explicitly asked
- All tables use RLS (Row Level Security) — always respect existing policies
- Never bypass auth context when writing queries

## Architecture Pattern

```
UI Component → Custom Hook → Service Layer → Supabase → Database
```

## Shared UI Library

There is a shared component library at `src/components/ui/` with ~20 components including `Modal`, `Table`, `Badge`, `Card`. Always use these before creating new UI primitives.

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
When working in a specific module, read the relevant file in `docs/modules/` before making changes.
After creating new files or doing major updates, update the relevant docs.

## graphify

This project has a graphify knowledge graph at graphify-out/.

Rules:
- Before answering architecture or codebase questions, read graphify-out/GRAPH_REPORT.md for god nodes and community structure
- If graphify-out/wiki/index.md exists, navigate it instead of reading raw files
- After modifying code files in this session, run `python3 -c "from graphify.watch import _rebuild_code; from pathlib import Path; _rebuild_code(Path('.'))"` to keep the graph current
