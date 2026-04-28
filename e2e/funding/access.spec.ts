import { test, expect } from '../support/fixtures'
import { storageStatePath } from '../support/auth'

// Funding routes are gated only by ProtectedRoute (no role-specific guard in
// App.tsx). The auth/permissions spec already asserts the inverse (Sales
// cannot reach Cashflow); this spec is the positive counterpart for the
// Investment role against Funding.
test.describe('funding — access', () => {
  test.use({ storageState: storageStatePath('investment') })

  test('Investment user reaches /banks (Investors management) and sees the module action bar', async ({ page }) => {
    await page.goto('/banks')
    await expect(page.getByRole('button', { name: /log\s*out|odjava/i })).toBeVisible()
    await expect(page).toHaveURL(/\/banks$/)

    // Page loads data before rendering actions, so wait past the spinner and
    // then confirm the module-specific buttons are present.
    await expect(
      page.getByRole('button', { name: /add\s*investor|dodaj\s*investitora/i })
    ).toBeVisible()
    await expect(
      page.getByRole('button', { name: /add\s*loan|dodaj\s*kredit/i })
    ).toBeVisible()
  })

  test('Investment user reaches /funding-credits', async ({ page }) => {
    await page.goto('/funding-credits')
    await expect(page.getByRole('button', { name: /log\s*out|odjava/i })).toBeVisible()
    await expect(page).toHaveURL(/\/funding-credits$/)
    // Login form would mean a redirect to the sign-in screen — should not be present.
    await expect(page.locator('#email')).toHaveCount(0)
  })
})
