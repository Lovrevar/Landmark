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
- **Exports:** `AuthProvider`, `useAuth`, `User`, `Profile`, `ProjectAssignment` types
- **Depends on:** supabase client

---

## Hooks — `src/hooks/`

### useModalOverflow.ts
- `useModalOverflow(isOpen)` — locks/unlocks `document.body` scroll when a modal opens or closes
- `lockBodyScroll()` — sets `body.style.overflow = 'hidden'`
- `unlockBodyScroll()` — sets `body.style.overflow = 'unset'`

---

## Lib — `src/lib/`

### supabase.ts
- Exports the singleton Supabase client as `supabase` — import this everywhere, never instantiate a second client
- Also exports legacy shared types: `User`, `Profile`, `Project`, `Task`, `Invoice`, `Subcontractor`, `Contract`, `WirePayment`, `ApartmentPayment`, `Building`, `Garage`, `Repository`, `LinkedUnit`, `Apartment`, `TaskComment`, `Todo`, `WorkLog`, `SubcontractorComment`, `Customer`, `Sale`, `Lead`, `Bank`, `BankCredit`, `Investor`, `ProjectInvestment`, `ProjectPhase`, `ProjectMilestone`, `BankCreditPayment`, `InvestorPayment`, `SubcontractorMilestone`, `PaymentNotification`
- **Note:** Prefer module-specific types defined in each module's own `types.ts`. These legacy exports exist for backwards compatibility.

### activityLog.ts
- `logActivity(params)` — fire-and-forget audit logger. Inserts a row into `activity_logs` asynchronously. Never throws — failures go to `console.warn`.
- **Params:** `{ action, entity, entityId?, projectId?, metadata?, severity?, userId?, userRole? }`
- When `userId`/`userRole` are omitted, resolves them from the Supabase auth session internally
- `severity` is merged into `metadata.severity` — not a separate column
- **Call pattern:** Place immediately after a successful `supabase.from().insert/update/delete` call in service or hook files
- **Full documentation:** [`docs/ACTIVITY_LOG.md`](./ACTIVITY_LOG.md)
- **Depends on:** supabase client

---

## Types — `src/types/`

### investment.ts
- Shared TypeScript interfaces for the Funding/Investment module: `Project`, `Company`, `Bank`, `CreditAllocation`, `BankCredit`, `FinancialSummary`, `RecentActivity`
- Used by dashboard and funding views that need cross-module investment data

### retail.ts
- Shared TypeScript interfaces for the Retail module: `RetailLandPlot`, `RetailCustomer`, `RetailSale`, `RetailProject`, `RetailProjectPhase`, `RetailSupplierType`, `RetailSupplier`, `RetailContract`, `RetailContractMilestone`
- Composed types: `RetailLandPlotWithSales`, `RetailCustomerWithSales`, `RetailProjectWithPhases`, `RetailPhaseWithContracts`, `RetailContractWithMilestones`

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
