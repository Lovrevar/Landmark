# Backlog — Retail

Land development, parcels and retail buyers. Ids: `RETAIL-n` (next free: `RETAIL-4`). Entry format
and rules are in [README.md](./README.md).

Retail was left out of the September 2026 code audit, so this list is short because nobody has
looked, not because the module is clean.

## Open

### RETAIL-1 · Low · Retail dashboard per-customer figures (was DASH-505)
- **Where:** `src/components/dashboards/services/retailDashboardService.ts`.
- **What happens:** per-customer revenue divides by all customers, including non-buyers;
  `customer_name` falls back to the invoice number; `'N/A'` and the contract number are not
  localised.
- **Fix direction:** divide by buyers only; consider gating on `approved = true`.

### RETAIL-2 · Low · Contract form hides a failed supplier load
- **Where:** `src/components/Retail/Projects/modals/ContractFormModal.tsx`. A failed load is
  logged to the console and shows an empty dropdown.
- **Fix direction:** an error state with retry, as in the three Retail modals already fixed.

### RETAIL-3 · Low · Milestones panel is a hand-rolled overlay
- **Where:** `src/components/Retail/Projects/ProjectDetail.tsx`, `MilestoneList.tsx`.
- **What happens:** role, label, focus trap and Escape were added, but there is still no portal,
  backdrop close or scroll lock.
- **Fix direction:** `<Modal size="full">`.
