import type { BrowserContext, Page } from '@playwright/test'

export type RoleKey =
  | 'director'
  | 'accounting'
  | 'sales'
  | 'supervision'
  | 'investment'

// Storage-state keys: the five role sessions plus a dedicated 'logout' session.
export type SessionKey = RoleKey | 'logout'

export type AppRole = 'Director' | 'Accounting' | 'Sales' | 'Supervision' | 'Investment'

export interface TestUser {
  role: SessionKey
  appRole: AppRole // public.users.role to provision (distinct from the storage-state key)
  email: string
  password: string
  unlockCashflow: boolean
}

// One shared session per role — used by the role-based specs and the smoke loop.
export const TEST_USERS: TestUser[] = [
  { role: 'director',    appRole: 'Director',    email: 'e2e-director@mail.com',    password: 'e2e123', unlockCashflow: true },
  { role: 'accounting',  appRole: 'Accounting',  email: 'e2e-cashflow@mail.com',    password: 'e2e123', unlockCashflow: true },
  { role: 'sales',       appRole: 'Sales',       email: 'e2e-sales@mail.com',       password: 'e2e123', unlockCashflow: false },
  { role: 'supervision', appRole: 'Supervision', email: 'e2e-supervision@mail.com', password: 'e2e123', unlockCashflow: false },
  { role: 'investment',  appRole: 'Investment',  email: 'e2e-funding@mail.com',     password: 'e2e123', unlockCashflow: false },
]

// Dedicated session for auth/session.spec. That spec logs out with a global-scope
// signOut (the app's default), which revokes EVERY session for that user — so it
// must not share a user with any other spec, or it would invalidate that user's
// shared role session mid-test under parallel workers (observed as intermittent
// drops to /login). Director-equivalent (cashflow unlocked) so the "logout clears
// the Cashflow flag" assertion stays meaningful. Deliberately NOT in TEST_USERS,
// so the smoke loop doesn't pin a shell check to this logged-out-mid-suite user.
export const LOGOUT_USER: TestUser = {
  role: 'logout', appRole: 'Director', email: 'e2e-logout@mail.com', password: 'e2e123', unlockCashflow: true,
}

// Every session globalSetup must establish (role sessions + the logout session).
export const SETUP_USERS: TestUser[] = [...TEST_USERS, LOGOUT_USER]

export function storageStatePath(role: SessionKey): string {
  return `e2e/.auth/${role}.json`
}

export async function loginThroughForm(page: Page, user: TestUser): Promise<void> {
  // Use 'commit' rather than 'load' or 'domcontentloaded': Vite's dev server
  // streams hundreds of modules lazily on a cold start, and the
  // DOMContentLoaded/load events can take 30+s to fire (or never fire under
  // Playwright's navigation semantics). 'commit' resolves as soon as the
  // response headers arrive, and we then gate on the login form mounting.
  //
  // The 90s timeout on #email is sized for cold-start: Vite compiles every
  // module in the dependency graph on the first navigation (App.tsx eagerly
  // imports all routes, giving ~100–150 requests), which can take 40–60s on
  // a cold server. Once this first login succeeds, Vite's on-disk cache
  // warms up and every subsequent page.goto in the suite completes in <2s.
  await page.goto('/', { waitUntil: 'commit', timeout: 30000 })
  await page.locator('#email').waitFor({ state: 'visible', timeout: 180000 })
  await page.locator('#email').fill(user.email)
  await page.locator('#password').fill(user.password)
  await page.locator('button[type="submit"]').click()
  await page.locator('#email').waitFor({ state: 'detached', timeout: 30000 })
}

export async function unlockCashflow(context: BrowserContext): Promise<void> {
  await context.addInitScript(() => {
    try {
      sessionStorage.setItem('cashflow_unlocked', 'true')
    } catch {
      // sessionStorage may not be available on about:blank; ignore
    }
  })
}
