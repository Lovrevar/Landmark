# Foundations

_Part of the [Cognilion Manual Testing Cheat Sheet](../TESTING.md). See that file for status markers and how to walk this document._

## Auth / Login

_Role: any. Profile: N/A (pre-login). Needs: valid demo credentials for at least one role, one disabled/non-existent email._

**Golden path**

- load `/` while logged out — login screen renders with email, password, Sign In button   (+)
- log in with valid credentials — redirects to `/` (or `/site-management` for Supervision role)   (+)

**Missing required fields**

- submit with both fields empty — HTML5 `required` blocks submit, no network request   (+)
- submit with email filled, password empty — blocked   (+)
- submit with password filled, email empty — blocked   (+)

**Invalid values**

- submit with a malformed email (e.g. `foo@`) — HTML5 `type=email` validation blocks submit   (+)
- submit with an unknown email — inline error "invalid credentials"   (+)
- submit with a known email + wrong password — inline error "invalid credentials"   (+)
- submit with trailing whitespace in email — verify it fails the same way (or is trimmed) consistently   (+)
- attempt SQL-like input in email (`' OR 1=1 --`) — inline error, nothing leaks   (+)
- attempt a very long password (500 chars) — error is handled, no crash   (+)

**Behaviour**

- while login request is in flight, the button shows `Signing in…` and is disabled   (+)
- after a failed login, the password field clears or stays — verify behaviour is consistent; no success flash   (+)
- successful login routes a Supervision-role user directly to `/site-management`, skipping the dashboard   (-)
- successful login routes all other roles to `/`   (+)

**Session persistence**

- after login, refresh the page — still logged in, lands on same route   (+)
- after login, close the tab and reopen — still logged in (Supabase session persistence)   (+)
- after login, open a second tab at `/` — second tab is also logged in   (+)

**Logout**

- click Logout in the top nav — returns to login screen, nav is gone   (+)
- after logout, refresh — still logged out   (+)
- after logout, second tab also logs out (or does on next action)   (+)
- after logout, clicking browser Back does not expose any authenticated screen   (+)

**Direct-URL access while logged out**

- visit `/accounting-invoices` while logged out — login screen shows, not the page   (+)
- visit a random unknown path like `/nope` while logged out — login screen shows   (+)

---

## Profile switcher

_Role: any except Supervision. Profile: starts at General. Needs: Cashflow password._

Six profiles: `General`, `Supervision`, `Sales`, `Funding`, `Cashflow` (lock icon), `Retail`.

**Visibility**

- log in as any role except Supervision — profile dropdown is visible in the top nav   (+)
- log in as Supervision — profile dropdown is **not** visible; only 4 menu items show   (+)
- click the dropdown — all 6 profiles are listed; Cashflow has a lock icon   (+)
- click outside the dropdown — it closes   (+)

**Switch between non-gated profiles**

- switch to General — menu updates, navigates to `/`   (+)
- switch to Sales — menu shows Apartments, Sales Projects, Customers, Payments, Reports   (+)
- switch to Funding — menu shows Investors, Investments, Projects, Payments, TIC   (+)
- switch to Retail — menu shows Projects, Land Plots, Customers, Retail Sales, Invoices, Reports   (+)
- switch to Supervision profile (as non-Supervision role) — menu shows supervision items   (+)

**Cashflow password gate**

- click Cashflow for the first time — password modal appears, password field autofocuses   (+)
- submit empty password — error or no-op, no unlock   (+)
- submit wrong password — inline red error "Wrong password"; password field stays   (+)
- submit correct password — modal closes, profile becomes Cashflow, menu updates, navigates to `/`   (+)
- press Esc or click Cancel in the password modal — modal closes; profile reverts to General if it had tried to land on Cashflow   (+)
- after unlocking, switch to General and back to Cashflow — **no** password prompt the second time in the same tab   (+)

**Cashflow unlock scope**

- after unlocking, refresh the page — Cashflow stays unlocked (sessionStorage persists in the tab)   (+)
- after unlocking, close the tab and reopen — Cashflow is locked again   (+)
- after unlocking in tab A, open tab B — tab B still requires the password (sessionStorage is per-tab)   (+)

**Direct-URL access to Cashflow routes without unlock**

- log in fresh, paste `/accounting-invoices` in the address bar — redirects to `/`   (+)
- same for `/accounting-payments`, `/accounting-banks`, `/debt-status`, `/accounting-approvals`   (+)
- unlock Cashflow, then paste `/accounting-invoices` — page loads   (+)

**Profile persistence**

- switch to Sales, refresh — still on Sales profile (stored in localStorage)   (+)
- log out, log back in — current profile is remembered across logout (localStorage is not cleared on logout) — note if this is unexpected   (+)

---

## Language switcher

_Role: any. Needs: one screen with known HR and EN labels (e.g. dashboard or invoices)._

The switcher is a single button in the top nav showing the **opposite** language code (HR or EN).

- button displays `HR` when current language is English and `EN` when current language is Croatian   (+)
- click the button — all visible labels swap language instantly; button label flips   (+)
- refresh the page — language preference is preserved   (+)
- log out and log in again — language preference persists (stored client-side)   (+)
- switch to each of the 6 profiles in both languages — nav menu labels all translate   ( )
- on login screen (logged out), language is applied but switcher is **not** shown — verify login labels respect the last-used language   (+)

**Croatian domain terms** (must NOT be translated, even with EN active)

- with EN active, open a payment detail — `cesija` and `kompenzacija` still read as-is   ( )
- with EN active, open a sales unit — `stan`, `garaža`, `repozitorij` still read as-is   ( )
- with EN active, open Funding TIC — `TIC` still reads as-is   ( )

---

## Layout & navigation

_Role: any. Profile: any._

**Top navigation bar**

- logo and "Cognilion" title are visible at top-left on every authenticated screen   (+)
- top-right shows: profile dropdown (hidden for Supervision), Chat icon, Tasks icon, Calendar icon, language switcher, theme toggle, Logout   (+)

**Sidebar**

- sidebar is expanded by default (width ~64 units)   (+)
- click the chevron on the sidebar edge — collapses to icon-only (~16 units)   (+)
- hover an icon while collapsed — label appears as a tooltip   (+)
- click the chevron again — expands back   (+ )
- active route is highlighted (blue text + blue-tinted background)   (+)
- click every item in the current profile's menu — each navigates without a full page reload   (+)

**Profile-specific menus** — verify correct items appear for each profile

- General: Dashboard, Projects, Budget Control, Reports, (+ Activity Log if Director)   (+)
- Supervision (profile): Dashboard, Site Management, Subcontractors, Work Logs, Payments, Invoices   (+)
- Supervision **role** (regardless of profile): only Site Management, Work Logs, Payments, Invoices — no Dashboard   (+)
- Sales: Dashboard, Apartments, Sales Projects, Customers, Payments, Reports   (+)
- Funding: Dashboard, Investors, Investments, Projects, Payments, TIC   (+)
- Cashflow: Dashboard, Invoices, Payments, Calendar, Suppliers, Office Suppliers, My Companies, Investments, Customers, Loans, Debt Status, Approvals   (+)
- Retail: Dashboard, Projects, Land Plots, Customers, Retail Sales, Invoices, Reports   (+)

**Activity Log visibility**

- log in as Director, General profile — "Activity Log" appears in the sidebar   (+)
- log in as any other role — "Activity Log" is hidden from the sidebar   (+)
- as non-Director, paste `/activity-log` in the URL — verify whether access is blocked or page renders (file a bug if a non-Director can view the log)   (+)

**Notification icons (header)**

- Chat icon — badge appears with count when unread messages exist, shows `99+` if >99, no badge when zero   ( )
- Tasks icon — same badge behaviour for unread task events   (+)
- Calendar icon — same badge behaviour for unread calendar events   (+)
- click each icon — navigates to the matching page and the icon turns blue (active state)   (+)

**Theme toggle**

- click moon icon — switches to dark theme; icon becomes sun   (+)
- click sun icon — switches back to light theme   (+)
- refresh — theme preference persists   (+)
- spot-check 3 screens in dark mode for readable contrast (no white-on-white text, modal backdrops visible)   (+)

**Unknown / 404 routes**

- visit `/does-not-exist` while logged in — redirects to `/`   (+)
- visit `/projects/00000000-0000-0000-0000-000000000000` (non-existent project) — verify graceful empty/error state, no crash   (+)

**Back/forward navigation**

- navigate A → B → C, press browser Back twice — returns to A without errors or stale data   ( )
- press browser Forward — returns forward without double-fetching errors   (+)

---

## Shared UI behaviours

_These primitives from [src/components/ui/](../../src/components/ui/) appear everywhere — test once here, trust elsewhere._

**Modal** (any Add/Edit modal)

- open, press Esc — closes without saving   ( )
- open, click the backdrop (dimmed area) — closes without saving   (+)
- open, click the X button — closes without saving   (+)
- open, click inside the modal — does **not** close   (+)
- open a modal on top of a modal (if any flow does this) — Esc closes the top one only   ( )

**ConfirmDialog** (any destructive action like Delete)

- trigger a delete — confirm dialog appears with clear Yes/No (or Confirm/Cancel) buttons   (+)
- click Cancel — dialog closes, nothing deleted   (+)
- press Esc — dialog closes, nothing deleted   (+)
- click Confirm — action runs, dialog closes, toast appears   (+)

**Toast** (any success or error notification)

- after a successful create/update/delete, a success toast appears top-right (or wherever the app puts it) and auto-dismisses within ~5 seconds   ( )
- after a failed action, an error toast appears with a clear message   ( )
- click the toast's close button (if present) — toast dismisses immediately   ( )
- trigger 3 actions in a row — toasts stack or replace without overlap or clipping   ( )

**Table** (any list view, e.g. Invoices, Suppliers)

- click a sortable column header — rows sort ascending; click again — sort descending; click again — unsorted (or toggles back)   (+)
- pagination: click next page, prev page, jump to last page — rows update, no duplicates, no blank page   (+)
- empty-state: filter down to zero rows — "no results" / EmptyState placeholder shows   (+)
- very wide table — horizontal scroll works without breaking the sidebar   (+)

**SearchInput**

- type quickly — input debounces and doesn't fire a query on every keystroke   (+)
- type a term that matches some rows — list narrows   (+)
- clear the field — full list returns   (+)
- type a term with Croatian diacritics (`Žaklina`) — matches rows with the same diacritics   (+)

**FilterBar / FilterBar combinations**

- apply one filter — list narrows correctly   (+)
- apply two filters — rows match **both** (AND logic)   (+)
- click "Clear all" (if present) — all filters reset, full list returns   (+)

**Pagination edge cases**

- page size change (if selectable) — rows update; page resets to 1   (+)
- land on page 5, apply a filter that reduces results to page 1 only — currently-shown page resets to 1, no empty page   (+)

**ColumnMenu / column toggle**

- hide two columns — table re-renders without them; no layout break   (+)
- refresh — column visibility persists (if persisted) OR resets (document which)   (+)
