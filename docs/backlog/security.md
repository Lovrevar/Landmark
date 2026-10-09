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

### AUTH-4 · Low · An unused `user_has_project_access(uuid, uuid)` overload contradicts the real rule
- **Check:** Confirmed on production, read-only (2026-10-09).
- **What is there:** two functions share the name. The one-argument one — Director, or Supervision
  on an assigned project — is what the only policy using it (`project_milestones`) calls, and
  `hasProjectAccess` in `src/contexts/AuthContext.tsx` matches it exactly. The two-argument one
  also grants Accounting, Sales and Investment, and nothing calls it: no policy, no function, no
  app code. The earlier entry compared the client with the wrong one; the client is right.
- **Fix direction:** drop the two-argument overload in a migration, so nobody builds a policy on
  it by mistake.

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
### SEC-004: The Supervision payment gate is screen-only; `contracts` is world-readable

**Status:** Open
**Severity:** Low
**Filed:** 2026-09-21
**Affected components:** [src/utils/permissions.ts](../../src/utils/permissions.ts) (`canManagePayments`), all of `src/components/Supervision/SiteManagement/`, [src/components/Common/Layout.tsx](../../src/components/Common/Layout.tsx) (the Supervision role menu), `public.contracts` and `public.accounting_invoices` RLS

#### Summary

Site Management now hides every payment-derived figure from users for whom
`canManagePayments(user)` is false (Supervision and Sales) — paid and unpaid tiles, the paid
column, the utilisation bar, card tints and status badges, the paid-based overdue badge, the
milestone paid column and status, and the entry points to the payment-history and invoice
modals. The Supervision role's navigation no longer offers `/payments` or `/invoices`.

**None of this is a data boundary.** It changes what the screen draws, not what the user's JWT
can read. A Supervision user with browser devtools can recover every hidden figure with a single
supabase-js call. The restriction is a "do not put this in front of people who do not need it"
measure, taken with eyes open, exactly like the Cashflow password modal in SEC-001.

#### Evidence

- `contracts` is readable by **any** authenticated user:
  ```sql
  CREATE POLICY "Authenticated users can read contracts" ON public.contracts
    FOR SELECT TO authenticated USING (true);
  ```
  ([supabase/migrations/00000000000000_baseline_schema.sql](../../supabase/migrations/00000000000000_baseline_schema.sql) line 7827). `contracts.budget_realized` is the app's single definition of money paid on a contract — a trigger-kept cache of `sum(accounting_payments.amount)` (migration `20260910120000`). Every paid figure Site Management hides is one `select budget_realized from contracts` away, as are the derived unpaid, remaining and overdue signals.
- `accounting_invoices` carries `paid_amount` and `remaining_amount` as ordinary columns, and the policy **"Supervision can view invoices for managed projects"** (baseline line 9123) grants Supervision SELECT on the invoices of the projects they are assigned to. So the invoice-side paid figures are readable too, even though the Invoices screen and modal are no longer reachable from the menu or the contract cards.
- `subcontractor_milestones.status` is set from payments by the `update_milestone_status_on_payment` trigger (baseline lines 1999-2045), so the hidden milestone status is likewise derivable from a readable table.

#### The inverse gap: `Investment` has the flag but not the rows

`canManagePayments` returns true for `Director`, `Accounting` **and** `Investment`
([permissions.ts:3-6](../../src/utils/permissions.ts)), but `20260526084700_tighten_cashflow_rls.sql`
gates `accounting_payments` to Director/Accounting only. An Investment user therefore gets the
full paid UI — tiles, columns, the payment-history button — over rows RLS will not return.
`contracts.budget_realized` still resolves (see above), so the tiles show figures; the payment
*history* modal is the part that comes back empty and will read as "this contract was never
paid". Either `canManagePayments` should drop `Investment`, or the RLS should include it. This
needs a product decision about what the Investment role is for, which is why it is recorded here
rather than fixed.

#### Threat model

- **Out of scope:** anyone without a valid JWT — the tables are not exposed to `anon`.
- **In scope:** an internal Supervision or Sales user deliberately reading data the UI declines to show them. This is a least-privilege gap, not an exposure to outsiders. The realistic everyday benefit of the screen-level gate is the opposite direction: supervisors' screens during site visits and screen-shares no longer carry the company's payment position.

#### Mitigations in place

- The UI gate defaults to **closed**: `ProjectDetail`'s `canManagePayments` prop defaults to `false`, so a component added later that forgets to pass it hides the figures rather than showing them.
- The gate covers derived signals, not just the raw numbers, so a reader cannot reconstruct paid from what is left (e.g. the unpaid tile is hidden because unpaid = contracted − paid). The "remaining budget" tile stays because `remainingBudget` is `budget − contracted − unpaidWithoutContract` and never reads `paid`.

#### Proposed fix

1. Replace `contracts`' blanket `USING (true)` SELECT policy with a project-scoped one (Supervision sees the contracts of their `project_managers` rows; Director/Accounting/Investment see all), keeping `budget_realized` behind it.
2. Decide whether `Investment` should have payment rights, then make `canManagePayments` and the `accounting_payments` policy agree.
3. Consider a `security_invoker` view that exposes contracts without `budget_realized` for roles that should not see it, if (1) proves too disruptive to the many screens that read `contracts`.

#### Why it isn't fixed yet

A migration here touches the most widely read table in the app — `contracts` is joined by Site Management, General, Funding, Reports and the AI chat tool handlers — and a scoping mistake fails *closed*, silently emptying screens for the role that needs them most. The screen-level change ships first and on its own; the policy work is a separate, tested piece with its own verification pass. No migration was written as part of this batch.

#### Cross-references

- [docs/SUPERVISION.md](../SUPERVISION.md) — "The payment gate" section lists exactly what is hidden and what stays
- [supabase/migrations/20260526084700_tighten_cashflow_rls.sql](../../supabase/migrations/20260526084700_tighten_cashflow_rls.sql) (why `/payments` showed Supervision an empty page)
- SEC-001 above — the same "UI gate over role-only RLS" shape, one layer up

## Resolved

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
