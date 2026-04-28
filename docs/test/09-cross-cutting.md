# Cross-cutting

_Part of the [Cognilion Manual Testing Cheat Sheet](../TESTING.md). See that file for status markers and how to walk this document._

_Preconditions: one test account per role (Director, Accounting, Sales, Supervision, Investment) with realistic seed data across every module. A Supervision user should have at least one `assignedProjects` entry so project scoping can be verified._

## Permissions matrix (sampled)

Marker legend: `✓` full access · `partial` limited to certain screens / row-level scoping · `✗` hidden or redirected. Based on [src/utils/permissions.ts](../../src/utils/permissions.ts) and the profile-route guards in [src/App.tsx](../../src/App.tsx). One representative action per cell — confirm on staging; update if roles diverge from the code.

| Module / Action | Director | Accounting | Sales | Supervision | Investment |
|---|---|---|---|---|---|
| Login                                                   | ✓       | ✓         | ✓     | ✓           | ✓          |
| Cashflow profile (password-gated)                       | ✓       | ✓         | partial | partial    | partial    |
| `canManagePayments` (Cashflow Payments CRUD)            | ✓       | ✓         | ✗     | ✗           | ✓          |
| `canViewAllProjects` (see every project)                | ✓       | ✓         | ✓     | partial *(assigned only)* | ✓ |
| `canManageSubcontractors` / `canManageWorkLogs`         | ✓       | ✗         | ✗     | ✓           | ✗          |
| `canManageProjectPhases` (Supervision phase setup)      | ✓       | ✗         | ✗     | ✗           | ✗          |
| `canViewActivityLog` (Activity Log `/activity-log`)     | ✓       | ✗         | ✗     | ✗           | ✗          |
| Funding (investors / credits / TIC)                     | ✓       | ✓         | ✗     | ✗           | ✓          |
| Sales (apartments / CRM / payments)                     | ✓       | ✓         | ✓     | ✗           | partial    |
| Retail (projects / land plots / invoices)               | ✓       | ✓         | partial | ✗         | partial    |
| Supervision dashboard (auto-redirect to `/site-management`) | partial | partial | partial | ✓ *(forced)* | partial |
| Chat / Tasks / Calendar                                 | ✓       | ✓         | ✓     | ✓           | ✓          |
| Reports (PDF/Excel export)                              | ✓       | ✓         | partial | partial   | partial    |

Verify these spot-checks per role:

```
Sales user tries to navigate to /activity-log → redirected to / (canViewActivityLog=false)    ( )
Supervision user lands on / → auto-redirects to /site-management                              ( )
Supervision user opens /projects list → sees only projects in assignedProjects                ( )
Accounting user opens /tic → can view & edit (Funding granted)                                ( )
Sales user opens Funding menu → Funding profile absent or routes redirect to /                ( )
Accounting / Sales / Supervision / Investment user opens /activity-log → redirected to /      ( )
Investment user opens /funding-payments → can create a payment                                ( )
Supervision user opens /accounting-invoices after Cashflow password prompt → unlock respects role ( )
Director user opens every sidebar item across all 6 profiles → no "forbidden" toasts surface  ( )
revoke a user's role in DB mid-session → next protected action requires re-login / silent fail is acceptable ( )
```

## Activity Log verification sweep

_Director account on a staging env with a recent clean slate. After each mutation, open `/activity-log`, filter by the entity, and confirm the row matches the expected `action` string and `severity` from [CLAUDE.md](../../CLAUDE.md) + [src/lib/activityLog.ts](../../src/lib/activityLog.ts)._

```
create invoice (multi-VAT)          → action=invoice.create            severity=medium  ( )
delete invoice                      → action=invoice.delete            severity=high    ( )
record payment (cesija)             → action=payment.create            severity=medium  ( )
bulk-update apartment prices        → action=apartment.bulk_price_update severity=high  ( )
import garages from Excel           → action=garage.import             severity=high    ( )
create subcontractor contract       → action=contract.create           severity=medium  ( )
delete work log                     → action=work_log.delete           severity=high    ( )
create bank credit allocation       → action=credit_allocation.create  severity=medium  ( )
create calendar event with participants → action=calendar_event.create severity=medium  ( )
create chat conversation (1:1)      → action=conversation.create       severity=medium  ( )
```

For each logged row also verify:

```
User column shows correct username + role badge                                               ( )
Entity column is truncated ID; "View Entity" button navigates via ENTITY_ROUTE_MAP            ( )
metadata JSON contains expected keys (entity_name for creates, changed_fields for updates, count for bulk) ( )
filter by category prefix (e.g. "invoice") returns only invoice.* rows                        ( )
filter by severity=high returns only high-severity rows                                       ( )
date-range filter excludes rows outside the range                                             ( )
search debounces ~500 ms and resets pagination to page 1 on change                            ( )
message sends (chat) produce NO activity rows (intentional silence)                           ( )
task / task-comment mutations produce NO activity rows (intentional silence)                   ( )
```

## i18n sweep

_Switch language via the header switcher; verify persistence via reload (language preference stored by i18next)._

```
switch to HR → reload → HR persists                                                           ( )
switch to EN → reload → EN persists                                                           ( )
clear localStorage → language falls back to browser locale (or project default)               ( )
Croatian domain terms stay untranslated in both languages: cesija, kompenzacija, stan, garaža, repozitorij, TIC, OIB ( )
```

Spot-check screens for hardcoded strings (5 per language). Walk with HR active and note any English text; repeat with EN and note any Croatian text:

```
/ (Director dashboard)                                                                        ( )
/accounting-invoices (Cashflow Invoices list + InvoiceFormModal opened)                       ( )
/sales-projects → building detail → unit grid                                                 ( )
/site-management → project detail (tabs, PhaseSetupModal, SubcontractorFormModal)             ( )
/tic (TIC grid + save/export buttons + toast messages)                                        ( )
/activity-log (filters, table headers, detail modal)                                          ( )
/calendar (month grid day-of-week headers, NewEventModal, EventDetailModal)                   ( )
/chat (NewConversationModal, composer placeholder, FILE_TOO_LARGE error toast)                ( )
/tasks (tabs, NewTaskModal, TaskDetailModal)                                                  ( )
any PDF/Excel export (Retail Reports uses Noto Sans; verify čćšđž render correctly)           ( )
```

## Release smoke list (run after every deploy)

_Walk top to bottom on staging with a Director account unless noted. Target time: ~20 min. Any failure here blocks the release._

```
 1. login with valid credentials → lands on Dashboard                                         ( )
 2. switch profile Cashflow → enter correct password → unlock persists for the session        ( )
 3. switch profile Cashflow → wrong password → stays locked, no redirect                       ( )
 4. switch language HR → EN → HR and reload → persists                                         ( )
 5. create a Cashflow invoice (single VAT, all fields) → saves and appears in list             ( )
 6. record a standard payment against that invoice → remaining balance updates                 ( )
 7. create a cesija payment (three parties) → saves; cross-company row appears                 ( )
 8. run Approvals bulk-hide on one row → row disappears from default view                      ( )
 9. export Cashflow list to CSV/PDF → file downloads, opens without corruption                 ( )
10. Sales: open a project → building → unit grid; change one apartment status → persists        ( )
11. Sales: record an apartment payment → totals reconcile on apartment detail                  ( )
12. Retail: open a project → add a customer → create an invoice → export PDF (Noto Sans čćšđž) ( )
13. Funding: allocate a credit to a project → allocation total ≤ credit amount                 ( )
14. Funding: create a subcontractor-notification payment → subcontractor "already paid" updates ( )
15. Supervision: create a work log with status=blocker → blocker textarea required and saves    ( )
16. Supervision: assign subcontractor contract within phase budget → contract appears in tab    ( )
17. General: open Budget Control → switch projects → CPI/SPI cards re-render with new data      ( )
18. Activity Log: confirm the last 5 mutations above all appear with correct action names        ( )
19. Chat: send message + 1 MB PDF attachment between two sessions → realtime bubble + badge     ( )
20. Calendar: create event with 2 participants → participants receive unread badge; one accepts → response persists ( )
21. Tasks: create assigned task → assignee sees it in "Assigned to me"; complete → status=done   ( )
22. log out → session cleared, sessionStorage `cashflow_unlocked` gone, /tasks redirects to login ( )
```
