import { test, expect } from '../support/fixtures'
import { storageStatePath } from '../support/auth'

/** The grid's own heading. Named, because the app shell carries an <h1>Cognilion</h1> too. */
const LIST_HEADING = /site management|upravljanje gradili/i

/**
 * Opening a project used to be component state, so the address stayed
 * `/site-management` throughout and the browser's Back button left the module
 * entirely — landing on whatever page preceded it. The project id is now a route
 * param, so history has an entry to come back to.
 */
test.describe('supervision — site management project navigation', () => {
  test.use({ storageState: storageStatePath('director') })

  test('browser Back from an open project returns to the project list, not the page before it', async ({ page }) => {
    // Arrive from somewhere else, so "the page before site management" is a real
    // entry in history and a regression has somewhere wrong to land.
    await page.goto('/projects')
    await expect(page).toHaveURL(/\/projects$/)

    await page.goto('/site-management')
    await expect(page).toHaveURL(/\/site-management$/)

    // The grid renders one clickable card per project; take whichever is first.
    const firstCard = page.locator('div.cursor-pointer').filter({ has: page.locator('h3') }).first()
    await expect(firstCard).toBeVisible()
    const projectName = (await firstCard.locator('h3').first().innerText()).trim()
    await firstCard.click()

    // The id in the URL is the whole point of the fix.
    await expect(page).toHaveURL(/\/site-management\/[0-9a-f-]{36}$/)
    await expect(page.getByRole('heading', { name: projectName, level: 1 })).toBeVisible()

    await page.goBack()

    await expect(page).toHaveURL(/\/site-management$/)
    await expect(page.getByRole('heading', { name: LIST_HEADING, level: 1 })).toBeVisible()
    await expect(page.getByRole('heading', { name: projectName, level: 1 })).toHaveCount(0)
    await expect(firstCard).toBeVisible()
  })

  test('the in-app back button also returns to the list', async ({ page }) => {
    await page.goto('/site-management')

    const firstCard = page.locator('div.cursor-pointer').filter({ has: page.locator('h3') }).first()
    await expect(firstCard).toBeVisible()
    await firstCard.click()
    await expect(page).toHaveURL(/\/site-management\/[0-9a-f-]{36}$/)

    await page.getByRole('button', { name: /back to projects|natrag na projekte|nazad na projekte/i }).click()
    await expect(page).toHaveURL(/\/site-management$/)
    await expect(firstCard).toBeVisible()
  })

  test('a project id that does not resolve falls back to the list', async ({ page }) => {
    await page.goto('/site-management/00000000-0000-0000-0000-000000000000')
    await expect(page).toHaveURL(/\/site-management$/)
    await expect(page.getByRole('heading', { name: LIST_HEADING, level: 1 })).toBeVisible()
  })
})
