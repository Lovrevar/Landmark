import { mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { test, type Page } from '@playwright/test'
import { DEMO_USERS, SHOTS, type DemoRole, type Shot } from './shots'

const HERE = dirname(fileURLToPath(import.meta.url))
const OUT_DIR = process.env.HELP_SHOTS_OUT ?? join(HERE, '..', '..', 'help-kb', 'img')
/** `HELP_SHOTS_ONLY=tic,budget` retakes only the files whose name contains one of the words. */
const ONLY = (process.env.HELP_SHOTS_ONLY ?? '').split(',').map(word => word.trim()).filter(Boolean)
const PASSWORD = process.env.DEMO_USER_PASSWORD ?? 'cognilion-demo'

const wanted = (shot: Shot): boolean => ONLY.length === 0 || ONLY.some(word => shot.file.includes(word))

async function prepare(page: Page): Promise<void> {
  // Croatian, light theme, Cashflow unlocked: the articles are Croatian and one look is enough.
  await page.addInitScript(() => {
    localStorage.setItem('i18nextLng', 'hr')
    localStorage.setItem('theme', 'light')
    sessionStorage.setItem('cashflow_unlocked', 'true')
  })
  // The run must leave the demo data as it found it. Anything that is not a read is refused
  // outright, so a shot that clicks a wrong button fails instead of changing a row. RPCs are
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
}

async function signIn(page: Page, role: DemoRole): Promise<void> {
  await page.goto('/')
  await page.locator('#email').fill(DEMO_USERS[role])
  await page.locator('#password').fill(PASSWORD)
  await page.locator('button[type="submit"]').click()
  await page.locator('#email').waitFor({ state: 'detached' })
  await page.waitForLoadState('networkidle')
}

/** The assistant's floating button would otherwise sit in the corner of every picture. */
async function clearOverlays(page: Page): Promise<void> {
  await page.addStyleTag({ content: 'button[aria-label="AI asistent"] { visibility: hidden !important; }' })
}

/** The page itself, without the top bar and the menu: what is inside <main>, as far as the window shows it. */
async function capturePage(page: Page, path: string): Promise<void> {
  const viewport = page.viewportSize()!
  const box = (await page.locator('main').boundingBox())!
  const top = Math.max(box.y, 0)
  // The menu's collapse handle hangs over the left edge of <main>; start just past it.
  const left = box.x + 14
  await page.screenshot({ path, clip: { x: left, y: top, width: viewport.width - left, height: viewport.height - top } })
}

const roles = [...new Set(SHOTS.filter(wanted).map(shot => shot.role))]

for (const role of roles) {
  test(`screenshots as ${role}`, async ({ page }) => {
    mkdirSync(OUT_DIR, { recursive: true })
    await prepare(page)
    await signIn(page, role)
    // The "what's new" line would head every page. Closing it only writes to this browser's storage.
    const closeNews = page.locator('main').getByRole('button', { name: 'Zatvori' }).first()
    if (await closeNews.isVisible().catch(() => false)) await closeNews.click()

    for (const shot of SHOTS.filter(candidate => candidate.role === role && wanted(candidate))) {
      await test.step(shot.file, async () => {
        if (shot.profile) await page.evaluate(profile => localStorage.setItem('currentProfile', profile), shot.profile)
        await page.goto(shot.route)
        await page.waitForLoadState('networkidle')
        if (!shot.keepAssistantButton) await clearOverlays(page)
        if (shot.before) await shot.before(page)
        // Park the pointer so no chart tooltip or hover state is caught, then let things settle.
        await page.mouse.move(0, 0)
        await page.waitForTimeout(400)
        const path = join(OUT_DIR, shot.file)
        if (shot.clip) await page.screenshot({ path, clip: shot.clip })
        else if (shot.target) await shot.target(page).first().screenshot({ path })
        else await capturePage(page, path)
      })
    }
  })
}
