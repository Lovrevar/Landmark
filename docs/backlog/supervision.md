# Backlog — Supervision

Site management, subcontractors, contracts, phases and work logs. Ids: `SUP-n` (next free:
`SUP-13`). Entry format and rules are in [README.md](./README.md).

Supervision is used on phones on site; the mobile problems are UI-8 in [ui.md](./ui.md). The
payment gate being screen-only is SEC-004 in [security.md](./security.md).

## Open

### SUP-5 · Low · The by-classification view has no add or budget buttons
- The "+" on a classification row now preselects it; the view itself still offers no way to add
  a contract or set a budget.

### SUP-7 · Low · Financing is stored on the company, not the contract
- `financed_by_*` is set only when creating a new subcontractor, and only banks are offered.

### SUP-12 · Low · Payment history repeats the accounting note on every row
- **Where:** `src/components/Supervision/SiteManagement/modals/PaymentHistoryModal.tsx`.
- **Fix direction:** say "managed in accounting" once, in the header.

### SUP-11 · Low · Dead code
- `check_subcontractor_budget_integrity()` references the non-existent `contracts.budget_planned`.
- Supervision invoices filter on `invoice_category IN ('SUBCONTRACTOR','SUPERVISION')`;
  `SUPERVISION` is not a valid category.
- Unused: `linkSubcontractorToPhase`, `getContractCount`, `createSubcontractor`,
  `fetchSubcontractorInvoiceStats`, `fetchMilestonesBySubcontractor`, `updateMilestoneStatus`,
  `recalculateAllPhaseBudgets` (no UI caller).
- Before deleting, grep every exported symbol; see [../GRAPHIFY.md](../GRAPHIFY.md) on why "no
  inbound import" is not proof.
