# Module: Supervision

**Path:** `src/components/Supervision/`

## Overview

Construction site supervision: manages active build sites, subcontractor contracts, phase/milestone tracking, work logs, invoices, and payments for on-site work.

---

## Sub-modules

### SiteManagement
**Path:** `Supervision/SiteManagement/`

The core supervision module. Full project site view with phases, subcontractor contracts, milestone tracking, document management, and financial summaries per phase.

#### Services

> The original monolithic `siteService.ts` was split by entity during the May 2026 audit refactor. `siteService.ts` is now a thin barrel that keeps a couple of project-level fetchers and re-exports the per-entity service files below, so existing `import * as siteService` consumers keep working unchanged. New code should import directly from the entity-specific file.

### services/siteService.ts (barrel)
- `fetchAllProjects()` — fetches all site projects ordered by start date
- `fetchSubcontractorsWithPhases()` — fetches active/draft contracts joined with subcontractor, phase, and contract-type details; returns a flat list keyed by contract
- Re-exports everything from phaseService, siteContractService, siteSubcontractorService, milestoneService, siteFundingService, and wirePaymentService
- **Depends on:** supabase client; the six entity service files below

### services/phaseService.ts
- `fetchProjectPhases()` — fetches all phases ordered by project then phase number
- `recalculatePhaseBudget(phaseId)` — recomputes budget_used for a phase from active/draft contract amounts
- `recalculateAllPhaseBudgets()` — recomputes budget_used for every phase across all projects via the `recalculate_all_phase_budgets()` Postgres RPC (set-based, avoids the 1000-row client cap)
- `createPhases(projectId, phases)` — bulk-creates phases for a project
- `updateProjectPhases(projectId, phases)` — syncs a project's phase set (insert/update/delete and renumber)
- `updatePhase(phaseId, updates)` — updates a single phase
- `deletePhase(phaseId)` — removes a phase
- `resequencePhases(phases)` — renumbers phases sequentially after a deletion
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
- `fetchMilestonesByContract(contractId)` — fetches milestones for a contract with paid_amount summed from linked invoices
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

### hooks/useSiteProjectData.ts
- `useSiteProjectData()` — fetches projects with phases, subcontractors, and invoice stats; builds existingSubcontractors array
- **Calls:** siteService barrel (`fetchAllProjects`, `fetchSubcontractorsWithPhases`; `fetchProjectPhases`, `fetchAllSubcontractors`, `fetchInvoiceStatsForContracts` via re-export from phaseService/siteSubcontractorService)
- **Returns:** projects, loading, refreshing, existingSubcontractors, fetchProjects

### hooks/useProjectPhases.ts
- `useProjectPhases(fetchProjects)` — manages phase CRUD with budget-allocation validation via a Promise-based requestConfirm flow
- **Calls:** siteService barrel → phaseService (`recalculateAllPhaseBudgets`, `createPhases`, `updatePhase`, `deletePhase`, `resequencePhases`, `updateProjectPhases`)
- **Returns:** recalculateAllPhaseBudgets, createProjectPhases, updatePhase, deletePhase, updateProjectPhases, pendingConfirm

### hooks/useSubcontractorManagement.ts
- `useSubcontractorManagement(fetchProjects)` — manages subcontractor add/edit/delete with document upload, phase budget recalculation, and unique contract number generation; payment create/update/delete now warn that those moved to the Accounting module
- **Calls:** siteService barrel → siteContractService (`createContract`, `generateUniqueContractNumber`), siteSubcontractorService (`createSubcontractorWithReturn`, `updateSubcontractor`, `deleteSubcontractor`, `getSubcontractorDetails`, `uploadSubcontractorDocuments`), phaseService (`getPhaseInfo`, `updatePhase`, `recalculatePhaseBudget`), wirePaymentService (`fetchWirePayments`)
- **Returns:** addSubcontractorToPhase, updateSubcontractor, deleteSubcontractor, pendingDeleteSubcontractor, confirmDeleteSubcontractor, cancelDeleteSubcontractor, deletingSubcontractor, addPaymentToSubcontractor, fetchWirePayments, updateWirePayment, deleteWirePayment

### hooks/useSubcontractorComments.ts
- `useSubcontractorComments()` — fetches and creates subcontractor comments; supports types: completed, issue, general
- **Calls:** siteService barrel → siteSubcontractorService (`fetchSubcontractorComments`, `createSubcontractorComment`)
- **Returns:** fetchSubcontractorComments, addSubcontractorComment

### hooks/useContractTypes.ts
- `useContractTypes()` — loads active contract types from the contract_types table
- **Calls:** contractTypesService (`fetchActiveContractTypes`)
- **Returns:** contractTypes, loading, load

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

### ProjectDetail.tsx
- Single project detail view: credit allocations section, phase cards, and project summary stats
- **Uses services:** siteFundingService (fetchCreditAllocations, via siteService barrel)
- **Uses components:** PhaseCard

### PhaseCard.tsx
- Expanded phase view: phase header, budget metrics, subcontractors grouped by contract type with expandable sections; shows contracted amount, paid out, unpaid, and budget remaining with colour warnings

### MilestoneList.tsx
- Milestone management panel: add/edit/delete milestones, stats summary, and details per milestone
- **Uses services:** milestoneService (fetchMilestonesByContract, getNextMilestoneNumber, createMilestone, updateMilestone, deleteMilestone, getMilestoneStatsForContract — via siteService barrel)
- **Uses components:** MilestoneFormModal
- **Uses Ui:** Button, Badge, EmptyState, LoadingSpinner, ConfirmDialog, useToast

### ContractDocumentUpload.tsx
- Drag-and-drop PDF uploader enforcing PDF-only and 25 MB per file limits; validates type, size, and duplicates
- Props: files, onChange, error?

### ContractDocumentViewer.tsx
- Document list viewer with delete and open (signed URL) actions
- Props: subcontractorId (required), contractId? (filters to contract), readOnly?
- **Uses services:** Documents `documentService` (fetchDocumentsByEntity, getDocumentSignedUrl, deleteDocument)
- **Uses Ui:** ConfirmDialog

### index.tsx (SiteManagement)
- Master orchestrator: project/phase/subcontractor CRUD, payment history, comments, milestone context, and all modal state
- Applies permission checks (canManagePayments, getAccessibleProjectIds)
- **Uses hooks:** useSiteData
- **Uses components:** ProjectsGrid, ProjectDetail, all modals
- **Uses Ui:** Card, Button

#### Modals

SiteManagement contains the following modals (each self-contained):

- **PhaseSetupModal** — bulk-create phases for a project
- **EditPhaseModal** — edit phase name, budget, dates, and status
- **SubcontractorDetailsModal** — read-only subcontractor detail with contracts and payment history
- **EditSubcontractorModal** — edit subcontractor contract fields and documents
- **PaymentHistoryModal** — payments for a subcontractor with totals
- **EditPaymentModal** — edit a single wire payment record
- **InvoicesModal** — invoices for a subcontractor/contract
- **MilestoneFormModal** — add/edit a contract milestone
- **ContractTypeFormModal** — add a new contract type category
- **WirePaymentModal** — record a wire payment against a subcontractor invoice

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
- `useSubcontractorData()` — wraps the registry fetch and delete; exposes the aggregated summary map and loading state
- **Calls:** subcontractorService (fetchSubcontractorsWithSummary, deleteSubcontractor)
- **Returns:** subcontractors (`Map<subcontractorId, SubcontractorSummary>`), loading, fetchData, deleteSubcontractor

#### Forms

### forms/SubcontractorBasicFormModal.tsx
- Add/edit base subcontractor registry entry (name, contact, notes)
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
- `useSupervisionInvoices()` — manages invoice list with filters (status, approval, date range) and CSV export
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
- `useSupervisionPayments()` — manages payment list with filters (search, status, date range) and CSV export
- **Calls:** supervisionPaymentService.ts
- **Returns:** loading, stats, filteredPayments, searchTerm, setSearchTerm, filterStatus, setFilterStatus, dateRange, setDateRange, handleExportCSV

#### Views

### index.tsx (SupervisionPayments)
- Payment table with stat cards, filter controls, and CSV export; shows paid-by company column
- **Uses hooks:** useSupervisionPayments
- **Uses Ui:** StatGrid, StatCard, Table, Button, FilterBar, PageHeader

---

### WorkLogs
**Path:** `Supervision/WorkLogs/`

Daily or weekly on-site work log entries. Supports cascading project → phase → contract selection and status categorisation.

#### Services

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
- **Calls:** workLogService.ts
- **Returns:** workLogs, projects, phases, contracts, loading, showForm, editingLog, formData, setFormData, openNewForm, openEditForm, closeForm, handleProjectChange, handlePhaseChange, handleSubmit, handleDelete

#### Views

### index.tsx (WorkLogs)
- Work log modal form with cascading selects, and history cards with status badges (work_finished, in_progress, blocker, quality_issue, waiting_materials, weather_delay)
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
- All delete confirmation dialogs use `ConfirmDialog` from `src/components/ui/` via the pending-item hook pattern; `useProjectPhases` uses a Promise-based `requestConfirm` pattern for mid-flow budget-mismatch confirmations — never use `window.confirm()` or `confirm()`
