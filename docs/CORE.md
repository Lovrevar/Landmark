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
- `formatEuropean(value)` — formats a number using `hr-HR` locale with 2 decimal places (comma as decimal separator)
- `formatEuro(value)` — returns `€` prefix plus `formatEuropean(value)`
- Use these everywhere — do not inline number/currency formatting

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

### reportGenerator.ts
- `generateDirectorReport(projects)` — generates a multi-section PDF report for the Director profile covering all projects with financials, tasks, and subcontractors
- `generateProjectDetailReport(project)` — generates a detailed single-project PDF report
- `generateComprehensiveExecutiveReport()` — fetches all data from Supabase and generates a full executive-level PDF
- Loads NotoSans (via Google Fonts CDN) at the start of each export to support Croatian characters (š č ć đ ž); falls back to helvetica if the font fetch fails
- **Depends on:** jsPDF, date-fns, supabase client

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
