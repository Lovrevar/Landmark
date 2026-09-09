# Codebase Index

> Real estate & business management platform. React + TypeScript + Vite + Supabase.

## Quick Navigation

| Module | File | Description |
|---|---|---|
| **Auth** | [AUTH.md](./AUTH.md) | Login and session management |
| **Cashflow** | [CASHFLOW.md](./CASHFLOW.md) | Invoices, payments, banks, suppliers, approvals |
| **Sales** | [SALES.md](./SALES.md) | Apartments, customers, projects, payments |
| **Retail** | [RETAIL.md](./RETAIL.md) | Retail projects, invoices, customers, land plots |
| **Funding** | [FUNDING.md](./FUNDING.md) | Investors, credits, disbursements, TIC — **the TIC is the only writer of planned budget across the whole app** |
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
| **Tasks** | [TASKS.md](./TASKS.md) | Shared org-wide task list grouped by project; binary open/done checkbox, subtask checklists (a task with lines has its completion written by a trigger, so its own checkbox is a readout), private tasks, colour labels, attachments, @mention comments. Schema is shared with a standalone mobile task app: task tables use auth user ids + a `profiles` mirror table (`deadline`/`completed` columns). That app's Web Push server half — `push_subscriptions`, the `send-push` edge function, and the `pg_cron` deadline-reminder dispatcher — also lives in this project |
| **Documents / Email Sorting** | [EMAIL_DOCUMENT_SORTING.md](./EMAIL_DOCUMENT_SORTING.md) | Documents browser (category tree, list, pickers) + auto-classify emailed documents via Make.com + Claude |

## Reference / cross-cutting docs

| Doc | File | Description |
|---|---|---|
| **Testing** | [TESTING.md](./TESTING.md) | Vitest unit tests + Playwright e2e setup and conventions |
| **Security Backlog** | [SECURITY_BACKLOG.md](./SECURITY_BACKLOG.md) | Tracked security items and RLS hardening status |
| **Presentation Modules** | [PRESENTATION_MODULES.md](./PRESENTATION_MODULES.md) | Croatian-language module overview + talking points for pitching the platform; ERP sync presented as a built-in product capability |
| **Presentation Deck** | [PRESENTATION_DECK.md](./PRESENTATION_DECK.md) | Slide-by-slide startup-event deck copy with speaker notes (non-technical users, modularity/integrations, multi-company analytics) |

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

### One cross-cutting invariant worth knowing before you touch budgets

`projects.budget`, `project_phases.budget_allocated` and `phase_classification_budgets` are
**derived from the project's TIC** by `sync_project_from_tic()`, and nothing in the client writes
them. Any screen showing a planned figure must gate on whether a TIC exists — a project without
one reads "budget not set", never €0. Details in
[FUNDING.md](./FUNDING.md#the-tic-is-the-only-source-of-planned-budget).

Two companion rules that follow from the same change, and that every module is expected to obey:

- **Render a phase with `formatPhaseLabel`**, never by concatenating `phase_number` and
  `phase_name`. Phases are now stored as "Faza 1", so the naive form prints "Faza 1 · Faza 1".
  Any query feeding a phase label therefore needs `phase_number` selected alongside `phase_name`.
- **Never display `project_phases.budget_used`.** It is a derived counter refreshed only by
  `recalculate_all_phase_budgets()`, so it reads 0 for a phase that does have contracts. Spend is
  derived from contracts at read time everywhere that matters.
- **"Paid" on a contract is `contracts.budget_realized`, and only that.** `accounting_payments` is
  the source of truth; `budget_realized` is its per-contract cache, kept by triggers on both
  `accounting_payments` and `accounting_invoices` (migration `20260910120000` added the second and
  repaired the drift). Summing the invoices' `paid_amount` gives the same number, so do not add a
  second field for it. Invoices are still the only answer to what is **owed**.

---

## Global Files

| File | Purpose |
|---|---|
| `src/App.tsx` | Root component and routing |
| `src/main.tsx` | Vite entry point |
| `src/lib/supabase.ts` | Supabase client (single instance) |
| `src/contexts/AuthContext.tsx` | Global auth state |
| `src/contexts/UnsavedChangesContext.tsx` | App-wide "you have unsaved work" guard. A screen arms it with `useUnsavedChanges(isDirty, save?)` — passing `save` adds a "save and leave" button to the dialog; every navigation in `Layout` runs through `useLeaveGuard()`'s `requestLeave`, and reloads fall to `beforeunload`. See `docs/UI.md` |
| `src/utils/permissions.ts` | Role-based access control |
| `src/utils/formatters.ts` | Shared date/currency/number formatters (unit-tested) |
| `src/utils/phaseLabel.ts` | `formatPhaseLabel(phase, phaseWord)` — the **only** way to render a phase to a user. Since the split, phases are stored as literally "Faza 1", so concatenating number and name gives "Faza 1 · Faza 1"; this collapses it. Matched structurally, so it works with a Croatian name under an English UI. Unit-tested |
| `src/utils/evm.ts` | EVM calculation utilities (calculatePhaseEVM, calculateProjectEVM) |
| `src/utils/vatCalculations.ts` | Croatian 4-slot VAT breakdown (`calculateVatBreakdown`, `CROATIAN_VAT_RATES` 25/13/0/5%); unit-tested |
| `src/utils/yieldToUI.ts` | `yieldToUI()` — yields to the next macrotask to keep the UI responsive during long PDF-builder loops |
| `src/utils/excelParsers.ts` | Excel file import helpers |
| `src/utils/reportGenerator.ts` | Shared PDF generation utilities |
| `src/types/investment.ts` | Shared investment types |
| `src/types/retail.ts` | Shared retail types |
| `src/lib/activityLog.ts` | Fire-and-forget audit logger (`logActivity`) |
| `src/components/Common/PageFallback.tsx` | Spinner fallback shown while lazy-loaded route components load |
| `src/components/Common/ProjectCategoryBadge.tsx` | Badge for a project's category (Interno / Retail / Stambeno); shared by General, Site Management, the Director dashboard and General Reports |
