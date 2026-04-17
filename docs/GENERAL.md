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

### projectDetailsService.ts
- `fetchProjectDetails(id)` — fetches a single project with contracts, subcontractors, invoices, apartments, milestones, bank credits, and credit allocations
- `fetchProjectDataEnhanced(id)` — extended fetch that also computes revenue from sales, expenses, pending invoices, and investor names
- **Depends on:** supabase client

### milestoneService.ts
- `addMilestone(projectId, data)` — inserts a new milestone for a project
- `updateMilestone(id, data)` — updates an existing milestone
- `deleteMilestone(id)` — removes a milestone
- `toggleMilestoneCompletion(id, completed)` — toggles the completed state of a milestone
- **Depends on:** supabase client

#### Hooks

### useProjectForm.ts
- `useProjectForm(projectId, onSaved, onDeleted)` — manages form state, validation, and save/delete for project create/edit
- **Calls:** projectService.ts
- **Returns:** form, setForm, loading, error, handleSubmit, handleDelete

### useMilestoneManagement.ts
- `useMilestoneManagement(projectId, onMutated)` — wraps milestone service calls with error handling and state management
- **Calls:** milestoneService.ts
- **Returns:** editingMilestone, setEditingMilestone, handleAddMilestone, handleUpdateMilestone, handleDeleteMilestone, handleToggleMilestone

#### Utilities

### utils.ts
- `getStatusConfig(status)` — returns badge color and label for a project status string
- `getDaysInfo(startDate, endDate)` — returns days elapsed and remaining for a project timeline
- `getMilestoneStatus(milestone)` — derives display status (completed, overdue, in_progress) for a milestone
- **Depends on:** date-fns, Lucide icons

#### Forms

### forms/ProjectFormModal.tsx
- Modal form for creating and editing projects (name, location, dates, budget, status)
- Edit mode includes a delete button
- **Uses hooks:** useProjectForm
- **Uses Ui:** Modal, FormField, Input, Select, Button, Alert

#### Views

### ProjectCard.tsx
- Summary card for a single project showing status badge, budget, spent, remaining, progress bar, milestone count, and days info
- **Uses services:** (receives ProjectWithStats as prop)
- **Uses Ui:** Badge, Button
- **Uses components:** getStatusConfig, getDaysInfo

### MilestoneTimeline.tsx
- Visual vertical timeline of project milestones sorted by due date, with status colors and edit/delete/toggle actions
- Shows summary stats (completed, overdue, pending)
- **Uses hooks:** (receives milestones as props, actions as callbacks)
- **Uses Ui:** Badge, Button, EmptyState

### ProjectDetails.tsx
- Tabbed project detail page: Overview (stats), Milestones (form + timeline), Subcontractors (contracts), Apartments (grid)
- Inline milestone form validates name with `milestoneFieldErrors` before calling `handleAddMilestone`
- **Uses hooks:** useMilestoneManagement
- **Uses services:** projectDetailsService (fetchProjectDetails)
- **Uses components:** MilestoneTimeline

### ProjectDetailsEnhanced.tsx
- Alternative multi-tab project view: Overview, Phases & Contracts, Apartments, Subcontractors, Financing, Milestones
- Adds phase budget breakdown, contract table, apartment table, and financing table
- **Uses hooks:** useMilestoneManagement
- **Uses services:** projectDetailsService (fetchProjectDataEnhanced)
- **Uses components:** MilestoneTimeline, ProjectFormModal

### index.tsx (ProjectsManagement)
- Project list with search by name/location and status filter, grid layout, and new project modal
- **Uses hooks:** (direct fetch via projectService)
- **Uses services:** projectService
- **Uses components:** ProjectCard, ProjectFormModal

---

### BudgetControl
**Path:** `General/BudgetControl/`

Standalone EVM (Earned Value Management) dashboard for monitoring project budget performance. Accessible from the General profile nav.

#### Hooks

### hooks/useBudgetControl.ts
- `useBudgetControl()` — fetches all projects list on mount; on project selection fetches phases and active/draft contracts, derives EVM inputs, and runs `calculateProjectEVM`
- Derives `physical_completion_percentage` per phase as `sum(budget_realized) / sum(contract_amount)` (financial proxy — no DB column required)
- **Returns:** `projects`, `selectedProjectId`, `setSelectedProjectId`, `data` (`BudgetControlData`), `loading`, `error`
- **Calls:** supabase directly (projects, project_phases, contracts)
- **Calls:** `calculateProjectEVM` from `src/utils/evm.ts`

#### Views

### index.tsx (BudgetControl)
- Project selector dropdown at the top to switch between all projects
- Top metric cards: TIC, Planned Budget, Committed (% of budget), Paid (% of committed), Forecast EAC (Under/Over Budget badge)
- Budget Control bar chart (recharts): 4 bars — Planned, Committed, Paid, Forecast EAC
- EVM Indices scatter chart (recharts): CPI and SPI plotted against Target (1.0) and Warning (0.95) reference lines
- EVM Performance Metrics row: CPI, SPI, EAC, VAC, Completion % with progress bar
- Card colors: green (≥ 1.0), yellow (0.95–1.0), red (< 0.95) for index cards
- **Uses hooks:** useBudgetControl
- **Uses lib:** recharts (BarChart, ScatterChart, ReferenceLine)
- **Uses Ui:** LoadingSpinner

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
- All delete confirmation dialogs use `ConfirmDialog` from `src/components/Ui/` via the pending-item hook pattern — never use `window.confirm()` or `confirm()`
