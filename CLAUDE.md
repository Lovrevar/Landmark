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

See `.claude-code-rules` for full modular architecture rules.

## Shared UI Library

There is a shared component library at `src/components/ui/` with ~20 components including `Modal`, `Table`, `Badge`, `Card`. Always use these before creating new UI primitives.

## Croatian Language & Localisation

- The UI is in Croatian — keep all user-facing strings in Croatian
- PDF reports must support Croatian characters: `š`, `č`, `ć`, `đ`, `ž` — use the established jsPDF font setup already in the codebase, do not replace it
- Do not translate Croatian business/legal terms (cesija, kompenzacija, etc.) — use them as-is

## Reference Implementations

- `src/components/Site/` — canonical modular structure example
- `src/components/Sales/` — well-organised feature module

## Codebase Index
Full module map with per-file descriptions: [`docs/CODEBASE_INDEX.md`](./docs/CODEBASE_INDEX.md).
When working in a specific module, read the relevant file in `docs/modules/` before making changes.
After creating new files or doing major updates, update the relevant docs.