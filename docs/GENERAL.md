# Module: General

**Path:** `src/components/General/`

## Overview

Shared project and milestone management used as a foundation across multiple domains. Not domain-specific — represents the generic "project" concept that Retail, Supervision, and Funding build on top of.

---

## Sub-modules

### Projects
**Path:** `General/Projects/`

Core project CRUD with milestone timeline, phase/contract views, apartment tables, and financing summaries.

#### Services

### projectService.ts
- `fetchProjectsWithStats()` — fetches all projects in a single joined query (contracts + project_milestones) and computes stats: total_spent, completion_percentage, milestones_completed, milestones_total
- **Depends on:** supabase client

### projectFormService.ts
- `fetchProjectById(projectId)` — fetches a single project row for the edit form (returns `FetchedProject | null`)
- `createProject(data)` — inserts a new project (`ProjectFormRecord`: name, location, start_date, end_date, budget, status)
- `updateProject(projectId, data)` — updates an existing project
- `deleteProject(projectId)` — deletes a project
- **Exports types:** `ProjectFormRecord`, `FetchedProject`
- **Depends on:** supabase client

### projectDetailsService.ts
- `fetchProjectDetails(id)` — parallel fetch (Promise.all) of a single project plus draft/active contracts (with subcontractor + phase joins), invoices, apartments, milestones, bank credits, and credit allocations; flattens contracts into a `subcontractors` array (cost, budget_realized, progress, phase_name), and computes `total_spent`, `total_revenue`, `pending_invoices`, and a joined `investors` string from bank/allocation bank names. Used by `ProjectDetails.tsx`
- `fetchProjectDataEnhanced(id)` — parallel fetch returning `{ project, milestones, phases, contracts, apartments, investments }`: project row, milestones (by due_date), `project_phases`, contracts (subcontractor + phase joins), apartments, and credit allocations (with bank_credits/banks joins). Used by `ProjectDetailsEnhanced.tsx` to feed the phase, subcontractor, apartment, and financing tabs
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
- **Calls:** projectFormService.ts (`fetchProjectById`, `createProject`, `updateProject`, `deleteProject`)
- **Returns:** form, setForm, loading, error, setError, handleSubmit, handleDelete, confirmDelete, cancelDelete, showDeleteConfirm, deleting

### useMilestoneManagement.ts
- `useMilestoneManagement(projectId, onMutated)` — wraps milestone service calls with toast-based error handling and pending-delete (ConfirmDialog) state
- **Calls:** milestoneService.ts (add/update/delete/toggle + `bulkAddMilestones`)
- **Uses:** ToastContext (`useToast`)
- **Returns:** editingMilestone, setEditingMilestone, handleAddMilestone, handleUpdateMilestone, handleDeleteMilestone, confirmDeleteMilestone, cancelDeleteMilestone, pendingDeleteMilestoneId, deletingMilestone, handleToggleMilestone, handleBulkAddMilestones

### usePhaseCollapseState.ts
- `usePhaseCollapseState(projectId, phases, namespace?)` — per-project expand/collapse state for phase-grouped sections, persisted to `localStorage` under `cognilion.<namespace>.<projectId>`. For phases the user has never toggled it derives a smart default (overdue → expanded; fully completed or not-yet-started → collapsed; in-progress mix → expanded). The `namespace` lets multiple groupings on the same project keep independent state (e.g. milestones use the default, `PhasesContractsTab` passes `'phase_contracts_collapse'`)
- **Returns (`PhaseCollapseController`):** isExpanded, toggle, expandAll, collapseAll, allExpanded
- **Depends on:** `PhaseStatus` (utils.ts), localStorage

#### Utilities

### utils.ts
- `getStatusConfig(status)` — returns badge color and label for a project status string
- `getDaysInfo(startDate, endDate)` — returns days elapsed and remaining for a project timeline
- `getMilestoneStatus(milestone)` — derives display status (completed, overdue, in_progress) for a milestone, plus icon/colors for the timeline
- `buildPhaseBuckets(milestones)` — groups milestones by their `phase` string into ordered `PhaseBucket[]`; known template phases come first (in template order), then unknown phases alphabetically, then the un-phased bucket (`NO_PHASE_KEY = '__no_phase'`) last
- `computePhaseStatuses(buckets)` — reduces buckets to `PhaseStatus[]` (`key`, `total`, `completed`, `overdue`) — consumed by `usePhaseCollapseState`
- **Exports:** `NO_PHASE_KEY`, `PhaseBucket`, `PhaseStatus`
- **Depends on:** date-fns, Lucide icons, `RESIDENTIAL_HR_TEMPLATE` (for phase ordering)

#### Data

### data/milestoneTemplates.ts
- Source-controlled construction milestone templates (no DB table yet). `RESIDENTIAL_HR_TEMPLATE` is the residential build with 4 ordered phases (`kupnja_zemljišta`, `ishođenje_dozvola`, `gradnja`, `uporabna_etažiranje`); each phase carries i18n `labelKey`, a literal Croatian `phaseLabel`, and items with a `name` and an `offsetDays` (days from project/template start used for auto-dating). Phase labels and item names are Croatian domain terms kept as literal strings
- **Exports:** `RESIDENTIAL_HR_TEMPLATE`, `MILESTONE_TEMPLATES`, types `ConstructionPhaseId`, `MilestoneTemplate`, `MilestoneTemplatePhase`, `MilestoneTemplateItem`

#### Forms

### forms/ProjectFormModal.tsx
- Modal form for creating and editing projects (name, location, dates, budget, status)
- Edit mode includes a delete button (routes to the optional `onDeleted` callback, falling back to `onSuccess`)
- **Uses hooks:** useProjectForm
- **Uses Ui:** Modal, FormField, Input, Select, Button, Alert, ConfirmDialog

### forms/MilestoneTemplateModal.tsx
- Modal for bulk-adding milestones from `RESIDENTIAL_HR_TEMPLATE`. Scope segmented control (`all` / `phase` / `pick`); `pick` mode shows per-phase checkbox groups with indeterminate select-all. Date strategy segmented control: `empty` (no dates) or `auto` (computes each `due_date` as project start + `offsetDays`, with a live date-range preview). Live preview shows total count, per-phase counts, and date span; on submit maps selected items to `{ name, phase: phaseLabel, due_date }[]` and calls the `onSubmit` prop (wired to `handleBulkAddMilestones`)
- **Uses data:** milestoneTemplates (`RESIDENTIAL_HR_TEMPLATE`)
- **Uses Ui:** Modal, Button, FormField, Input, Alert, Select, SegmentedControl

#### Views

### ProjectCard.tsx
- Summary card for a single project showing status badge, budget, spent, remaining, progress bar, milestone count, and days info
- **Uses services:** (receives ProjectWithStats as prop)
- **Uses Ui:** Badge, Button
- **Uses components:** getStatusConfig, getDaysInfo

### MilestoneTimeline.tsx
- Visual vertical timeline of project milestones sorted by due date, with status colors and edit/delete/toggle actions
- Optional `groupByPhase` mode renders collapsible per-phase sections (via `buildPhaseBuckets`) with phase progress bars and overdue badges; the parent drives expansion through the `isPhaseExpanded`/`onTogglePhase` props (wired to `usePhaseCollapseState`)
- Shows summary stats (completed, in-progress, overdue, % progress)
- **Calls:** `buildPhaseBuckets`, `getMilestoneStatus`, `NO_PHASE_KEY` (utils.ts)
- **Uses hooks:** (receives milestones as props, actions as callbacks)
- **Uses Ui:** Badge, Button, EmptyState

### ProjectDetails.tsx
- Tabbed project detail page: Overview (stats), Milestones (inline form + card list), Subcontractors (contracts), Apartments (grid)
- Inline milestone form validates name with `milestoneFieldErrors` before calling `handleAddMilestone`/`handleUpdateMilestone`; deletes confirm through a `ConfirmDialog` driven by the hook's pending-delete state
- **Uses hooks:** useMilestoneManagement
- **Uses services:** projectDetailsService (fetchProjectDetails)
- **Uses Ui:** PageHeader, StatGrid, StatCard, Badge, Button, FormField, Input, EmptyState, ConfirmDialog

### ProjectDetailsEnhanced.tsx
- Alternative multi-tab project view: Overview, Phases (PhasesContractsTab), Apartments, Subcontractors (SubcontractorsTab), Financing, Milestones
- Header stat cards (budget/spent, timeline, completion %, contract count); Milestones tab combines an inline add form, the "Use template" action (MilestoneTemplateModal), an expand/collapse-all toggle, and a phase-grouped MilestoneTimeline
- Computes `phaseStatuses` from milestones (`computePhaseStatuses(buildPhaseBuckets(...))`) and drives both the milestone grouping and `PhasesContractsTab` collapse via `usePhaseCollapseState`
- **Uses hooks:** useMilestoneManagement, usePhaseCollapseState
- **Uses services:** projectDetailsService (fetchProjectDataEnhanced)
- **Uses components:** MilestoneTimeline, ProjectFormModal, MilestoneTemplateModal, PhasesContractsTab, SubcontractorsTab
- **Calls:** `buildPhaseBuckets`, `computePhaseStatuses` (utils.ts)
- **Uses Ui:** LoadingSpinner, Badge, Button, FormField, Input, EmptyState, Table

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
- Project list with search by name/location and status filter, grid layout, and new project modal
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
- **Returns (`BudgetControlData`):** `projects`, `selectedProjectId`, `setSelectedProjectId`, `data` (`tic`, `plannedBudget`, `committed`, `paid`, `completionPct`, `metrics`), `loading`, `error`
- **Calls:** budgetControlService.ts (`fetchProjectsList`, `fetchProjectBudgetData`)
- **Calls:** `calculateProjectEVM` from `src/utils/evm.ts`

#### Views

### index.tsx (BudgetControl)
- Project selector dropdown at the top to switch between all projects
- Top metric cards: TIC, Planned Budget, Committed (% of budget), Paid (% of committed), Forecast EAC (Under/Over Budget by sign of VAC)
- Budget Control bar chart (recharts): 4 bars — Planned, Committed, Paid, Forecast EAC
- EVM Indices scatter chart (recharts): CPI and SPI plotted against a Target (1.0) and a Warning (0.9) reference line
- EVM Performance Metrics row: CPI, SPI, EAC, VAC, Completion % with progress bar
- Index card colors via `getIndexStatus`: green (≥ 1.0), yellow (0.9–1.0), red (< 0.9)
- Empty/edge states: no projects, and "no budget data" when `plannedBudget` is 0
- **Uses hooks:** useBudgetControl
- **Uses lib:** recharts (BarChart, ScatterChart, ReferenceLine)
- **Uses Ui:** LoadingSpinner

#### EVM calculation (`src/utils/evm.ts`)

The earned-value math lives in `src/utils/evm.ts` (a CORE util — see the Codebase Index; documented here as the General consumer):
- `calculatePhaseEVM(plannedBudget, physicalCompletionPct, plannedStartDate, plannedEndDate, actualCost, currentDate?)` — computes a single phase's PV/EV/AC and the derived CPI, SPI, CV, SV, EAC, VAC. Planned completion is time-elapsed-based; EV uses physical completion
- `calculateProjectEVM(phases, contracts, milestones?)` — aggregates phase EVM across a project. Each contract's *physical* completion is the share of its `subcontractor_milestones` marked completed/paid (falling back to the financial proxy `budget_realized / contract_amount` when a contract has no milestones); a phase's completion is the contract-value-weighted average. Keeping EV independent of money spent is what makes CPI/SPI meaningful
- **Exports types:** `EVMMetrics`, `MilestoneProgress`
- Surfaced in General only through BudgetControl (`useBudgetControl` → `calculateProjectEVM`). Project detail views (`ProjectDetails(Enhanced)`) show simpler budget/progress summaries and do not call the EVM utils

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
- **Returns:** logs, loading, totalCount, pagination, all filter state + setters, selectedLog, resetFilters, refetch

#### Views

### index.tsx (ActivityLog)
- Director-only guard via `canViewActivityLog(user)` — redirects to `/` for non-Directors
- Filter bar: search, user, category, severity, project, date range, reset
- Results table with pagination
- **Uses hooks:** useActivityLog
- **Uses Ui:** PageHeader, SearchInput, Select, Pagination, LoadingSpinner, EmptyState, Button

### ActivityLogTable.tsx
- Table columns: Timestamp (hr-HR), User (name + role badge), Action (i18n), Entity (type + truncated ID), Project, Severity (colored badge), Details (eye icon)
- **Uses Ui:** Table, Badge

### ActivityLogDetailModal.tsx
- Three-section detail view: User info, Entity info, Metadata key-value pairs
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
