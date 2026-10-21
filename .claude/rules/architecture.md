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

## Business figures

- **A business figure (a total, a balance, a budget, EVM) is computed in one tested function in
  `src/lib` or `src/utils`. Screens and reports call it; they never re-derive it inline** — not in
  a service, a component, or a PDF or Excel builder. Why: a figure computed in three places gets
  fixed in one (GEN-2 fixed the portfolio's debt and left the project cards' — GEN-27)
- Before changing a figure, grep for the other places that compute it, and switch them to the
  shared function in the same change or log them with `/backlog`
- The figure modules so far, all in `src/utils/`: `salesFigures`, `fundingFigures`,
  `paymentFigures`, `paymentTotals`, `cashFlowFigures`, `invoiceFigures`, `constructionFigures`,
  `projectFigures`, `retailFigures`, `ticFigures`, `invoiceCashDirection`, `contractRollup`, `evm`.
  The TIC's own plan maths (`ticGrandTotal` and the rest) stays in
  `Funding/TIC/utils/ticBudget.ts`, which `ticFigures` and `evm` build on. Details:
  `docs/CORE.md` → Business figures
- A figure that has no answer (no revenue for a margin, nothing paid for CPI) returns an
  availability flag or `null` so the screen shows "—", never a 0 that reads as a measurement
  (`.claude/rules/testing.md`). The ratios moved out of the General report still return 0 —
  pinned, and logged as GEN-32

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
