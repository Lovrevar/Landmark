# Security Backlog

This file is a persistent, in-repo record of known security limitations that have been triaged and **accepted as not-yet-fixed**. Each entry is meant to give a future maintainer enough context to pick the work up cold: what the issue is, why it exists, why it hasn't been fixed yet, and what a fix would look like. Entries here are not fresh bugs — fresh bugs go in the issue tracker. An item lands here only after we've decided to live with it (with eyes open) until a focused initiative addresses it.

## Format

Each entry uses the heading `## SEC-NNN: <one-line title>` followed by a metadata block (`**Status:**`, `**Severity:**`, `**Filed:**`, optional `**Affected components:**`) and one or more of these subsections: `### Summary`, `### Why it exists`, `### Evidence`, `### Threat model`, `### Mitigations in place`, `### Proposed fix`, `### Why it isn't fixed yet`, `### Cross-references`. Short stub entries may use just `### Summary` and `### Cross-references`. Severity values: **Critical / High / Medium / Low** (UX-only issues that have been classified as security-adjacent should say `Low (UX, not security)`).

---

## SEC-001: Cashflow access is role-gated only; password modal is UI-only

**Status:** Open
**Severity:** Medium
**Filed:** 2026-05-08
**Affected components:** [src/components/Common/Layout.tsx](../src/components/Common/Layout.tsx) (modal), [src/App.tsx](../src/App.tsx) (`CashflowRoute`), all tables under `accounting_*` with role-only RLS

### Summary

The Cashflow password modal in `Layout.tsx` and the `CashflowRoute` guard in `App.tsx` provide UI navigation gating only. They do not gate data access. The RLS policies on cashflow-bearing tables (`accounting_invoices`, `accounting_payments`, `accounting_companies`, `accounting_banks`, `accounting_customers`, `bank_credits`, debt status views, etc.) check `role IN ('Director', 'Accounting')` and do NOT reference the `cashflow_unlocked` sessionStorage flag. A user with a valid Supabase JWT and either of those roles can query all cashflow data via supabase-js (or any client with their JWT) without ever entering the password.

### Why it exists

The password gate predates the role-based RLS. Layering RLS-level cashflow enforcement on top would have required either a Supabase Auth Hook or an edge-function-proxied data path — both non-trivial Supabase-specific patterns — and was deferred. The password modal was retained as a UX cue rather than a security control.

### Evidence

- `VITE_CASHFLOW_PASSWORD` is inlined into the JS bundle at build time (Vite static replacement). Anyone with browser devtools and a valid Director/Accounting JWT can extract it; the password is therefore not a secret.
- `CashflowRoute` ([src/App.tsx](../src/App.tsx)) checks `sessionStorage.getItem('cashflow_unlocked') === 'true'` plus role. Both checks are client-side and easily bypassed.
- RLS policies on cashflow tables (e.g. [supabase/migrations/20251128113128_fix_all_accounting_invoices_policies.sql](../supabase/migrations/20251128113128_fix_all_accounting_invoices_policies.sql)) gate by `users.role IN ('Director', 'Accounting')` only.
- **Correction (2026-05-26):** five tables were NOT even role-gated — `accounting_payments`, `accounting_companies`, `bank_credits`, `company_loans`, and `company_bank_accounts` carried blanket `USING (true)` policies, so *any* authenticated user (Sales, Supervision, Investment, Retail) could read every row from the browser console. This was a broader exposure than the role-gated posture described above. Closed by [supabase/migrations/20260526084700_tighten_cashflow_rls.sql](../supabase/migrations/20260526084700_tighten_cashflow_rls.sql) — see the Update and Mitigations sections below.
- There is no rate limiting, no lockout, no audit log of password attempts.
- There is no token-revocation path: changing `VITE_CASHFLOW_PASSWORD` and redeploying does not invalidate already-set `sessionStorage['cashflow_unlocked']` flags.
- e2e tests ([e2e/support/auth.ts](../e2e/support/auth.ts), `fixtures.ts`, `globalSetup.ts`) bypass the modal by writing `sessionStorage` directly, confirming the gate is purely client-side.

### Threat model

- **Out of scope:** external attackers without a valid JWT. RLS already gates them by role; the cashflow tables are not exposed to anonymous users.
- **In scope:** an internal user with `Director` or `Accounting` role acting outside their nominal task scope. Today, such a user has full data access to all cashflow tables regardless of whether they "unlocked" Cashflow in the UI. If your access-control posture treats internal users as semi-trusted (least-privilege within the org), this is a real gap.

### Mitigations in place

- Roles are gate-kept at user creation (`handle_new_user` trigger + role CHECK constraint).
- The `'admin'` fallback default for `VITE_CASHFLOW_PASSWORD` was removed in step 1.5.1 of the AI chat plan; the modal now fails closed when the env var is unset.
- The AI chat (v1) does NOT layer additional cashflow enforcement on top of role — it inherits the same role-gated posture as the rest of the app, intentionally and visibly. See [docs/AI_CHAT.md §2 / Security posture](./AI_CHAT.md).
- **(2026-05-26)** The five previously blanket-open tables (`accounting_payments`, `accounting_companies`, `bank_credits`, `company_loans`, `company_bank_accounts`) are now role-gated by [supabase/migrations/20260526084700_tighten_cashflow_rls.sql](../supabase/migrations/20260526084700_tighten_cashflow_rls.sql), with scoped exceptions for the Sales apartment-payment workflow and broad SELECT retained on `accounting_companies` (names + OIB are public reference data). The SECURITY DEFINER `get_invoice_statistics` RPC now rejects non-`Director`/`Accounting` callers up front ([supabase/migrations/20260526084701_get_invoice_statistics_role_check.sql](../supabase/migrations/20260526084701_get_invoice_statistics_role_check.sql)).
- **(2026-09-16)** Its sibling `get_filtered_invoices` — also SECURITY DEFINER, and the RPC behind the Cashflow invoice list — had no role check, so any authenticated user (e.g. Sales) could page through every invoice past the `accounting_invoices` RLS. It now raises `insufficient_privilege` for anyone but `Director`/`Accounting`. The same migration revokes EXECUTE from `public`/`anon`/`authenticated` on five SECURITY DEFINER finance functions the app never calls (`get_apartment_payments`, `check_subcontractor_budget_integrity`, `fix_subcontractor_budget_integrity`, `recalculate_bank_credit_fields`, `recalculate_contract_budget_realized`); the triggers that use the two `recalculate_*` functions are themselves SECURITY DEFINER and keep working, and `service_role` / the SQL editor keep access ([supabase/migrations/20260916100000_lock_down_finance_definer_functions.sql](../supabase/migrations/20260916100000_lock_down_finance_definer_functions.sql)). Found during the September UI audit. **Rule for new RPCs:** a SECURITY DEFINER function either checks the caller's role itself or has EXECUTE revoked from `authenticated`.

### Update (2026-05-26): partial remediation, item stays open

The 2026-05-26 RLS-tightening migrations close the **blanket-`USING (true)`** sub-gap (cross-role exposure of five tables) but do **not** resolve SEC-001 itself. The core limitation — cashflow access is role-gated only, the password modal is UI-only and decoupled from RLS — is unchanged: a `Director`/`Accounting` JWT can still read all cashflow data via supabase-js without entering the password. The Proposed fix below (server-side unlock + JWT claim consumed by RLS) is still required. **Status remains Open.**

### Proposed fix

Move cashflow access enforcement to the data layer:

1. Replace the client-side password modal with an edge function `unlock-cashflow` that validates a server-stored password (hashed; rotated via admin tooling, not a build-time env var).
2. On successful unlock, the function injects a custom JWT claim (e.g. `cashflow_unlocked: true` with an explicit expiry) — either via Supabase Auth Hooks or by issuing a session-scoped token that RLS policies read via `request.jwt.claims`.
3. Update RLS policies on cashflow tables to require both `role IN (...)` AND the cashflow claim.
4. Update `CashflowRoute` to verify the claim's expiry rather than a sessionStorage boolean.
5. Update e2e helpers to call the real unlock flow with a known test password.

### Why it isn't fixed yet

The fix touches ~15 RLS policies across 11 tables, requires choosing between Supabase Auth Hooks and a token-injection mechanism, and carries regression risk on a critical financial workflow. It deserves a focused initiative with its own design review, threat-model writeup, and rollout plan — not a sub-task of an unrelated feature.

### Cross-references

- [docs/CASHFLOW.md](./CASHFLOW.md) (overview of the cashflow module)
- [docs/AI_CHAT.md](./AI_CHAT.md) §2 / Security posture (how the AI chat inherits this limitation)
- [supabase/migrations/20260526084700_tighten_cashflow_rls.sql](../supabase/migrations/20260526084700_tighten_cashflow_rls.sql) (2026-05-26, closes the blanket-open sub-gap)
- [supabase/migrations/20260526084701_get_invoice_statistics_role_check.sql](../supabase/migrations/20260526084701_get_invoice_statistics_role_check.sql) (2026-05-26, RPC role check)
- Discovered during AI chat plan, Phase 1.5 (May 2026)

---

## SEC-002: Cashflow profile remains selectable in the dropdown when misconfigured

**Status:** Open
**Severity:** Low (UX, not security)
**Filed:** 2026-05-08

### Summary

When `VITE_CASHFLOW_PASSWORD` is unset, the Cashflow profile remains selectable in the profile dropdown. Selecting it opens the password modal in its fail-closed configuration-error state. A cleaner UX would disable the option entirely. Out of scope for the fail-closed fix in step 1.5.1; trivial to address in a follow-up.

### Cross-references

- [src/components/Common/Layout.tsx](../src/components/Common/Layout.tsx) (profile dropdown + modal)
- Discovered during AI chat plan, Phase 1.5 (May 2026)

---

## SEC-003: RLS policies on project_managers compare wrong UUID columns

**Status:** Resolved — not present in applied schema (verified 2026-05-29)
**Severity:** Medium
**Filed:** 2026-05-08
**Resolved:** 2026-05-29
**Affected components:** RLS policies on `public.project_managers`, all frontend code that reads or writes `project_managers` via the standard supabase-js userClient

### Resolution (2026-05-29)

This bug is **not present in the schema that is actually applied to the database**. The evidence below was sourced from `supabase/full_schema.sql`, a reconnaissance dump committed 2026-05-12 (during the AI-chat work) and **removed 2026-05-29** (see note below). The authoritative applied state is the consolidated baseline [supabase/migrations/00000000000000_baseline_schema.sql](../supabase/migrations/00000000000000_baseline_schema.sql), committed **2026-05-15** — three days *after* the dump — under "Migration history reconciliation: baseline + neuter historical".

All four `project_managers` policies in the baseline use the **correct** `users.auth_user_id = auth.uid()` bridge:

- `Directors can create project manager assignments` — baseline line 8604 — `users.auth_user_id = ( SELECT auth.uid() AS uid)`
- `Directors can delete project manager assignments` — baseline line 8631 — same
- `Directors can view all project manager assignments` — baseline line 8694 — same
- `Supervision users can view their own assignments` — baseline line 9166 — `user_id IN ( SELECT users.id FROM users WHERE users.auth_user_id = auth.uid())`

End-to-end check: the Supervision self-view policy aligns exactly with the frontend query in [src/contexts/AuthContext.tsx:90-100](../src/contexts/AuthContext.tsx) (`.eq('user_id', data.id)` where `data.id` is `public.users.id`), so Supervision users' `assignedProjects` is correctly populated. No migration is required.

`full_schema.sql` is stale (it also still contains legacy lowercase roles such as `'admin'`/`'project_manager'` that are not in the live `users_role_check` constraint). It should not be treated as ground truth — see the note at the end of this entry.

### Summary (historical — applied only to the stale full_schema.sql dump)

Three RLS policies on `public.project_managers` used the predicate `users.id = auth.uid()` where they should use `users.auth_user_id = auth.uid()`. Because `public.users.id` is a generated uuid distinct from `auth.users.id` (the bridge column is `public.users.auth_user_id`), the predicate can never match for any real user. Consequently, the userClient cannot SELECT, INSERT, or DELETE on `project_managers` — even for Directors. Frontend code that goes through this path silently returns 0 rows and does no I/O. **This described the dump, not the deployed baseline, which already uses the correct bridge (see Resolution above).**

### Why it exists

The repository has a project-wide ambiguity between `auth.uid()` (= `auth.users.id`) and `public.users.id`. Several other policies use the correct `users.auth_user_id = auth.uid()` bridge (e.g. `accounting_invoices` at `full_schema.sql:11394-11396`), but at least these three policies on `project_managers` use the broken `users.id = auth.uid()` form. The mistake likely dates to a copy-paste from a draft pattern and was never caught because Director-only project-manager management is rarely exercised through the userClient and the AI chat reads this table via the service role.

### Evidence

- `full_schema.sql:11641-11643` (`Directors can create project manager assignments`):
  ```sql
  CREATE POLICY "Directors can create project manager assignments" ON public.project_managers FOR INSERT TO authenticated WITH CHECK ((EXISTS ( SELECT 1
     FROM public.users
    WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = 'Director'::text)))));
  ```
- `full_schema.sql:11668-11670` (`Directors can delete project manager assignments`): same `users.id = ( SELECT auth.uid() AS uid)` predicate.
- `full_schema.sql:11731-11733` (`Directors can view all project manager assignments`): same predicate.
- For comparison, the correct pattern (used by other tables): `users.auth_user_id = auth.uid()`. Quoted at `full_schema.sql:11394-11396`.
- `public.users.id` is `gen_random_uuid()` (per `full_schema.sql:6717-6725`); `auth.users.id` is the Supabase Auth user UUID; the bridge column is `public.users.auth_user_id` with `UNIQUE` + FK to `auth.users(id)` ON DELETE CASCADE.

> Note: line references above point at the now-removed `full_schema.sql` dump and are retained only for historical context. The applied policies (all correct) are in `supabase/migrations/00000000000000_baseline_schema.sql`.

### Threat model

- **Out of scope:** unauthorized data exposure. The bug fails closed — it denies access where access was intended.
- **In scope:** functional breakage. Any frontend feature that lets Directors view, assign, or delete project_manager rows via the standard supabase client will silently do nothing. Users see empty UI states with no error message. If `AuthContext.fetchUserData()` falls under this policy at runtime (it queries `project_managers` with the standard client at [src/contexts/AuthContext.tsx:90-115](../src/contexts/AuthContext.tsx)), Supervision users may not see their own assignments — worth empirical confirmation against the live deployment.

### Mitigations in place

- The AI chat edge function uses the **service client** for `project_managers` lookups in [supabase/functions/_shared/auth.ts](../supabase/functions/_shared/auth.ts). The service role bypasses RLS, so the AI chat (specifically the resolution of Supervision users' `assignedProjects`) is unaffected by this bug.
- The bug is fail-closed (denies access rather than over-granting), so it cannot leak data on its own.

### Proposed fix

A small forward-fix migration:

1. `DROP POLICY` on the three affected policies (`Directors can create / delete / view all project manager assignments`).
2. Recreate each with the corrected predicate `users.auth_user_id = auth.uid()`.
3. Audit the rest of the codebase for any other `users.id = auth.uid()` pattern via `grep -rn "users\.id\s*=\s*(\s*SELECT\s*)?auth\.uid" supabase/full_schema.sql supabase/migrations/` — there may be more occurrences and a systematic sweep is cheaper than a one-off fix.
4. Empirically verify that Supervision users' `assignedProjects` field is correctly populated end-to-end before and after the fix.

### Why it isn't fixed yet

~~This bug was discovered during AI-chat schema reconnaissance (Phase 3.1)...~~ — **Moot.** The bug was never in the applied schema; it existed only in the stale `full_schema.sql` recon dump. The baseline reconciliation on 2026-05-15 already deployed the correct predicate. No forward-fix migration is needed. (Original note retained below for history: the AI chat path was independently unaffected because `_shared/auth.ts` reads `project_managers` via the service client.)

### Note: `full_schema.sql` is stale and should not be trusted as ground truth

The root cause of this false positive is that `supabase/full_schema.sql` (committed 2026-05-12) predated the consolidated baseline (`supabase/migrations/00000000000000_baseline_schema.sql`, 2026-05-15) and was never regenerated. A repo-wide sweep on 2026-05-29 found **14** occurrences of the broken `users.id = auth.uid()` predicate in `full_schema.sql` and **0** in the applied migrations — and `full_schema.sql` still referenced legacy lowercase roles (`'admin'`, `'project_manager'`) that the live `users_role_check` constraint forbids. Nothing in the build/tooling consumed it.

**Resolved 2026-05-29:** `supabase/full_schema.sql` was deleted in favour of the baseline migration (the single source of truth), and the one stale code reference to it was fixed ([supabase/functions/_shared/tool-handlers.ts](../supabase/functions/_shared/tool-handlers.ts) now cites the policy by name instead of `full_schema.sql:12000`). For a readable full-schema reference, regenerate from the linked DB on demand (`supabase db dump`); do not re-commit a static copy that can drift out of sync again.

### Cross-references

- [supabase/migrations/00000000000000_baseline_schema.sql](../supabase/migrations/00000000000000_baseline_schema.sql) lines 8604, 8631, 8694, 9166 (the **correct**, applied policies)
- [src/contexts/AuthContext.tsx](../src/contexts/AuthContext.tsx) lines 90-115 (`assignedProjects` reads `project_managers` via the standard client — verified consistent with the applied Supervision policy)
- [supabase/functions/_shared/auth.ts](../supabase/functions/_shared/auth.ts) (uses service client for the same lookup, independently unaffected)
- `supabase/full_schema.sql` lines 11641-11643, 11668-11670, 11731-11733 (the **stale dump** where the phantom bug appeared — file removed 2026-05-29)
- Discovered during AI chat plan, Phase 3.1 schema reconnaissance (May 2026); verified resolved 2026-05-29

---

## SEC-004: The Supervision payment gate is screen-only; `contracts` is world-readable

**Status:** Open
**Severity:** Low
**Filed:** 2026-09-21
**Affected components:** [src/utils/permissions.ts](../src/utils/permissions.ts) (`canManagePayments`), all of `src/components/Supervision/SiteManagement/`, [src/components/Common/Layout.tsx](../src/components/Common/Layout.tsx) (the Supervision role menu), `public.contracts` and `public.accounting_invoices` RLS

### Summary

Site Management now hides every payment-derived figure from users for whom
`canManagePayments(user)` is false (Supervision and Sales) — paid and unpaid tiles, the paid
column, the utilisation bar, card tints and status badges, the paid-based overdue badge, the
milestone paid column and status, and the entry points to the payment-history and invoice
modals. The Supervision role's navigation no longer offers `/payments` or `/invoices`.

**None of this is a data boundary.** It changes what the screen draws, not what the user's JWT
can read. A Supervision user with browser devtools can recover every hidden figure with a single
supabase-js call. The restriction is a "do not put this in front of people who do not need it"
measure, taken with eyes open, exactly like the Cashflow password modal in SEC-001.

### Evidence

- `contracts` is readable by **any** authenticated user:
  ```sql
  CREATE POLICY "Authenticated users can read contracts" ON public.contracts
    FOR SELECT TO authenticated USING (true);
  ```
  ([supabase/migrations/00000000000000_baseline_schema.sql](../supabase/migrations/00000000000000_baseline_schema.sql) line 7827). `contracts.budget_realized` is the app's single definition of money paid on a contract — a trigger-kept cache of `sum(accounting_payments.amount)` (migration `20260910120000`). Every paid figure Site Management hides is one `select budget_realized from contracts` away, as are the derived unpaid, remaining and overdue signals.
- `accounting_invoices` carries `paid_amount` and `remaining_amount` as ordinary columns, and the policy **"Supervision can view invoices for managed projects"** (baseline line 9123) grants Supervision SELECT on the invoices of the projects they are assigned to. So the invoice-side paid figures are readable too, even though the Invoices screen and modal are no longer reachable from the menu or the contract cards.
- `subcontractor_milestones.status` is set from payments by the `update_milestone_status_on_payment` trigger (baseline lines 1999-2045), so the hidden milestone status is likewise derivable from a readable table.

### The inverse gap: `Investment` has the flag but not the rows

`canManagePayments` returns true for `Director`, `Accounting` **and** `Investment`
([permissions.ts:3-6](../src/utils/permissions.ts)), but `20260526084700_tighten_cashflow_rls.sql`
gates `accounting_payments` to Director/Accounting only. An Investment user therefore gets the
full paid UI — tiles, columns, the payment-history button — over rows RLS will not return.
`contracts.budget_realized` still resolves (see above), so the tiles show figures; the payment
*history* modal is the part that comes back empty and will read as "this contract was never
paid". Either `canManagePayments` should drop `Investment`, or the RLS should include it. This
needs a product decision about what the Investment role is for, which is why it is recorded here
rather than fixed.

### Threat model

- **Out of scope:** anyone without a valid JWT — the tables are not exposed to `anon`.
- **In scope:** an internal Supervision or Sales user deliberately reading data the UI declines to show them. This is a least-privilege gap, not an exposure to outsiders. The realistic everyday benefit of the screen-level gate is the opposite direction: supervisors' screens during site visits and screen-shares no longer carry the company's payment position.

### Mitigations in place

- The UI gate defaults to **closed**: `ProjectDetail`'s `canManagePayments` prop defaults to `false`, so a component added later that forgets to pass it hides the figures rather than showing them.
- The gate covers derived signals, not just the raw numbers, so a reader cannot reconstruct paid from what is left (e.g. the unpaid tile is hidden because unpaid = contracted − paid). The "remaining budget" tile stays because `remainingBudget` is `budget − contracted − unpaidWithoutContract` and never reads `paid`.

### Proposed fix

1. Replace `contracts`' blanket `USING (true)` SELECT policy with a project-scoped one (Supervision sees the contracts of their `project_managers` rows; Director/Accounting/Investment see all), keeping `budget_realized` behind it.
2. Decide whether `Investment` should have payment rights, then make `canManagePayments` and the `accounting_payments` policy agree.
3. Consider a `security_invoker` view that exposes contracts without `budget_realized` for roles that should not see it, if (1) proves too disruptive to the many screens that read `contracts`.

### Why it isn't fixed yet

A migration here touches the most widely read table in the app — `contracts` is joined by Site Management, General, Funding, Reports and the AI chat tool handlers — and a scoping mistake fails *closed*, silently emptying screens for the role that needs them most. The screen-level change ships first and on its own; the policy work is a separate, tested piece with its own verification pass. No migration was written as part of this batch.

### Cross-references

- [docs/SUPERVISION.md](./SUPERVISION.md) — "The payment gate" section lists exactly what is hidden and what stays
- [supabase/migrations/20260526084700_tighten_cashflow_rls.sql](../supabase/migrations/20260526084700_tighten_cashflow_rls.sql) (why `/payments` showed Supervision an empty page)
- SEC-001 above — the same "UI gate over role-only RLS" shape, one layer up
