import { test, expect } from '../support/fixtures'
import { storageStatePath } from '../support/auth'

// Logout awaits activity_log insert + supabase.auth.signOut() serially before
// flipping client state; under full-suite load both network hops plus the
// re-render can crowd the default 30s test budget.
test.setTimeout(60_000)

test.describe('logout', () => {
  test.use({ storageState: storageStatePath('director') })

  test('clears the session, hides the layout, and clears the cashflow unlock flag', async ({ page }) => {
    await page.goto('/')
    await expect(
      page.getByRole('button', { name: /log\s*out|odjava/i })
    ).toBeVisible()

    await page.getByRole('button', { name: /log\s*out|odjava/i }).click()

    // Login form reappears in place of the protected layout. Logout awaits an
    // activity_log insert AND supabase.auth.signOut() before flipping auth
    // state; under load both network calls can run long, so give extra time
    // for the re-render to LoginForm.
    await expect(page.locator('#email')).toBeVisible({ timeout: 25_000 })
    await expect(
      page.getByRole('button', { name: /log\s*out|odjava/i })
    ).toHaveCount(0)

    // Logout should have cleared the Cashflow unlock flag regardless of what set it.
    const cashflowUnlocked = await page.evaluate(() =>
      sessionStorage.getItem('cashflow_unlocked')
    )
    expect(cashflowUnlocked).toBeNull()
  })
})

test.describe('session persistence', () => {
  test.use({ storageState: storageStatePath('director') })

  test('reloading a protected route keeps the user authenticated on that route', async ({ page }) => {
    await page.goto('/projects')
    await expect(
      page.getByRole('button', { name: /log\s*out|odjava/i })
    ).toBeVisible()
    await expect(page).toHaveURL(/\/projects$/)

    await page.reload()

    await expect(page).toHaveURL(/\/projects$/)
    await expect(
      page.getByRole('button', { name: /log\s*out|odjava/i })
    ).toBeVisible()
    await expect(page.locator('#email')).toHaveCount(0)
  })
})
