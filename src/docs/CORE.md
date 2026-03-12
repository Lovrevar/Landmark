# Module: Core

Covers `src/contexts/`, `src/hooks/`, `src/lib/`, `src/types/`, and `src/utils/`.

## Contexts — `src/contexts/`

| File | Purpose |
|---|---|
| `AuthContext.tsx` | Global auth state — provides `useAuth()` with current user, session, and role. Has active uncommitted changes. |

## Hooks — `src/hooks/`

| File | Purpose |
|---|---|
| `useModalOverflow.ts` | Prevents body scroll when a modal is open |

## Lib — `src/lib/`

| File | Purpose |
|---|---|
| `supabase.ts` | Supabase client singleton — import this everywhere, never instantiate a second client |
| `Cogni.png`, `CogniLion.png` | App logo assets |

> `lib/Deleted/` contains deprecated credit components. Do not use or restore.

## Types — `src/types/`

| File | Purpose |
|---|---|
| `investment.ts` | Shared TypeScript types for investment/funding data |
| `retail.ts` | Shared TypeScript types for retail data |

> Module-specific types live inside each module's own `types.ts`. Only truly cross-module types belong here.

## Utils — `src/utils/`

| File | Purpose |
|---|---|
| `formatters.ts` | Date, currency, and number formatting helpers — use these everywhere, do not inline format logic |
| `permissions.ts` | Role-based access checks derived from `AuthContext` |
| `excelParsers.ts` | Helpers for parsing Excel uploads (used by Sales bulk import) |
| `reportGenerator.ts` | Shared PDF generation utilities used by the Reports module |
