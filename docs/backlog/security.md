# Backlog — security and access

Open defects in RLS, storage policies, edge-function auth and role gating, followed by the
security limitations the team has accepted for now. Ids: `SEC-An` for defects (next free:
`SEC-A13`), `SEC-00n` for accepted risks (next free: `SEC-005`). Entry format and rules are in
[README.md](./README.md).

An item moves from "Open defects" to "Accepted risks" only after the team decides to live with
it; write down why, and what a fix would look like.

## Open defects

### SEC-A9 · Low · `dispatch-calendar-reminders` has no request authentication
- **Where:** `supabase/functions/dispatch-calendar-reminders/index.ts`, `verify_jwt = false`.
- **What happens:** harmless today because the function is disabled in `config.toml`. Enabling it
  as is would let anyone trigger reminder inserts.
- **Fix direction:** add a shared-secret header like `send-push` before enabling. Part of turning
  reminders back on (COLLAB-1 in [collaboration.md](./collaboration.md)).

## Accepted risks

### SEC-001: Cashflow access is role-gated only; password modal is UI-only

**Status:** Open
**Severity:** Medium
**Filed:** 2026-05-08
**Affected components:** [src/components/Common/Layout.tsx](../../src/components/Common/Layout.tsx) (modal), [src/App.tsx](../../src/App.tsx) (`CashflowRoute`), all tables under `accounting_*` with role-only RLS

#### Summary

The Cashflow password modal in `Layout.tsx` and the `CashflowRoute` guard in `App.tsx` provide UI navigation gating only. They do not gate data access. The RLS policies on cashflow-bearing tables (`accounting_invoices`, `accounting_payments`, `accounting_companies`, `accounting_banks`, `accounting_customers`, `bank_credits`, debt status views, etc.) check `role IN ('Director', 'Accounting')` and do NOT reference the `cashflow_unlocked` sessionStorage flag. A user with a valid Supabase JWT and either of those roles can query all cashflow data via supabase-js (or any client with their JWT) without ever entering the password.

#### Why it exists

The password gate predates the role-based RLS. Layering RLS-level cashflow enforcement on top would have required either a Supabase Auth Hook or an edge-function-proxied data path — both non-trivial Supabase-specific patterns — and was deferred. The password modal was retained as a UX cue rather than a security control.

#### Evidence

- `VITE_CASHFLOW_PASSWORD` is inlined into the JS bundle at build time (Vite static replacement). Anyone with browser devtools and a valid Director/Accounting JWT can extract it; the password is therefore not a secret.
- `CashflowRoute` ([src/App.tsx](../../src/App.tsx)) checks `sessionStorage.getItem('cashflow_unlocked') === 'true'` plus role. Both checks are client-side and easily bypassed.
- RLS policies on cashflow tables (e.g. [supabase/migrations/20251128113128_fix_all_accounting_invoices_policies.sql](../../supabase/migrations/20251128113128_fix_all_accounting_invoices_policies.sql)) gate by `users.role IN ('Director', 'Accounting')` only.
- **Correction (2026-05-26):** five tables were NOT even role-gated — `accounting_payments`, `accounting_companies`, `bank_credits`, `company_loans`, and `company_bank_accounts` carried blanket `USING (true)` policies, so *any* authenticated user (Sales, Supervision, Investment, Retail) could read every row from the browser console. This was a broader exposure than the role-gated posture described above. Closed by [supabase/migrations/20260526084700_tighten_cashflow_rls.sql](../../supabase/migrations/20260526084700_tighten_cashflow_rls.sql) — see the Update and Mitigations sections below.
- There is no rate limiting, no lockout, no audit log of password attempts.
- There is no token-revocation path: changing `VITE_CASHFLOW_PASSWORD` and redeploying does not invalidate already-set `sessionStorage['cashflow_unlocked']` flags.
- e2e tests ([e2e/support/auth.ts](../../e2e/support/auth.ts), `fixtures.ts`, `globalSetup.ts`) bypass the modal by writing `sessionStorage` directly, confirming the gate is purely client-side.

#### Threat model

- **Out of scope:** external attackers without a valid JWT. RLS already gates them by role; the cashflow tables are not exposed to anonymous users.
- **In scope:** an internal user with `Director` or `Accounting` role acting outside their nominal task scope. Today, such a user has full data access to all cashflow tables regardless of whether they "unlocked" Cashflow in the UI. If your access-control posture treats internal users as semi-trusted (least-privilege within the org), this is a real gap.

#### Mitigations in place

- Roles are gate-kept at user creation (`handle_new_user` trigger + role CHECK constraint).
- The `'admin'` fallback default for `VITE_CASHFLOW_PASSWORD` was removed in step 1.5.1 of the AI chat plan; the modal now fails closed when the env var is unset.
- The AI chat (v1) does NOT layer additional cashflow enforcement on top of role — it inherits the same role-gated posture as the rest of the app, intentionally and visibly. See [docs/AI_CHAT.md §2 / Security posture](../AI_CHAT.md).
- **(2026-05-26)** The five previously blanket-open tables (`accounting_payments`, `accounting_companies`, `bank_credits`, `company_loans`, `company_bank_accounts`) are now role-gated by [supabase/migrations/20260526084700_tighten_cashflow_rls.sql](../../supabase/migrations/20260526084700_tighten_cashflow_rls.sql), with scoped exceptions for the Sales apartment-payment workflow and broad SELECT retained on `accounting_companies` (names + OIB are public reference data). The SECURITY DEFINER `get_invoice_statistics` RPC now rejects non-`Director`/`Accounting` callers up front ([supabase/migrations/20260526084701_get_invoice_statistics_role_check.sql](../../supabase/migrations/20260526084701_get_invoice_statistics_role_check.sql)).
- **(2026-09-16)** Its sibling `get_filtered_invoices` — also SECURITY DEFINER, and the RPC behind the Cashflow invoice list — had no role check, so any authenticated user (e.g. Sales) could page through every invoice past the `accounting_invoices` RLS. It now raises `insufficient_privilege` for anyone but `Director`/`Accounting`. The same migration revokes EXECUTE from `public`/`anon`/`authenticated` on five SECURITY DEFINER finance functions the app never calls (`get_apartment_payments`, `check_subcontractor_budget_integrity`, `fix_subcontractor_budget_integrity`, `recalculate_bank_credit_fields`, `recalculate_contract_budget_realized`); the triggers that use the two `recalculate_*` functions are themselves SECURITY DEFINER and keep working, and `service_role` / the SQL editor keep access ([supabase/migrations/20260916100000_lock_down_finance_definer_functions.sql](../../supabase/migrations/20260916100000_lock_down_finance_definer_functions.sql)). Found during the September UI audit. **Rule for new RPCs:** a SECURITY DEFINER function either checks the caller's role itself or has EXECUTE revoked from `authenticated`.

#### Update (2026-05-26): partial remediation, item stays open

The 2026-05-26 RLS-tightening migrations close the **blanket-`USING (true)`** sub-gap (cross-role exposure of five tables) but do **not** resolve SEC-001 itself. The core limitation — cashflow access is role-gated only, the password modal is UI-only and decoupled from RLS — is unchanged: a `Director`/`Accounting` JWT can still read all cashflow data via supabase-js without entering the password. The Proposed fix below (server-side unlock + JWT claim consumed by RLS) is still required. **Status remains Open.**

#### Proposed fix

Move cashflow access enforcement to the data layer:

1. Replace the client-side password modal with an edge function `unlock-cashflow` that validates a server-stored password (hashed; rotated via admin tooling, not a build-time env var).
2. On successful unlock, the function injects a custom JWT claim (e.g. `cashflow_unlocked: true` with an explicit expiry) — either via Supabase Auth Hooks or by issuing a session-scoped token that RLS policies read via `request.jwt.claims`.
3. Update RLS policies on cashflow tables to require both `role IN (...)` AND the cashflow claim.
4. Update `CashflowRoute` to verify the claim's expiry rather than a sessionStorage boolean.
5. Update e2e helpers to call the real unlock flow with a known test password.

#### Why it isn't fixed yet

The fix touches ~15 RLS policies across 11 tables, requires choosing between Supabase Auth Hooks and a token-injection mechanism, and carries regression risk on a critical financial workflow. It deserves a focused initiative with its own design review, threat-model writeup, and rollout plan — not a sub-task of an unrelated feature.

#### Cross-references

- [docs/CASHFLOW.md](../CASHFLOW.md) (overview of the cashflow module)
- [docs/AI_CHAT.md](../AI_CHAT.md) §2 / Security posture (how the AI chat inherits this limitation)
- [supabase/migrations/20260526084700_tighten_cashflow_rls.sql](../../supabase/migrations/20260526084700_tighten_cashflow_rls.sql) (2026-05-26, closes the blanket-open sub-gap)
- [supabase/migrations/20260526084701_get_invoice_statistics_role_check.sql](../../supabase/migrations/20260526084701_get_invoice_statistics_role_check.sql) (2026-05-26, RPC role check)
- Discovered during AI chat plan, Phase 1.5 (May 2026)

---

### SEC-002: Cashflow profile remains selectable in the dropdown when misconfigured

**Status:** Open
**Severity:** Low (UX, not security)
**Filed:** 2026-05-08

#### Summary

When `VITE_CASHFLOW_PASSWORD` is unset, the Cashflow profile remains selectable in the profile dropdown. Selecting it opens the password modal in its fail-closed configuration-error state. A cleaner UX would disable the option entirely. Out of scope for the fail-closed fix in step 1.5.1; trivial to address in a follow-up.

#### Cross-references

- [src/components/Common/Layout.tsx](../../src/components/Common/Layout.tsx) (profile dropdown + modal)
- Discovered during AI chat plan, Phase 1.5 (May 2026)

---
### SEC-004: Paid figures are hidden from Supervision on screen only

**Status:** Accepted risk, narrowed 2026-10-12
**Severity:** Low
**Filed:** 2026-09-21
**Affected components:** [src/utils/permissions.ts](../../src/utils/permissions.ts) (`canManagePayments`), all of `src/components/Supervision/SiteManagement/`, `public.contracts`, `public.accounting_invoices`

#### What was fixed

Migration `20261012100000_contracts_project_scope` (written 2026-10-12, **not applied yet** — see
[release.md](./release.md)) replaced the blanket `USING (true)` policies:

- `contracts`: read through `app_can_access_project(project_id)` — Director, Accounting,
  Investment and Sales always, Supervision only on projects in `project_managers`. Supervision
  can insert and update contracts only on those projects.
- `subcontractor_milestones`: readable and writable only together with their contract.

A Supervision user can therefore no longer read or change anything on a project that is not
theirs. `canManagePayments` no longer includes Investment (SEC-A10, 2026-10-09).

#### What remains, and why it is accepted

On the projects a Supervision user *is* assigned to, Site management hides every payment-derived
figure (`canManagePayments`), but the database still returns them:

- `contracts.budget_realized`, the trigger-kept sum of payments, is a column of a table that user
  must read. The site screens need it themselves: the budget check on adding or editing a
  contract counts what was paid on terminated contracts (`committedAmount`).
- `accounting_invoices.paid_amount` / `remaining_amount` for those projects, through the policy
  "Supervision can view invoices for managed projects".
- `subcontractor_milestones.status`, which the payment trigger sets.

Sales and Investment read every contract, as they read every phase, including `budget_realized`.

Every app role connects as the one Postgres role `authenticated`, so the column cannot be
withheld per role by a grant. Closing this means moving the paid figure out of `contracts` (a
side table or a view per audience) and changing about forty reads across Site management, the
dashboards, the reports and the assistant's tools. That is a project of its own.

#### Threat model

- **Out of scope:** anyone without a valid JWT.
- **In scope:** an internal Supervision user reading, with developer tools, what has been paid on
  a project they supervise. The everyday benefit of the screen-level gate is unchanged: a
  supervisor's screen on site or in a screen-share does not carry the company's payment position.

#### Mitigations in place

- The UI gate defaults to **closed**: `ProjectDetail`'s `canManagePayments` prop defaults to
  `false`, so a component that forgets to pass it hides the figures.
- The gate covers derived signals (unpaid, utilisation, overdue), not just the raw numbers.

## Resolved

### AUTH-4 · Low · An unused `user_has_project_access(uuid, uuid)` overload contradicts the real rule
- Fixed on `fix/contracts-scope-sale-cancel-unit-numbers` (2026-10-12): the unused two-argument `user_has_project_access` is dropped in migration
  `20261012100000` (**not applied yet**), behind a guard that refuses if anything uses it.

### SEC-A10 · Low · Investment role can manage payments in the UI but reads none
- Decided 2026-10-09: hide the screens rather than widen the policy (production has no
  Investment user). `canManagePayments` is Director and Accounting, as the RLS; done on `fix/storage-policies-sec-a12` (2026-10-09).

### SEC-A12 · Medium · Any signed-in user can delete any stored document file
- Fixed by migration `20261009100000_storage_document_delete_policies` (written 2026-10-09,
  **not applied yet** — see [release.md](./release.md)): the DELETE policies on the `documents`
  and `contract-documents` buckets allow the file's owner, Director and Accounting. There was no
  UPDATE policy on either bucket, so files could not be overwritten; the entry was wrong on that.

- **SEC-003** (RLS on `project_managers`): never present in the applied schema. Record in
  [archive/SECURITY_BACKLOG.md](./archive/SECURITY_BACKLOG.md).
- **SEC-A1 to SEC-A8, SEC-A11:** fixed on `fix/defect-backlog` and `fix/backlog-batch-2`. Record in
  [archive/DEFECT_BACKLOG.md](./archive/DEFECT_BACKLOG.md).
