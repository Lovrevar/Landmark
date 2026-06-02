# Codebase Index

> Real estate & business management platform. React + TypeScript + Vite + Supabase.

## Quick Navigation

| Module | File | Description |
|---|---|---|
| **Auth** | [AUTH.md](./AUTH.md) | Login and session management |
| **Cashflow** | [CASHFLOW.md](./CASHFLOW.md) | Invoices, payments, banks, suppliers, approvals |
| **Sales** | [SALES.md](./SALES.md) | Apartments, customers, projects, payments |
| **Retail** | [RETAIL.md](./RETAIL.md) | Retail projects, invoices, customers, land plots |
| **Funding** | [FUNDING.md](./FUNDING.md) | Investors, credits, disbursements, TIC |
| **Supervision** | [SUPERVISION.md](./SUPERVISION.md) | Site management, subcontractors, work logs |
| **Reports** | [REPORTS.md](./REPORTS.md) | PDF reports across all domains |
| **Dashboards** | [DASHBOARDS.md](./DASHBOARDS.md) | Role-based dashboard views |
| **General** | [GENERAL.md](./GENERAL.md) | Shared project/milestone management, budget control, EVM |
| **UI** | [UI.md](./UI.md) | Primitive component library |
| **Core** | [CORE.md](./CORE.md) | Contexts, hooks, lib, types, utils |
| **Activity Log** | [ACTIVITY_LOG.md](./ACTIVITY_LOG.md) | Audit trail: shared logger, Director-only UI, action inventory |
| **AI Chat** | [AI_CHAT.md](./AI_CHAT.md) | Floating Claude assistant: SSE streaming, 10-tool catalog, fork-and-regenerate edits |
| **Chat** | [CHAT.md](./CHAT.md) | 1:1 and group conversations, file attachments, realtime unread badge |
| **Calendar** | [CALENDAR.md](./CALENDAR.md) | Events, RSVP, month/week/day/agenda views, recurring occurrences, per-user task overlay |
| **Tasks** | [TASKS.md](./TASKS.md) | Tasks with 3-state status, projects, reminders, attachments, @mention comments, activity log |
| **Documents / Email Sorting** | [EMAIL_DOCUMENT_SORTING.md](./EMAIL_DOCUMENT_SORTING.md) | Documents browser (category tree, list, pickers) + auto-classify emailed documents via Make.com + Claude |

## Reference / cross-cutting docs

| Doc | File | Description |
|---|---|---|
| **Testing** | [TESTING.md](./TESTING.md) | Vitest unit tests + Playwright e2e setup and conventions |
| **Security Backlog** | [SECURITY_BACKLOG.md](./SECURITY_BACKLOG.md) | Tracked security items and RLS hardening status |

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
- **services** are plain async functions called by hooks. A module's `services/` folder may contain **several focused service files** (e.g. `siteService.ts`, `milestoneService.ts`, `phaseService.ts`), not a single `service.ts` — Supabase query logic was extracted out of hooks into these per-concern services during the May 2026 codebase audit
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
| `src/utils/formatters.ts` | Shared date/currency/number formatters (unit-tested) |
| `src/utils/evm.ts` | EVM calculation utilities (calculatePhaseEVM, calculateProjectEVM) |
| `src/utils/vatCalculations.ts` | Croatian 4-slot VAT breakdown (`calculateVatBreakdown`, `CROATIAN_VAT_RATES` 25/13/0/5%); unit-tested |
| `src/utils/yieldToUI.ts` | `yieldToUI()` — yields to the next macrotask to keep the UI responsive during long PDF-builder loops |
| `src/utils/excelParsers.ts` | Excel file import helpers |
| `src/utils/reportGenerator.ts` | Shared PDF generation utilities |
| `src/types/investment.ts` | Shared investment types |
| `src/types/retail.ts` | Shared retail types |
| `src/lib/activityLog.ts` | Fire-and-forget audit logger (`logActivity`) |
| `src/components/Common/PageFallback.tsx` | Spinner fallback shown while lazy-loaded route components load |
