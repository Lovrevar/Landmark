import type { BrowserContext, Page } from '@playwright/test'

export type RoleKey =
  | 'director'
  | 'accounting'
  | 'sales'
  | 'supervision'
  | 'investment'

export interface TestUser {
  role: RoleKey
  email: string
  password: string
  unlockCashflow: boolean
}

export const TEST_USERS: TestUser[] = [
  { role: 'director',    email: 'e2e-director@mail.com',    password: 'e2e123', unlockCashflow: true },
  { role: 'accounting',  email: 'e2e-cashflow@mail.com',    password: 'e2e123', unlockCashflow: true },
  { role: 'sales',       email: 'e2e-sales@mail.com',       password: 'e2e123', unlockCashflow: false },
  { role: 'supervision', email: 'e2e-supervision@mail.com', password: 'e2e123', unlockCashflow: false },
  { role: 'investment',  email: 'e2e-funding@mail.com',     password: 'e2e123', unlockCashflow: false },
]

export function storageStatePath(role: RoleKey): string {
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
