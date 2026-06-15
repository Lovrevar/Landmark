# Feature: Activity Log

**Path:** `src/components/General/ActivityLog/`
**Shared Logger:** `src/lib/activityLog.ts`
**Database:** `activity_logs` table + `get_activity_logs` RPC function
**Access:** Director-only (route `/activity-log`)

## Overview

The Activity Log provides a full audit trail for all CRUD operations across the platform. Every mutation (create, update, delete, bulk operation, import, export) is logged with the acting user, target entity, severity, and action-specific metadata. The log is immutable — no UPDATE or DELETE policies exist on the table.

---

## Architecture

```
Mutation site (service/hook)
  └─ logActivity({ action, entity, entityId?, metadata })   ← fire-and-forget, never blocks
       └─ resolves user from Supabase auth session (if not passed)
            └─ INSERT into activity_logs table
                 └─ Director queries via get_activity_logs RPC
                      └─ ActivityLog UI (filters, table, detail modal)
```

---

## Database

### Table: `activity_logs`

| Column | Type | Notes |
|---|---|---|
| `id` | uuid | PK, `DEFAULT gen_random_uuid()` |
| `user_id` | uuid | NOT NULL, FK → `users(id)` |
| `user_role` | text | NOT NULL |
| `action` | text | NOT NULL (e.g. `invoice.create`) |
| `entity` | text | NOT NULL (e.g. `invoice`) |
| `entity_id` | uuid | nullable — null for bulk/export/auth actions |
| `project_id` | uuid | nullable, FK → `projects(id)` |
| `metadata` | jsonb | NOT NULL DEFAULT `'{}'` |
| `ip_address` | text | nullable — currently always NULL (client-side limitation) |
| `created_at` | timestamptz | NOT NULL DEFAULT `now()` |

**RLS Policies:**
- `SELECT` — Director-only
- `INSERT` — All authenticated users (fire-and-forget writes)
- No `UPDATE` or `DELETE` — logs are immutable

### RPC: `get_activity_logs`

Server-side filtered and paginated query function. Parameters:

| Parameter | Type | Default | Description |
|---|---|---|---|
| `p_user_id` | uuid | NULL | Filter by acting user |
| `p_action_prefix` | text | NULL | Prefix match on action (e.g. `invoice` matches `invoice.*`) |
| `p_severity` | text | NULL | Filter by `metadata->>'severity'` |
| `p_search_term` | text | NULL | Free-text search across action, entity, username, metadata |
| `p_date_from` | timestamptz | NULL | Start of date range |
| `p_date_to` | timestamptz | NULL | End of date range |
| `p_project_id` | uuid | NULL | Filter by project |
| `p_offset` | integer | 0 | Pagination offset |
| `p_limit` | integer | 50 | Page size |

Returns rows with JOINed `username`, `project_name`, and `total_count` (window function for pagination).

---

## Shared Logger — `src/lib/activityLog.ts`

### `logActivity(params): void`

Fire-and-forget function. Returns `void` (not `Promise`). A logging failure **never** blocks or errors the user's CRUD operation — failures are caught and sent to `console.warn`.

```typescript
logActivity({
  action: string         // e.g. 'invoice.create'
  entity: string         // e.g. 'invoice'
  entityId?: string | null
  projectId?: string | null
  metadata?: Record<string, unknown>
  severity?: 'low' | 'medium' | 'high'
  // Optional — if omitted, resolved from Supabase auth session:
  userId?: string
  userRole?: string
})
```

**Key behaviors:**
- `severity` is merged into `metadata.severity` (not a separate column)
- When `userId`/`userRole` are omitted, the function calls `supabase.auth.getUser()` and looks up the `users` row internally
- The insert uses a try/catch with `console.warn` — never throws

---

## UI Components

### index.tsx (ActivityLog page)
- Director-only guard via `canViewActivityLog(user)` — redirects non-Directors to `/`
- Filter bar: search input, user select, action category select, severity select, project select, date range inputs, reset button
- Results: `ActivityLogTable` + `Pagination`
- Detail: `ActivityLogDetailModal` on eye icon click
- **Uses:** `useActivityLog` hook, `PageHeader`, `SearchInput`, `Select`, `Pagination`, `LoadingSpinner`, `EmptyState`, `Button`

### ActivityLogTable.tsx
- Table columns: Timestamp, User (name + role badge), Action (i18n translated), Entity (type + truncated ID), Project, Severity (colored badge), Details (eye icon)
- Timestamp formatted in `hr-HR` locale
- Role badges: Director=blue, Accounting=purple, Sales=teal, Supervision=orange, Investment=gray
- Severity badges: low=green, medium=yellow, high=red

### ActivityLogDetailModal.tsx
- Three sections: User info, Entity info, Metadata
- Metadata renders all keys except `severity` as key-value pairs
- "View Entity" navigation button when `entity_id` exists and `ENTITY_ROUTE_MAP` has a matching route
- **Uses:** `Modal`, `Badge`, `Button`, `ENTITY_ROUTE_MAP`

### hooks/useActivityLog.ts
- Manages all filter state, debounced search (500ms), server-side pagination
- Fetches reference data (users list, projects list) on mount for filter dropdowns
- Resets to page 1 when any filter changes
- **Returns:** logs, loading, totalCount, pagination, all filter state + setters, selectedLog, resetFilters, refetch

### services/activityLogQueryService.ts
- `fetchActivityLogs(filters, offset, limit)` — wraps `get_activity_logs` RPC call
- `fetchLogUsers()` — fetches all users for filter dropdown
- `fetchProjects()` — fetches all projects for filter dropdown

### types.ts
- `ActivityLogEntry` — row shape returned by the RPC
- `ActivityLogFilters` — filter state shape
- `ACTION_CATEGORIES` — 35 action category prefixes for the category filter
- `ENTITY_ROUTE_MAP` — maps entity types to their app routes for "View Entity" navigation
- `SeverityFilter`, `ActionCategory` — union types

---

## Instrumented Actions — Full Inventory

~140 discrete actions across 8 categories. Severity: **L**=low, **M**=medium, **H**=high.

### Auth (2)
| Action | Severity | File |
|---|---|---|
| `auth.login` | L | `src/contexts/AuthContext.tsx` |
| `auth.logout` | L | `src/contexts/AuthContext.tsx` |

### General — Projects & Milestones (7)
| Action | Severity | File |
|---|---|---|
| `project.create` | M | `General/Projects/services/projectFormService.ts` |
| `project.update` | M | `General/Projects/services/projectFormService.ts` |
| `project.delete` | H | `General/Projects/services/projectFormService.ts` |
| `milestone.create` | M | `General/Projects/services/milestoneService.ts` |
| `milestone.update` | M | `General/Projects/services/milestoneService.ts` |
| `milestone.delete` | H | `General/Projects/services/milestoneService.ts` |
| `milestone.bulk_create` | M | `General/Projects/services/milestoneService.ts` |

### Cashflow / Accounting (29)
| Action | Severity | File |
|---|---|---|
| `invoice.create` | H | `Cashflow/Invoices/services/invoiceService.ts` |
| `invoice.update` | M | `Cashflow/Invoices/services/invoiceService.ts` |
| `invoice.delete` | H | `Cashflow/Invoices/services/invoiceService.ts` |
| `invoice.approve` | H | `Cashflow/Invoices/services/invoiceService.ts` |
| `invoice.hide` | M | `Cashflow/Invoices/services/invoiceService.ts` |
| `invoice.bulk_hide` | M | `Cashflow/Invoices/services/invoiceService.ts` |
| `invoice.bulk_create` | H | `Cashflow/Invoices/services/landPurchaseService.ts` |
| `retail_invoice.create` | H | `Cashflow/Invoices/services/invoiceService.ts` |
| `retail_invoice.update` | H | `Cashflow/Invoices/services/invoiceService.ts` |
| `payment.create` | H | `Cashflow/Payments/services/paymentService.ts` + `Cashflow/Invoices/services/invoiceService.ts` |
| `payment.update` | H | `Cashflow/Payments/services/paymentService.ts` |
| `payment.delete` | H | `Cashflow/Payments/services/paymentService.ts` |
| `company.create` | M | `Cashflow/Companies/services/companyService.ts` |
| `company.update` | M | `Cashflow/Companies/services/companyService.ts` |
| `company.delete` | H | `Cashflow/Companies/services/companyService.ts` |
| `bank_account.create` | M | `Cashflow/Banks/services/bankService.ts` + `Cashflow/Companies/services/companyService.ts` |
| `bank_account.balance_reset` | H | `Cashflow/Banks/services/bankService.ts` |
| `bank_credit.create` | H | `Cashflow/Banks/services/bankService.ts` |
| `bank_credit.update` | H | `Cashflow/Banks/services/bankService.ts` |
| `bank_credit.delete` | H | `Cashflow/Banks/services/bankService.ts` |
| `supplier.create` | L | `Cashflow/Suppliers/services/supplierService.ts` |
| `supplier.update` | L | `Cashflow/Suppliers/services/supplierService.ts` |
| `supplier.delete` | M | `Cashflow/Suppliers/services/supplierService.ts` |
| `contract.create` | M | `Cashflow/Suppliers/services/supplierService.ts` (link from Accounting) |
| `office_supplier.create` | L | `Cashflow/OfficeSuppliers/services/officeSupplierService.ts` |
| `office_supplier.update` | L | `Cashflow/OfficeSuppliers/services/officeSupplierService.ts` |
| `office_supplier.delete` | M | `Cashflow/OfficeSuppliers/services/officeSupplierService.ts` |
| `loan.create` | H | `Cashflow/Loans/services/loanService.ts` |
| `loan.delete` | H | `Cashflow/Loans/services/loanService.ts` |
| `monthly_budget.update` | M | `Cashflow/Budget/services/budgetService.ts` + `Cashflow/Calendar/services/calendarService.ts` |

### Sales (21+)
| Action | Severity | File |
|---|---|---|
| `building.create` | M | `Sales/SalesProjects/services/salesService.ts` |
| `building.bulk_create` | M | `Sales/SalesProjects/services/salesService.ts` |
| `building.delete` | H | `Sales/SalesProjects/services/salesService.ts` |
| `apartment.create` | M | `Sales/Apartments/services/apartmentService.ts` + `Sales/SalesProjects/services/salesService.ts` |
| `apartment.bulk_create` | M | `Sales/Apartments/services/apartmentService.ts` + `Sales/SalesProjects/services/salesService.ts` |
| `apartment.update` | M | `Sales/Apartments/services/apartmentService.ts` + `Sales/SalesProjects/services/salesService.ts` |
| `apartment.delete` | H | `Sales/Apartments/services/apartmentService.ts` + `Sales/SalesProjects/services/salesService.ts` |
| `apartment.bulk_price_update` | H | `Sales/SalesProjects/services/salesService.ts` |
| `{garage,repository}.{create,bulk_create,update,delete,bulk_price_update}` | M/H | `Sales/SalesProjects/services/salesService.ts` (dynamic `${unitType}.*`) |
| `apartment.link_garage` | L | `Sales/SalesProjects/services/salesService.ts` |
| `apartment.link_repository` | L | `Sales/SalesProjects/services/salesService.ts` |
| `apartment.unlink_garage` | L | `Sales/SalesProjects/services/salesService.ts` |
| `apartment.unlink_repository` | L | `Sales/SalesProjects/services/salesService.ts` |
| `apartment.link_units` | L | `Sales/Apartments/services/linkUnitsService.ts` (replace-all link save) |
| `apartment.import_excel` | H | `Sales/SalesProjects/services/apartmentImportService.ts` |
| `garage.import_excel` | H | `Sales/SalesProjects/services/garageImportService.ts` |
| `customer.create` | L | `Sales/Customers/services/customerService.ts` + `Sales/SalesProjects/services/salesService.ts` |
| `customer.update` | L | `Sales/Customers/services/customerService.ts` + `Sales/SalesProjects/services/salesService.ts` |
| `customer.delete` | M | `Sales/Customers/services/customerService.ts` |
| `sale.create` | H | `Sales/SalesProjects/services/salesService.ts` |
| `export.payments_csv` | L | `Sales/Payments/services/salesPaymentsService.ts` |

### Supervision (18)
| Action | Severity | File |
|---|---|---|
| `phase.create` | M | `Supervision/SiteManagement/services/phaseService.ts` |
| `phase.update` | M | `Supervision/SiteManagement/services/phaseService.ts` |
| `phase.delete` | H | `Supervision/SiteManagement/services/phaseService.ts` |
| `phase.bulk_update` | H | `Supervision/SiteManagement/services/phaseService.ts` (phase sync + resequence) |
| `subcontractor.create` | M | `Supervision/SiteManagement/services/siteSubcontractorService.ts` |
| `subcontractor.update` | M | `Supervision/SiteManagement/services/siteSubcontractorService.ts` |
| `subcontractor.delete` | H | `Supervision/SiteManagement/services/siteSubcontractorService.ts` + `Supervision/Subcontractors/hooks/useSubcontractorData.ts` |
| `subcontractor.comment` | L | `Supervision/SiteManagement/services/siteSubcontractorService.ts` |
| `contract.create` | H | `Supervision/SiteManagement/services/siteContractService.ts` |
| `contract_type.create` | M | `Supervision/SiteManagement/services/siteContractService.ts` |
| `contract_milestone.create` | L | `Supervision/SiteManagement/services/milestoneService.ts` |
| `contract_milestone.update` | L–M | `Supervision/SiteManagement/services/milestoneService.ts` + `Funding/Payments/services/paymentNotificationService.ts` |
| `contract_milestone.delete` | M | `Supervision/SiteManagement/services/milestoneService.ts` |
| `document.upload` | M | `Documents/services/documentService.ts` |
| `document.delete` | M | `Documents/services/documentService.ts` |
| `work_log.create` | L | `Supervision/WorkLogs/services/workLogService.ts` |
| `work_log.update` | L | `Supervision/WorkLogs/services/workLogService.ts` |
| `work_log.delete` | M | `Supervision/WorkLogs/services/workLogService.ts` |
| `invoice.approve` | H | `Supervision/Invoices/services/supervisionInvoiceService.ts` |

### Funding (15)
| Action | Severity | File |
|---|---|---|
| `investor.create` | M | `Funding/Investors/hooks/useBankData.ts` |
| `investor.update` | M | `Funding/Investors/hooks/useBankData.ts` |
| `investor.delete` | H | `Funding/Investors/hooks/useBankData.ts` |
| `bank_credit.create` | H | `Funding/Investors/services/creditService.ts` + `Cashflow/Banks/services/bankService.ts` |
| `bank_credit.update` | H | `Funding/Investors/services/creditService.ts` + `Cashflow/Banks/services/bankService.ts` |
| `bank_credit.delete` | H | `Funding/Investors/services/creditService.ts` + `Cashflow/Banks/services/bankService.ts` |
| `bank_credit.generate_schedule` | M | `Funding/Payments/services/paymentNotificationService.ts` |
| `payment_notification.dismiss` | M | `Funding/Payments/services/paymentNotificationService.ts` |
| `subcontractor_payment.create` | H | `Funding/Payments/services/paymentNotificationService.ts` |
| `credit_allocation.create` | H | `Funding/Investments/services/creditService.ts` |
| `credit_allocation.delete` | H | `Funding/Investments/services/creditService.ts` |
| `equity_investment.create` | H | `Funding/Investors/hooks/useEquityForm.ts` |
| `tic.update` | M | `Funding/TIC/hooks/useTIC.ts` |
| `export.tic_excel` | L | `Funding/TIC/services/ticExport.ts` |
| `export.tic_pdf` | L | `Funding/TIC/services/ticExport.ts` |

### Retail (25)
| Action | Severity | File |
|---|---|---|
| `retail_project.create` | M | `Retail/Projects/services/retailProjectService.ts` |
| `retail_project.update` | M | `Retail/Projects/services/retailProjectService.ts` |
| `retail_project.delete` | H | `Retail/Projects/services/retailProjectService.ts` |
| `retail_phase.create` | M | `Retail/Projects/services/retailProjectService.ts` |
| `retail_phase.update` | M | `Retail/Projects/services/retailProjectService.ts` |
| `retail_phase.delete` | H | `Retail/Projects/services/retailProjectService.ts` |
| `retail_customer.create` | L–M | `Retail/Customers/services/retailCustomerService.ts` + `Retail/Projects/services/retailProjectService.ts` |
| `retail_customer.update` | L | `Retail/Customers/services/retailCustomerService.ts` |
| `retail_customer.delete` | M | `Retail/Customers/services/retailCustomerService.ts` |
| `retail_sale.create` | H | `Retail/Sales/services/retailSalesService.ts` |
| `retail_sale.delete` | H | `Retail/Sales/services/retailSalesService.ts` |
| `retail_contract.create` | M | `Retail/Projects/services/retailProjectService.ts` |
| `retail_contract.update` | M | `Retail/Projects/services/retailProjectService.ts` |
| `retail_contract.delete` | H | `Retail/Projects/services/retailProjectService.ts` |
| `retail_milestone.create` | M | `Retail/Projects/services/retailProjectService.ts` |
| `retail_milestone.update` | M | `Retail/Projects/services/retailProjectService.ts` |
| `retail_milestone.delete` | H | `Retail/Projects/services/retailProjectService.ts` |
| `retail_supplier.create` | M | `Retail/Projects/services/retailProjectService.ts` |
| `retail_supplier.update` | M | `Retail/Projects/services/retailProjectService.ts` |
| `retail_supplier.delete` | H | `Retail/Projects/services/retailProjectService.ts` |
| `retail_supplier_type.create` | M | `Retail/Projects/services/retailProjectService.ts` |
| `retail_invoice.create` | H | `Cashflow/Invoices/services/invoiceService.ts` |
| `retail_invoice.update` | H | `Cashflow/Invoices/services/invoiceService.ts` |
| `land_plot.create` | M | `Retail/LandPlots/services/landPlotService.ts` |
| `land_plot.update` | M | `Retail/LandPlots/services/landPlotService.ts` |
| `invoice.approve` | H | `Retail/Invoices/services/retailInvoiceService.ts` |

### Chat / Calendar

| Action | Severity | File |
|---|---|---|
| `conversation.create` | M | `Chat/services/chatService.ts` |
| `calendar_event.create` | M | `Calendar/services/calendarService.ts` |
| `calendar_event.respond` | L | `Calendar/services/calendarService.ts` |
| `calendar_event.delete` | H | `Calendar/services/calendarService.ts` |
| `calendar_event.acknowledge_all` | L | `Calendar/services/calendarService.ts` |

---

## Intentionally Unlogged Mutations

These writes are deliberately exempt from `logActivity()` — do not "fix" them without reconsidering the rationale:

- **Derived-value recalculations** — system-computed aggregates rewritten from source data, not user actions; logging them would flood the log: `recalculateBankAccountBalance` (companyService), `recalculatePhaseBudget` / `recalculateAllPhaseBudgets` (phaseService), `updateContractBudgetRealized` (siteContractService)
- **Automatic status sweeps** — `update_overdue_notifications` RPC (runs on page load, no user intent)
- **Chat traffic** — `chat_messages` inserts, `chat_participants.last_read_at` updates, chat/AI-chat file attachments; conversation create/delete *are* logged
- **AI session housekeeping** — session title updates and cancel flags (`aiChatService`); session create/delete *are* logged
- **Storage rollbacks** — `.remove()` calls that clean up after a failed upload

## Adding Logging to New Features

When building new features that include mutations, follow this pattern:

### 1. Import the logger

```typescript
import { logActivity } from '../../../../lib/activityLog'
```

### 2. Call after successful mutation

Place the `logActivity()` call **immediately after** a successful Supabase insert/update/delete. Never place it inside a `.then()` on the Supabase query builder (it returns `PromiseLike`, not `Promise`).

```typescript
// CREATE — capture the new entity ID
const { data: inserted, error } = await supabase
  .from('my_table')
  .insert([payload])
  .select('id')
  .maybeSingle()
if (error) throw error

logActivity({
  action: 'my_entity.create',
  entity: 'my_entity',
  entityId: inserted?.id ?? null,
  projectId: projectId ?? null,
  metadata: { severity: 'medium', entity_name: payload.name }
})
```

```typescript
// UPDATE — log which fields changed
const { error } = await supabase.from('my_table').update(updates).eq('id', id)
if (error) throw error

logActivity({
  action: 'my_entity.update',
  entity: 'my_entity',
  entityId: id,
  metadata: { severity: 'medium', changed_fields: Object.keys(updates) }
})
```

```typescript
// DELETE — always severity high
const { error } = await supabase.from('my_table').delete().eq('id', id)
if (error) throw error

logActivity({
  action: 'my_entity.delete',
  entity: 'my_entity',
  entityId: id,
  metadata: { severity: 'high' }
})
```

```typescript
// BULK — entity_id is null, count in metadata
logActivity({
  action: 'my_entity.bulk_create',
  entity: 'my_entity',
  metadata: { severity: 'medium', count: items.length }
})
```

### 3. Choose the right severity

| Severity | Use when |
|---|---|
| `low` | Read-only actions, links, non-destructive updates (work logs, milestones) |
| `medium` | Standard creates/updates, configuration changes |
| `high` | Deletes, financial mutations, bulk operations, imports, approvals |

### 4. Metadata conventions

| Pattern | Metadata keys |
|---|---|
| `*.create` | `{ severity, entity_name? }` |
| `*.update` | `{ severity, changed_fields: string[] }` |
| `*.delete` | `{ severity, entity_name? }` |
| `*.bulk_*` | `{ severity, count: number }` |
| `*.import_excel` | `{ severity, filename?, row_count?, created_count? }` |
| `export.*` | `{ severity: 'low', format: 'csv'\|'excel'\|'pdf' }` |

### 5. Action naming convention

Format: `entity.verb` — e.g. `invoice.create`, `apartment.bulk_price_update`, `export.tic_excel`

- Use the entity's table name (singular) as the prefix
- Use descriptive verbs: `create`, `update`, `delete`, `approve`, `hide`, `bulk_create`, `bulk_hide`, `import_excel`, `link_garage`
- Retail entities are prefixed: `retail_project`, `retail_customer`, `retail_sale`, `land_plot`

### 6. Register new entities for navigation

If the new entity has a viewable route, add it to `ENTITY_ROUTE_MAP` in `src/components/General/ActivityLog/types.ts` so the detail modal can offer a "View Entity" button.

### 7. Add i18n keys

Add translated action labels in both locale files under the `activity_log.actions` namespace:

```json
"activity_log": {
  "actions": {
    "my_entity.create": "Created My Entity",
    "my_entity.update": "Updated My Entity",
    "my_entity.delete": "Deleted My Entity"
  }
}
```

---

## Access Control

- `canViewActivityLog(user)` in `src/utils/permissions.ts` — returns `true` only for Director role
- Used in `Layout.tsx` to conditionally show the nav item
- Used in `ActivityLog/index.tsx` to redirect non-Directors

---

## Notes

- **Logs are immutable** — no UPDATE or DELETE RLS policies. This is by design for audit integrity.
- **IP address column** exists but is always NULL — client-side Supabase cannot reliably capture IP. An Edge Function could populate this in the future.
- **No log retention policy** — at current usage levels the table stays small. Consider `pg_cron` pruning or monthly partitioning if the table grows large.
- **Mutations live in both service files and hook files** depending on the module. Always trace to wherever the `supabase.from().insert/update/delete` actually executes.
- **Supabase query builder returns `PromiseLike`** not `Promise` — do not use `.catch()` on the builder. Use async/await with try/catch instead.
