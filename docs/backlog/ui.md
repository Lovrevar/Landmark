# Backlog — app-wide UI

Problems that repeat across modules: formatting, status display, failed loads, translations, the
shared component library, mobile and dark mode. Ids: `UI-n` (next free: `UI-12`). Entry format and
rules are in [README.md](./README.md).

A UI problem on one screen belongs in that module's file. It belongs here when the fix is a shared
helper or a sweep. Counts were measured on 2026-09-21 to 2026-09-23 and will have drifted; measure
again before starting a sweep. Check [../UI.md](../UI.md) before adding a primitive.

## Open

### UI-11 · Low · Amounts run past their card at laptop width on Budget Control and Companies
- **Check:** Confirmed in a browser at 1280×800 with the menu open (LandmarkDemo, 2026-10-12, while taking the help screenshots).
- **Where:** `MetricCard` at the bottom of `General/BudgetControl/index.tsx` (five summary cards); the "Izdano" / "Plaćeno" tiles in `Cashflow/Companies/index.tsx` (the `grid grid-cols-2 gap-3` inside each company card).
- **What happens:** an eight-digit amount (`€12.000.000,00`, `€3.318.750,00`) is drawn over its card's edge.
- **Cause:** both are hand-built cards with a fixed font size (`text-lg`, `text-sm`) around a string with no break point, and both pick their column count from the *window* width (`xl:grid-cols-5`, `lg:grid-cols-3`) although the open menu takes 256px of it. At 1280px that leaves about 150px for a figure that needs about 160px on Budget Control, and about 100px for one that needs about 108px on Companies. Neither uses `StatCard`, so neither has its shrink-then-wrap rule; UI-8 and CASH-21 fixed the same thing for `StatCard` and for phones only. Collapsing the menu, or a window of roughly 1400px and up, hides it.
- **Fix direction:** give both values the `.stat-card` container and `.stat-card__value` sizing from `index.css` (shrinks with the card, then wraps), or build them from `StatCard`. Moving the five-column step to `2xl` would only shift the width at which it happens.

### UI-10 · Low · Shell labels that disagree or are unused
- **Check:** Code reading (help-article audit, 2026-10-06)
- Menu label and page title differ on several pages (the help articles now name both).
- The Cashflow prompt says "Lozinka" and its error "Netočna šifra".
- Looks unused: `profiles.unlock`, `profiles.locked`, `profiles.select_profile` and some `nav.*`
  labels. Grep before deleting.
- English literals left on screen: "TBD", "Mixed", "Retail", "Site".

### UI-8 · Low · Mobile
- **Done** on `fix/mobile-pass-ui8` (2026-10-09), measured at 390px on 45 pages as Director and
  7 as Supervision: no page scrolls sideways and nothing is cut off any more. Fixed: the phase
  card header and the group rows on Site management, the work log cards, the Investment project
  cards, the calendar toolbar and the General report's project header (all pushed their right
  half off the card); the assistant's edit and regenerate buttons (hover-only); the calendar,
  which now opens on the agenda on a phone.
- **Left:** tap targets under 32px — the icon buttons on Documents (expand, open, paging; 43 on
  one screen) and the calendar's type chips and month arrows. Wide tables on desktop
  (Cashflow invoices, the TIC with phases) scroll inside their card by design.
- **How to re-measure:** load each page at 390px and look for elements whose right edge passes
  the viewport or a clipping ancestor; the page's own scroll container hides a plain
  `document.scrollWidth` check.

### UI-4 · Low · Failed loads that still read as "no data"
- **Done:** ~60 hook-shaped loaders expose `error` + `refetch` and render `ErrorState`; services
  throw; all silent mutations report. On `fix/failed-loads-ui4` (2026-10-08) the remaining inline
  loaders were fixed: 17 in 14 files, mostly dropdown lookups in form modals, now showing
  `InlineLoadError` with a retry (`common.list_load_error`); the Sales report and project details
  show `ErrorState` instead of an empty picker and "not found".
- **Left:** the full-page spinner on refetch on 9 Cashflow pages (the search box loses focus);
  the lookup in the unreachable `BankCreditFormModal` (CASH-15); the Projects list shows a failed
  load as an `Alert` (GEN-21).
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
- **Sign order (2026-10-06):** the shared euro helpers now print a negative as "−€1.234,56". The
  hand-built sites do not follow: about 59 that write "€" before `formatCurrency`, about 148 that
  write it before a bare `toLocaleString`, and 10 locale strings of the form `€{{amount}}` still
  print "€−…". Most never go negative; "Preostalo" after an overpayment can.

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
