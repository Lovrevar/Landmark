# Codebase Index

> Real estate & business management platform. React + TypeScript + Vite + Supabase.

## Quick Navigation

| Module | File | Description |
|---|---|---|
| **Auth** | [AUTH.md](./modules/AUTH.md) | Login and session management |
| **Cashflow** | [CASHFLOW.md](./modules/CASHFLOW.md) | Invoices, payments, banks, suppliers, approvals |
| **Sales** | [SALES.md](./modules/SALES.md) | Apartments, customers, projects, payments |
| **Retail** | [RETAIL.md](./modules/RETAIL.md) | Retail projects, invoices, customers, land plots |
| **Funding** | [FUNDING.md](./modules/FUNDING.md) | Investors, credits, disbursements, TIC |
| **Supervision** | [SUPERVISION.md](./modules/SUPERVISION.md) | Site management, subcontractors, work logs |
| **Reports** | [REPORTS.md](./modules/REPORTS.md) | PDF reports across all domains |
| **Dashboards** | [DASHBOARDS.md](./modules/DASHBOARDS.md) | Role-based dashboard views |
| **General** | [GENERAL.md](./modules/GENERAL.md) | Shared project/milestone management |
| **UI** | [UI.md](./modules/UI.md) | Primitive component library |
| **Core** | [CORE.md](./modules/CORE.md) | Contexts, hooks, lib, types, utils |
| **Activity Log** | [ACTIVITY_LOG.md](./modules/ACTIVITY_LOG.md) | Audit trail: shared logger, Director-only UI, action inventory |

---

## Architecture Pattern

Every feature module follows this internal structure:

```
Module/
├── index.tsx              # Entry point / main view
├── types.ts               # Module-specific TypeScript types
├── components/            # Presentational sub-components
├── forms/                 # Form modals for create/edit
├── modals/                # Detail/action modals
├── hooks/                 # Data fetching and local state
└── services/              # Supabase queries and business logic
```

- **hooks** own data fetching — components never call Supabase directly
- **services** are plain async functions called by hooks
- **Types** are local to each module; shared types live in `src/types/`
- **Ui/** components are the only shared primitives — use them everywhere
- **Casing convention:** Feature/domain directories use PascalCase (`Sales/`, `SalesProjects/`); utility subdirectories always use lowercase (`hooks/`, `services/`, `forms/`, `modals/`, `components/`)

---

## Global Files

| File | Purpose |
|---|---|
| `src/App.tsx` | Root component and routing |
| `src/main.tsx` | Vite entry point |
| `src/lib/supabase.ts` | Supabase client (single instance) |
| `src/contexts/AuthContext.tsx` | Global auth state |
| `src/utils/permissions.ts` | Role-based access control |
| `src/utils/formatters.ts` | Shared date/currency/number formatters |
| `src/utils/evm.ts` | EVM calculation utilities (calculatePhaseEVM, calculateProjectEVM) |
| `src/utils/excelParsers.ts` | Excel file import helpers |
| `src/utils/reportGenerator.ts` | Shared PDF generation utilities |
| `src/types/investment.ts` | Shared investment types |
| `src/types/retail.ts` | Shared retail types |
| `src/lib/activityLog.ts` | Fire-and-forget audit logger (`logActivity`) |
