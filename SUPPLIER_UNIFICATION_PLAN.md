# Plan: Unify the three vendor tables (Option C — base + extension tables)

## Context

The database currently has three structurally-overlapping "vendor/payee" tables:
`subcontractors` (construction/Supervision), `retail_suppliers` (Retail), and
`office_suppliers` (Cashflow/Office). They duplicate the same conceptual columns
(`name`, contact, address, tax id, `notes`, timestamps) with inconsistent shapes
(`contact` vs `contact_person/_phone/_email`; `oib` vs `tax_id`+`vat_id`), and the
app already merges them logically at read time in
[debtService.ts](src/components/Cashflow/DebtStatus/services/debtService.ts) and the
Approvals service. `accounting_invoices` carries **three** separate supplier FK
columns plus a large `check_invoice_entity_type` CHECK to distinguish them.

**Goal:** reduce this duplication by extracting the common columns into a single
`suppliers` base table, moving the divergent columns into per-category extension
tables (1:1), and collapsing the three invoice FK columns into one. Existing IDs
are **UUIDs from `gen_random_uuid()`**, so every row keeps its `id` and all current
foreign keys stay valid — we only repoint FK *targets*.

**Confirmed decisions:** (1) keep existing `.from('subcontractors'/...)` CRUD working
via compatibility **views** with `INSTEAD OF` triggers; (2) **collapse** the three
`accounting_invoices` FK columns into one `supplier_id`; (3) **scope = suppliers
only** — leave `contracts` vs `retail_contracts` separate, and leave the type-lookup
tables `retail_supplier_types` / `contract_types` untouched (they are a different
axis: supplier-type vs contract-type).

---

## Target schema

### Base: `public.suppliers`
| column | source / notes |
|---|---|
| `id uuid PK DEFAULT gen_random_uuid()` | reuse each source row's existing id |
| `category text NOT NULL CHECK IN ('subcontractor','retail','office')` | discriminator |
| `name text NOT NULL` | all three |
| `contact text` | `subcontractors.contact`, `office_suppliers.contact`, **`retail_suppliers.contact_person`** map here |
| `address text` | retail + office (NULL for subcontractor) |
| `notes text DEFAULT ''` | subcontractor + retail |
| `created_at timestamptz DEFAULT now()` | all |
| `updated_at timestamptz DEFAULT now()` | new for subcontractor rows |

Indexes: `idx_suppliers_name`, `idx_suppliers_category`. `updated_at` trigger reuses
existing `public.update_updated_at_column()`.

### Extension `public.subcontractor_details` (PK = FK `supplier_id → suppliers.id ON DELETE CASCADE`)
- `financed_by_type`, `financed_by_investor_id`, `financed_by_bank_id`, `completed_at`,
  `active_contracts_count int DEFAULT 0`
- Move the 3 CHECK constraints (`*_financed_by_type_check`, `*_funder_type_consistency_check`, `*_single_funder_check`) here.
- Move outgoing FKs to `investors` / `banks` (keep `ON DELETE SET NULL`) and the two
  partial indexes on `financed_by_*` here.

### Extension `public.retail_supplier_details` (PK = FK `supplier_id`)
- `contact_phone`, `contact_email`, `oib`, `supplier_type_id uuid NOT NULL → retail_supplier_types.id`
- Move `idx_retail_suppliers_type_id` here.

### Extension `public.office_supplier_details` (PK = FK `supplier_id`)
- `email`, `tax_id`, `vat_id`

---

## Migration sequence

Follow repo conventions (timestamped files `YYYYMMDDHHmmss_*.sql` in
`supabase/migrations/`, idempotent via `IF NOT EXISTS` / `DROP ... IF EXISTS`, no
explicit `BEGIN/COMMIT` — Supabase wraps each file). Split into ordered files:

**M1 — `..._suppliers_base_and_extensions.sql`**
Create `suppliers` + the three extension tables, all constraints, indexes, and the
`updated_at` triggers. No data yet.

**M2 — `..._suppliers_data_backfill.sql`** (data migration; idempotent with `ON CONFLICT (id) DO NOTHING`)
```sql
INSERT INTO suppliers (id, category, name, contact, address, notes, created_at)
  SELECT id,'subcontractor',name,contact,NULL,notes,created_at FROM subcontractors
UNION ALL SELECT id,'retail',name,contact_person,address,notes,created_at FROM retail_suppliers
UNION ALL SELECT id,'office',name,contact,address,NULL,created_at FROM office_suppliers
ON CONFLICT (id) DO NOTHING;

INSERT INTO subcontractor_details (supplier_id, financed_by_type, financed_by_investor_id,
       financed_by_bank_id, completed_at, active_contracts_count)
  SELECT id, financed_by_type, financed_by_investor_id, financed_by_bank_id,
         completed_at, active_contracts_count FROM subcontractors
ON CONFLICT (supplier_id) DO NOTHING;
-- analogous INSERT ... SELECT for retail_supplier_details and office_supplier_details
```
UUID global-uniqueness guarantees no id collisions across the three sources.

**M3 — `..._repoint_vendor_fks.sql`**
For each dependent FK, drop the old constraint and re-add it pointing at `suppliers.id`,
preserving the original `ON DELETE` behavior:
- `contracts.subcontractor_id` (CASCADE), `retail_contracts.supplier_id` (CASCADE),
  `subcontractor_comments.subcontractor_id` (CASCADE),
  `subcontractor_documents.subcontractor_id` (CASCADE),
  `work_logs.subcontractor_id` (CASCADE), `old_invoices.subcontractor_id` (SET NULL).

`accounting_invoices` collapse (the invasive part):
```sql
UPDATE accounting_invoices
  SET supplier_id = COALESCE(supplier_id, retail_supplier_id, office_supplier_id)
  WHERE supplier_id IS NULL;
ALTER TABLE accounting_invoices DROP CONSTRAINT accounting_invoices_supplier_id_fkey;
ALTER TABLE accounting_invoices
  ADD CONSTRAINT accounting_invoices_supplier_id_fkey
  FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE RESTRICT;
ALTER TABLE accounting_invoices
  DROP CONSTRAINT accounting_invoices_retail_supplier_id_fkey,
  DROP CONSTRAINT accounting_invoices_office_supplier_id_fkey,
  DROP COLUMN retail_supplier_id,
  DROP COLUMN office_supplier_id;
-- replace check_invoice_entity_type: every clause that referenced
-- retail_supplier_id / office_supplier_id now refers to supplier_id; the
-- invoice_category column already disambiguates subcontractor/retail/office.
```

**M4 — `..._drop_old_vendor_tables_add_compat_views.sql`**
1. Redefine `public.update_subcontractor_contract_count()` to `UPDATE subcontractor_details`
   instead of `subcontractors` (trigger stays on `contracts`).
2. `DROP TABLE subcontractors, retail_suppliers, office_suppliers` (now unreferenced).
3. Create compatibility views with **`WITH (security_invoker = true)`** (PG15/Supabase)
   so base-table RLS is enforced through the view:
   - `subcontractors` = `suppliers ⋈ subcontractor_details WHERE category='subcontractor'`,
     exposing original columns (`contact`, `financed_*`, `completed_at`, `active_contracts_count`, `notes`).
   - `retail_suppliers` = join `retail_supplier_details`, mapping `contact_person = suppliers.contact`.
   - `office_suppliers` = join `office_supplier_details`.
4. Add `INSTEAD OF INSERT/UPDATE/DELETE` triggers on each view that write to
   `suppliers` + the matching extension (DELETE → delete from `suppliers`, cascades to extension).

**M5 — `..._rewrite_invoice_reporting_functions.sql`**
Rewrite `get_filtered_invoices`, `get_invoice_statistics`, `count_invoices_with_search`
to a single `LEFT JOIN suppliers s ON s.id = ai.supplier_id`. **Preserve the existing
return-column names** (`supplier_name`, `retail_supplier_name`, `office_supplier_name`)
by `CASE s.category WHEN ... END`, so frontend read code is unaffected. Keep the
Director/Accounting role guard added in `20260526084701`.

---

## RLS design (security-sensitive — office gating)

`office_suppliers` is currently **Director/Accounting-only**; the base table must
preserve that per-row. Use the repo's canonical check
`EXISTS (SELECT 1 FROM public.users WHERE auth_user_id = auth.uid() AND role IN (...))`.

On `public.suppliers`:
- **SELECT**: `USING (category <> 'office' OR <Director/Accounting>)`
- **INSERT/UPDATE**: `WITH CHECK ( (category='retail') OR (category='subcontractor' AND <Director/Supervision/Accounting>) OR (category='office' AND <Director/Accounting>) )`
- **DELETE**: `USING ( category='retail' OR <Director> )` (subcontractor + office deletes were Director-only; retail was open).

On the three extension tables: enable RLS with policies mirroring the base for their
category (`office_supplier_details` → Director/Accounting; others → authenticated),
since a direct query on an extension table is not gated by the base join.

Compatibility views use `security_invoker = true` so these policies apply through them.

---

## Application-code changes

**Unaffected (covered by compat views):** standalone supplier-management CRUD and
id/name lookups in supplier-management screens and `debtService` id resolution —
`.from('subcontractors'|'retail_suppliers'|'office_suppliers')` keep working.

**Must change (forced by the invoice-FK collapse):**
1. Invoice write paths — stop branching to `retail_supplier_id`/`office_supplier_id`;
   write the single `supplier_id` (category already lives in `invoice_category`):
   [invoiceService.ts](src/components/Cashflow/Invoices/services/invoiceService.ts),
   [retailInvoiceFormDataService.ts](src/components/Cashflow/Invoices/services/retailInvoiceFormDataService.ts),
   [landPurchaseFormDataService.ts](src/components/Cashflow/Invoices/services/landPurchaseFormDataService.ts).
2. PostgREST **embedded selects** that rely on the old invoice→vendor FK
   (e.g. `.select('*, subcontractors(...)')`, `retail_suppliers(...)`) must embed
   `suppliers(name, category)` instead — primarily
   [approvalsService.ts](src/components/Cashflow/Approvals/services/approvalsService.ts)
   and any invoice/report reads embedding these relations. The compat views do **not**
   serve FK-based embedding.
3. `debtService` can be simplified to read `supplier_id` + join `suppliers` (category
   gives the `'subcontractor'|'retail'|'office'` type), replacing the three-way
   parallel fetch + union — optional cleanup, not required.

**Types & logging:**
- Regenerate `src/types/database.ts` from the new schema; update the
  `Subcontractor` and supplier types in [supabase.ts](src/lib/supabase.ts) (compat
  views keep the same column shapes, so most types stay valid).
- Activity log: existing `subcontractor.*` / `office_supplier.*` actions still fire
  through the views. Optionally add the missing `retail_supplier.*` actions; no
  `ENTITY_ROUTE_MAP` changes required (routes unchanged).
- i18n: no new keys required for the schema change.

---

## Verification

1. **Schema/data parity (run after M2, before M3):** assert
   `COUNT(*) FROM suppliers` = sum of the three source counts; assert each extension
   count matches its source; spot-check that `contact_person`→`contact` mapping is
   non-lossy.
2. **FK integrity (after M3):** `SELECT count(*) FROM accounting_invoices WHERE supplier_id IS NOT NULL AND supplier_id NOT IN (SELECT id FROM suppliers)` = 0; same for `contracts`, `retail_contracts`, `work_logs`.
3. **RLS:** as a Sales/Supervision user, `SELECT * FROM suppliers WHERE category='office'`
   returns 0 rows; as Director/Accounting it returns all. Verify through the
   `office_suppliers` view too.
4. **Compat views writable:** INSERT/UPDATE/DELETE through each view and confirm rows
   land in `suppliers` + the right extension.
5. **App E2E:** run the existing money-write / invoice E2E specs (see
   [docs/TESTING.md](docs/TESTING.md)); manually exercise the Supervision
   subcontractor screen, Retail supplier screen, Cashflow Office-suppliers screen,
   invoice creation for each category, the Approvals list, and the Debt-status report.
6. Run `npm run build` / typecheck after regenerating `database.ts`.

Apply migrations against a **branch/staging Supabase DB with a production data copy
first** — M3/M4 are destructive (column + table drops). Each migration file is
written idempotently so a partial run can be re-applied.

## Rollback

Keep M1–M5 reversible in principle, but because M3/M4 drop columns/tables, the safe
rollback is **restore from the pre-migration snapshot** rather than a down-migration.
Take a DB snapshot immediately before applying M3.

## Out of scope (explicitly)

- Merging `contracts` and `retail_contracts` (different axis; partly done already in
  `20260504093712_copy_nin_retail_contracts_to_contracts.sql`).
- Changing `contract_types` (integer-id, contract-level) or `retail_supplier_types`
  (supplier-level) lookups — both remain as-is.
