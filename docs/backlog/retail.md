# Backlog — Retail

Land development, parcels and retail buyers. Ids: `RETAIL-n` (next free: `RETAIL-7`). Entry format
and rules are in [README.md](./README.md).

Retail was left out of the September 2026 code audit, so this list is short because nobody has
looked, not because the module is clean.

## Open

### RETAIL-6 · Low · Retail strings
- **Check:** Code reading
- English in the Croatian file: retail phase and contract statuses, "Deadline", "Milestones
  plaćanja", "Export Excel". Toasts in `useRetailInvoices.ts` are literals.
- Several strings send the user to an "Accounting modul" that is called Cashflow on screen.
- The `land_plots.*` locale block looks unused.

### RETAIL-1 · Low · Retail dashboard overdue list (was DASH-505)
- **Where:** `src/components/dashboards/services/retailDashboardService.ts`.
- **What happens:** `customer_name` falls back to the invoice number; `'N/A'` and the contract
  number are not localised. (Revenue per customer dividing by non-buyers was fixed on
  `fix/backlog-small-batch`, 2026-10-08: `buying_customers`.)

### RETAIL-2 · Low · Contract form hides a failed supplier load
- **Where:** `src/components/Retail/Projects/modals/ContractFormModal.tsx`. A failed load is
  logged to the console and shows an empty dropdown.
- **Fix direction:** an error state with retry, as in the three Retail modals already fixed.

### RETAIL-3 · Low · Milestones panel is a hand-rolled overlay
- **Where:** `src/components/Retail/Projects/ProjectDetail.tsx`, `MilestoneList.tsx`.
- **What happens:** role, label, focus trap and Escape were added, but there is still no portal,
  backdrop close or scroll lock.
- **Fix direction:** `<Modal size="full">`.

## Resolved

### RETAIL-5 · Medium · The `/retail-sales` page cannot be reached from the menu
- Fixed on `fix/figures-and-tic-export` (2026-10-08): the Retail menu's "Prodaje" opens `/retail-sales`, and the payments register
  has its own item "Plaćanja".

### RETAIL-4 · Medium · Approving a retail invoice is not role-gated and fails silently
- Fixed on `fix/audit-medium-findings` (2026-10-07): the update checks `assertRowsAffected`, the tick is disabled unless
  `canApproveInvoices`, and the toasts are translated.
