# Module: Auth

**Path:** `src/components/Auth/`

## Overview

Handles user authentication via Supabase Auth. Single entry point with an email/password login form. Global auth state lives in `src/contexts/AuthContext.tsx`.

## Components

### LoginForm.tsx
- Email/password login form that calls `login()` from AuthContext
- Shows inline error on failed authentication
- **Uses hooks:** useAuth
- **Uses Ui:** (plain JSX with Tailwind, Lucide icons)

## Global Auth State

Auth state is managed globally in `src/contexts/AuthContext.tsx` — not inside this component folder.

## Related

- [src/contexts/AuthContext.tsx](../contexts/AuthContext.tsx) — provides `useAuth()` hook consumed app-wide
- [src/utils/permissions.ts](../utils/permissions.ts) — role-based access checks derived from auth context
