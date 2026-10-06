# Backlog — app-wide UI

Problems that repeat across modules: formatting, status display, failed loads, translations, the
shared component library, mobile and dark mode. Ids: `UI-n` (next free: `UI-11`). Entry format and
rules are in [README.md](./README.md).

A UI problem on one screen belongs in that module's file. It belongs here when the fix is a shared
helper or a sweep. Counts were measured on 2026-09-21 to 2026-09-23 and will have drifted; measure
again before starting a sweep. Check [../UI.md](../UI.md) before adding a primitive.

## Open

### UI-10 · Low · Shell labels that disagree or are unused
- **Check:** Code reading (help-article audit, 2026-10-06)
- Menu label and page title differ on several pages (the help articles now name both).
- The Cashflow prompt says "Lozinka" and its error "Netočna šifra".
- Looks unused: `profiles.unlock`, `profiles.locked`, `profiles.select_profile` and some `nav.*`
  labels. Grep before deleting.
- English literals left on screen: "TBD", "Mixed", "Retail", "Site".
- The assistant only boosts articles for `/site-management`, not for a project opened inside it
  (`routeLabels.ts`), and the page help link there finds no article for the same reason.

### UI-8 · Medium · Mobile
- Non-wrapping header rows in Supervision, which is used on phones on site.
- Hover-only actions (AI chat edit and regenerate, and others) cannot be reached by touch.
- The Cashflow invoice table is 1400px wide.
- Calendar opens on the month view on phones.

### UI-4 · Medium · Failed loads that still read as "no data"
- **Done:** ~60 hook-shaped loaders expose `error` + `refetch` and render `ErrorState`; services
  throw; all silent mutations report.
- **Left:** ~39 `load`/`fetch` functions written inline in 33 `.tsx` files, 12 silent
  `.catch(() => set…([]))` fallbacks, and the full-page spinner on refetch on 9 Cashflow pages
  (the search box loses focus).
- **Rule:** never render zeros or an empty state on a failed load.

### UI-3 · Medium · Status colours and labels
- **Done:** `utils/statusDisplay.ts` holds project, contract, retail contract, retail phase, unit,
  milestone, retail milestone and risk level, each with one label key and one colour.
- **Left:** per-screen colour choices inside Cashflow that no shared map covers, and ~16 Croatian
  literal maps in `invoiceHelpers` / `paymentHelpers` (see CASH-18 in
  [cashflow.md](./cashflow.md)).

### UI-1 · Low · Money formatting
- **Done:** shared helpers cover exact cents, aggregates and compact tiles; every `en-US`,
  browser-locale, `$`, `€0.0M` and `€`-suffix render is gone.
- **Left:** ~256 hand-rolled `toLocaleString('hr-HR')` money renders in 68 files (ragged
  decimals), and 74 `DollarSign` icons in 29 files outside Reports and dashboards.
- **Fix direction:** `formatEuro` / `formatEuroRounded` / `formatEuroCompact` from
  `utils/formatters.ts`.

### UI-5 · Low · Hardcoded strings
- **Done:** the English strings on screen, in every module and the shell.
- **Left:** ~93 Croatian literals that belong in the locale files; ~420 literals in the export
  generators (PDFs ignore the UI language); TimelineColumn's "+N more"; English placeholders and
  no language switcher on the login form; several shell strings. AiChat's 36 are Croatian-only by
  a documented decision.
- **Rule:** follow the i18n rules in CLAUDE.md; ask before translating anything ambiguous.

### UI-2 · Low · Dates in exports and inputs
- **Done:** every date on screen goes through `formatDate` / `formatDateTime` /
  `formatMonthYear`, with a Vitest guard.
- **Left:** the three PDF generators and the CSV headers (policy in
  [../REPORTS.md](../REPORTS.md)), `DateInput`'s third format (`DD/MM/YYYY`), and 59 native
  `type="date"` inputs.

### UI-9 · Low · Dark-mode contrast
- 441 lines carry a `-600` accent with no `dark:text-` of their own (~230 sit beside a sibling
  branch that has one). Worst: Cashflow 71, dashboards 68, Funding 65, Sales 62, Retail 53.

### UI-7 · Low · Hand-rolled primitives
- ~60 KPI tiles instead of `StatCard`; ~12 raw tables with no mobile view; six dashboards each
  hand-roll their header and grid; four modal-footer styles; "Export PDF" styled as a red danger
  button in three places.

### UI-6 · Low · Shared library props that do nothing
- `Alert` ignores `onClose`; `StatCard` ignores `trend`; `DateInput` ignores `min` / `max`.
- **Fix direction:** implement the props or remove them.
