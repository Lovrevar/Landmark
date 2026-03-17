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

### Services/siteService.ts
- `fetchAllProjects()` — fetches all site projects with phases and subcontractor summary data
- `fetchProjectPhases(projectId)` — fetches phases for a project
- `fetchSubcontractorsWithPhases()` — fetches subcontractor-contract records joined with phase and project data
- `fetchAllSubcontractors()` — fetches the base subcontractor registry
- `getSubcontractorById(id)` — fetches a single subcontractor record
- `recalculatePhaseBudget(phaseId)` — recomputes budget_used for a phase from contract amounts
- `recalculateAllPhaseBudgets(projectId)` — recalculates all phases for a project
- `createPhases(projectId, phases)` — bulk-creates phases for a project (with budget validation)
- `updateProjectPhases(phases)` — updates multiple phase records
- `updatePhase(phaseId, data)` — updates a single phase
- `deletePhase(phaseId)` — removes a phase (only if budget_used is 0)
- `createSubcontractorWithReturn(data)` — inserts a new subcontractor and returns the created record
- `updateSubcontractor(id, data)` — updates a subcontractor-contract record
- `deleteSubcontractor(id)` — removes a subcontractor from a phase
- `insertSubcontractorRecord(data)` — inserts a base subcontractor registry entry
- `updateSubcontractorRecord(id, data)` — updates a base subcontractor registry entry
- `createContract(contractData)` — creates a contract record linked to a subcontractor and phase
- `generateUniqueContractNumber()` — generates a unique contract number
- `getPhaseInfo(phaseId)` — fetches phase details for contract linking
- `getContractByNumber(number)` — fetches a contract by its number
- `uploadSubcontractorDocuments(subcontractorId, files, contractId?)` — uploads PDF files to Supabase storage
- `fetchSubcontractorDocuments(subcontractorId)` — fetches all documents for a subcontractor
- `fetchDocumentsByContract(contractId)` — fetches documents filtered by contract
- `deleteSubcontractorDocument(documentId, filePath)` — removes a document from storage and database
- `getContractDocumentSignedUrl(filePath)` — returns a signed URL for a stored document
- `fetchMilestonesByContract(contractId)` — fetches milestones for a contract
- `createMilestone(data)` — inserts a new milestone
- `updateMilestone(id, data)` — updates an existing milestone
- `deleteMilestone(id)` — removes a milestone
- `getNextMilestoneNumber(contractId)` — returns the next available milestone number
- `getMilestoneStatsForContract(contractId)` — returns milestone count and completion stats
- `fetchSubcontractorComments(subcontractorId)` — fetches comments/notes for a subcontractor
- `createSubcontractorComment(subcontractorId, userId, comment, type)` — adds a comment
- `fetchProjectFunders(projectId)` — returns banks and investors linked to a project
- `fetchCreditAllocations(projectId)` — returns bank credit allocations for a project
- **Depends on:** supabase client

#### Hooks

### Hooks/useSiteData.ts
- `useSiteData()` — aggregator hook that composes useSiteProjectData, useProjectPhases, useSubcontractorManagement, and useSubcontractorComments into a single return object
- **Calls:** useSiteProjectData, useProjectPhases, useSubcontractorManagement, useSubcontractorComments

### Hooks/useSiteProjectData.ts
- `useSiteProjectData()` — fetches projects with phases, subcontractors, and invoice stats; builds existingSubcontractors array
- **Calls:** siteService.ts
- **Returns:** projects, loading, existingSubcontractors, refetch

### Hooks/useProjectPhases.ts
- `useProjectPhases()` — manages phase CRUD with budget allocation validation
- **Calls:** siteService.ts
- **Returns:** createProjectPhases, updatePhase, deletePhase

### Hooks/useSubcontractorManagement.ts
- `useSubcontractorManagement()` — manages subcontractor add/edit/delete with document upload, phase budget recalculation, and unique contract number generation
- **Calls:** siteService.ts
- **Returns:** addSubcontractorToPhase, updateSubcontractor, deleteSubcontractor

### Hooks/useSubcontractorComments.ts
- `useSubcontractorComments()` — fetches and creates subcontractor comments; supports types: completed, issue, general
- **Calls:** siteService.ts
- **Returns:** fetchSubcontractorComments, addSubcontractorComment

### Hooks/useContractTypes.ts
- `useContractTypes()` — loads active contract types from the contract_types table
- **Calls:** supabase client
- **Returns:** contractTypes, loading, load

### Hooks/useVATCalculation.ts
- `useVATCalculation(baseAmount, vatRate)` — computes vatAmount and totalAmount via useMemo
- Formula: `vatAmount = baseAmount × vatRate / 100`
- **Returns:** vatAmount, totalAmount

#### Forms

### Forms/ContractFormFields.tsx
- Reusable contract field group: Osnovica (base amount), PDV stopa (VAT rate from VAT_RATE_OPTIONS), VAT/total summary display, start date, and deadline
- Props: formData, vatAmount, totalAmount, onChange, deadlineRequired?
- **Uses hooks:** (receives computed vatAmount/totalAmount as props)
- **Uses Ui:** Select, Input

### Forms/SubcontractorFormModal.tsx
- Complex form for adding a subcontractor to a phase: toggle between new entry and existing subcontractor, contract fields, document upload, and financing source selection
- **Uses hooks:** useContractTypes, useVATCalculation
- **Uses components:** ContractFormFields, ContractTypeFormModal, ContractDocumentUpload
- **Uses services:** siteService (fetchProjectFunders)
- **Uses Ui:** Modal, Button, Select

#### Views

### ProjectsGrid.tsx
- Project card grid with budget allocation progress bars, phase count, subcontractor count, and timeline

### ProjectDetail.tsx
- Single project detail view: credit allocations section, phase cards, and project summary stats
- **Uses services:** siteService (fetchCreditAllocations)
- **Uses components:** PhaseCard

### PhaseCard.tsx
- Expanded phase view: phase header, budget metrics, subcontractors grouped by contract type with expandable sections; shows contracted amount, paid out, unpaid, and budget remaining with colour warnings

### MilestoneList.tsx
- Milestone management panel: add/edit/delete milestones, stats summary, and details per milestone
- **Uses services:** siteService (milestone CRUD)
- **Uses components:** MilestoneFormModal
- **Uses Ui:** Button, EmptyState, useToast

### ContractDocumentUpload.tsx
- Drag-and-drop PDF uploader enforcing PDF-only and 25 MB per file limits; validates type, size, and duplicates
- Props: files, onChange, error?

### ContractDocumentViewer.tsx
- Document list viewer with delete and open (signed URL) actions
- Props: subcontractorId (required), contractId? (filters to contract), readOnly?
- **Uses services:** siteService (fetch, delete, getSignedUrl)

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

#### Hooks

### Hooks/useSubcontractorData.ts
- `useSubcontractorData()` — fetches subcontractors, contracts with phase/project relations, and invoices by contract; aggregates into a Map keyed by subcontractor ID
- **Calls:** siteService.ts
- **Returns:** `Map<subcontractorId, SubcontractorSummary>`, loading, refetch

#### Forms

### Forms/SubcontractorBasicFormModal.tsx
- Add/edit base subcontractor registry entry (name, contact, notes)
- **Uses services:** siteService (insertSubcontractorRecord, updateSubcontractorRecord)
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
- `fetchSupervisionInvoices()` — fetches accounting invoices with subcontractor, project, and contract relations
- `calculateInvoiceStats(invoices)` — aggregates monthly and total invoice statistics
- `toggleInvoiceApproval(invoiceId, currentApproved)` — flips the approval flag on an invoice
- `exportInvoicesCSV(invoices)` — generates a CSV blob and triggers download
- **Depends on:** supabase client, date-fns

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
- `createWorkLog(data)` — inserts a new work log
- `updateWorkLog(id, data)` — updates a work log
- `deleteWorkLog(id)` — removes a work log
- **Depends on:** supabase client

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
- Document storage bucket: `contract-documents`; path: `subcontractors/{subcontractorId}/...`
- `ContractDocumentViewer` accepts `subcontractorId` (required) and optional `contractId` to filter by contract
- VAT_RATE_OPTIONS = [0, 5, 13, 25] — defined in SiteManagement/types.ts
