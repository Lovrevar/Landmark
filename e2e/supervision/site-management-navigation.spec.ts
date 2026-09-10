import { test, expect } from '../support/fixtures'
import { storageStatePath } from '../support/auth'
import type { Page } from '@playwright/test'

/**
 * Opening a project used to be component state, so the address stayed
 * `/site-management` throughout and the browser's Back button left the module
 * entirely — landing on whatever page preceded it. The project id is now a route
 * param, so history has an entry to come back to.
 */

/** The grid's own heading. Named, because the app shell carries an <h1>Cognilion</h1> too. */
const LIST_HEADING = /site management|upravljanje gradili/i

/**
 * Wait for the logged-in shell, then for the grid itself.
 *
 * `page.goto` is patched to `waitUntil: 'commit'` (see support/fixtures), so it returns before
 * auth has resolved and before the lazy SiteManagement chunk has mounted. Asserting straight
 * after it passes on a warm run and times out under the full suite, where two workers share one
 * Vite process — the same reason work-logs.spec gates on the logout button.
 */
async function gotoProjectList(page: Page) {
  await page.goto('/site-management')
  await expect(page.getByRole('button', { name: /log\s*out|odjava/i })).toBeVisible()
  await expect(page.getByRole('heading', { name: LIST_HEADING, level: 1 })).toBeVisible()
}

/**
 * The anchor project's card. Pinned by name rather than "whichever card is first": the suite
 * creates and sweeps namespaced projects in parallel, so position is not stable.
 */
function anchorCard(page: Page) {
  return page.locator('div.cursor-pointer').filter({ hasText: 'E2E Anchor Project' }).first()
}

test.describe('supervision — site management project navigation', () => {
  test.use({ storageState: storageStatePath('director') })

  test('browser Back from an open project returns to the project list, not the page before it', async ({ page }) => {
    // Arrive from somewhere else, so "the page before site management" is a real
    // entry in history and a regression has somewhere wrong to land.
    await page.goto('/projects')
    await expect(page.getByRole('button', { name: /log\s*out|odjava/i })).toBeVisible()
    await expect(page).toHaveURL(/\/projects$/)

    await gotoProjectList(page)
    await expect(page).toHaveURL(/\/site-management$/)

    const card = anchorCard(page)
    await expect(card).toBeVisible()
    await card.click()

    // The id in the URL is the whole point of the fix.
    await expect(page).toHaveURL(/\/site-management\/[0-9a-f-]{36}$/)
    await expect(page.getByRole('heading', { name: 'E2E Anchor Project', level: 1 })).toBeVisible()

    await page.goBack()

    await expect(page).toHaveURL(/\/site-management$/)
    await expect(page.getByRole('heading', { name: LIST_HEADING, level: 1 })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'E2E Anchor Project', level: 1 })).toHaveCount(0)
  })

  test('the in-app back button also returns to the list', async ({ page }) => {
    await gotoProjectList(page)

    const card = anchorCard(page)
    await expect(card).toBeVisible()
    await card.click()
    await expect(page).toHaveURL(/\/site-management\/[0-9a-f-]{36}$/)

    await page.getByRole('button', { name: /back to projects|natrag na projekte|nazad na projekte/i }).click()
    await expect(page).toHaveURL(/\/site-management$/)
    await expect(page.getByRole('heading', { name: LIST_HEADING, level: 1 })).toBeVisible()
  })

  test('a project id that does not resolve falls back to the list', async ({ page }) => {
    await page.goto('/site-management/00000000-0000-0000-0000-000000000000')
    // The redirect only fires once the project list has loaded — until then the screen is
    // legitimately a spinner at a URL that does not resolve yet.
    await expect(page.getByRole('button', { name: /log\s*out|odjava/i })).toBeVisible()
    await expect(page.getByRole('heading', { name: LIST_HEADING, level: 1 })).toBeVisible()
    await expect(page).toHaveURL(/\/site-management$/)
  })
})
