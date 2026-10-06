# Module: General

**Path:** `src/components/General/`

## Overview

Shared project and milestone management used as a foundation across multiple domains. Not domain-specific — represents the generic "project" concept that Retail, Supervision, and Funding build on top of.

## Dates and status labels

**Dates go through `formatDate`** (`src/utils/formatters.ts`), which takes the language:
`const { t, i18n } = useTranslation()` → `formatDate(value, i18n.language)`. Croatian renders
`05.01.2026.`, English `Jan 05, 2026`. `ProjectDetailsEnhanced`, `MilestoneTimeline` and
`MilestoneTemplateModal` all formatted with `'MMM dd, yyyy'` / `'MMMM dd, yyyy'` /
`'d. MMM yyyy.'` — the last one a Croatian shape with an English month name.

**`projects.status` is English and CHECK-constrained.** Render it through `PROJECT_STATUS` +
`statusVariant` / `statusLabel` (`src/utils/statusDisplay.ts`); the `<option value="…">` in
`ProjectFormModal` and the `index.tsx` filter stay English because they are the stored values.

---

## Sub-modules

### Projects
**Path:** `General/Projects/`

Core project CRUD with milestone timeline, phase/contract views, apartment tables, and financing summaries.

#### Services

### projectService.ts
- `fetchProjectsWithStats()` — fetches all projects in a single joined query (contracts + project_milestones) and computes stats: total_spent, completion_percentage, milestones_completed, milestones_total. In parallel it reads every project's TIC grand total (`fetchTICTotalsByProject()` from `Supervision/SiteManagement/services/siteService.ts`) onto `ProjectWithStats.tic_total`, so the cards can apply the same budget gate as the rest of the app instead of printing a stale `projects.budget`
- **Depends on:** supabase client, `fetchTICTotalsByProject`, `ticGrandTotal` (`Funding/TIC/utils/ticBudget.ts`)

### projectFormService.ts
- `fetchProjectById(projectId)` — fetches a single project row for the edit form (returns `FetchedProject | null`)
- `createProject(data)` — inserts a new project (`ProjectFormRecord`: name, location, aliases, start_date, end_date, budget, status, category)
- `updateProject(projectId, data)` — updates an existing project
- `deleteProject(projectId)` — deletes a project
- **Exports types:** `ProjectFormRecord`, `FetchedProject`
- **Depends on:** supabase client

### projectDetailsService.ts
- `fetchProjectDataEnhanced(id)` — parallel fetch returning `{ project, milestones, phases, contracts, apartments, investments, ticTotal }`: project row, milestones (by due_date), `project_phases`, contracts (subcontractor + phase joins), apartments, credit allocations (with bank_credits/banks joins), and the project's TIC grand total (`null` when it has no TIC or an all-zero one). Used by `ProjectDetailsEnhanced.tsx` to feed the phase, subcontractor, apartment, and financing tabs
- **Depends on:** supabase client

### milestoneService.ts
- `addMilestone(projectId, data)` — inserts a new milestone for a project (`data` may include an optional `phase`)
- `updateMilestone(id, data)` — updates an existing milestone (writes `phase` only when provided)
- `deleteMilestone(id)` — removes a milestone
- `toggleMilestoneCompletion(id, completed)` — toggles the completed state of a milestone
- `bulkAddMilestones(projectId, rows)` — bulk-inserts template-generated milestones (`{ name, due_date, phase }[]`, all `completed: false`); fire-and-forget `logActivity('milestone.bulk_create', severity: medium, count)`
- **Depends on:** supabase client, `logActivity` (`src/lib/activityLog.ts`)

#### Hooks

### useProjectForm.ts
- `useProjectForm(projectId, onSaved, onDeleted)` — manages form state, validation, and save/delete for project create/edit; delete runs through a `ConfirmDialog` (showDeleteConfirm/confirmDelete/cancelDelete)
- Error text comes from the shared [`src/lib/errorMessage.ts`](../src/lib/errorMessage.ts) (`toErrorMessage` / `isPermissionError`); the local copies of those two helpers were promoted there. A thin local `toFormError` keeps the one project-specific case: a 42501 returns the key `general_projects.error_permission_denied`, which `ProjectFormModal` runs through `t()`. The shared helper also refuses raw Postgres text ("new row violates row-level security policy…") in favour of the caller's fallback
- **Calls:** projectFormService.ts (`fetchProjectById`, `createProject`, `updateProject`, `deleteProject`)
- **Returns:** form, setForm, loading, error, setError, handleSubmit, handleDelete, confirmDelete, cancelDelete, showDeleteConfirm, deleting

### useMilestoneManagement.ts
- `useMilestoneManagement(projectId, onMutated)` — wraps milestone service calls with toast-based error handling and pending-delete (ConfirmDialog) state. `editingMilestone` is typed as the local `Milestone`; `handleUpdateMilestone` resolves `true` on success so the caller only leaves edit mode when the save landed; a failed toggle shows `general_projects.milestone_update_error`
- **Calls:** milestoneService.ts (add/update/delete/toggle + `bulkAddMilestones`)
- **Uses:** ToastContext (`useToast`)
- **Returns:** editingMilestone, setEditingMilestone, handleAddMilestone, handleUpdateMilestone, handleDeleteMilestone, confirmDeleteMilestone, cancelDeleteMilestone, pendingDeleteMilestoneId, deletingMilestone, handleToggleMilestone, handleBulkAddMilestones

### usePhaseCollapseState.ts
- `usePhaseCollapseState(projectId, phases, namespace?)` — per-project expand/collapse state for phase-grouped sections, persisted to `localStorage` under `cognilion.<namespace>.<projectId>`. For phases the user has never toggled it derives a smart default (overdue → expanded; fully completed or not-yet-started → collapsed; in-progress mix → expanded). The `namespace` lets multiple groupings on the same project keep independent state (e.g. milestones use the default, `PhasesContractsTab` passes `'phase_contracts_collapse'`)
- **Returns (`PhaseCollapseController`):** isExpanded, toggle, expandAll, collapseAll, allExpanded
- **Depends on:** `PhaseStatus` (utils.ts), localStorage

#### Utilities

### utils.ts
- `getStatusConfig(status)` is **gone.** It returned `{ icon, label }` with the label as an English
  literal ('In Progress'), which rendered untranslated in a Croatian UI, and its only caller
  (`ProjectCard`) used the label and never the icon. Project status now renders through
  `PROJECT_STATUS` + `statusVariant` / `statusLabel` (`src/utils/statusDisplay.ts`), the one map
  every screen in the app reads a project status from — `ProjectCard` and `ProjectDetailsEnhanced`
  each had their own colour ladder, and both printed the raw `projects.status` column
- `getMilestoneStatus(milestone)` — derives a milestone's display state (completed / overdue /
  in_progress) for the timeline: icon, colour classes, `labelKey` (`status.completed` /
  `status.overdue` / `status.in_progress`) and a `variant` for the badge. It used to return English
  `label` literals, which `MilestoneTimeline` then string-compared to pick a badge colour
- `buildPhaseBuckets(milestones)` — groups milestones by their `phase` string into ordered `PhaseBucket[]`; known template phases come first (in template order), then unknown phases alphabetically, then the un-phased bucket (`NO_PHASE_KEY = '__no_phase'`) last
- `computePhaseStatuses(buckets)` — reduces buckets to `PhaseStatus[]` (`key`, `total`, `completed`, `overdue`) — consumed by `usePhaseCollapseState`
- **Exports:** `NO_PHASE_KEY`, `PhaseBucket`, `PhaseStatus`
- **Depends on:** `daysFromToday` (`src/utils/dateOnly.ts`), Lucide icons, `RESIDENTIAL_HR_TEMPLATE` (for phase ordering)
- `getDaysInfo(startDate, endDate)` is **gone** — replaced by the shared, tested
  `projectTimeline()` below. It said green "Completed" for *any* project past its end date
  whatever its `status`, and red "Overdue" the day *before* the end date (`differenceInDays`
  truncates towards zero), and its strings were hardcoded English

#### One project-timeline rule (`src/utils/projectTimeline.ts`)

`projectTimeline(status, endDate)` returns `{ state, days }` where `state` is one of
`completed` / `overdue` / `due_today` / `due_soon` (inside `DUE_SOON_DAYS` = 30) / `on_track` /
`no_end_date`, and `days` is whole calendar days to the end date (negative when past, `null`
when there is none). `PROJECT_TIMELINE_TONE` maps each state to a text colour **with a dark
pair**. Tested in `projectTimeline.test.ts` under fake timers, because the due-day boundary is
exactly what kept regressing.

- **"Completed" comes from `status`, never from a date.** A stalled project past its end date
  used to read as finished.
- Dates go through `daysFromToday` (`src/utils/dateOnly.ts`), so the end date itself is not late
  and a missing one is open-ended rather than overdue.
- The state is decided once; each screen picks its own wording. Used by
  `General/Projects/ProjectCard.tsx`, `ProjectDetailsEnhanced.tsx` and
  `Supervision/SiteManagement/ProjectsGrid.tsx` — which previously showed
  "N dana kašnjenja" in orange on a project already marked Completed.

#### Data

### data/milestoneTemplates.ts
- Source-controlled construction milestone templates (no DB table yet). `RESIDENTIAL_HR_TEMPLATE` is the residential build with 4 ordered phases (`kupnja_zemljišta`, `ishođenje_dozvola`, `gradnja`, `uporabna_etažiranje`); each phase carries i18n `labelKey`, a literal Croatian `phaseLabel`, and items with a `name` and an `offsetDays` (days from project/template start used for auto-dating). Phase labels and item names are Croatian domain terms kept as literal strings
- **Exports:** `RESIDENTIAL_HR_TEMPLATE`, `MILESTONE_TEMPLATES`, types `ConstructionPhaseId`, `MilestoneTemplate`, `MilestoneTemplatePhase`, `MilestoneTemplateItem`

#### Forms

### forms/ProjectFormModal.tsx
- Modal form for creating and editing projects (name, location, aliases, dates, status, category)
- **Budget is displayed, not entered.** The project's TIC is its only writer (see [FUNDING.md](./FUNDING.md#the-tic-is-the-only-source-of-planned-budget)); a project without one reads "budget not set". There is deliberately no budget validation — a new project has no plan yet by definition, and requiring one blocked creation entirely
- Create/edit/delete are Director-only at the RLS level. The entry-point buttons in `index.tsx` and `ProjectDetailsEnhanced.tsx` are hidden for other roles, and a 42501 from Postgres is surfaced as `general_projects.error_permission_denied` instead of a generic "Failed to save project". RLS stays the real boundary; the UI gate only avoids offering an action that will be refused
- Category is one of `interno` / `retail` / `stambeno`, from `PROJECT_CATEGORIES` in `lib/supabase.ts`. These are Croatian domain terms and stay untranslated. Note this is unrelated to the Retail module, which models land development in its own `retail_*` tables
- Edit mode includes a delete button (routes to the optional `onDeleted` callback, falling back to `onSuccess`)
- **Uses hooks:** useProjectForm
- **Uses Ui:** Modal, FormField, Input, Select, Button, Alert, ConfirmDialog

### forms/MilestoneTemplateModal.tsx
- Modal for bulk-adding milestones from `RESIDENTIAL_HR_TEMPLATE`. Scope segmented control (`all` / `phase` / `pick`); `pick` mode shows per-phase checkbox groups with indeterminate select-all. Date strategy segmented control: `empty` (no dates) or `auto` (computes each `due_date` as project start + `offsetDays`, with a live date-range preview). Live preview shows total count, per-phase counts, and date span; on submit maps selected items to `{ name, phase: phaseLabel, due_date }[]` and calls the `onSubmit` prop (wired to `handleBulkAddMilestones`)
- **Uses data:** milestoneTemplates (`RESIDENTIAL_HR_TEMPLATE`)
- **Uses Ui:** Modal, Button, FormField, Input, Alert, Select, SegmentedControl

#### Views

### ProjectCard.tsx
- Summary card for a single project showing status badge, project-category badge, budget, spent, remaining, progress bar, milestone count, and its timeline
- **Budget is gated on the TIC**, like every other screen: `tic_total !== null && tic_total > 0`, otherwise the card reads `general_projects.budget_not_set` and the "remaining" row is dropped altogether. `fetchProjectsWithStats` fetches the totals alongside the list (`fetchTICTotalsByProject()`), and `ProjectWithStats` carries `tic_total`
- "Remaining" is red when negative. It used to be `text-green-600` unconditionally, so an overspent project reported its overspend in green
- Money uses `formatEuro`; the timeline line uses `projectTimeline()` + `PROJECT_TIMELINE_TONE`
- **Uses services:** (receives ProjectWithStats as prop)
- **Uses Ui:** Badge, Button
- **Uses components:** ProjectCategoryBadge, `PROJECT_STATUS` + `statusVariant`/`statusLabel`, `projectTimeline`

### MilestoneTimeline.tsx
- Visual vertical timeline of project milestones sorted by due date, with status colors and edit/delete/toggle actions
- Optional `groupByPhase` mode renders collapsible per-phase sections (via `buildPhaseBuckets`) with phase progress bars and overdue badges; the parent drives expansion through the `isPhaseExpanded`/`onTogglePhase` props (wired to `usePhaseCollapseState`)
- Shows summary stats (completed, in-progress, overdue, % progress)
- Row actions (toggle/edit/delete) are always visible below `md`; from `md` up they appear on hover or keyboard focus (`md:opacity-0 md:group-hover:opacity-100 md:focus-within:opacity-100`, the `TaskRow` convention)
- **Calls:** `buildPhaseBuckets`, `getMilestoneStatus`, `NO_PHASE_KEY` (utils.ts)
- **Uses hooks:** (receives milestones as props, actions as callbacks)
- **Uses Ui:** Badge, Button, EmptyState

### ProjectDetailsEnhanced.tsx
- The project detail page (lazy-loaded in `App.tsx`; the older `ProjectDetails.tsx` it replaced was deleted on 2026-09-14). Tabs: Overview, Phases (PhasesContractsTab), Apartments, Subcontractors (SubcontractorsTab), Financing, Milestones
- Header shows the project-category badge next to the status badge, and the Overview tab's project-info grid carries a "Vrsta projekta" tile alongside location/investor/dates
- Header stat cards (budget/spent, timeline, completion %, contract count); Milestones tab combines an inline add form, the "Use template" action (MilestoneTemplateModal), an expand/collapse-all toggle, and a phase-grouped MilestoneTimeline
- Milestone edit reuses the inline form: the timeline's Edit action fills it, switches the heading/submit to "Uredi prekretnicu"/Save, and scrolls to and focuses the name field. Cancel (or the header's Add button) returns it to add mode. Saving keeps the milestone's `phase` and reads `completed` from the live list, so a toggle made while the form was open is not reverted. Delete goes through a `ConfirmDialog` (`general_projects.milestone_delete_confirm`)
- The full-page spinner shows only until this project has loaded (`loading && project?.id !== id`): milestone mutations reload the data, and a spinner then would unmount the form and the delete dialog
- Computes `phaseStatuses` from milestones (`computePhaseStatuses(buildPhaseBuckets(...))`) and drives both the milestone grouping and `PhasesContractsTab` collapse via `usePhaseCollapseState`
- **Uses hooks:** useMilestoneManagement, usePhaseCollapseState
- **Uses services:** projectDetailsService (fetchProjectDataEnhanced)
- **Uses components:** ProjectCategoryBadge, MilestoneTimeline, ProjectFormModal, MilestoneTemplateModal, PhasesContractsTab, SubcontractorsTab
- **Calls:** `buildPhaseBuckets`, `computePhaseStatuses` (utils.ts)
- **Uses Ui:** LoadingSpinner, Badge, Button, FormField, Input, EmptyState, Table, ConfirmDialog

#### Tabs

### tabs/PhasesContractsTab.tsx
- Phases & contracts view: collapsible per-phase cards (header shows contract count, summed contract value, and a budget-used progress bar from `budget_used / budget_allocated`); expanded phases list their contracts (subcontractor, job description, contract amount, realized) in a dense table. Buckets contracts by `contract.phase.phase_name`; expand/collapse persists via `usePhaseCollapseState` (namespace `'phase_contracts_collapse'`)
- **Props:** phases, contracts, projectId
- **Uses hooks:** usePhaseCollapseState
- **Uses Ui:** EmptyState, Table

### tabs/SubcontractorsTab.tsx
- Subcontractor contracts view: 4 summary StatCards (total contract value, total realized, total remaining, count), search by subcontractor name, phase filter (including an un-phased option) and status filter, plus a fully sortable table (name, phase, contract amount, realized, remaining, status badge, contact). Remaining is derived as `contract_amount - budget_realized`
- **Props:** contracts, phases, projectId (currently unused — filtering/sort is client-side)
- **Uses Ui:** Badge, Button, EmptyState, Select, SearchInput, StatCard, StatGrid, Table

### index.tsx (ProjectsManagement)
- Project list with search by name/location, a status filter and a project-category filter (Interno / Retail / Stambeno), grid layout, and new project modal
- **Uses hooks:** (direct fetch via projectService)
- **Uses services:** projectService
- **Uses components:** ProjectCard, ProjectFormModal

---

### BudgetControl
**Path:** `General/BudgetControl/`

Standalone EVM (Earned Value Management) dashboard for monitoring project budget performance. Accessible from the General profile nav.

#### Services

### services/budgetControlService.ts
- `fetchProjectsList()` — fetches all projects (ordered by name) for the selector
- `fetchProjectBudgetData(projectId)` — parallel-ish fetch of the project row, `project_phases`, draft/active/completed `contracts` (with subcontractor + phase joins), and the contracts' `subcontractor_milestones` (`contract_id`, `percentage`, `status`); returns `ProjectBudgetData` (`{ project, phases, contracts, milestones }`)
- **Exports types:** `ProjectBudgetData`; reuses `MilestoneProgress` from `src/utils/evm.ts`
- **Depends on:** supabase client

#### Hooks

### hooks/useBudgetControl.ts
- `useBudgetControl()` — loads the projects list on mount and auto-selects the first; on selection fetches budget data and computes `plannedBudget` (sum of phase `budget_allocated`), `committed` (sum of `contract_amount`), `paid` (sum of `budget_realized`), `completionPct` (paid / committed), `tic` (project budget), and the EVM `metrics`
- **Returns (`BudgetControlData`):** `projects`, `selectedProjectId`, `setSelectedProjectId`, `data` (`tic`, `plannedBudget`, `committed`, `paid`, `completionPct`, `metrics`), `loading`, `error`, `refetch`
- `refetch` re-runs both loads (a reload counter both effects depend on) and preserves the selected project
- A failed project-data load now **clears `data`**. Leaving the previous project's EVM figures standing attributed one project's numbers to whichever project the selector named
- Both load failures are translated (`common.projects_load_error`, `budget_control.errors.load_data_failed`); they were English literals set straight into `error` and rendered by `ErrorState`
- **Calls:** budgetControlService.ts (`fetchProjectsList`, `fetchProjectBudgetData`)
- **Calls:** `calculateProjectEVM` from `src/utils/evm.ts`

#### Views

### index.tsx (BudgetControl)
- Project selector dropdown at the top to switch between all projects; each option is suffixed with the project's category (`Name — Stambeno`) so same-named projects of different categories can be told apart
- Top metric cards: TIC, Planned Budget, Committed (% of budget), Paid (% of committed), Forecast EAC (Under/Over Budget by sign of VAC)
- Budget Control bar chart (recharts): 4 bars — Planned, Committed, Paid, Forecast EAC
- EVM Indices scatter chart (recharts): CPI and SPI plotted against a Target (1.0) and a Warning (0.9) reference line
- EVM Performance Metrics row: CPI, SPI, EAC, VAC, Completion % with progress bar

#### What the EVM screen refuses to claim

Three fallbacks inside `calculateProjectEVM` used to surface as confident figures:

- **No schedule baseline.** `scheduleAvailable` is false when no phase carries both a start and
  an end date; SPI then falls back to 1 (`evm.ts:135`). Nothing read the flag, so a project with
  no dates at all reported a green "On schedule ✓". SPI now renders "—" with
  `budget_control.no_schedule` underneath, and no point is plotted on the indices chart.
- **CPI = 0** (cost booked with no earned value against it) makes `EAC = plannedBudget`, so
  `VAC = 0` and the VAC tile went green "Ispod proračuna" beside a red CPI of 0.00. Both the
  forecast card and the EAC/VAC tiles now show "—" with `budget_control.no_forecast`.
- **The forecast bar was hardcoded red** while the EAC and VAC tiles were already coloured by the
  sign of VAC, so a project forecast to come in *under* budget got a red bar next to two green
  tiles. It now follows VAC (`CHART_COLORS.forecastUnder` / `forecastOver`).

Also: the **Committed** card is amber (`variant="amber"`), matching its own bar in the chart
below — it was `variant="active"`, a green ring that read as approval of a neutral number. The
CPI/SPI sub-labels were hardcoded English and now come from `budget_control.cpi_*` / `spi_*`.
- Index card colors via `getIndexStatus`: green (≥ 1.0), yellow (0.9–1.0), red (< 0.9)
- Money goes through the shared helpers ([`src/utils/formatters.ts`](../src/utils/formatters.ts)): `compactEuro` (= `formatEuroCompact`) on the EVM tiles and the chart's Y axis, `formatEuroFull` (= `formatEuro`) on the metric cards and the chart tooltip. `compactEuro` was previously a local `formatEuro` that **shadowed the shared name while meaning the opposite** (abbreviated, not exact), abbreviated from €1.000 up (so €1.500 read "€2K") and used a decimal point where the rest of the app uses a comma
- Empty/edge states: no projects, and "no budget data" when `plannedBudget` is 0
- With an error and no figures loaded, an `ErrorState` (with the service's message as its description) and a retry replace the page body; with figures on screen the error stays as the inline red banner above them
- **Uses hooks:** useBudgetControl
- **Uses lib:** recharts (BarChart, ScatterChart, ReferenceLine)
- **Uses Ui:** LoadingSpinner

#### EVM calculation (`src/utils/evm.ts`)

The earned-value math lives in `src/utils/evm.ts` (a CORE util — see the Codebase Index; documented here as the General consumer):
- `calculatePhaseEVM(plannedBudget, physicalCompletionPct, plannedStartDate, plannedEndDate, actualCost, currentDate?)` — computes a single phase's PV/EV/AC and the derived CPI, SPI, CV, SV, EAC, VAC. Planned completion is time-elapsed-based; EV uses physical completion
- `calculateProjectEVM(phases, contracts, milestones?)` — aggregates phase EVM across a project. Each contract's *physical* completion is the share of its `subcontractor_milestones` marked completed/paid (falling back to the financial proxy `budget_realized / contract_amount` when a contract has no milestones); a phase's completion is the contract-value-weighted average. Keeping EV independent of money spent is what makes CPI/SPI meaningful
- **Exports types:** `EVMMetrics`, `MilestoneProgress`
- Surfaced in General only through BudgetControl (`useBudgetControl` → `calculateProjectEVM`). The project detail view (`ProjectDetailsEnhanced`) shows simpler budget/progress summaries and do not call the EVM utils

---

### ActivityLog
**Path:** `General/ActivityLog/`

Director-only audit trail UI. Displays all logged mutations across the platform with server-side filtering and pagination. Full documentation: [`docs/ACTIVITY_LOG.md`](./ACTIVITY_LOG.md).

#### Services

### services/activityLogQueryService.ts
- `fetchActivityLogs(filters, offset, limit)` — wraps `get_activity_logs` RPC with all filter parameters
- `fetchLogUsers()` — fetches users for the user filter dropdown
- `fetchProjects()` — fetches projects for the project filter dropdown
- **Depends on:** supabase client, `ActivityLogEntry` type

#### Hooks

### hooks/useActivityLog.ts
- `useActivityLog()` — manages filter state, debounced search (500ms), server-side pagination, reference data for dropdowns, and detail modal state
- **Calls:** activityLogQueryService.ts
- **Returns:** logs, loading, error, totalCount, pagination, all filter state + setters, selectedLog, resetFilters, refetch
- A failed fetch **no longer clears `logs` / `totalCount`**. This is the audit trail: an empty table reads as "nobody did anything in this period", which a failed query has no business asserting. The rows from the last successful read stay and the page renders the failure over them

#### Views

### index.tsx (ActivityLog)
- Director-only guard via `canViewActivityLog(user)` — redirects to `/` for non-Directors
- Filter bar: search, user, category, severity, project, date range, reset
- Results table with pagination
- Three-way results area: spinner while loading, `ErrorState` with a retry when the query failed and nothing is loaded, `EmptyState` only for a genuinely empty result. With stale rows on screen an `Alert variant="error"` above the table says `activity_log.stale_after_error` ("these entries are from the last successful read, not from the current filters") and offers the retry
- **Uses hooks:** useActivityLog
- **Uses Ui:** PageHeader, SearchInput, Select, Pagination, LoadingSpinner, EmptyState, ErrorState, Alert, Button

### ActivityLogTable.tsx
- Table columns: Timestamp (hr-HR), User (name + role badge), Action (i18n), Entity (type + truncated ID), Project, Severity (colored badge), Details (eye icon)
- **Uses Ui:** Table, Badge

### ActivityLogDetailModal.tsx
- Three-section detail view: User info, Entity info, Metadata key-value pairs
- `formatMetadataValue(value, t)` takes the translator: a boolean metadata value rendered the English literals "Yes"/"No" and now uses `common.yes` / `common.no`
- "View Entity" navigation button when entity has a known route
- **Uses Ui:** Modal, Badge, Button

### types.ts
- `ActivityLogEntry` — row shape from RPC
- `ACTION_CATEGORIES` — 35 category prefixes for filtering
- `ENTITY_ROUTE_MAP` — entity-to-route mapping for navigation
- `ActivityLogFilters`, `SeverityFilter`, `ActionCategory` — filter types

---

## Notes
- This is the canonical project model — `Retail/Projects` and `Supervision/SiteManagement` are domain-specific extensions of this pattern
- When adding project-level features that apply across domains, consider whether they belong here first
- All delete confirmation dialogs use `ConfirmDialog` from `src/components/ui/` via the pending-item hook pattern — never use `window.confirm()` or `confirm()`
- **Failed loads are not empty states.** ActivityLog and BudgetControl expose `error` + `refetch` and render `ErrorState` (from `src/components/ui`) in the content area, keeping the header and filters mounted. `Projects/index.tsx` still fetches inline in the component and is **not** yet converted — it is part of the deferred set of in-component fetches from the same audit item
