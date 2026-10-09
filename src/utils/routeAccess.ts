/**
 * Which roles can open which pages — the router's guards, stated once as data.
 *
 * `App.tsx` enforces these with `<CashflowRoute>` and `<DirectorRoute>`, the Activity Log page
 * redirects non-Directors itself, and `Layout.tsx` gives the Supervision role a fixed menu. This
 * file does not replace any of that (and none of it is a security boundary — RLS is); it lets
 * other code ask the same question without mounting a route, e.g. the Help page deciding whether
 * an article about a page is of any use to the reader. `routeAccess.test.ts` reads `App.tsx` and
 * fails if a guarded route is missing here or listed here without its guard.
 */

export type Role = 'Director' | 'Accounting' | 'Sales' | 'Supervision' | 'Investment'

/** Wrapped in `<CashflowRoute>`: Director and Accounting only. */
export const CASHFLOW_ROUTES: readonly string[] = [
  '/accounting-invoices',
  '/accounting-payments',
  '/accounting-suppliers',
  '/office-suppliers',
  '/accounting-companies',
  '/accounting-banks',
  '/accounting-customers',
  '/accounting-calendar',
  '/accounting-loans',
  '/debt-status',
  '/accounting-approvals',
  '/sifrarnici',
  '/erp-import',
]

/** Director and Accounting only; the page guards itself with `canManagePayments` (SEC-A10). */
export const PAYMENT_ROUTES: readonly string[] = ['/funding-payments']

/** Director only: `<DirectorRoute>`, plus the Activity Log, which guards itself. */
export const DIRECTOR_ROUTES: readonly string[] = ['/general-reports', '/activity-log']

/**
 * Everything the Supervision role is offered: its fixed three-item menu and the pages behind the
 * top-bar icons. Other routes are not guarded against this role, but nothing links to them and
 * most show it no data, so for guidance purposes they do not count as pages it uses.
 */
export const SUPERVISION_ROLE_ROUTES: readonly string[] = [
  '/site-management',
  '/work-logs',
  '/documents',
  '/chat',
  '/tasks',
  '/calendar',
  '/help',
]

/** `/site-management/:projectId?` → `/site-management`; `/projects/:id` → `/projects`. */
const staticPrefix = (routePattern: string): string => {
  const parts = routePattern.split('/').filter(Boolean)
  const firstParam = parts.findIndex(part => part.startsWith(':'))
  return '/' + (firstParam === -1 ? parts : parts.slice(0, firstParam)).join('/')
}

/** Whether a role can open the page at a route pattern or pathname. */
export function canRoleAccessRoute(role: string | null | undefined, routePattern: string): boolean {
  if (!role) return false
  const route = staticPrefix(routePattern)
  if (CASHFLOW_ROUTES.includes(route) || PAYMENT_ROUTES.includes(route)) return role === 'Director' || role === 'Accounting'
  if (DIRECTOR_ROUTES.includes(route)) return role === 'Director'
  if (role === 'Supervision') return SUPERVISION_ROLE_ROUTES.includes(route)
  return true
}
