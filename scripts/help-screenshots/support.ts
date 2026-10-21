import type { Page } from '@playwright/test'
import { DEMO_USERS, type DemoRole } from './shots'

const PASSWORD = process.env.DEMO_USER_PASSWORD ?? 'cognilion-demo'

export interface PrepareOptions {
  language?: 'hr' | 'en'
  theme?: 'light' | 'dark'
}

/**
 * Language, theme and Cashflow unlock through the app's own storage keys, and the guards that
 * keep a run from changing the demo data.
 */
export async function prepare(page: Page, { language = 'hr', theme = 'light' }: PrepareOptions = {}): Promise<void> {
  await page.addInitScript(([lang, look]) => {
    localStorage.setItem('i18nextLng', lang)
    localStorage.setItem('theme', look)
    sessionStorage.setItem('cashflow_unlocked', 'true')
  }, [language, theme])
  // The run must leave the demo data as it found it. Anything that is not a read is refused
  // outright, so a step that clicks a wrong button fails instead of changing a row. RPCs are
  // let by: the screens read through them. (Playwright tries the handler registered last
  // first, so the exception for the activity log comes second.)
  await page.route('**/rest/v1/**', route => {
    const request = route.request()
    const isRead = request.method() === 'GET' || request.method() === 'HEAD' || request.url().includes('/rest/v1/rpc/')
    return isRead ? route.continue() : route.abort()
  })
  // The one write the screens make by being looked at is the activity log (sign-in, help usage).
  // It is answered here and never sent.
  await page.route('**/rest/v1/activity_logs*', route =>
    route.request().method() === 'GET' ? route.continue() : route.fulfill({ status: 201, contentType: 'application/json', body: '[]' }),
  )
  // The assistant writes its conversations; a run never talks to it.
  await page.route('**/functions/v1/**', route => route.abort())
}

export async function signIn(page: Page, role: DemoRole): Promise<void> {
  await page.goto('/')
  await page.locator('#email').fill(DEMO_USERS[role])
  await page.locator('#password').fill(PASSWORD)
  await page.locator('button[type="submit"]').click()
  await page.locator('#email').waitFor({ state: 'detached' })
  await page.waitForLoadState('networkidle')
}
