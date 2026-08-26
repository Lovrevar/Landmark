# Module: Auth

**Path:** `src/components/Auth/`

## Overview

Handles user authentication via Supabase Auth. Single entry point offering two sign-in methods — email/password and Microsoft (Entra ID) — plus password reset. Global auth state lives in `src/contexts/AuthContext.tsx`.

## Components

### LoginForm.tsx
- Email/password login form that calls `login()` from AuthContext
- "Sign in with Microsoft" button that calls `loginWithMicrosoft()` (full-page redirect)
- Shows inline error on failed authentication, and the context's `authError`
  banner for failures that happen after the OAuth redirect returns
- **Uses hooks:** useAuth
- **Uses Ui:** (plain JSX with Tailwind, Lucide icons; inline `MicrosoftLogo` SVG)

## Microsoft (Entra ID) sign-in

`loginWithMicrosoft()` calls `supabase.auth.signInWithOAuth({ provider: 'azure' })`
and redirects to `window.location.origin`. `detectSessionInUrl` in
[src/lib/supabase.ts](../src/lib/supabase.ts) picks the tokens out of the return
URL and fires `SIGNED_IN`, which `handleAuthChange` handles like any other
session. A `sso_redirect_pending` sessionStorage marker survives the redirect so
the handler can log the `auth.login` activity and reset the profile — the work
`login()` does for the password path.

**Provisioning is link-only.** Signing in with Microsoft never creates an app
account. `handle_new_user()` (see
`supabase/migrations/20260825100000_sso_pre_provisioned_only.sql`) attaches a
non-email identity to a `public.users` row that an admin created in advance,
matched on email with `auth_user_id` still NULL. With no such row, no account is
created, `fetchUserData` finds nothing, and the client signs the session back out
with `auth.error_sso_not_provisioned`. To onboard someone:

```sql
INSERT INTO public.users (email, username, role)
VALUES ('ime.prezime@landmark.hr', 'ime.prezime', 'Sales');
```

Existing staff whose Microsoft address matches their password account are linked
by Supabase itself (verified-email identity linking) and keep the same
`auth_user_id`.

**Dashboard setup** — Authentication → Providers → Azure needs the Entra app's
client ID and secret, and an Azure URL scoped to the company tenant
(`https://login.microsoftonline.com/<tenant-id>`) so accounts outside the tenant
cannot reach the callback. Every app origin must be listed under Authentication
→ URL Configuration → Redirect URLs.

## Global Auth State

Auth state is managed globally in `src/contexts/AuthContext.tsx` — not inside this component folder.

## Related

- [src/contexts/AuthContext.tsx](../contexts/AuthContext.tsx) — provides `useAuth()` hook consumed app-wide
- [src/utils/permissions.ts](../utils/permissions.ts) — role-based access checks derived from auth context
