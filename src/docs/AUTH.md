# Module: Auth

**Path:** `src/components/Auth/`

## Overview
Handles user authentication via Supabase Auth. Single entry point with login form.

## Files

| File | Purpose |
|---|---|
| `LoginForm.tsx` | Email/password login form, calls Supabase Auth |

## Global Auth State
Auth state (user, session, role) is managed globally in `src/contexts/AuthContext.tsx` — not inside this component folder.

## Related
- `src/contexts/AuthContext.tsx` — provides `useAuth()` hook consumed app-wide
- `src/utils/permissions.ts` — role checks derived from auth context
