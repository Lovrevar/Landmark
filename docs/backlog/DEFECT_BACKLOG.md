# Defect Backlog

Defects, gaps and inconsistencies found in a code-level audit of the whole platform except Retail
(30 September 2026). The audit was done while writing [SPECIFIKACIJA.md](../SPECIFIKACIJA.md): seven
passes, one per area, each reading the components, services, migrations and edge functions and
checking the existing docs against them.

This is a triage list, not a log of accepted risks. Security items that the team decides to live
with should move to [SECURITY_BACKLOG.md](./SECURITY_BACKLOG.md) (which, by its own rules, only
holds accepted items). UI/UX findings are tracked separately in [UI_AUDIT.md](./UI_AUDIT.md).

## How to read an entry

- **Severity**
  - **High:** data is lost or written wrong, a feature does not work at all, or data is exposed.
  - **Medium:** wrong figures are shown, a secondary flow is broken, or behaviour contradicts the
    documented rules.
  - **Low:** inconsistency, dead code, missing guard or cosmetic problem.
- **Check**
  - **Confirmed:** re-read in the code after the audit; the cited lines say what the entry says.
  - **Code reading:** found by reading the code; not re-checked a second time.
  - **Runtime check needed:** the code suggests the failure, but it depends on database state or
    library behaviour that has to be tried.
- **Status** is `Open` for every entry at filing time. Update it in place (`Fixed in <commit>`,
  `Won't fix: <reason>`, `Moved to SECURITY_BACKLOG SEC-NNN`).

## Summary

| Area | High | Medium | Low |
|---|---|---|---|
| Security and access | 2 | 7 | 3 |
| Auth and platform | 0 | 2 | 3 |
| Sales | 2 | 5 | 5 |
| Supervision | 1 | 3 | 7 |
| Cashflow | 3 | 5 | 8 |
| Funding and TIC | 1 | 4 | 10 |
| Projects, dashboards, reports | 0 | 4 | 10 |
| Tasks, calendar, chat, documents, AI | 0 | 4 | 5 |
| ERP integration (on hold) | 3 | 6 | 3 |
| Documentation drift | — | — | see last section |

---

## 1. Security and access

### SEC-A1 · High · `public.users` is readable without logging in
- **Check:** Confirmed. **Status:** Fixed on `fix/defect-backlog` (fix(security))
- **Where:** [baseline_schema.sql:7396](../../supabase/migrations/00000000000000_baseline_schema.sql#L7396), policy `"Allow reading users for authentication"`, `FOR SELECT TO anon, authenticated USING (true)`.
- **What happens:** anyone holding the anon key (it ships in the JS bundle) can list every user's
  username, email and role.
- **Fix direction:** drop `anon` from the policy. Check first whether the login form reads `users`
  before authentication; `AuthContext.fetchUserData` runs after sign-in, so it should not need it.

### SEC-A2 · High · Any signed-in user can insert roster rows with any role
- **Check:** Confirmed. **Status:** Fixed on `fix/defect-backlog` (fix(security))
- **Where:** [baseline_schema.sql:7361](../../supabase/migrations/00000000000000_baseline_schema.sql#L7361), `"Allow authenticated to insert users"`, `WITH CHECK (true)`.
- **What happens:** a Sales user can insert a `public.users` row with `role = 'Director'` for an
  email address. SSO provisioning links a Microsoft identity to a pre-created row by email
  (`handle_new_user`, `20260825100000_sso_pre_provisioned_only.sql`), so a pre-created row
  decides the role that identity gets.
- **Fix direction:** restrict INSERT to Director (or to `service_role` only, since onboarding is an
  admin SQL insert today).

### SEC-A3 · Medium · Activity-log rows can be forged
- **Check:** Confirmed. **Status:** Fixed on `fix/defect-backlog` (fix(security))
- **Where:** [baseline_schema.sql:7671](../../supabase/migrations/00000000000000_baseline_schema.sql#L7671), `activity_logs` INSERT `WITH CHECK (true)`; [src/lib/activityLog.ts](../../src/lib/activityLog.ts) sends `user_id` and `user_role` from the client.
- **What happens:** any authenticated user can write log rows attributed to another user or role,
  which undermines the audit trail.
- **Fix direction:** `WITH CHECK (user_id = (SELECT id FROM users WHERE auth_user_id = auth.uid()))`,
  or fill `user_id`/`user_role` in a BEFORE INSERT trigger and ignore the client values.

### SEC-A4 · Medium · Chat attachments are publicly readable
- **Check:** Confirmed. **Status:** Fixed on `fix/defect-backlog` (fix(security))
- **Where:** [20260527100100_restore_other_storage_buckets_and_policies.sql:51](../../supabase/migrations/20260527100100_restore_other_storage_buckets_and_policies.sql#L51) (`chat-attachments` is `public = true`); the chat service stores `getPublicUrl`.
- **What happens:** anyone with a file URL can download it without authenticating. URLs are
  guessable only with difficulty (`{conversationId}/{timestamp}_{random}.{ext}`), but they leak
  through copy/paste and logs.
- **Fix direction:** make the bucket private, store the path, and sign URLs on read (as Tasks and
  Documents already do). The DELETE policy also checks the first folder against `auth.uid()`,
  which never matches the `conversationId` path.

### SEC-A5 · Medium · Blanket `USING (true)` policies make role policies ineffective
- **Check:** Code reading. **Status:** Fixed on `fix/defect-backlog` (fix(security))
- **Where:** baseline policies on `apartments`, `buildings`, `garages`, `repositories`,
  `apartment_garages`, `apartment_repositories`, `customers`, `sales`, `banks`,
  `credit_allocations`, `monthly_budgets`, `hidden_approved_invoices`, `project_milestones`,
  `documents`, `document_associations`, `document_categories`, `subcontractor_comments`,
  `subcontractor_milestones`.
- **What happens:** permissive policies are OR-ed, so the role-specific ones on the same tables
  (for example "Director can delete customers", "Sales roles can insert/update sales") have no
  effect. Every authenticated role, including Supervision and Investment, can modify or delete
  sales data, credit allocations and milestones, and can delete document categories.
- **Fix direction:** decide the intended matrix per table and remove the blanket policies. Start
  with `document_categories` DELETE and `credit_allocations` writes.

### SEC-A6 · Medium · Dashboard cache is shared between users in the same tab
- **Check:** Code reading. **Status:** Fixed on `fix/defect-backlog` (fix(security))
- **Where:** [src/lib/useCachedData.ts](../../src/lib/useCachedData.ts), a module-level `Map`; nothing calls `invalidateCachedData`.
- **What happens:** after logout and login as another user in the same tab, dashboards and reports
  can show the previous user's (RLS-scoped) figures for up to 5 minutes. Figures are also up to
  5 minutes stale after any mutation.
- **Fix direction:** clear the cache on `SIGNED_OUT` and key entries by user id; invalidate the
  relevant keys after mutations.

### SEC-A7 · Medium · RLS-filtered writes report success and are logged
- **Check:** Code reading. **Status:** Fixed on `fix/defect-backlog` (fix(security))
- **Where:** delete and update paths across modules; PostgREST returns success with zero rows when
  RLS filters an UPDATE or DELETE.
- **What happens (examples):**
  - Accounting deletes an invoice, company or office supplier (DELETE is Director-only): the UI
    shows success and logs `invoice.delete` / `company.delete`, but nothing was deleted.
  - Supervision deletes a contract or a phase: no-op, but `subcontractor.delete` / `phase.delete`
    is logged; the phase delete then fails on renumbering with a confusing error.
  - A non-finance user ticks "approved" on `/invoices`: the checkbox flips locally until reload.
  - Accounting adds a contract: the client-side `budget_used` recalculation is a no-op, so the
    phase figure goes stale.
- **Fix direction:** chain `.select('id')` on mutations and treat zero rows as a permission error;
  hide the actions the role cannot perform (the `canManage*` helpers in
  [permissions.ts](../../src/utils/permissions.ts) exist but are unused).

### SEC-A8 · Low · Non-finance roles can open the Cashflow dashboard
- **Check:** Code reading. **Status:** Fixed on `fix/backlog-batch-2` (fix(platform)): `canUseCashflow` (Director, Accounting) filters the profile list and backs `CashflowRoute`; a stored Cashflow profile falls back to General
- **Where:** [Layout.tsx](../../src/components/Common/Layout.tsx) profile switcher, [Dashboard.tsx](../../src/components/Common/Dashboard.tsx).
- **What happens:** Sales and Investment users can select the Cashflow profile, enter the password
  and see `AccountingDashboard` at `/` (RLS-limited data). Every `/accounting-*` route still
  redirects them. Related to SEC-001 and SEC-002.
- **Fix direction:** filter the profile list by role.

### SEC-A9 · Low · `dispatch-calendar-reminders` has no request authentication
- **Check:** Code reading. **Status:** Open
- **Where:** [supabase/functions/dispatch-calendar-reminders/index.ts](../../supabase/functions/dispatch-calendar-reminders/index.ts), `verify_jwt = false`, `Deno.serve(async () => …)`.
- **What happens:** harmless today because the function is disabled in `config.toml`. Enabling it
  as is would let anyone trigger reminder inserts. See COLLAB-1.
- **Fix direction:** add a shared-secret header like `send-push` before enabling.

### SEC-A10 · Low · Investment role can manage payments in the UI but reads none
- **Check:** Code reading. **Status:** Open. Already tracked as SEC-004; listed here for
  completeness.

### SEC-A11 · Medium · `company_statistics` bypassed RLS
- **Check:** Runtime check needed (found 2026-10-01). **Status:** Fixed on `fix/backlog-batch-2` (migration `20261001100000`)
- **Where:** the `company_statistics` view in the baseline schema was a plain view, which Postgres runs as its owner.
- **What happened:** RLS on `accounting_invoices`, `company_bank_accounts` and `bank_credits` did not apply through it, so any role able to select from the view — with Supabase's default grants, every signed-in user and possibly `anon` — could read every company's bank balances and income/expense totals.
- **Fix:** `security_invoker = on`.

### SEC-A12 · Medium · Any signed-in user can delete any stored document file
- **Check:** Confirmed (found 2026-10-01 while fixing AI_CHAT.md). **Status:** Open
- **Where:** [20260527100000_restore_documents_bucket_and_policies.sql](../../supabase/migrations/20260527100000_restore_documents_bucket_and_policies.sql) and [20260527100100_restore_other_storage_buckets_and_policies.sql](../../supabase/migrations/20260527100100_restore_other_storage_buckets_and_policies.sql): the `storage.objects` INSERT / SELECT / DELETE policies on the `documents` and `contract-documents` buckets check only `bucket_id`.
- **What happens:** `20260930100000` limited deleting a `public.documents` row to its uploader, Director and Accounting, but the file itself can be removed (or overwritten by path) by any signed-in user through the Storage API, leaving a row that points at nothing. Reading every file is also open to every signed-in user, which matches the table's SELECT policy today but has no per-entity check.
- **Fix direction:** mirror the table rule in the DELETE (and UPDATE) policies on `storage.objects` — owner (`owner_id = auth.uid()`) or `app_user_role() IN ('Director','Accounting')` — the way `can_access_chat_object` does for chat.

---

## 2. Auth and platform

### AUTH-1 · Medium · Password reset cannot be completed
- **Check:** Code reading. **Status:** Fixed on `fix/defect-backlog` (fix(auth))
- **Where:** [AuthContext.tsx](../../src/contexts/AuthContext.tsx) `resetPassword` redirects to `/reset-password`; [App.tsx](../../src/App.tsx) has no such route and nothing handles the `PASSWORD_RECOVERY` event.
- **What happens:** the recovery link falls through to `/` and, at best, signs the user in; there is
  no screen to set a new password.
- **Fix direction:** add a `/reset-password` route that calls `supabase.auth.updateUser({ password })`
  when a recovery session is present.

### AUTH-2 · Medium · User provisioning trigger is not in any migration
- **Check:** Code reading. **Status:** Fixed on `fix/defect-backlog` (fix(auth))
- **Where:** `on_auth_user_created` on `auth.users` exists on the remote database only; the function
  `handle_new_user()` is in `20260825100000_sso_pre_provisioned_only.sql`.
- **What happens:** a fresh project built from migrations (demo, a new e2e project) has no trigger,
  so new sign-ups get no `public.users` row and are signed straight back out.
- **Fix direction:** add a migration that creates the trigger idempotently.

### AUTH-3 · Low · `npm run e2e:seed` points at a missing script
- **Status:** Fixed on `fix/backlog-batch-2` (fix(platform)): the `e2e:seed` script entry was removed
- **Where:** `package.json` → `scripts/seed-e2e.mjs` (does not exist). Remove or restore it.

### AUTH-4 · Low · Client and SQL disagree on project access
- **Where:** `hasProjectAccess` in [AuthContext.tsx](../../src/contexts/AuthContext.tsx) returns `false` for Accounting, Sales and Investment; SQL `user_has_project_access(user, proj)` grants them all projects. Align one to the other.

### AUTH-5 · Low · Profile switcher shows raw English names
- **Status:** Fixed on `fix/backlog-batch-2` (fix(platform)): the switcher and the header label use `profiles.*`
- **Where:** [Layout.tsx](../../src/components/Common/Layout.tsx) renders `{profile}` although `profiles.*` i18n keys exist.

---

## 3. Sales

### SALES-1 · High · Selling a standalone garage or storage unit always fails
- **Check:** Confirmed. **Status:** Fixed on `fix/defect-backlog` (fix(sales)): Sell is shown on apartments only; `completeSale` refuses other unit types
- **Where:** [salesService.ts:592-599](../../src/components/Sales/SalesProjects/services/salesService.ts#L592-L599) inserts `garage_id` / `repository_id` into `sales`; the table has neither column and `apartment_id` is `NOT NULL` ([baseline:3939-3941](../../supabase/migrations/00000000000000_baseline_schema.sql#L3939-L3941)).
- **What happens:** the "Sell" button on a garage or storage card always shows the error toast. In
  "new customer" mode the customer row (status `buyer`) has already been created and is left
  orphaned.
- **Fix direction:** either hide "Sell" for garages and repositories (they are sold with the
  apartment package) or add nullable `garage_id` / `repository_id` columns with a CHECK that exactly
  one unit id is set. Create the customer only after the sale insert succeeds (see SALES-5).

### SALES-2 · High · Bulk price update wipes prices of units without a price per m²
- **Check:** Confirmed. **Status:** Fixed on `fix/defect-backlog` (fix(sales)): `effectivePricePerM2` fallback in the service and preview, plus the trigger and backfill in migration `20260930100200`
- **Where:** [salesService.ts:693](../../src/components/Sales/SalesProjects/services/salesService.ts#L693) `const currentPricePerM2 = unit.price_per_m2 || 0`.
- **What happens:** units with `price_per_m2 = 0` get `price = size × adjustment`, losing the old
  total. That covers every apartment created on the Apartments page (bulk or single), garages
  from the garage Excel import, and parking/storage units created by the apartment import.
- **Fix direction:** derive the current price per m² from `price / size_m2` when the stored value
  is 0, and backfill `price_per_m2` for existing rows.

### SALES-3 · Medium · Editing a price leaves `price_per_m2` stale
- **Status:** Fixed on `fix/defect-backlog` (fix(sales))
- **Where:** `apartmentService.updateApartment` and the create paths on the Apartments page.
- **What happens:** a later bulk update recalculates the price from the stale per-m² value.
- **Fix direction:** recompute `price_per_m2` whenever `price` or `size_m2` changes (or make it a
  generated column).

### SALES-4 · Medium · Re-importing the apartment Excel resets sold apartments to Available
- **Status:** Fixed on `fix/defect-backlog` (fix(sales))
- **Where:** `apartmentImportService.importApartmentRow` updates existing rows with `status: 'Available'`.
- **What happens:** a sold or reserved apartment becomes Available, while its `sales` row and
  `buyer_name` stay.
- **Fix direction:** do not write `status` on update.

### SALES-5 · Medium · The sale flow is not transactional
- **Status:** Fixed on `fix/defect-backlog` (fix(sales))
- **Where:** `completeSale` in [salesService.ts](../../src/components/Sales/SalesProjects/services/salesService.ts): customer insert, sale insert, unit update, linked-unit updates and customer status update are separate calls.
- **What happens:** a failure midway leaves partial state (orphan customer, sale without Sold
  status, and so on).
- **Fix direction:** move the sequence into one RPC.

### SALES-6 · Medium · "Paid" and "total" are computed five different ways
- **ERP:** If buyer payments come from the ERP (ERP open question Q14), the paid basis already matches; only the package-total denominator remains.
- **Status:** Partly fixed on `fix/defect-backlog` (fix(sales)): every apartment-level screen now counts payments on the apartment's `OUTGOING_SALES` invoices (Customers keeps a per-customer view on purpose); `sales.total_paid`/`remaining_amount` are documented as a sale-time snapshot. The package-total denominator (list price vs `sale_price`) is still per screen
- **Where:** Sales Projects cards, Apartments page, Customers, Sales dashboard, Sales Payments; `sales.total_paid` / `remaining_amount` are written once and never updated.
- **What happens:** the same apartment can show different paid, total and remaining figures on
  different screens (invoice-type filter, customer match, list price vs `sale_price`).
- **Fix direction:** one shared helper for "paid per apartment" and "package total"; drop or derive
  the two stale `sales` columns.

### SALES-7 · Medium · Unit links can be lost or left inconsistent
- **Status:** Fixed on `fix/defect-backlog` (fix(sales)): both linkers share one code path with error checks. Decision: unlinking a unit from a sold apartment still returns it to Available, because it has left the package
- **Where:** `linkUnitsService` (Apartments page) and the SalesProjects linker.
- **What happens:**
  - `saveUnitLinks` deletes all links, then inserts the selection. `fetchLinkedUnitIds` and
    `fetchAvailableUnits` ignore Supabase errors, so a failed read yields an empty list and saving
    wipes the links. The two delete calls are unchecked.
  - Unlinking always resets the garage or repository to Available and clears `buyer_name`, even
    when the package was sold.
  - The Apartments-page editor does not mark newly linked units Sold; the SalesProjects linker does.
- **Fix direction:** check errors on reads and deletes; make both linkers share one service with
  the same Sold propagation.

### SALES-8 · Low · Customers module keeps only one garage and one storage per apartment
- Customer totals also use list prices instead of `sale_price`.

### SALES-9 · Low · No unique constraint on unit numbers
- Duplicates are possible through bulk create, single create and within-file garage imports.

### SALES-10 · Low · No sale cancellation flow
- Nothing updates or deletes `sales` rows; a reverted sale still counts in dashboards and reports.

### SALES-11 · Low · Bulk-created buildings get hard-coded English names ("Building N")
- **Status:** Fixed on `fix/backlog-batch-2` (fix(sales)): names come from `sales_projects.default_building_name` ("Zgrada {{n}}")

### SALES-12 · Low · Import help text is wrong about columns V–Y
- **Status:** Fixed on `fix/backlog-batch-2` (fix(sales)): help lists V–Y as instalment amounts and Z as the credit amount
- The help says they hold dates; the code parses them as EUR amounts, so a date string becomes a
  number such as 1022026.

---

## 4. Supervision

### SUP-1 · High · Contract comments never load or save
- **Check:** Confirmed. **Status:** Fixed on `fix/defect-backlog` (fix(supervision))
- **Where:** [SiteManagement/index.tsx:307-321](../../src/components/Supervision/SiteManagement/index.tsx#L307-L321) passes `subcontractor.id`, which in the Site Management tree is the **contract** id; `subcontractor_comments.subcontractor_id` references `subcontractors(id)` ([baseline:7107](../../supabase/migrations/00000000000000_baseline_schema.sql#L7107)).
- **What happens:** reads always return nothing; inserts fail with a foreign-key error ("add
  failed" toast).
- **Fix direction:** pass `subcontractor.subcontractor_id`. The `subcontractor.comment` log entry
  also carries the contract id.

### SUP-2 · Medium · Subcontractor payments page shows the wrong phase
- **Status:** Fixed on `fix/defect-backlog` (fix(supervision)): `contract_id` selected, `!inner` join, no fallback to another contract
- **Where:** `Supervision/Payments` service: the invoice embed does not select `contract_id`, so the lookup always falls back to the supplier's first contract, in any project. The embed is also not `!inner`, so all payments are fetched and filtered client-side (see SUP-3).

### SUP-3 · Medium · Unpaginated lists hit the 1000-row cap
- **Status:** Fixed on `fix/defect-backlog` (fix(supervision)): new `src/lib/fetchAllRows.ts`, used by the register, invoices, payments and work logs
- **Where:** subcontractor register, supervision invoices, supervision payments, work logs.
- **What happens:** older rows silently disappear once a table passes 1000 rows.

### SUP-4 · Medium · Contract status and subcontractor completion never change
- **Status:** Fixed. On `fix/defect-backlog`: the dashboard card counts crews with a
  `work_finished` log this week. On `fix/backlog-batch-2` (fix(supervision)), per the 2026-10-01
  decision "stays visible, still counts": the edit form sets Aktivan / Završen / Raskinut;
  Site Management, the classification gate, Budget Control, supplier and project summaries read
  every status; a terminated contract commits only what was paid (`committedAmount` /
  `contract_committed_amount`, migration `20261001100200`); a header button hides closed cards
  without changing totals. See [SUPERVISION.md](../SUPERVISION.md) → "Contract status"
- New contracts are always `active` and nothing moves them to `completed` or `terminated`.
  `subcontractors.completed_at` is never written, so the dashboard's "completed this week" is
  always 0.

### SUP-5 · Low · "+" on a classification row ignores the classification
- **Status:** Partly fixed on `fix/backlog-batch-2` (fix(supervision)): the "+" on a classification row now preselects it. Open: the by-classification view still has no add or budget buttons
- The form does not preselect it; the by-classification view has no add or budget buttons at all.

### SUP-6 · Low · Edit path skips the phase budget cap
- **Status:** Fixed on `fix/backlog-batch-2` (fix(supervision)): the edit path checks the phase cap (`fetchPhaseBudgetStatus`) and zeroes amounts when "has contract" is switched off
- Switching "has contract" off on edit keeps the amounts, while the add path zeroes them.

### SUP-7 · Low · Financing is stored on the company, not the contract
- `financed_by_*` is set only when creating a new subcontractor, and only banks are offered.

### SUP-8 · Low · Some failed loads show zeros
- **Status:** Fixed on `fix/backlog-batch-2` (fix(supervision)): `fetchInvoiceStatsForContracts` throws; InvoicesModal, MilestoneList and the credit allocations show load errors with retry
- `fetchInvoiceStatsForContracts` returns a zero map on error; `InvoicesModal`, `MilestoneList`
  and the Project Detail credit allocations only log errors to the console.

### SUP-9 · Low · Phase card label says "net" for a gross figure
- **Status:** Fixed on `fix/backlog-batch-2` (fix(supervision)): label reads "Ugovoreni iznos (bruto)"
- `phase_card.contracted_amount` reads "Ugovoreni iznos (osnova)" but shows the gross amount.

### SUP-10 · Low · Required document category `IZVODACI` is not seeded
- **Status:** Fixed on `fix/backlog-batch-2` (fix(supervision)): migration `20261001100300` inserts IZVODACI when the code is free (no-op where it exists). The demo seed script creates `UGOVORI_PODIZVODACI` instead, which is why demo uploads failed
- Contract document uploads throw on a fresh environment until the category row is added by hand.

### SUP-11 · Low · Dead code
- `check_subcontractor_budget_integrity()` references the non-existent `contracts.budget_planned`.
- Supervision invoices filter on `invoice_category IN ('SUBCONTRACTOR','SUPERVISION')`;
  `SUPERVISION` is not a valid category.
- Unused: `linkSubcontractorToPhase`, `getContractCount`, `createSubcontractor`,
  `fetchSubcontractorInvoiceStats`, `fetchMilestonesBySubcontractor`, `updateMilestoneStatus`,
  `recalculateAllPhaseBudgets` (no UI caller).

---

## 5. Cashflow

### CASH-1 · High · New companies lose their opening bank balance
- **Check:** Code reading. **Status:** Fixed on `fix/defect-backlog` (fix(cashflow)): opening balance written to `initial_balance`; resets go through `reset_company_bank_account_balance`; backfill for untouched accounts. Accounts already wiped need a manual check (query at the end of migration `20260930100300`)
- **Where:** `createCompany` writes the entered balance into `current_balance` with
  `initial_balance = 0`; the balance trigger rebuilds from `initial_balance`.
- **What happens:** the first payment or loan on the account resets the balance to
  `0 + movements`. Only an edit with a balance reset fixes it.
- **Fix direction:** write the entered value into `initial_balance` too (and set
  `balance_reset_at`).

### CASH-2 · High · Credit disbursements to an account are erased by the next recompute
- **Check:** Code reading. **Status:** Fixed on `fix/defect-backlog` (fix(cashflow)): disbursements are a term of the one balance formula; the loan trigger delegates to it
- **Where:** `trigger_disbursed_credit_balance` adds the credit amount to `current_balance`, but
  `recalc_company_bank_account_balance` (`20260917100000`) does not include disbursements.
- **What happens:** the next payment or loan on that account removes the disbursed amount from the
  balance.
- **Fix direction:** add disbursed credits to the recompute formula.

### CASH-3 · Medium · Editing an invoice un-approves it and changes its author
- **Status:** Fixed on `fix/defect-backlog` (fix(cashflow))
- **Where:** `invoiceService.handleSubmit` sends the create payload on edit.
- **What happens:** `approved` is recomputed (false for supplier and sales invoices) and
  `created_by` is overwritten with the editor.
- **Fix direction:** omit `approved` and `created_by` from the update payload.

### CASH-4 · Medium · Invoice count and list can disagree on search
- **Status:** Fixed on `fix/defect-backlog` (fix(cashflow)): statistics use the list's joins and search predicate
- `get_invoice_statistics` and `get_filtered_invoices` search slightly different fields (customer
  full name vs refund and retail-project names).

### CASH-5 · Medium · Invoice categories cannot be managed
- **Status:** Fixed on `fix/defect-backlog` (fix(cashflow))
- The manage policy on `invoice_categories` tests `role = 'director'` in lower case, which never
  matches; there is no UI either.

### CASH-6 · Medium · Cesija from a credit decreases the allocation's usage
- **ERP:** ERP cesija payments never set `cesija_credit_*`, so the sign only affects cesija entered in the app. After phase 5 it matters for historical rows only: fix the sign once confirmed, then run drift check 2 from migration `20260917100000`.
- **Status:** Open — **needs an accounting decision**: should a cesija paid from a credit allocation add to or subtract from that allocation's `used_amount`? The code subtracts while the credit's own `used_amount` adds; migration `20260917100000` kept the sign deliberately, with no recorded reason
- **Check:** Runtime check needed.
- `update_credit_allocation_used_amount()` subtracts the amount for `cesija_credit_allocation_id`,
  while `recalculate_bank_credit_fields` adds cesija to the credit's `used_amount`. One of the two
  signs is likely wrong.

### CASH-7 · Medium · Income and expense are classified four different ways
- **ERP:** The ERP resolver reads `INCOMING` as a received bill (a payable), so `INCOMING_INVESTMENT` is money out when paid — what the balance trigger and payments list already do. Recommended: cash-flow screens use the prefix rule (`OUTGOING_*` in, `INCOMING_*` out); the company income/expense view leaves out the bank-credit types (`*_BANK`, `INCOMING_BANK_EXPENSES`), which are neither revenue nor expense. Confirm with accounting before changing.
- **Status:** Fixed on `fix/backlog-batch-2` (decided 2026-10-01: `INCOMING_INVESTMENT` is money out). Every cash-direction figure uses `paymentDirection()`; `company_statistics` counts issued invoices as income, paid bills as expense and leaves the bank-credit types out (migration `20261001100000`)
- `company_statistics`, the Accounting dashboard, `paymentDirection()` and the General report
  cash-flow table disagree on `INCOMING_INVESTMENT`, `OUTGOING_SUPPLIER`, `OUTGOING_BANK` and the
  bank types. The dashboard service comment claiming it matches the calendar convention is wrong.
- **Fix direction:** one shared direction map used by SQL views and the client.

### CASH-8 · Low · Payment calendar omits `INCOMING_BANK_EXPENSES` from expense bills
- **Status:** Fixed on `fix/backlog-batch-2` (with CASH-7): the calendar uses `paymentDirection()`, so credit fees are bills; bank types get labels

### CASH-9 · Low · Loans have no sanity checks
- **ERP:** Gains weight: once the ERP feeds bank movements, an intercompany transfer arrives as ERP payments and is also a `company_loans` row, so it would count twice in the derived balance. See "ERP outlook" below.
- No check that the source and target differ, or that the source has the balance.

### CASH-10 · Low · Two lookup failures leave dropdowns silently empty
- **ERP:** Moot after phase 5: the invoice form loses these dropdowns.
- Bank-account and credit lookups in `invoiceService.fetchData` only log errors.

### CASH-11 · Low · Kompenzacija has no link to its counter-invoice
- **ERP:** Becomes ERP work: `kompenzacija_reference` is staged by the importer but not stored on the payment.
- The two sides are entered as independent payments; nothing checks they match. Design gap rather
  than a bug.

### CASH-12 · Low · Deleting a company with invoices fails with a generic error
- **Status:** Fixed on `fix/backlog-batch-2` (fix(funding)): the delete says the company has invoices or other linked records
- `accounting_invoices.company_id` is `NOT NULL` with `ON DELETE SET NULL`.

### CASH-13 · Low · `company_bank_accounts.account_number` is never captured
- **ERP:** Becomes an ERP prerequisite (ERP-5): BANK payments and the `bank_balances` feed are matched by IBAN. With bank accounts moving to the ERP, create or match `company_bank_accounts` from the feed rather than adding an IBAN field to the form.
- No UI writes it. It also blocks ERP payment resolution (ERP-5).

### CASH-14 · Low · VAT rates are fixed per slot
- `calculate_invoice_amounts()` hard-codes 25 / 13 / 0 / 5 % by slot and ignores `vat_rate_n`.
  Intended, but undocumented outside the trigger.

### CASH-15 · Low · Dead code
- **ERP:** Moot after phase 5: the bank invoice and credit forms are removed.
- `BankCreditFormModal` in Cashflow/Banks is rendered but has no entry point.

### CASH-16 · High · Saving a company resets every bank account's balance
- **Check:** Confirmed (found while re-checking the fix/defect-backlog branch). **Status:** Fixed on `fix/defect-backlog` (fix(cashflow) follow-up)
- **Where:** `updateCompany` in [companyService.ts](../../src/components/Cashflow/Companies/services/companyService.ts); the edit form is pre-filled from `fetchBankAccountsForCompany` with each account's `initial_balance` and reset date.
- **What happened:** every save sent a balance reset for every account. An account with no reset date got one dated today, so all earlier payments and loans dropped out of its balance — a plain rename was enough. Existed before this branch; the branch first carried it into the reset RPC.
- **Fix:** only accounts whose balance or date differs from the stored values are reset. Accounts already hit by this show `balance_reset_at` on the day the company was last edited; check them with the query at the end of migration `20260930100300`.

---

## 6. Funding and TIC

### FUND-1 · High · Renaming an investor fails
- **Check:** Runtime check needed. **Status:** Fixed on `fix/defect-backlog` (fix(funding)): trigger and function dropped
- **Where:** trigger `trigger_update_bank_in_accounting_companies` runs
  `UPDATE accounting_companies SET name = … WHERE bank_id = …`; `accounting_companies.bank_id` was
  removed in `20260203113055`.
- **What happens:** editing an investor's name is expected to fail with an undefined-column error.
- **Fix direction:** drop the trigger.

### FUND-2 · Medium · First TIC save and non-Director TIC saves may be rejected
- **Status:** Fixed on `fix/defect-backlog` (fix(funding)): insert check compares `public.users.id`; TIC writes limited to Director, Accounting, Investment; sync runs `SECURITY DEFINER`. Still worth a runtime check once the migration is on dev
- **Check:** Runtime check needed.
- The client sends `created_by = public.users.id`, but the INSERT policy requires
  `auth.uid() = created_by` (and the FK points at `users(id)`), so a first-time TIC insert is likely
  refused for every user.
- `sync_project_from_tic` is `SECURITY INVOKER`; for Accounting and Investment the phase and
  classification-budget writes it performs violate RLS and would abort the save.

### FUND-3 · Medium · Allocation limit ignores direct drawdowns
- **Status:** Fixed on `fix/defect-backlog` (fix(funding))
- The modal shows "Nealocirano" = amount − allocations − direct drawdowns, but validation only
  checks amount − allocations, so users can allocate more than the figure shown.

### FUND-4 · Medium · Credit status cannot be changed
- **Status:** Fixed on `fix/defect-backlog` (fix(funding)): status select in the credit form on edit
- No UI writes `bank_credits.status`; credits stay `active`, so "paid" and "defaulted" badges
  depend on manual database edits.

### FUND-5 · Medium · Two repayment models disagree
- **ERP:** Actual repayments come from the ERP; the model only drives the plan and the "monthly debt service" figures on the Director dashboard and general report.
- **Status:** Fixed on `fix/backlog-batch-2` (decided 2026-10-01: equal principal instalments, interest on the outstanding balance). One model in `creditCalculations.ts` for the stored figure, the preview and the Banks service; migration `20261001100100` restates existing credits
- The stored `monthly_payment` is an annuity (monthly by default, 10 years when no maturity is set),
  while the schedule preview uses linear principal plus flat interest on the full amount. No
  schedule is persisted.

### FUND-6 · Low · "Disbursed to account" without an account gives a generic error
- The account is marked required but not validated; the database CHECK rejects the save.

### FUND-7 · Low · Equity form drops fields
- `percentage_stake`, `notes` and custom schedules are shown but not stored.

### FUND-8 · Low · `recalculate_bank_credit_fields` ignores `disbursed_to_account`
- **ERP:** Gains weight with the ERP: see "ERP outlook" (disbursed credits counted twice).
- It can overwrite the `used_amount = amount` set by the disbursement trigger.

### FUND-9 · Low · Funding payments register filters oddly
- The project column uses the legacy `bank_credits.project_id` (usually empty); "Nedavno" filters by
  `created_at`; rows with null bank, project and notes never match, even with an empty search;
  supplier payments drawn from a credit are not listed.

### FUND-10 · Low · Investment projects screen
- Budget is not gated on the TIC (a project without one shows €0, 0 % funded, High risk); the
  "debt" list includes equity; credit types render raw; opex and refinancing allocations are
  invisible.

### FUND-11 · Low · Investment dashboard shows zeros on failure
- **Status:** Fixed. Query errors were already checked (batch 1); on `fix/backlog-batch-2` (fix(funding)) the PDF labels refinancing allocations "Refinanciranje - X" instead of OPEX. `total_equity` / `debt_to_equity_ratio` stay 0 in this service, but the Investment dashboard does not display them
- No query error is checked; `total_equity` and `debt_to_equity_ratio` are hard-coded to 0; the
  PDF labels refinancing allocations "OPEX".

### FUND-12 · Low · Allocation invoice list does not reconcile
- It lists payments with `credit_allocation_id` only; `OUTGOING_BANK` drawdowns counted in the
  allocation's `used_amount` are missing.

### FUND-13 · Low · TIC odds and ends
- **Status:** Partly fixed on `fix/backlog-batch-2` (fix(funding)): the "funtana" auto-select is gone. Open: the Excel export drops phases and classifications; messages are hard-coded Croatian
- A project whose name contains "funtana" is auto-selected (hard-coded); the Excel export drops
  phases and classifications, so a round trip yields an unphased TIC; messages are hard-coded
  Croatian.

### FUND-14 · Low · Orphan function
- `update_overdue_notifications()` references the removed `payment_notifications` table.

### FUND-15 · Low · Investment role sees credits but no money movements
- Drawdown, repayment and fee sections come back empty for that role (related to SEC-004).

---

## 7. Projects, dashboards and reports

### GEN-1 · Medium · General report shows available credit as €0
- **Check:** Confirmed. **Status:** Fixed on `fix/defect-backlog` (fix(reports))
- **Where:** [generalReportService.ts:476](../../src/components/Reports/services/generalReportService.ts#L476) reads `available_balance` and `drawn_amount`, which do not exist on `bank_credits`.
- **Fix direction:** `Σ (amount − used_amount)`, as the "company investments" section already does.

### GEN-2 · Medium · Other General report formulas are off
- **Status:** Fixed on `fix/defect-backlog` (fix(reports)): definitions aligned with the Director dashboard, see REPORTS.md
- "Completed milestones" counts `status = 'completed'`, which means partly paid; fully paid
  (`paid`) milestones are not counted.
- "Work logs (7 days)" uses `subMonths(now, 0.25)` (runtime check needed; likely not 7 days).
- "Equity" is Σ credit allocations, so ROI and D/E use allocations; debt includes equity-type and
  repaid credits; average interest is an unweighted mean.
- The cash-flow window has 7 month buckets while the screen says six months.

### GEN-3 · Medium · Several dashboards show zeros instead of an error
- **Status:** Fixed on `fix/defect-backlog` (fix(reports)): every read checked in the Director, Investment, Budget Control and Project Details services; Accounting top companies paged and checked
- Director dashboard checks only the `projects` error; Investment checks none; Accounting's
  top-companies sub-queries, Budget Control sub-queries and Project Details sub-queries are
  unchecked. This contradicts the "never render zeros on a failed load" rule.

### GEN-4 · Medium · Milestones can be edited by every role
- **Status:** Fixed on `fix/defect-backlog` (RLS in fix(security), UI in fix(reports)): writes limited to Directors and Supervision on assigned projects
- UI and RLS both allow any authenticated user to create, edit and delete project milestones,
  while projects themselves are Director-only.

### GEN-5 · Low · Budget not gated on the TIC in three places
- Director dashboard portfolio table, Investment dashboard portfolio value and PDF, Sales report.

### GEN-6 · Low · Project details "Aktivni ugovori" counts contracts of every status
- **Status:** Fixed on `fix/backlog-batch-2` (fix(general)): counts draft and active contracts only

### GEN-7 · Low · Budget Control chart and scope
- The forecast bar is drawn in red when the forecast is suppressed; contracts without a phase
  count in Committed and Paid but not in EV and AC.

### GEN-8 · Low · EVM "physical" progress is payment-driven in practice
- Milestone statuses feeding EV are set by the payment trigger, so EV is not independent of AC.
  The code comment claims otherwise.

### GEN-9 · Low · Director and Sales dashboards define sales differently
- Director counts apartments only and uses contracted sale value; Sales counts all unit types and
  uses cash collected.

### GEN-10 · Low · Supervision dashboard "paid" uses invoice `paid_amount`
- Contrary to the rule that `contracts.budget_realized` is the only paid figure.

### GEN-11 · Low · Projects list hides load failures behind the empty state
- **Status:** Fixed on `fix/backlog-batch-2` (fix(general)): error Alert with retry

### GEN-12 · Low · English literals in Croatian UI
- **Status:** Fixed on `fix/backlog-batch-2` (fix(general)): the cited Sales dashboard and General report literals go through `common.unknown` / `common.uncategorized` (other `N/A` fallbacks in Cashflow remain)
- "Unknown", "N/A" (Sales dashboard), "Uncategorized" (General report contract types).

### GEN-13 · Low · Reports menu item shown to non-Directors
- **Status:** Fixed on `fix/backlog-batch-2` (fix(platform)): the menu item is shown to Directors only
- `/general-reports` appears in every General-profile menu but only Directors can open it.

### GEN-14 · Low · Credit types rendered raw
- **Status:** Fixed on `fix/backlog-batch-2` (fix(general)): `formatCreditType` in creditCalculations.ts
- Project details financing tab and Investment dashboard use `replace(/_/g, ' ')` instead of the
  label map.

---

## 8. Tasks, calendar, chat, documents and AI assistant

### COLLAB-1 · Medium · Calendar reminders are never delivered
- **Status:** Fixed on `fix/backlog-batch-2` (fix(calendar)), per the 2026-10-01 decision "remove the field": the event form no longer offers reminders and the detail modal no longer lists them. The backend stays switched off; turning reminders on later still needs shared-secret auth (SEC-A9), a pg_cron job like `deadline-reminders`, skipping declined invitees, the toast listener in Layout, and the field back — see [CALENDAR.md](../CALENDAR.md) → "Reminders (parked)"
- `dispatch-calendar-reminders` is `enabled = false` in `config.toml` and has no schedule; the toast
  listener is mounted only on `/calendar`. Users can still set reminder offsets, which are stored
  and ignored. It would also notify invitees who declined. See SEC-A9 before enabling.

### COLLAB-2 · Medium · The assistant's help articles are stale
- **Status:** Fixed on `fix/defect-backlog` (fix(collab)): tasks, calendar and ai-chat-widget articles rewritten from the current UI labels; index rebuilt. The calendar article leaves reminders out until COLLAB-1 is decided
- `help-kb/tasks.md` describes removed statuses, sorting and filters; `help-kb/calendar.md` mentions
  a "Možda" RSVP and event types that do not exist; `help-kb/ai-chat-widget.md` says the assistant
  cannot create PDFs. The assistant repeats these answers.
- **Fix direction:** update the articles and run `npm run kb:build`.

### COLLAB-3 · Medium · Misfiled documents cannot be fixed in the UI
- **Status:** Fixed on `fix/defect-backlog` (fix(collab)): Edit action (uploader, Director, Accounting) reusing the upload modal in edit mode. The dedicated Uncategorized filter node is still missing (Low)
- `updateDocument` exists but nothing calls it; there is no way to re-categorise or re-link a
  document, although EMAIL_DOCUMENT_SORTING.md tells users to fix misfiled imports on the Documents
  page. Uncategorised documents have no dedicated filter node, only a count.

### COLLAB-4 · Medium · AI rate limiting miscounts
- **Status:** Deferred to the voice branch: this is open question OQ-3 there, and `feature/voice-assistant` pins the assistant with characterisation tests; change it with that work
- Tool-result rows are stored as `role = 'user'` and count against the 20-per-5-minutes and
  200-per-day limits; the check fails open on query errors and can be raced by concurrent requests.

### COLLAB-5 · Low · Open questions from the voice analysis
- OQ-1 (stopping during a tool call breaks the branch), OQ-5 (`tool_result` emitted before it is
  persisted), OQ-6 (`is_fully_paid` true when nothing is invoiced). See
  [voice/open-questions.md](../voice/open-questions.md).

### COLLAB-6 · Low · Chat loads only the latest 50 messages
- No "load older"; no message edit or delete; no member management after creation.

### COLLAB-7 · Low · @mentions in task comments notify nobody

### COLLAB-8 · Low · Document category seed data is not in the repo
- The baseline is schema-only; a fresh environment has an empty category tree.

### COLLAB-9 · Low · `get_busy_blocks` ignores recurrence and RSVPs
- It does not expand recurring events, exclude private events or declined invitations, or merge
  overlaps.

---

## 9. ERP integration (on hold — fix before resuming)

These only matter once the checklist in [erp-integration/PROGRESS.md](../erp-integration/PROGRESS.md)
is picked up again. They are tracked in more detail, with fix directions and the order to fix them
in, in [erp-integration/KNOWN_ISSUES.md](../erp-integration/KNOWN_ISSUES.md); the design questions
from the "ERP outlook" section below are Q17–Q20 in
[erp-integration/OPEN_QUESTIONS.md](../erp-integration/OPEN_QUESTIONS.md).

### ERP-1 · High · Promoting a bank invoice fails the whole run
- **Check:** Confirmed.
- **Where:** [20260831160000_erp_phase3_promotion.sql:328](../../supabase/parked-migrations/erp/20260831160000_erp_phase3_promotion.sql#L328) writes `invoice_category = 'BANK'`, which is not in `accounting_invoices_invoice_category_check`.
- **Fix direction:** use `BANK_CREDIT`.

### ERP-2 · High · Negative documents fail the whole run
- Storno and credit notes arrive with negative amounts, which violate the `>= 0` CHECKs on invoices
  and `amount > 0` on payments. Nothing links a correction to its original either.

### ERP-3 · High · Šifrarnici partners tab uses the old column name
- **Check:** Confirmed.
- The UI reads and writes `kom_id` (number); phase 2 renamed it to `erp_id` (text). Files:
  `Cashflow/Sifrarnici/{index.tsx, types.ts, hooks/useSifrarnici.ts, services/sifrarniciService.ts}`
  and both locale files.

### ERP-4 · Medium · Investor targets query a moved table
- `fetchPartnerTargets('investor')` reads `public.investors`, which is now in the `deprecated` schema.

### ERP-5 · Medium · BANK payments cannot resolve
- Resolution matches `company_bank_accounts.account_number` to the IBAN, and no UI writes that
  column (CASH-13).

### ERP-6 · Medium · ERP cesija moves the wrong account
- In-app cesija debits the payer's `cesija_bank_account_id`; an ERP cesija with `company_iban` set
  moves the invoice company's own account and never debits the payer.

### ERP-7 · Medium · Retail invoices are not categorised RETAIL
- They become invisible to Retail RLS and the retail approvals list.

### ERP-8 · Medium · Reference feed replacement is not atomic
- Delete-then-upsert; a failure in between empties the register.

### ERP-9 · Medium · No target for overhead costs
- Every line must carry a cost centre mapped to exactly one project, so office overhead needs a
  fake project mapping.

### ERP-10 · Low · Designed but not built
- Snapshot diff for retracted documents, ERP bank balance display and drift column, automatic
  partner matching by OIB, a payments review queue.

### ERP-11 · Low · Screen text says promotion happens later
- The ERP import screen's i18n description and CASHFLOW.md say nothing reaches
  `accounting_invoices` until a later phase; the function promotes immediately on upload.

### ERP-12 · Low · Phase 3 replaces `calculate_invoice_amounts()` wholesale
- Already step 2 of the resume checklist; listed so it is not missed.

---

## ERP outlook (added 2026-10-01)

Phase 5 of the 4D Wand integration removes in-app invoice and payment creation and takes bank
balances from the ERP. How that affects this backlog:

**Fixes on `fix/defect-backlog` that phase 5 makes redundant** — correct now, remove with phase 5:
- `reset_company_bank_account_balance` and the balance fields on the company form (CASH-1, CASH-16):
  the ERP balance becomes authoritative and the trigger-derived balance only a drift check.
- The invoice-edit approval fix (CASH-3) and the hidden invoice delete (SEC-A7): the forms go and
  writes are locked to the service role.

Everything else on the branch stays useful. No new migration on the branch overlaps a parked ERP
migration; the only shared object is `calculate_invoice_amounts()`, which the branch does not touch
(already step 2 of the resume checklist).

**New design questions for the ERP resume:**
1. **Double counting in the derived balance.** A drawdown imported from the ERP is a payment on an
   `OUTGOING_BANK` invoice into the account, while a credit flagged `disbursed_to_account` also adds
   its full amount (CASH-2 made that term permanent). Intercompany transfers are both ERP payments
   and `company_loans` rows (CASH-9). Decide which in-app money records survive once the ERP is the
   source of truth — most likely `disbursed_to_account` becomes informational and `company_loans`
   stops moving balances.
2. **Bank accounts from the ERP.** Payments and balances are matched by IBAN, which no screen
   captures (CASH-13, ERP-5). Create or match `company_bank_accounts` from the `bank_balances`
   feed instead of maintaining them by hand.

**Open items, re-assessed:** CASH-7 and FUND-5 still need a decision and still matter after phase 5;
CASH-6 shrinks to historical data; SALES-6, SUP-4, COLLAB-1 and COLLAB-4 are unaffected (see each
entry's **ERP** line).

---

## 10. Documentation drift

Docs that disagree with the code. None of these change behaviour, but people and the AI assistant
rely on them.

**Status:** Fixed on `fix/backlog-batch-2` (docs), 2026-10-01, item by item against the code. Two
claims were already out of date and were not applied: the chat attachment bucket is private since
SEC-A4, and CASHFLOW.md never claimed a PDF preview (the nearest thing, `InvoicePreview.tsx`, is now
described as the VAT-totals card it is). Left for later: the "138 discrete actions across 11
categories" total in ACTIVITY_LOG.md is probably stale. Found on the way: SEC-A12. The list below is
what was wrong.

- **Presentation docs** ([PRESENTATION_MODULES.md](../PRESENTATION_MODULES.md),
  [PRESENTATION_DECK.md](../PRESENTATION_DECK.md)):
  - payment certificates (situacije) are described as a feature; they do not exist (contracts use
    percentage payment milestones);
  - TIC is said to fill actual costs from invoices; it holds only the plan;
  - the ERP sync is described as a ~15-minute API sync with cursors and webhooks; the design is
    file exports pushed by an on-prem agent, with cadence undecided;
  - partners are said to be matched by OIB automatically; they are mapped by hand in Šifrarnici;
  - payment notices are listed under Funding; the feature was removed on 2026-09-14.
- **CLAUDE.md:** says five UI components are outside the barrel file; there are six
  (`InlineLoadError` is missing from the list).
- **ACTIVITY_LOG.md:** `logActivity` returns `Promise<void>`, not `void`; `ACTION_CATEGORIES` has
  46 prefixes, not 35, and none for `erp_*` or `ai_session`; cites a non-existent
  `Cashflow/Budget` service; omits `apartment.import_excel_summary` and `tic.import_excel`; several
  Funding actions are attributed to hooks instead of the services that emit them.
- **TESTING.md:** lists 8 unit-test targets and 28 e2e tests; there are 63 unit-test files and 13 e2e
  specs.
- **CALENDAR.md:** presents reminders as working; says private events are creator-only (all events
  are creator-plus-participants); says `due_date` where the code uses `deadline`.
- **CHAT.md:** says conversation summaries are computed on the client (they come from the
  `get_chat_conversation_summaries` RPC); does not mention that the attachment bucket is public.
- **AI_CHAT.md:** says the document buckets have no storage policies (they do since
  `20260527100000`); `tools.ts` header still says "12 tools… stub" (there are 15).
- **CASHFLOW.md:** says cesija columns exist on invoices (only on payments); says the invoice detail
  view includes payment history and a PDF preview (neither exists).
- **DASHBOARDS.md:** Accounting cash flow is month-over-month, not year-over-year.
- **GENERAL.md / CORE.md:** PhasesContractsTab groups by `phase_id` then classification, its bar is
  paid / `budget_allocated`, and its collapse key is `phase_contracts_collapse_v2`; milestone template
  ids are ASCII; `calculateProjectEVM` takes a third `milestones` argument and uses
  milestone-weighted completion.
- **SALES.md:** Sales Projects shows both Stambeno and Retail categories; `fetchAvailableUnits`
  returns all units; the Cashflow Customers screen reads the same `customers` table; the
  `paymentMethod.ts` helper it describes does not exist.
- **SUPERVISION.md:** `EditPhaseModal` does not edit budgets; the payments and invoices services
  filter more than documented; "one definition of paid" does not hold on the register and dashboard.
- **FUNDING.md:** misdescribes what `20260518110001` dropped.
- **REPORTS.md:** `salesReportPdf` does not use `pdfCharts`; the TIC block exists only in the PDF.
