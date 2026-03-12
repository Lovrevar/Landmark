# Module: Supervision

**Path:** `src/components/Supervision/`

## Overview
Construction site supervision: manages active build sites, subcontractor contracts, phase/milestone tracking, work logs, invoices, and payments for on-site work.

## Sub-modules

### SiteManagement
**Path:** `Supervision/SiteManagement/`
- The core supervision module. Full project site view with phases, milestones, and subcontractor management.
- `useSiteData.ts` — site list and overview data
- `useSiteProjectData.ts` — single site detail with phases and subcontractors
- `useProjectPhases.ts` — phase CRUD and ordering
- `useSubcontractorManagement.ts` — assign/edit subcontractors per phase
- `useSubcontractorComments.ts` — comments/notes on subcontractors
- `useContractTypes.ts` — contract type reference data
- `useVATCalculation.ts` — VAT computation for contracts
- `siteService.ts` — Supabase queries
- Views: `ProjectsGrid`, `ProjectDetail`, `PhaseCard`, `MilestoneList`
- Document handling: `ContractDocumentUpload.tsx`, `ContractDocumentViewer.tsx`
- Forms: `SubcontractorFormModal`, `ContractFormFields`
- Modals: `SubcontractorDetailsModal`, `EditSubcontractorModal`, `EditPhaseModal`, `PhaseSetupModal`, `MilestoneFormModal`, `ContractTypeFormModal`, `InvoicesModal`, `PaymentHistoryModal`, `EditPaymentModal`, `WirePaymentModal`

### Subcontractors
**Path:** `Supervision/Subcontractors/`
- Standalone subcontractor registry with contracts and documents.
- `useSubcontractorData.ts` — subcontractor profiles with contracts
- `SubcontractorCard.tsx` — summary card
- `SubcontractorContractsList.tsx` — all contracts per subcontractor
- `SubcontractorDocumentsSection.tsx` — uploaded document list
- `SubcontractorBasicFormModal.tsx` — create/edit subcontractor

### Invoices
**Path:** `Supervision/Invoices/`
- Invoices raised by subcontractors for work completed on site.
- `useSupervisionInvoices.ts` — invoice list
- `supervisionInvoiceService.ts` — Supabase queries

### Payments
**Path:** `Supervision/Payments/`
- Payments made to subcontractors against their invoices.
- `useSupervisionPayments.ts` — payment list
- `supervisionPaymentService.ts` — Supabase queries

### WorkLogs
**Path:** `Supervision/WorkLogs/`
- Daily or weekly on-site work log entries.
- `useWorkLogs.ts` — work log list and CRUD
- `workLogService.ts` — Supabase queries

## Notes
- Supervision has active uncommitted changes
- `SiteManagement` and `Retail/Projects` share a similar phase/milestone UI pattern — keep in sync if updating one
