# Module: Supervision

**Path:** `src/components/Supervision/`

## Overview

Construction site supervision: manages active build sites, subcontractor contracts, phase/milestone tracking, work logs, invoices, and payments for on-site work.

---

## Sub-modules

### SiteManagement
**Path:** `Supervision/SiteManagement/`

The core supervision module. Full project site view with phases, subcontractor contracts, milestone tracking, document management, and financial summaries per phase.

**Phases and cost classifications are two independent axes.** A phase (`project_phases`) is a
time division of a project — "Faza 1", "Faza 2". A cost classification (`cost_classifications`)
is a cost-breakdown line — "Zemljište", "Priprema i razvoj", "Izgradnja i uređenje", … — and is
set per contract via `contracts.classification_id`. Contract type (`contract_types`) is a third,
narrower axis for the kind of work or vendor. The screen groups contracts three levels deep and
the user can swap the top two, so the same contracts read either "phase → classification" or
"classification → phase".

Before migration `20260908120200` the two were conflated: users typed the cost line into
`phase_name`, which meant a project could never have more than one real phase and the seven
canonical names drifted into 17 spellings. That migration folded the old rows onto the new
model. Per-(phase, classification) budgets live in `phase_classification_budgets`.

**Planned budget is read-only here.** Since migrations `20260909130000` / `20260909140000` the
project's TIC is the only writer of `projects.budget`, `project_phases.budget_allocated` and
`phase_classification_budgets` — see [FUNDING.md](./FUNDING.md#the-tic-is-the-only-source-of-planned-budget)
for the sync itself. Three consequences for this module:

- The budget inputs are gone from `PhaseSetupModal` and `EditPhaseModal`, and
  `PhaseClassificationBudgetsModal` displays the TIC's split rather than editing it. Nothing in
  `SiteManagement` writes a budget column; `PhaseFormInput` and `EditPhaseFormData` deliberately
  carry no `budget_allocated`, because round-tripping one reverts a sync that ran while the modal
  was open.
- A project with no TIC shows **"budget not set"** in the header, on its card in the grid, and in
  the subcontractor form — not €0. `ProjectWithPhases.tic_total` (null when there is no TIC) is
  what every one of those gates on.
- The phase-budget cap on a new contract applies **only when a plan exists**
  (`exceedsPhaseBudget` in `utils/contractTree.ts`). Without that guard, every phase of a
  TIC-less project sits at 0 and no contract could be recorded at all.

#### Project screen layout

`ProjectDetail` renders, top to bottom: the header (name, location, budget + `TICBudgetBadge`),
then `ProjectSummaryBanner`, then the contract tree.

- **`ProjectSummaryBanner`** totals the whole project in the same five tiles a phase card uses —
  contracted, paid, unpaid, remaining, and "not phased" — computed with the same
  `rollupContracts`, so the project total is by construction the sum of what is displayed
  beneath it. It carries no budget figure of its own (the header has it) and shows the
  "not phased" tile only when the TIC actually has phases; on an unphased TIC every line would
  land there, which is true but unreadable.
- **A single-phase project renders no phase level at all** — its classification groups sit
  directly under the banner. A phase wrapper around the only phase is pure indentation.
- There is one definition of "paid" on the screen: **`contracts.budget_realized`**, mapped onto
  the shared `rollupContracts` in `utils/contractTree.ts`. It is a trigger-kept cache of
  `sum(accounting_payments.amount)`, repaired and sealed by migration `20260910120000`, so no
  second query is needed and summing the invoices' `paid_amount` would give the same figure. Only
  `invoice_total_owed` still comes from invoices — payments cannot say what is *still* outstanding.
  (This bullet used to say "invoice-derived"; it was describing an older implementation.)

#### The payment gate

`canManagePayments(user)` (`src/utils/permissions.ts`) is true for **Director**, **Accounting**
and **Investment**, false for **Supervision** and **Sales**. Site Management threads it through
the whole tree and hides *everything derived from payments*, not just the figures:

`index.tsx` → `ProjectDetail` (default **`false`**, so a screen that forgets to pass it leaks
nothing) → `ProjectSummaryBanner` / `PhaseCard` / `ClassificationCard` / the single-phase
`TreeGroup` → `TreeGroup` → `ContractCard`; plus `ProjectsGrid`, `SubcontractorDetailsModal`,
`EditSubcontractorModal` and `MilestoneList`.

Hidden when false:

- the **paid** and **unpaid** tiles everywhere (unpaid is contracted − paid, so it hands the
  reader the figure the paid tile is hiding), and the `TreeGroup` "Paid" column
- the phase card's **utilisation bar** and its "over budget by" line — both are paid against plan
- `ContractCard`'s status badge, card tint, paid / remaining / overrun rows, and the uncontracted
  row's paid + owed pair. The deadline **keeps** its red warning: with payments visible it means
  "past due **and** not paid in full", and without them it falls back to "past due" on the date
  alone. A site manager is the person who most needs that warning, and a date discloses no amount
- `ProjectsGrid`'s paid bar segment and legend, its "isplaćeno" line, and the red overdue badge
  (`overdue_subcontractors` counts contracts past deadline **and** unpaid)
- `MilestoneList`'s Paid column, total-paid tile, paid/pending counts and Status column — every
  value that column can take is set by the `update_milestone_status_on_payment` trigger from
  payments
- the entry points to `PaymentHistoryModal` **and** `InvoicesModal` (`onOpenPaymentHistory` and
  `onOpenInvoices` are both left `undefined`), which makes those modals unreachable

Still shown: contract amounts, deadlines, names, budgets and the **remaining budget** tile —
`remainingBudget` is `budget − contracted − unpaidWithoutContract` and never reads `paid`.
Where hiding a tile would leave a ragged grid the grid collapses (`md:grid-cols-5` → `-3`, etc.)
rather than leaving a hole.

**The Supervision role's menu carries no Payments or Invoices entry** (`Common/Layout.tsx`).
Since `20260526084700_tighten_cashflow_rls.sql` that role has no `accounting_payments` rows, so
`/payments` rendered "nema pronađenih plaćanja" — a false claim about the projects rather than a
statement about the reader's rights. The Supervision *profile* keeps both, because a Director or
Accounting user can switch into it and does have the rows.

> This is a **screen-only** restriction, not a data boundary — `contracts` is readable by any
> authenticated user, so `budget_realized` is one console call away. See
> [SECURITY_BACKLOG.md](./SECURITY_BACKLOG.md) SEC-004.

#### One definition of "overdue"

Every date-only comparison on this screen goes through `daysFromToday(value) < 0`
(`src/utils/dateOnly.ts`, tested in `dateOnly.test.ts`): positive is future, 0 is today, negative
is past, and **NaN** for a missing or unparseable date — which is not `< 0`, so an undated row is
never overdue. Two bugs it replaced:

- `new Date('YYYY-MM-DD') < new Date()` parses as **UTC** midnight, so in Croatia a contract due
  today was overdue from 01:00 (02:00 in summer). `differenceInDays` truncates towards zero, so
  the banner on the due day read "Kasni za 0 dana".
- `useSiteProjectData` had no null guard, and `new Date(null)` is 1 January 1970 — so every
  unpaid contract **without** a deadline counted towards the grid's overdue badge.

Each site keeps its own "done" criterion: `ContractCard` and `useSiteProjectData` add
`paid < cost`, `SubcontractorContractsList` adds `progress < 100`.

#### Services

> The original monolithic `siteService.ts` was split by entity during the May 2026 audit refactor. `siteService.ts` is now a thin barrel that keeps a couple of project-level fetchers and re-exports the per-entity service files below, so existing `import * as siteService` consumers keep working unchanged. New code should import directly from the entity-specific file.

### services/siteService.ts (barrel)
- `fetchAllProjects()` — fetches all site projects ordered by start date
- `fetchSubcontractorsWithPhases()` — fetches active/draft contracts joined with subcontractor, phase, and contract-type details; returns a flat list keyed by contract
- Re-exports everything from phaseService, siteContractService, siteSubcontractorService, milestoneService, siteFundingService, and wirePaymentService
- **Depends on:** supabase client; the six entity service files below

### services/costClassificationService.ts
- `fetchCostClassifications(includeInactive?)` — global cost breakdown lookup, ordered by sort_order
- `createCostClassification({ name, description, sort_order })` — returns the new integer id
- `updateCostClassification(id, updates)` / `deleteCostClassification(id)`
- `countClassificationUsage(id)` — contracts + budget rows referencing a classification, used to explain a refused delete
- **Note:** the seven seeded rows are `is_system` and a database trigger refuses to rename or delete them; `is_active` and `sort_order` stay editable

### services/phaseClassificationBudgetService.ts
Read-only by design — `sync_project_from_tic()` owns this table and rebuilds it on every TIC save,
so a client write would survive only until the next one.
- `fetchPhaseClassificationBudgets(phaseIds?)` — per-(phase, classification) sub-allocations
- `fetchClassificationBudgetStatus(phaseId, classificationId, excludeContractId?)` — allocated vs committed (draft/active contracts); the binding limit when adding or editing a contract, since the phase budget is the sum of its classifications. With `excludeContractId` that contract is left out of `used` and its current amount in the bucket comes back as `excludedAmount` (0 when it is not in the bucket)
- `fetchTICClassificationTotals(projectId)` — the project's TIC plan per classification, for the read-only comparison in `PhaseClassificationBudgetsModal`

### services/phaseService.ts
- `fetchProjectPhases()` — fetches all phases ordered by project then phase number
- `recalculatePhaseBudget(phaseId)` — recomputes budget_used for a phase from active/draft contract amounts
- `recalculateAllPhaseBudgets()` — recomputes budget_used for every phase across all projects via the `recalculate_all_phase_budgets()` Postgres RPC (set-based, avoids the 1000-row client cap)
- `createPhases(projectId, phases)` — bulk-creates phases for a project. **Writes no budget**: the column default of 0 stands until a TIC plans the phase
- `updateProjectPhases(projectId, phases)` — syncs a project's phase set (insert/update/delete and renumber); name, dates and ordering only. Existing phases missing from `phases` are deleted; if any of them still has contracts or work logs it deletes nothing and throws `PhaseHasDependentsError` (`phases: { name, contracts, workLogs }[]`) so the caller can word the refusal in the user's language
- `updatePhase(phaseId, updates)` — updates a single phase's name, dates and status
- `deletePhase(phaseId)` — removes a phase
- `countPhaseDependents(phaseId)` — contracts + work logs pointing at a phase. Both FKs are `ON DELETE SET NULL`, so deleting a phase with dependants silently detaches them; callers must check this first. `budget_used` is **not** a substitute — it is derived and only refreshed by `recalculate_all_phase_budgets()`
- `resequencePhases(phases)` — renumbers via the `renumber_project_phases` RPC, set-based and collision-free (the old row-by-row loop could transiently violate `UNIQUE (project_id, phase_number)`)
- `getPhaseInfo(phaseId)` — fetches project_id and phase_name for contract linking
- **Depends on:** supabase client, logActivity

### services/siteContractService.ts
- `createContract(contractData)` — creates a contract record linked to a subcontractor and phase, returns it
- `createContractWithUniqueNumber(contractData)` — generates a unique contract number and calls `createContract`, retrying (max 3) on a `contract_number` UNIQUE-violation race; preferred entry point over generate+create
- `getContractCount()` — returns the total contract count
- `generateUniqueContractNumber(projectId)` — generates a unique `CNT-{year}-{seq}-{timestamp}` contract number scoped to a project
- `fetchContractTypes()` — fetches active contract types ordered by name
- `createContractType(name, description)` — inserts a new contract type (id assigned by the DB identity column), returns the new id
- `fetchContractInvoices(contractId)` — fetches invoices for a contract with company name (returns `ContractInvoiceRow[]`)
- `fetchContractInvoiceTotals(contractId)` — returns total invoiced and total paid amounts for a contract
- `fetchContractDetails(contractId)` — fetches contract header (osnovica/base, PDV/VAT, total, dates, type) as `ContractDetailsRow`
- `fetchContractFormData(contractId)` — fetches phases for the contract's project plus current contract_type_id, base_amount, vat_rate
- **Depends on:** supabase client

### services/siteSubcontractorService.ts
- `fetchAllSubcontractors()` — fetches the base subcontractor registry ordered by name
- `getSubcontractorById(id)` — fetches a single subcontractor record
- `createSubcontractor(data)` — inserts a new subcontractor (no return)
- `createSubcontractorWithReturn(data)` — inserts a new subcontractor and returns the created record
- `linkSubcontractorToPhase(subcontractorId, phaseId, cost, deadline, jobDescription)` — assigns a subcontractor to a phase
- `updateSubcontractor(contractId, updates)` — updates contract-specific fields plus the linked subcontractor's name/contact; recalculates old/new phase budgets when the phase changes
- `deleteSubcontractor(contractId)` — deletes a contract (removes the subcontractor from a phase)
- `getSubcontractorDetails(contractId)` — returns the contract's cost and phase_id
- `fetchSubcontractorComments(subcontractorId)` — fetches comments/notes joined with the author user
- `createSubcontractorComment(data)` — adds a comment (type: completed, issue, general)
- `insertSubcontractorRecord(data)` — inserts a base subcontractor registry entry
- `updateSubcontractorRecord(id, data)` — updates a base subcontractor registry entry
- `fetchInvoiceStatsForContracts(contractIds)` — batch fetch of paid/owed totals per contract, returned as a Map
- `fetchSubcontractorInvoiceStats(subcontractorId, contractId?)` — paid/owed totals for one subcontractor or one contract
- `uploadSubcontractorDocuments(subcontractorId, contractId, files)` — uploads documents via the central document service under the `IZVODACI` category, associating them with the subcontractor, contract, project, and phase
- **Depends on:** supabase client, logActivity, Documents `documentService.uploadDocument`, `recalculatePhaseBudget` (phaseService)

### services/milestoneService.ts
- `fetchMilestonesByContract(contractId)` — fetches milestones for a contract with `paid_amount` summed from the linked invoices' **`paid_amount`** (gross money received). See "Milestones are gross" below; it used to sum their net `base_amount`, paid or not
- `fetchMilestonesBySubcontractor(subcontractorId)` — fetches all milestones across a subcontractor's contracts
- `getNextMilestoneNumber(contractId)` — returns the next available milestone number
- `createMilestone(data)` — inserts a new milestone
- `updateMilestone(milestoneId, updates)` — updates name/description/percentage/due date
- `updateMilestoneStatus(milestoneId, status, dateField?)` — sets status (pending/completed/paid) with optional completed/paid dates
- `deleteMilestone(milestoneId)` — removes a milestone
- `validateMilestonePercentagesForContract(contractId, excludeMilestoneId?)` — returns total/remaining percentage and validity (≤ 100)
- `getMilestoneStatsForContract(contractId, contractCost)` — returns percentage, amount, paid, and pending/completed/paid counts
- **Depends on:** supabase client, logActivity

### services/siteFundingService.ts
- `fetchCreditAllocations(projectId)` — returns bank credit allocations for a project as `CreditAllocation[]`
- `fetchProjectFunders(projectId)` — returns the distinct banks funding a project via credit allocations
- `fetchBankById(bankId)` — returns a bank's name by id
- **Depends on:** supabase client

### services/wirePaymentService.ts
- `fetchWirePayments(contractId)` — fetches accounting payments joined with their invoices for a contract
- **Depends on:** supabase client

### services/contractTypesService.ts
- `fetchActiveContractTypes()` — fetches active contract types ordered by id (returns `ContractType[]`)
- **Depends on:** supabase client

#### Hooks

### hooks/useSiteData.ts
- `useSiteData()` — aggregator hook that composes useSiteProjectData, useProjectPhases, useSubcontractorManagement, and useSubcontractorComments into a single return object
- **Calls:** useSiteProjectData, useProjectPhases, useSubcontractorManagement, useSubcontractorComments
- Re-exports `error` and `refetch` from useSiteProjectData alongside `projects` / `loading` / `refreshing`

### hooks/useSiteProjectData.ts
- `useSiteProjectData()` — fetches projects with phases, subcontractors, and invoice stats; builds existingSubcontractors array
- **Calls:** siteService barrel (`fetchAllProjects`, `fetchSubcontractorsWithPhases`; `fetchProjectPhases`, `fetchAllSubcontractors`, `fetchInvoiceStatsForContracts` via re-export from phaseService/siteSubcontractorService)
- On failure the previously loaded projects are **kept** and `error` is set; the grid must never render a failed read as "no projects on site"
- **Returns:** projects, loading, refreshing, error, existingSubcontractors, fetchProjects, refetch (alias of fetchProjects)

### hooks/useProjectPhases.ts
- `useProjectPhases(fetchProjects)` — manages phase CRUD with budget-allocation validation via a Promise-based requestConfirm flow
- `createProjectPhases` / `updateProjectPhases` toast `supervision.site_management.phase_setup.errors.has_dependents` (listing each blocked phase with its contract and work-log counts) for a `PhaseHasDependentsError`, and `…errors.create_failed` / `…errors.update_failed` otherwise
- `deletePhase` (single phase) strings live under `supervision.site_management.delete_phase.*`; the confirm reuses `common.confirm_delete` / `common.yes_delete`
- **Calls:** siteService barrel → phaseService (`recalculateAllPhaseBudgets`, `createPhases`, `updatePhase`, `deletePhase`, `resequencePhases`, `updateProjectPhases`)
- `recalculateAllPhaseBudgets` toasts `supervision.site_management.recalculate_budgets_failed` and returns `false` on failure — silence there left every phase budget on screen stale with nothing to say so
- **Returns:** recalculateAllPhaseBudgets, createProjectPhases, updatePhase, deletePhase, updateProjectPhases, pendingConfirm

### utils/phaseSetup.ts
- `findRemovedPhases(existing, phases)` — the saved phases a phase-setup submit would delete (existing ids not in the form). Mirrors `updateProjectPhases`; a phase sliced off by lowering the count and then "re-added" by raising it is still reported, because the re-added row has no id
- Pure, covered by `phaseSetup.test.ts`

### hooks/useSubcontractorManagement.ts
- `useSubcontractorManagement(fetchProjects)` — manages subcontractor add/edit/delete with document upload, phase budget recalculation, and unique contract number generation; payment create/update/delete now warn that those moved to the Accounting module
- `updateSubcontractor(subcontractor, pendingFiles = [])` — after a successful update, uploads `pendingFiles` via `uploadSubcontractorDocuments` (only when `has_contract`), mirroring the add path; a failed upload only warns with `supervision.edit_subcontractor.document_upload_failed`. Other failures toast `supervision.edit_subcontractor.errors.update_failed`
- `updateSubcontractor` passes `classification_id` through and applies the same classification budget gate as the add path (for contracts with `has_contract` and a classification). The contract's own amount is excluded from `used`, and an edit that does not raise what the contract commits to the bucket is never refused, so an already over-allocated bucket still lets you fix names or dates. A refusal toasts `supervision.subcontractor_form.errors.exceeds_classification_budget` and returns `false`, keeping the modal open
- **Calls:** siteService barrel → siteContractService (`createContract`, `generateUniqueContractNumber`), siteSubcontractorService (`createSubcontractorWithReturn`, `updateSubcontractor`, `deleteSubcontractor`, `getSubcontractorDetails`, `uploadSubcontractorDocuments`), phaseService (`getPhaseInfo`, `updatePhase`, `recalculatePhaseBudget`), wirePaymentService (`fetchWirePayments`)
- `fetchWirePayments` **rejects** on failure (it used to `return []`). `SiteManagement/index.tsx` wraps it in `loadWirePayments`, which toasts `supervision.payment_history.load_failed` and returns `null`; the payment-history modal is not opened on a `null`, so a failed read can never show a paid contract as having no payments
- **Returns:** addSubcontractorToPhase, updateSubcontractor, deleteSubcontractor, pendingDeleteSubcontractor, confirmDeleteSubcontractor, cancelDeleteSubcontractor, deletingSubcontractor, addPaymentToSubcontractor, fetchWirePayments, updateWirePayment, deleteWirePayment

### hooks/useSubcontractorComments.ts
- `useSubcontractorComments()` — fetches and creates subcontractor comments; supports types: completed, issue, general
- `fetchSubcontractorComments` **rejects** on failure (it used to `return []`, which hid the failure from every caller and read as "nobody has commented"). `SiteManagement/index.tsx` catches it into `commentsError` and the details modal renders a compact `ErrorState` in place of the "no comments" panel
- `addSubcontractorComment` toasts `supervision.site_management.comments.add_success` on success and `…comments.add_failed` (through `toErrorMessage`) on failure — the caller keeps the typed comment in the box on a `false` return, so the toast is the only explanation for it still being there
- **Calls:** siteService barrel → siteSubcontractorService (`fetchSubcontractorComments`, `createSubcontractorComment`)
- **Returns:** fetchSubcontractorComments, addSubcontractorComment

### hooks/useCostClassifications.ts
- `useCostClassifications(includeInactive?)` — loads the global classification list once at the SiteManagement root and passes it down, rather than duplicating it onto every project
- **Returns:** classifications, loading, error, load, refetch (alias of load). A failed load surfaces as an `Alert` with a retry above ProjectDetail and inside the two subcontractor modals — an empty list would otherwise read as "no classifications exist" and silently block the form's required dropdown

### hooks/useContractTypes.ts
- `useContractTypes()` — loads active contract types from the contract_types table
- **Calls:** contractTypesService (`fetchActiveContractTypes`)
- **Returns:** contractTypes, loading, error, load, refetch (alias of load). Same reasoning as useCostClassifications: the category dropdown is required to save

### hooks/useVATCalculation.ts
- `useVATCalculation(baseAmount, vatRate)` — computes vatAmount and totalAmount via useMemo
- Formula: `vatAmount = baseAmount × vatRate / 100`
- **Returns:** vatAmount, totalAmount

#### Forms

### forms/ContractFormFields.tsx
- Reusable contract field group: Osnovica (base amount), PDV stopa (VAT rate from VAT_RATE_OPTIONS), VAT/total summary display, start date, and deadline
- Props: formData, vatAmount, totalAmount, onChange, deadlineRequired?
- **Uses hooks:** (receives computed vatAmount/totalAmount as props)
- **Uses Ui:** Select, Input

### forms/SubcontractorFormModal.tsx
- Complex form for adding a subcontractor to a phase: toggle between new entry and existing subcontractor, contract fields, document upload, and financing source selection
- **Uses hooks:** useContractTypes, useVATCalculation
- **Uses components:** ContractFormFields, ContractTypeFormModal, ContractDocumentUpload
- **Uses services:** siteFundingService (fetchProjectFunders, via siteService barrel)
- **Uses Ui:** Modal, Button, Select

#### Views

### ProjectsGrid.tsx
- Project card grid with budget allocation progress bars, phase count, subcontractor count, and timeline
- Takes an optional `error`: with no projects loaded it replaces the grid (and the "no projects" empty state) with an `ErrorState` wired to `onRefresh`; with projects on screen it shows a dismissible `Alert variant="error"` above them. The title and Refresh button stay mounted either way
- Each card's badge row carries the project-category badge (ProjectCategoryBadge) next to the status badge

### ProjectDetail.tsx
- Single project detail view: credit allocations section, phase cards, and project summary stats
- The header shows the project-category badge beside the status badge
- **Uses services:** siteFundingService (fetchCreditAllocations, via siteService barrel)
- **Uses components:** ProjectCategoryBadge, PhaseCard

### utils/phaseLabel.ts → moved
`formatPhaseLabel` now lives at [`src/utils/phaseLabel.ts`](../src/utils/phaseLabel.ts). It is
used by Cashflow, Documents, General and Reports as well as this module — anything rendering a
phase to a user goes through it.

### utils/contractTree.ts
- `buildContractTree(contracts, dimensions, ctx)` — the grouping used by both Site Management views. `dimensions` comes from `VIEW_DIMENSIONS`: `['phase','classification','contractType']` or `['classification','phase','contractType']`. Contract type is always innermost; only the top two levels swap
- `rollupContracts(contracts)` — contracted / paid / unpaid money for any subset. A row counts as contracted only when it has a contract AND a non-zero amount. The arithmetic itself lives in [`src/utils/contractRollup.ts`](../src/utils/contractRollup.ts), shared with Retail's phase card; what stays here is the mapping from a subcontractor row onto it — `budget_realized` is "paid", `invoice_total_owed` is "owed"
- `remainingBudget(budget, rollup)` — re-exported from `contractRollup` so importers keep one path; `unallocatedBudget(phase, budgets)` is the phase budget not yet given to any classification, shown as "Neraspoređeno"
- `isFullySettled(sub)` — the "paid in full" predicate, different for contracted and uncontracted rows
- `exceedsPhaseBudget(phase, cost)` — whether a new contract overruns the phase plan. **False when the phase has no budget at all**: a project without a TIC has every phase at 0, and reading that as "a budget of zero, which everything overruns" would block every contract on the project while blaming the amount
- Pure module, covered by `contractTree.test.ts` (grouping, and the field mapping onto the shared rollup) plus `src/utils/contractRollup.test.ts` (the money rules themselves). The logic used to be inline in PhaseCard where it could not be tested

### ProjectSummaryBanner.tsx
- The whole project in one strip of five tiles, in the same order and colours a phase card uses, so the project reads as one level up from what sits beneath it. Money comes from `rollupContracts`, the same function every node below uses
- The "not phased" tile appears only when `tic_phase_count > 0`; on an unphased TIC every line would land there
- The paid tile **and** the unpaid tile are gated on `canManagePayments` (unpaid is contracted − paid, so showing it alone gives paid away), and the grid collapses to two or three columns rather than leaving holes. See "The payment gate" above

### TICBudgetBadge.tsx
- Says where a project's budget comes from — "✓ iz TIC-a" — or that it has none yet. There is no drift warning any more: a budget cannot drift from the plan when the plan is the only thing that writes it

### PhaseCard.tsx
- Level 1 of the "by phase" view: phase header, five budget tiles (contracted, paid, unpaid, remaining, unallocated), utilisation bar, then the classification groups nested inside

### ClassificationCard.tsx
- Level 1 of the "by cost classification" view: a classification with the project's phases nested inside. Its budget is a SUM across phases; like every other planned figure it is read-only and comes from the TIC

### TreeGroup.tsx
- One collapsible level of the contract tree, rendered recursively and dimension-agnostic, so the same component draws a classification inside a phase and a phase inside a classification

### ContractCard.tsx
- A single contract card, lifted out of PhaseCard when the tree gained a third level
- Money renders through `formatEuro`
- The old "Dobit/Gubitak" row (paid − contracted, sign inverted, so an unpaid €200.000 contract read as a €200.000 gain) is gone. The card now shows a variance from [`contractVariance`](../src/utils/contractVariance.ts) with `settled` = `isFullySettled(sub)`, and only when there is one: a red "Prekoračenje" row when paid exceeds the contract, a green "Ušteda" row for a contract settled below its value. An open contract still being paid shows no row — "Preostalo" already says what it owes
- Because this screen lists only `draft`/`active` contracts, settled can only mean paid in full, so in practice the row appears only for an overrun. The status badge and card tint use the same variance, so a badge never says "over budget" when the row does not

### MilestoneList.tsx
- Milestone management panel: add/edit/delete milestones, stats summary, and details per milestone
- Rendered inside `Modal.Body noPadding` from `index.tsx` — `Modal.Body` is the only part of `Modal` that scrolls, so as a direct child a long milestone table simply overflowed the viewport. It draws its own header and close button (the close button carries an `aria-label`), which is why the body takes no padding
- Money is rendered with `formatEuro`, not a hand-rolled `toLocaleString('hr-HR')`
- Paid column, total-paid tile, paid/pending counts and the Status column are gated on `canManagePayments` (see "The payment gate")
- **Uses services:** milestoneService (fetchMilestonesByContract, getNextMilestoneNumber, createMilestone, updateMilestone, deleteMilestone, getMilestoneStatsForContract — via siteService barrel)
- **Uses components:** MilestoneFormModal
- **Uses Ui:** Button, Badge, EmptyState, LoadingSpinner, ConfirmDialog, useToast

#### Milestones are gross

A milestone's amount is `percentage × contract.contract_amount`, and a trigger keeps
`contract_amount` equal to `total_amount` — the contract **with VAT**
(`baseline_schema.sql:57-61`). So both sides of every milestone comparison are gross:

- **Paid** is the sum of the linked invoices' `paid_amount` (gross money received). It used to be
  their `base_amount` — net, and counted whether or not the invoice had ever been paid — so at
  25 % VAT a fully paid milestone read "80 % Djelomično" and `paid >= amount` could never be true.
  This is also what the `update_milestone_status_on_payment` trigger compares against
  `total_amount` when it sets the milestone's status, so the UI now agrees with the database.
- The label is `milestone_list.contract_gross` ("Ugovor (s PDV)"). It used to say
  "Ugovor (osnova)" — *net* — over a gross figure, with a hardcoded English "(Base)" repeating it
  in `MilestoneFormModal` and "Ukupno plaćeno (osnova)" in `EditSubcontractorModal`.
- Cashflow's invoice form computes a milestone's remaining the same way:
  `Cashflow/Invoices/services/invoiceService.ts` `fetchMilestones()` subtracts gross paid from the
  gross milestone amount, not net invoiced.

### ContractDocumentUpload.tsx
- Drag-and-drop PDF uploader enforcing PDF-only and 25 MB per file limits; validates type, size, and duplicates
- Props: files, onChange, error?

### ContractDocumentViewer.tsx
- Document list viewer with delete and open (signed URL) actions
- Props: subcontractorId (required), contractId? (filters to contract), readOnly?
- **Uses services:** Documents `documentService` (fetchDocumentsByEntity, getDocumentSignedUrl, deleteDocument)
- **Uses Ui:** ConfirmDialog

### modals/

All ten are controlled components: `SiteManagement/index.tsx` owns their state and passes
`visible` (or `isOpen` for `InvoicesModal`) plus `onClose`. None of them fetch on their own —
the orchestrator does the writes and re-fetches.

#### PhaseSetupModal.tsx
- Bulk-defines a project's phases in one pass; `editMode?` switches it from initial setup to editing
- Props: `visible`, `onClose`, `project` (`ProjectWithPhases`), `onSubmit(phases: PhaseFormInput[]) => Promise<boolean> | void`, `editMode?`
- In edit mode, submitting a list that drops saved phases (e.g. after lowering the count) first opens a `ConfirmDialog` naming them (`findRemovedPhases`); nothing is deleted unless the user confirms. The submit handler returns the `onSubmit` promise so the button shows loading
- Subtitle is the project name. The old "Distribute €X budget across phases" subtitle and the classification hint were removed: phase budgets come from the TIC (the hint at the bottom says so)

#### ManageCostClassificationsModal.tsx
- Lists every cost classification (including inactive) and loads them itself on open
- Delete asks through a `ConfirmDialog` (`supervision.cost_classification.delete_confirm_message`), then runs the usage pre-check. A refused delete shows `errors.in_use` only when the cause is a foreign-key violation (the FKs are NO ACTION); any other failure shows `errors.save_error`
- The sort-order input (`aria-label` = `sort_order_label`) keeps a draft while typing and saves on blur only when the value changed, then reloads without the spinner so the list re-sorts and focus is not lost. Failures go to the modal's error `Alert`

#### EditPhaseModal.tsx
- Edits a single phase (name, budget allocation, dates, status)
- Props: `visible`, `onClose`, `phase` (`ProjectPhase | null`), `project`, `onSubmit(updates: EditPhaseFormData)`

#### EditSubcontractorModal.tsx
- Edits a subcontractor in the site-management context (contract-adjacent fields, financing source)
- Props: `visible`, `onClose`, `subcontractor`, `onChange(updated)`, `onSubmit(updated, pendingFiles) => Promise<boolean>`
- On open it resets every field, including those `loadContractFormData` fills (phases, contract type, classification, base amount, VAT rate) plus picked files and field errors, so nothing from the previously edited contract lingers. The load is guarded by a request-id ref, so a slow response for an earlier contract is dropped
- A load failure shows an error `Alert` (`supervision.edit_subcontractor.errors.load_failed`). Save is disabled while the contract data loads, after a load failure, and while the Upload button is running — otherwise it would write the reset placeholders over the real amounts
- Save returns the `onSubmit` promise (button loading state) and passes the picked-but-not-uploaded files, which `useSubcontractorManagement.updateSubcontractor` uploads after the update. The separate Upload button still uploads without saving
- Footer is Cancel + Save changes only. The "Mark as completed" button, which had no handler, was removed on 2026-09-15
- Distinct from `Subcontractors/forms/SubcontractorBasicFormModal.tsx`, which edits the base record from the subcontractor register

#### SubcontractorDetailsModal.tsx
- Read-only detail panel plus the comment thread (`completed` / `issue` / `general`)
- Props: `visible`, `onClose`, `subcontractor` (`SubcontractorWithPhase | null`), `comments`, `commentsError`, `onRetryComments`, `newComment`, `commentType`, `onCommentChange`, `onCommentTypeChange`
- With `commentsError` set and no comments, the thread area shows a compact `ErrorState` with a retry instead of the "no comments yet" panel
- **Gross against gross.** `budget_realized` is a sum of payments, VAT included, so the payment tiles compare it with the contract's `total_amount` (falling back to `subcontractor.cost`, i.e. `contract_amount`, which a trigger keeps equal to it). They used to compare it with `base_amount` — net — so a fully-paid contract showed a red 25% overrun here and €0 on the card beside it. The "Ugovoreno" and "Plaćeno" tiles are both gross now; the "(osnova)" in their labels, which was wrong for the paid one, was dropped (the net/VAT breakdown stays in the contract-details block above)
- The third tile is the `contractVariance` result — red "Prekoračenje" or green "Ušteda" — and when there is none it shows "Preostalo" instead of leaving a hole. The header badge (over budget / fully paid / partial / unpaid) is derived from the same contracted, paid and settled values, so badge and tiles cannot contradict each other

#### MilestoneFormModal.tsx
- Creates a contract milestone; carries the subcontractor / project / phase names and `contractCost` for context so the percentage split is checkable at a glance
- Props: `visible`, `onClose`, `onSubmit(data: MilestoneFormData)`, `contractId`, `subcontractorName`, `projectName`, `phaseName`, `contractCost`

#### ContractTypeFormModal.tsx
- Creates a new contract type inline, so adding one does not mean leaving the contract form
- Props: `visible`, `onClose`, `onCreated(newId: number)`

#### EditPaymentModal.tsx
- Edits an existing wire payment
- Props: `visible`, `onClose`, `payment` (`WirePayment | null`), `onChange(updated)`, `onSubmit()`

#### PaymentHistoryModal.tsx
- Merged payment history for one subcontractor — both `WirePayment` and `AccountingPayment` rows in a single list, since a subcontractor can be paid through either path
- The three totals (invoiced / paid / remaining) used to be **zeroed** when `fetchContractInvoiceTotals` failed, so a fully billed contract read as unbilled and unpaid. The figures are now withheld and a compact `ErrorState` with a retry takes their place
- Props: `visible`, `onClose`, `subcontractor`, `payments: (WirePayment | AccountingPayment)[]`

#### InvoicesModal.tsx
- Invoices attached to one subcontractor
- Props: `isOpen` (**not** `visible` — the odd one out), `onClose`, `subcontractor`

Both of these modals label and colour invoice status through the shared `getInvoiceStatusVariant` /
`getInvoiceStatusLabel` in `Cashflow/services/invoiceHelpers.ts` (UNPAID red, PARTIALLY_PAID yellow,
PAID green). `PaymentHistoryModal`'s own map compared against lowercase `'paid'`, which the column
never holds, so every invoice rendered yellow with its raw enum as the label.

### index.tsx (SiteManagement)
- Master orchestrator: project/phase/subcontractor CRUD, payment history, comments, milestone context, and all modal state
- Applies permission checks (`canManagePayments`, `getAccessibleProjectIds`) and threads `canManagePayments` into `ProjectDetail`, `ProjectsGrid`, `SubcontractorDetailsModal`, `EditSubcontractorModal` and `MilestoneList`; `onOpenPaymentHistory` and `onOpenInvoices` are both left `undefined` without it
- **Uses hooks:** useSiteData
- **Uses components:** ProjectsGrid, ProjectDetail, all modals
- **Uses Ui:** Card, Button

#### Which project is open lives in the URL

The route is `/site-management/:projectId?` — **one** route with an optional segment, not two. Two
routes would swap elements on open/back and remount the component, refetching the whole site data
set each time; changing a param does not.

`selectedProject` is derived from `useParams` on every render, not held in state:

- Back returns to the project list. It used to leave Site Management altogether, because the
  address stayed `/site-management` the whole time and opening a project put nothing in history
- A project page can be linked and reloaded
- The derivation replaced a `useEffect` that re-synced the stored project object after every list
  refresh — looking it up fresh does the same thing with nothing to keep in step
- It resolves against `filteredProjects`, not `projects`, so a hand-typed id cannot open a project
  the grid would not have offered a Supervision user (RLS is still the real boundary)
- An id that does not resolve — deleted, or not this user's — redirects to `/site-management` with
  `replace`, so Back does not walk into the dead URL

Covered by `e2e/supervision/site-management-navigation.spec.ts`.

`Layout` marks a menu item active for its own path **and** anything under it, so a detail page
keeps its section lit.

#### Modals

SiteManagement contains the following modals (each self-contained):

- **PhaseSetupModal** — bulk-create phases for a project (name and dates; budgets come from the TIC)
- **EditPhaseModal** — edit a phase's name, dates and status; its budget is shown read-only
- **PhaseClassificationBudgetsModal** — read-only view of a phase's budget split by classification, beside what the project's TIC plans and what other phases already took
- **SubcontractorDetailsModal** — read-only subcontractor detail with contracts and payment history
- **EditSubcontractorModal** — edit subcontractor contract fields and documents
- **PaymentHistoryModal** — payments for a subcontractor with totals
- **EditPaymentModal** — edit a single wire payment record
- **InvoicesModal** — invoices for a subcontractor/contract
- **MilestoneFormModal** — add/edit a contract milestone
- **ContractTypeFormModal** — add a new contract type category

---

### Subcontractors
**Path:** `Supervision/Subcontractors/`

Standalone subcontractor registry with aggregated contract and payment summaries and document management.

#### Services

### services/subcontractorService.ts
- `fetchSubcontractorsWithSummary()` — fetches subcontractors, their contracts (with phase/project relations), and SUBCONTRACTOR-category invoices; aggregates per subcontractor into a `Map<id, SubcontractorSummary>` with contract counts, total value, paid, and remaining
- `deleteSubcontractor(id)` — deletes a base subcontractor record
- **Depends on:** supabase client, logActivity

#### Hooks

### hooks/useSubcontractorData.ts
- `useSubcontractorData()` — wraps the registry fetch and delete; exposes the aggregated summary map, loading state and `error` (plus `refetch`, an alias of `fetchData`). On a failed load the page hides its four stat cards, shows "—" for the header count and renders an `ErrorState` in the list area, because zeros there would report every subcontractor as unpaid and nothing outstanding
- **Calls:** subcontractorService (fetchSubcontractorsWithSummary, deleteSubcontractor)
- **Returns:** subcontractors (`Map<subcontractorId, SubcontractorSummary>`), loading, fetchData, deleteSubcontractor

#### Forms

### forms/SubcontractorBasicFormModal.tsx
- Add/edit base subcontractor registry entry (name, contact, notes)
- The form resets only when `visible` or `editingId` changes. It used to reset on `initialData` too, which the parent rebuilt every render, so the error toast's re-render wiped the typed input; the parent now also memoizes `initialData`
- **Uses services:** siteSubcontractorService (insertSubcontractorRecord, updateSubcontractorRecord — imported via the SiteManagement siteService barrel)
- **Uses Ui:** Modal, Button, Input, useToast

#### Views

### SubcontractorCard.tsx
- Card tile: name/contact, total/active/completed contract counts, total value, paid, remaining, and payment progress bar
- Props: sub (SubcontractorSummary), onSelect, onEdit, onDelete

### SubcontractorContractsList.tsx
- Contracts list in the detail modal: project name, phase, job description, cost/paid/remaining, deadline with overdue indicator, progress badge, and "BEZ UGOVORA" badge if no contract file
- Props: contracts, onViewDocuments

### SubcontractorDocumentsSection.tsx
- Self-contained document upload and viewer for a subcontractor (no contract filter)
- **Uses components:** ContractDocumentViewer, ContractDocumentUpload (from SiteManagement)
- **Uses services:** siteSubcontractorService (uploadSubcontractorDocuments — via the SiteManagement siteService barrel)

### index.tsx (SubcontractorManagement)
- Subcontractor grid with search, detail modal (contracts + documents), add/edit/delete with confirmation
- **Uses hooks:** useSubcontractorData
- **Uses components:** SubcontractorCard, SubcontractorContractsList, SubcontractorDocumentsSection, SubcontractorBasicFormModal
- **Uses Ui:** SearchInput, Card, ConfirmDialog, useToast

---

### Invoices
**Path:** `Supervision/Invoices/`

Invoices raised by subcontractors for work completed on site. Supports approval toggling and CSV export.

#### Services

### services/supervisionInvoiceService.ts
- `fetchSupervisionInvoices()` — fetches accounting invoices with subcontractor, project, and contract relations; phase name now comes from the nested `contract.phase` join (no separate phases query)
- `calculateInvoiceStats(invoices)` — aggregates monthly and total invoice statistics
- `toggleInvoiceApproval(invoiceId, currentApproved)` — flips the approval flag on an invoice; logs `invoice.approve`
- `exportInvoicesCSV(invoices)` — generates a CSV blob and triggers download
- **Depends on:** supabase client, date-fns, logActivity

#### Hooks

### hooks/useSupervisionInvoices.ts
- `useSupervisionInvoices()` — manages invoice list with filters (status, approval, date range) and CSV export; returns `error`, `hasData` and `refetch`. A failed load no longer toasts and empties the register — the stat cards are withheld and the table area carries an `ErrorState`
- **Calls:** supervisionInvoiceService.ts
- **Returns:** loading, stats, filteredInvoices, searchTerm, setSearchTerm, filterStatus, setFilterStatus, filterApproved, setFilterApproved, dateRange, setDateRange, handleApprove, handleExportCSV

#### Views

### index.tsx (SupervisionInvoices)
- Invoice table with stat cards, filter controls, approval toggles, and CSV export
- **Uses hooks:** useSupervisionInvoices
- **Uses Ui:** StatGrid, StatCard, Table, Button, FilterBar, PageHeader

---

### Payments
**Path:** `Supervision/Payments/`

Payments made to subcontractors against their invoices, including cesija and bank/investor payment tracking.

#### Services

### services/supervisionPaymentService.ts
- `fetchSupervisionPayments()` — fetches accounting payments joined with invoices (filtered to INCOMING_SUPPLIER), subcontractors, projects, contracts, cesija company, and paid-by bank/investor
- `calculatePaymentStats(payments)` — aggregates total and monthly payment statistics
- `exportPaymentsCSV(payments)` — generates a CSV blob and triggers download
- **Depends on:** supabase client

#### Hooks

### hooks/useSupervisionPayments.ts
- `useSupervisionPayments()` — manages payment list with filters (search, status, date range) and CSV export; returns `error`, `hasData` and `refetch`, and the screen withholds the stat cards rather than reporting €0 paid on a failed read
- **Calls:** supervisionPaymentService.ts
- **Returns:** loading, error, hasData, refetch, stats, filteredPayments, searchTerm, setSearchTerm, filterStatus, setFilterStatus, dateRange, setDateRange, handleExportCSV

#### Views

### index.tsx (SupervisionPayments)
- Payment table with stat cards, filter controls, and CSV export; shows paid-by company column
- **Uses hooks:** useSupervisionPayments
- **Uses Ui:** StatGrid, StatCard, Table, Button, FilterBar, PageHeader

---

### WorkLogs
**Path:** `Supervision/WorkLogs/`

Daily or weekly on-site work log entries. Supports cascading project → phase → contract selection and status categorisation.

**Colour is the status.** A log's left stripe and its badge both come from its status, via `workLogStatus.ts`. There used to be a hand-picked colour (`work_logs.color`, free text, default `'blue'`) whose picker disagreed with the list's renderer for all eight swatches and could paint a finished log red. The picker was removed; the column is retained in the database (the default fills it on insert) but is **no longer written or read** — it is absent from the `WorkLog` type and from the dashboard's select. Do not reintroduce it.

#### Services

### workLogStatus.ts
- `statusConfig` — per status: label key, icon, `Badge` variant and a **literal** stripe class (`border-l-green-500`, `-blue-`, `-red-`, `-orange-`, `-yellow-`, `border-l-gray-400`), each with a `dark:` twin. The stripe uses the badge's own hue so the two read as one colour. Literal because Tailwind only emits classes written out in the source; the `dark:` twin because the cards' `dark:border-gray-700` would otherwise outrank a bare `border-l-*` and grey every stripe in dark mode
- `unknownStatusConfig` / `statusConfigFor(status)` — the fallback for a null or unrecognised status (`work_logs.status` is nullable with no default); an own-property lookup, so `"constructor"` is not a status
- `stripeClass(status)` — the left-border class for a card
- Pure; covered by `workLogStatus.test.ts`

### StatusBadge.tsx
- `StatusBadge({ status })` — icon + label badge. Takes `string | null | undefined` so the Supervision dashboard's week view (`dashboards/sections/SupervisionWeekView.tsx`, whose row type has `status: string`) uses it too; that view previously showed no status at all

### services/workLogService.ts
- `fetchProjects()` — fetches projects for the log form selector
- `fetchPhasesByProject(projectId)` — fetches phases for a selected project
- `fetchContractsByPhase(phaseId)` — fetches contracts for a selected phase
- `fetchWorkLogs()` — fetches all work log records with nested contract/subcontractor/project/phase relations
- `createWorkLog(data, subcontractorId, userId)` — inserts a new work log; logs `work_log.create`
- `updateWorkLog(id, data, subcontractorId)` — updates a work log; logs `work_log.update`
- `deleteWorkLog(id)` — removes a work log; logs `work_log.delete`
- **Depends on:** supabase client, logActivity

#### Hooks

### hooks/useWorkLogs.ts
- `useWorkLogs()` — manages work log CRUD with cascading project/phase/contract selects and form state
- Returns `error` and `refetch`; an empty history under a failed read renders an `ErrorState` instead of "no work logs yet". The cascading phase/contract lookups toast `supervision.work_logs.errors.load_phases_failed` / `…load_contracts_failed` rather than only logging, since an empty dropdown otherwise reads as "no phases in this project"
- **Calls:** workLogService.ts
- **Returns:** workLogs, projects, phases, contracts, loading, error, refetch, showForm, editingLog, formData, setFormData, openNewForm, openEditForm, closeForm, handleProjectChange, handlePhaseChange, handleSubmit, handleDelete

#### Views

### index.tsx (WorkLogs)
- Work log modal form with cascading selects, and history cards with status badges (work_finished, in_progress, blocker, quality_issue, waiting_materials, weather_delay); each card's left stripe is `stripeClass(log.status)`
- `handleValidatedSubmit` returns `handleSubmit`'s promise, so `Form` blocks re-submits and the submit button spins while saving (a double-click creates one log)
- **Uses hooks:** useWorkLogs
- **Uses Ui:** Modal, Button, Select, Card, PageHeader

---

## Notes
- `SiteManagement/` and `Retail/Projects/` share a similar phase/milestone UI pattern — keep in sync when updating either
- Subcontractor/contract documents are no longer stored via a SiteManagement-owned bucket. `uploadSubcontractorDocuments` (siteSubcontractorService) delegates to the central Documents `documentService.uploadDocument` under the `IZVODACI` category, attaching associations to the subcontractor, contract, project, and phase. `ContractDocumentViewer` reads/deletes via `documentService` (fetchDocumentsByEntity, getDocumentSignedUrl, deleteDocument). The old `ContractDocument` type was removed from SiteManagement/types.ts
- `ContractDocumentViewer` accepts `subcontractorId` (required) and optional `contractId` to filter by contract
- VAT_RATE_OPTIONS = [0, 5, 13, 25] — defined in SiteManagement/types.ts
- The original monolithic `siteService.ts` was split into per-entity service files (phase, contract, subcontractor, milestone, funding, wire payment) during the May 2026 audit refactor; `siteService.ts` now re-exports them so `import * as siteService` consumers keep working
- Payment create/update/delete from SiteManagement now only warn the user — those operations moved to the Accounting module (Invoices/Payments)
- **Failed loads are not empty states.** Every loader in this module returns `error` and a `refetch`, and the screens render a `ErrorState` (from `src/components/ui`) in the list area — page header and filters stay mounted — when nothing loaded, or keep the stale rows under a dismissible `Alert variant="error"` with a retry when something did. Stat cards computed from a failed read are withheld rather than shown as €0. This covers SiteManagement (project grid, comments, wire payments, invoice totals, the classification/category lookups), Subcontractors, Invoices, Payments and WorkLogs
- All delete confirmation dialogs use `ConfirmDialog` from `src/components/ui/` via the pending-item hook pattern; `useProjectPhases` uses a Promise-based `requestConfirm` pattern for mid-flow budget-mismatch confirmations — never use `window.confirm()` or `confirm()`
