# Security Backlog

> **Archived 2026-10-05 — do not update.** This is the record of what was found and how it was fixed. Everything still open was carried over to [../security.md](../security.md), which now holds SEC-001, SEC-002 and SEC-004 in full. Only the resolved SEC-003 remains here.

This file is a persistent, in-repo record of known security limitations that have been triaged and **accepted as not-yet-fixed**. Each entry is meant to give a future maintainer enough context to pick the work up cold: what the issue is, why it exists, why it hasn't been fixed yet, and what a fix would look like. Entries here are not fresh bugs — fresh bugs go in the issue tracker. An item lands here only after we've decided to live with it (with eyes open) until a focused initiative addresses it.

## Format

Each entry uses the heading `## SEC-NNN: <one-line title>` followed by a metadata block (`**Status:**`, `**Severity:**`, `**Filed:**`, optional `**Affected components:**`) and one or more of these subsections: `### Summary`, `### Why it exists`, `### Evidence`, `### Threat model`, `### Mitigations in place`, `### Proposed fix`, `### Why it isn't fixed yet`, `### Cross-references`. Short stub entries may use just `### Summary` and `### Cross-references`. Severity values: **Critical / High / Medium / Low** (UX-only issues that have been classified as security-adjacent should say `Low (UX, not security)`).

---


## SEC-003: RLS policies on project_managers compare wrong UUID columns

**Status:** Resolved — not present in applied schema (verified 2026-05-29)
**Severity:** Medium
**Filed:** 2026-05-08
**Resolved:** 2026-05-29
**Affected components:** RLS policies on `public.project_managers`, all frontend code that reads or writes `project_managers` via the standard supabase-js userClient

### Resolution (2026-05-29)

This bug is **not present in the schema that is actually applied to the database**. The evidence below was sourced from `supabase/full_schema.sql`, a reconnaissance dump committed 2026-05-12 (during the AI-chat work) and **removed 2026-05-29** (see note below). The authoritative applied state is the consolidated baseline [supabase/migrations/00000000000000_baseline_schema.sql](../../../supabase/migrations/00000000000000_baseline_schema.sql), committed **2026-05-15** — three days *after* the dump — under "Migration history reconciliation: baseline + neuter historical".

All four `project_managers` policies in the baseline use the **correct** `users.auth_user_id = auth.uid()` bridge:

- `Directors can create project manager assignments` — baseline line 8604 — `users.auth_user_id = ( SELECT auth.uid() AS uid)`
- `Directors can delete project manager assignments` — baseline line 8631 — same
- `Directors can view all project manager assignments` — baseline line 8694 — same
- `Supervision users can view their own assignments` — baseline line 9166 — `user_id IN ( SELECT users.id FROM users WHERE users.auth_user_id = auth.uid())`

End-to-end check: the Supervision self-view policy aligns exactly with the frontend query in [src/contexts/AuthContext.tsx:90-100](../../../src/contexts/AuthContext.tsx) (`.eq('user_id', data.id)` where `data.id` is `public.users.id`), so Supervision users' `assignedProjects` is correctly populated. No migration is required.

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
- **In scope:** functional breakage. Any frontend feature that lets Directors view, assign, or delete project_manager rows via the standard supabase client will silently do nothing. Users see empty UI states with no error message. If `AuthContext.fetchUserData()` falls under this policy at runtime (it queries `project_managers` with the standard client at [src/contexts/AuthContext.tsx:90-115](../../../src/contexts/AuthContext.tsx)), Supervision users may not see their own assignments — worth empirical confirmation against the live deployment.

### Mitigations in place

- The AI chat edge function uses the **service client** for `project_managers` lookups in [supabase/functions/_shared/auth.ts](../../../supabase/functions/_shared/auth.ts). The service role bypasses RLS, so the AI chat (specifically the resolution of Supervision users' `assignedProjects`) is unaffected by this bug.
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

**Resolved 2026-05-29:** `supabase/full_schema.sql` was deleted in favour of the baseline migration (the single source of truth), and the one stale code reference to it was fixed ([supabase/functions/_shared/tool-handlers.ts](../../../supabase/functions/_shared/tool-handlers.ts) now cites the policy by name instead of `full_schema.sql:12000`). For a readable full-schema reference, regenerate from the linked DB on demand (`supabase db dump`); do not re-commit a static copy that can drift out of sync again.

### Cross-references

- [supabase/migrations/00000000000000_baseline_schema.sql](../../../supabase/migrations/00000000000000_baseline_schema.sql) lines 8604, 8631, 8694, 9166 (the **correct**, applied policies)
- [src/contexts/AuthContext.tsx](../../../src/contexts/AuthContext.tsx) lines 90-115 (`assignedProjects` reads `project_managers` via the standard client — verified consistent with the applied Supervision policy)
- [supabase/functions/_shared/auth.ts](../../../supabase/functions/_shared/auth.ts) (uses service client for the same lookup, independently unaffected)
- `supabase/full_schema.sql` lines 11641-11643, 11668-11670, 11731-11733 (the **stale dump** where the phantom bug appeared — file removed 2026-05-29)
- Discovered during AI chat plan, Phase 3.1 schema reconnaissance (May 2026); verified resolved 2026-05-29

---

