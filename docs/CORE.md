# Module: Core

Covers `src/contexts/`, `src/hooks/`, `src/lib/`, `src/types/`, and `src/utils/`.

---

## Contexts — `src/contexts/`

### AuthContext.tsx
- `AuthProvider` — wraps the app; initialises Supabase session on mount and subscribes to auth state changes
- `useAuth()` — returns the auth context; throws if used outside `AuthProvider`
- `login(email, password)` — calls `supabase.auth.signInWithPassword`, fetches the app user record, resets profile to `General`
- `logout()` — calls `supabase.auth.signOut`, clears `localStorage.currentProfile` and `sessionStorage.cashflow_unlocked`
- `hasProjectAccess(projectId)` — returns `true` for Directors unconditionally; for Supervision role checks against `assignedProjects`; returns `false` for all other roles
- `setCurrentProfile(profile)` — sets active profile and persists to `localStorage`
- Supervision users have their assigned projects fetched from `project_managers` table on login
- **Exports:** `AuthProvider`, `useAuth`, `User`, `Profile`, `ProjectAssignment`, `LoginErrorCode` types
- **Depends on:** supabase client

### ThemeContext.tsx
- `ThemeProvider` — light/dark theme state, persisted to `localStorage`
- `useTheme()` — returns the current theme and a setter

### ToastContext.tsx
- `ToastProvider` — app-wide toast queue mounted near the root
- `useToast()` — returns `{ toast, success, error, warning, dismiss }`. The returned object is memoised and referentially stable, so the helpers are safe in `useEffect` / `useCallback` dependency arrays
- Use this instead of `alert()`; see [`UI.md`](./UI.md) § Toast for usage
- **Exports:** `ToastVariant` (`info` | `success` | `warning` | `error`), `ToastItem` types

---

## Hooks — `src/hooks/`

### useModalOverflow.ts
- `useModalOverflow(isOpen)` — locks/unlocks `document.body` scroll when a modal opens or closes
- `lockBodyScroll()` — sets `body.style.overflow = 'hidden'`
- `unlockBodyScroll()` — sets `body.style.overflow = 'unset'`

### useMediaQuery.ts
- `useMediaQuery(query)` — subscribes to a `matchMedia` query and re-renders on change
- `useIsMobile()` / `useIsTabletUp()` / `useIsDesktop()` — the named breakpoints built on it
- Use these rather than duplicating breakpoint strings; the responsive-table card view keys off `useIsMobile()`

### useListPreferences.ts
- `useListPreferences(key, defaults)` — persists a list's view mode / sort / filter choice per user
- Backed by `localStorage`, keyed per list

### useAsyncExport.ts
- `useAsyncExport(fn)` — wraps a long-running export so the caller gets pending state and the button can disable itself
- Pairs with `yieldToUI()` in the PDF builders to keep the UI responsive

---

## Lib — `src/lib/`

### supabase.ts
- Exports the singleton Supabase client as `supabase` — import this everywhere, never instantiate a second client
- Configured with a **custom `storageKey: 'supabase.auth.token'`** — not the supabase-js default `sb-<ref>-auth-token`. Any browser-console snippet or external tool that reads the JWT out of `localStorage` must use this key
- Registers a `visibilitychange` listener that refreshes the session when the tab becomes visible again and the access token has under 60 s left. This is why a tab left open overnight does not come back to a dead session
- Also exports legacy shared types: `Project`, `Task`, `Invoice`, `Subcontractor`, `Contract`, `WirePayment`, `ApartmentPayment`, `Building`, `Garage`, `Repository`, `LinkedUnit`, `Apartment`, `TaskComment`, `Todo`, `WorkLog`, `SubcontractorComment`, `Customer`, `Sale`, `Lead`, `Bank`, `BankCredit`, `Investor`, `ProjectInvestment`, `ProjectPhase`, `ProjectMilestone`, `BankCreditPayment`, `InvestorPayment`, `SubcontractorMilestone`, `PaymentNotification`
- **Note:** Prefer module-specific types defined in each module's own `types.ts`. These legacy exports exist for backwards compatibility. `User` and `Profile` are **not** here — they live in `AuthContext.tsx`.

### activityLog.ts
- `logActivity(params)` — fire-and-forget audit logger. Inserts a row into `activity_logs` asynchronously. Never throws — failures go to `console.warn`.
- **Params:** `{ action, entity, entityId?, projectId?, metadata?, severity?, userId?, userRole? }`
- When `userId`/`userRole` are omitted, resolves them from the Supabase auth session internally
- `severity` is merged into `metadata.severity` — not a separate column
- **Call pattern:** Place immediately after a successful `supabase.from().insert/update/delete` call in service or hook files
- **Full documentation:** [`docs/ACTIVITY_LOG.md`](./ACTIVITY_LOG.md)
- **Depends on:** supabase client

### useCachedData.ts
- `useCachedData(key, fetcher, ttl)` — TTL-cached fetch hook; every dashboard reads through it
- Returns `{ data, loading, error }`. **Always render the `error` state** — the hook used to swallow fetch failures and leave dashboards showing zeros, which is indistinguishable from "this company genuinely has no revenue" (DASH-003 in [`DASHBOARD_AUDIT.md`](./DASHBOARD_AUDIT.md)). `DashboardError.tsx` is the shared renderer
- `invalidateCachedData(predicate?)` — drops matching cache entries after a mutation
- Lives in `src/lib/`, not `src/hooks/`, despite being a hook

### featureFlags.ts
- Compile-time switches for work that is merged but not released. Plain constants, deliberately not `VITE_*` env vars: each guards code whose database side is not applied anywhere, so turning one on has to be a code change shipped with its migrations
- `ERP_INTEGRATION_ENABLED` (`false`) — hides the Šifrarnici and ERP import routes and their Cashflow menu entries. Read by `App.tsx` and `Common/Layout.tsx`. See [`erp-integration/PROGRESS.md`](./erp-integration/PROGRESS.md) → "On hold" before changing it

### dbErrors.ts
- `isForeignKeyViolation(error)` — tells a Postgres FK violation (`23503`) apart from other Supabase errors, so a delete blocked by dependent rows can show a useful message instead of a generic failure

---

## Types — `src/types/`

### investment.ts
- Shared TypeScript interfaces for the Funding/Investment module: `Project`, `Company`, `Bank`, `CreditAllocation`, `BankCredit`, `FinancialSummary`, `RecentActivity`
- Used by dashboard and funding views that need cross-module investment data

### retail.ts
- Shared TypeScript interfaces for the Retail module: `RetailLandPlot`, `RetailCustomer`, `RetailSale`, `RetailProject`, `RetailProjectPhase`, `RetailSupplierType`, `RetailSupplier`, `RetailContract`, `RetailContractMilestone`
- Composed types: `RetailLandPlotWithSales`, `RetailCustomerWithSales`, `RetailProjectWithPhases`, `RetailPhaseWithContracts`, `RetailContractWithMilestones`

### database.ts
- Supabase-generated types for the whole schema — both `public` and the `erp` schema
- Regenerate with `npm run db:types` (writes here and mirrors the file into `supabase/functions/_shared/database.ts`). **Never hand-edit**
- Exports the `Database` type plus the `Tables` / `TablesInsert` / `TablesUpdate` / `Enums` helpers

### tasks.ts
- Shared task types: `Task`, `TaskUser`, `TaskActor`, `TaskAssignee`, `TaskAttachment`, `TaskDescriptionFormat`
- Shared with the standalone mobile task app's schema — see [`TASKS.md`](./TASKS.md)

### chat.ts
- Shared chat types: `ChatUser`, `ChatConversation`, `ChatParticipant`, `ChatMessage`

### aiChat.ts
- AI chat SSE event taxonomy, the `AiChatHttpError` class, attachment types (`AttachmentKind`, `AiAttachmentRow`), and the `create_document` spec types (`DocumentFormat`, `DocumentSheet`)

> Module-specific types live inside each module's own `types.ts`. Only truly cross-module types belong here.

---

## Utils — `src/utils/`

### formatters.ts
- `formatFileSize(bytes)` — returns human-readable file size string (B / KB / MB)
- `formatEuropean(value)` — `hr-HR` number, always 2 decimals, no symbol: `1.234,56`. Use when the `€` is supplied separately, e.g. it already sits inside a translated string
- `formatEuro(value)` — `€1.234,56`. **Exact cents**: invoices, contracts, payments, per-record amounts
- `formatEuroRounded(value)` — `€1.235`. **Aggregates**, where cents are noise (phase and group rollups, yearly totals). Also cures the ragged `toLocaleString('hr-HR')` output, where a whole number renders `73.125` but a fractional one renders `1.425.597,5`
- `formatEuroCompact(value)` — `€1,2M` / `€45K` / `€9.500`. **Dashboard tiles and chart axes only.** Thousands start at 10.000, so a five-figure amount keeps its digits; every screen used to divide by a million itself, which rendered €45.000 as `€0.0M`
- All four accept `number | null | undefined` and render `—` (`NO_VALUE`) for a missing value or `NaN`. A budget that was never set must never read as €0
- **`€` goes first** — `€1.234,56`, not `1.234,56 €`. `Intl` with `style: 'currency'` emits the suffix form, so don't use it; the module-local formatters that did now delegate to these helpers
- Use these everywhere — do not inline number/currency formatting
- **PDF exception:** `hr-HR` renders the minus as U+2212, which is outside WinAnsi and garbles a whole string in jsPDF built-in fonts. PDF generators swap it for an ASCII hyphen (see `docs/REPORTS.md`) or embed a Unicode font

**Dates (same file).** 74 call sites formatted with `'MMM dd, yyyy'` and no locale, so a Croatian UI
read "Jan 05, 2026".
- `formatDate(value, language)` — `05.01.2026.` / `Jan 05, 2026`. The trailing dot is the Croatian
  convention (date-fns' own `hr` locale and `supabase/functions/_shared/prompts.ts:73` both use it)
- `formatDateTime(value, language)` — adds `HH:mm`, for timestamps
- `formatMonthYear(value, language)` — `siječanj 2026.` / `Jan 2026`. Croatian uses the **standalone**
  month (`LLLL`, "siječanj"); `MMMM` yields the genitive "siječnja", which reads wrong in a label
- `formatDayMonth(value, language)` — `05.01.` / `Jan 05`
- All four take the language explicitly (`i18n.language` in a component) rather than reaching for
  i18n, so they stay pure and callable from services, and all render `—` for a missing or
  unparseable value
- A **string** argument is parsed as a *date-only* value through `parseLocalDate` — a `date` column
  through `new Date()` is UTC midnight and renders as the previous day in Croatia. Pass a `Date`
  where the time of day matters
- `'yyyy-MM-dd'` values written to the database, query bounds and file names are machine data and
  stay as they are

### locale.ts
- `isCroatian(language)` / `appLanguage(language)` / `intlLocale(language)` — one answer to "which
  language is the UI in"
- Fourteen components carried `i18n.language === 'hr' ? 'hr-HR' : 'en-US'`. That test is **false for
  `'hr-HR'`**, which is what the detector returns for a Croatian browser with nothing in
  localStorage — so those users read an English calendar. `src/i18n.ts` now sets `supportedLngs` and
  `load: 'languageOnly'` so the detector returns a bare `'hr'`; these helpers are the second line of
  defence and the single place to touch if a third language is added
- `appLanguage` falls back to Croatian for an unknown language, mirroring what `fallbackLng: 'hr'`
  does to the strings on the same screen

### statusDisplay.ts
- `PROJECT_STATUS`, `CONTRACT_STATUS`, `RETAIL_CONTRACT_STATUS`, `RETAIL_PHASE_STATUS`,
  `UNIT_STATUS`, `MILESTONE_STATUS`, `RETAIL_MILESTONE_STATUS`, `RISK_LEVEL` — one label key and one
  badge colour per database status, read with `statusVariant(map, value)` /
  `statusLabel(map, value, t)`
- Same shape as `Cashflow/services/invoiceHelpers.ts` (invoice status) and
  `Funding/Investors/utils/creditStatus.ts` (credits), which stay where they are
- The problem it replaces: a project "On Hold" was yellow, grey, red and orange on four different
  screens, and all eleven sites printed the raw English column value in a Croatian UI
- **The stored value is English and CHECK-constrained — map at render time only.** `UnitsGrid` and
  `ApartmentDetailsModal` compare against `'Sold'` / `'Available'` / `'Reserved'` and write them
  back; those comparisons stay English
- An unknown value keeps its raw text in a grey badge rather than disappearing
- The test asserts each map covers exactly its CHECK values and that every key exists in both locales

### contractRollup.ts
- `rollupContracts(rows)` / `remainingBudget(budget, rollup)` — the contract totals behind a phase card: contracted value, paid, unpaid, and unpaid-without-contract, then budget headroom
- Takes a neutral row (`hasContract` / `cost` / `paid` / `owed`), so Supervision and Retail map their own columns onto it instead of keeping two copies of the arithmetic

### contractVariance.ts
- `contractVariance({ contracted, paid, settled })` → `{ kind: 'none' } | { kind: 'overrun', amount } | { kind: 'saving', amount }` — what one contract's payments say about its price. **Overrun** when paid exceeds contracted (at any time); **saving** only when the caller says the contract is `settled` and it closed below its value; otherwise **none**, and the caller renders no row — an open, part-paid contract has nothing to report that "Remaining" doesn't already say
- Replaces the "Gain/Loss" rows (paid − contracted with the sign inverted) on Supervision's `ContractCard` and `SubcontractorDetailsModal` and Retail's `PhaseCard`. Each caller defines `settled` for its own rows
- Compares in whole cents, so floating-point noise from summing payments (`0.1 + 0.2`) is neither an overrun nor a saving, and amounts come back cent-rounded. `contracted <= 0` (no contract amount) or a non-number is always `none`
- Both amounts must be in the same unit — compare gross with gross. Comparing gross payments against a net `base_amount` is what made every fully-paid subcontractor contract show a 25% overrun
- Pure; covered by `contractVariance.test.ts`

### errorMessage.ts (`src/lib/`)
- `toErrorMessage(error, fallback)` — the sentence to show a user for a rejected promise. Prefers a message written for people (a service's own "Ne možete obrisati faze koje imaju ugovore: …"), and falls back to the caller's translated string when the error is machine text (`violates … constraint`, a bare `PGRST301`) or an RLS refusal
- `isPermissionError(error)` — Postgres `42501`
- Pair with `isForeignKeyViolation` from `src/lib/dbErrors.ts`

### Data-loading hook contract
- A loader hook returns `error: Error | null` alongside its data and a `refetch` (add `refetch` as an alias where the loader is already exported under another name)
- A service must **throw** on a failed query — never `return []`. An empty array below the hook makes the failure invisible to everything above it, and the page then says "no rows"
- Rendering rule: see `ErrorState` in [UI.md](./UI.md)

### permissions.ts
- `canManagePayments(user)` — true for Director, Accounting, Investment
- `canViewAllProjects(user)` — true for Director, Accounting, Investment, Sales
- `canManageSubcontractors(user)` — true for Director, Supervision
- `canManageWorkLogs(user)` — true for Director, Supervision
- `canManageProjectPhases(user)` — true for Director only
- `isSupervisionRole(user)` — true if role is Supervision
- `isDirectorRole(user)` — true if role is Director
- `canViewActivityLog(user)` — alias for `isDirectorRole`; the activity log is Director-only
- `getAccessibleProjectIds(user)` — returns `[]` for roles with full access; returns assigned project IDs for Supervision; returns `[]` for others
- **Depends on:** AuthContext User type

### evm.ts
- `calculatePhaseEVM(plannedBudget, physicalCompletionPct, startDate, endDate, actualCost)` — computes PV, EV, AC, CPI, SPI, CV, SV, EAC, VAC for a single phase using standard EVM formulas
- `calculateProjectEVM(phases, contracts)` — aggregates phase-level EVM across all phases of a project; derives `physicalCompletionPct` from `budget_realized / contract_amount` per phase; maps `Phase.budget_allocated → plannedBudget`, `Phase.start_date / end_date → planned dates`
- **Returns:** `EVMMetrics` (`PV`, `EV`, `AC`, `CPI`, `SPI`, `CV`, `SV`, `EAC`, `VAC`)
- **Used by:** `BudgetControl/hooks/useBudgetControl.ts`
- **Depends on:** `Phase`, `ContractWithDetails` from `General/Projects/types.ts`

### excelParsers.ts
- `parseNumber(value)` — parses a number from an Excel cell, handles European format (e.g. `"3.000,00"`)
- `parseDate(value)` — parses a date from an Excel cell; handles Excel serial numbers, `DD.MM.YYYY` strings, and ISO strings
- `detectPaymentType(row)` — detects payment type for apartment import rows from column positions (V–Y = installments, Z = credit)
- Used by the Sales bulk apartment import feature

### vatCalculations.ts
- `CROATIAN_VAT_RATES` — the four slots (25 / 13 / 5 / 0 %) a Croatian invoice can mix
- `calculateVatBreakdown(...)` — the 4-slot multi-VAT engine; null-safe, and holds the invariant that the total equals the sum of the per-slot subtotals
- Unit-tested in `vatCalculations.test.ts` — change the invariant and the tests fail loudly, which is the point

### dateOnly.ts
- `parseLocalDate(str)` — builds `new Date(y, m-1, d)` so a SQL `date` column is not parsed as UTC midnight
- `monthKey(str)` — `YYYY-MM` bucket key; `daysFromToday(str)`; `isValidDate(str)`; `startOfTodayLocal()`
- **Use these for every date-only column.** `new Date('2026-09-01')` parses as UTC and compares wrong against a local `new Date()` — Croatia is UTC+1/+2, so month buckets and overdue detection drift by a day at boundaries. Added during the June 2026 dashboard audit (see [`DASHBOARD_AUDIT.md`](./DASHBOARD_AUDIT.md) DASH-001)

### pdfFont.ts
- `loadUnicodeFont(doc)` — loads NotoSans into a jsPDF document so Croatian diacritics (š č ć đ ž) render instead of turning into boxes
- Falls back to helvetica if the font fetch fails

### yieldToUI.ts
- `yieldToUI()` — awaits the next macrotask, so a long PDF-builder loop can hand the main thread back and keep the UI responsive
- Pairs with `useAsyncExport` for the pending state
