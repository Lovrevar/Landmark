---
paths:
  - "src/**/*.ts"
  - "src/**/*.tsx"
---

# Module layout and layer rules

Moved from the old root `.claude-code-rules`, which Claude Code never loaded. For the full
module map see [`docs/CODEBASE_INDEX.md`](../../docs/CODEBASE_INDEX.md); when in doubt, the
docs and the existing code are authoritative.

## Module structure

Each feature module under `src/components/[FeatureName]/` follows this layout. Not every module
has every folder — add one when it earns its place.

```
Module/
├── index.tsx       # Entry point / main view
├── types.ts        # Module-specific TypeScript types
├── components/     # Presentational sub-components
├── forms/          # Form modals for create/edit
├── modals/         # Detail/action modals
├── hooks/          # Data fetching and local state
└── services/       # Supabase queries and business logic
```

Feature directories are **PascalCase** (`Sales/`, `SalesProjects/`); the utility subdirectories
above are always **lowercase**.

## Layers

- **`services/`** — Supabase queries, business logic, data transformation, and the
  `logActivity()` calls that go with mutations. No JSX, no React hooks. Split by concern into
  several focused files (`siteService.ts`, `milestoneService.ts`) rather than one monolith —
  `src/components/Supervision/SiteManagement/` is the example
- **`hooks/`** — names start with `use`; state and calls to services. Hooks never import
  `supabase` directly (ESLint enforces it; realtime hooks are the listed exception)
- **`components/`, `index.tsx`** — presentational, props-driven, local UI state only. No
  Supabase calls, no business logic
- **`forms/`, `modals/`** — delegate data logic to services; no complex logic inline
- **`types.ts`** — module-local types. Shared types live in `src/types/`

## Module boundaries

- Never import from another feature module's internals (e.g. `../Sales/services/salesService`)
- Share through `src/lib/`, `src/utils/`, `src/types/` and `src/components/ui/`

## Import order

React → third-party → types → services → hooks → components.

## File size

~150–300 lines is a healthy target, not a gate — report/PDF builders and generated types
legitimately exceed it. Extract when a file does several unrelated jobs: a component making API
calls, a block over ~100 lines, UI or logic duplicated in 2+ places, 5+ `useState` calls in one
component, or ternaries nested more than 2 deep.
