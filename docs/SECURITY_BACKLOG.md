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

**Status:** Open
**Severity:** Medium
**Filed:** 2026-05-08
**Affected components:** RLS policies on `public.project_managers` (visible at [supabase/full_schema.sql](../supabase/full_schema.sql) lines 11643, 11668, 11731), all frontend code that reads or writes `project_managers` via the standard supabase-js userClient

### Summary

Three RLS policies on `public.project_managers` use the predicate `users.id = auth.uid()` where they should use `users.auth_user_id = auth.uid()`. Because `public.users.id` is a generated uuid distinct from `auth.users.id` (the bridge column is `public.users.auth_user_id`), the predicate can never match for any real user. Consequently, the userClient cannot SELECT, INSERT, or DELETE on `project_managers` — even for Directors. Frontend code that goes through this path silently returns 0 rows and does no I/O.

### Why it exists

The repository has a project-wide ambiguity between `auth.uid()` (= `auth.users.id`) and `public.users.id`. Several other policies use the correct `users.auth_user_id = auth.uid()` bridge (e.g. `accounting_invoices` at [supabase/full_schema.sql:11394-11396](../supabase/full_schema.sql)), but at least these three policies on `project_managers` use the broken `users.id = auth.uid()` form. The mistake likely dates to a copy-paste from a draft pattern and was never caught because Director-only project-manager management is rarely exercised through the userClient and the AI chat reads this table via the service role.

### Evidence

- [supabase/full_schema.sql:11641-11643](../supabase/full_schema.sql) (`Directors can create project manager assignments`):
  ```sql
  CREATE POLICY "Directors can create project manager assignments" ON public.project_managers FOR INSERT TO authenticated WITH CHECK ((EXISTS ( SELECT 1
     FROM public.users
    WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = 'Director'::text)))));
  ```
- [supabase/full_schema.sql:11668-11670](../supabase/full_schema.sql) (`Directors can delete project manager assignments`): same `users.id = ( SELECT auth.uid() AS uid)` predicate.
- [supabase/full_schema.sql:11731-11733](../supabase/full_schema.sql) (`Directors can view all project manager assignments`): same predicate.
- For comparison, the correct pattern (used by other tables): `users.auth_user_id = auth.uid()`. Quoted at [supabase/full_schema.sql:11394-11396](../supabase/full_schema.sql).
- `public.users.id` is `gen_random_uuid()` (per [supabase/full_schema.sql:6717-6725](../supabase/full_schema.sql)); `auth.users.id` is the Supabase Auth user UUID; the bridge column is `public.users.auth_user_id` with `UNIQUE` + FK to `auth.users(id)` ON DELETE CASCADE.

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

This bug was discovered during AI-chat schema reconnaissance (Phase 3.1). The AI chat path is unaffected because `_shared/auth.ts` reads `project_managers` via the service client. Fixing this on its own requires a forward-fix migration plus a frontend audit — appropriate for its own focused PR with verification steps, not folded into the AI-chat work.

### Cross-references

- [supabase/full_schema.sql](../supabase/full_schema.sql) lines 11641-11643, 11668-11670, 11731-11733
- [src/contexts/AuthContext.tsx](../src/contexts/AuthContext.tsx) lines 90-115 (`assignedProjects` reads `project_managers` via the standard client)
- [supabase/functions/_shared/auth.ts](../supabase/functions/_shared/auth.ts) (uses service client for the same lookup, unaffected)
- Discovered during AI chat plan, Phase 3.1 schema reconnaissance (May 2026)
