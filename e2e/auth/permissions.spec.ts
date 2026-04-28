import { test, expect } from '../support/fixtures'
import { storageStatePath } from '../support/auth'

// Cashflow routes are wrapped in CashflowRoute (src/App.tsx) which redirects to '/'
// unless the current user has role Director or Accounting AND the Cashflow profile
// has been unlocked via password. A Sales user fails the role check, so every
// Cashflow route must redirect regardless of the unlock flag.
const CASHFLOW_ROUTES = [
  '/accounting-invoices',
  '/accounting-payments',
  '/accounting-approvals',
  '/debt-status',
] as const

test.describe('permissions — Sales role and Cashflow routes', () => {
  test.use({ storageState: storageStatePath('sales') })

  for (const route of CASHFLOW_ROUTES) {
    test(`Sales user navigating to ${route} is redirected to /`, async ({ page }) => {
      await page.goto(route)

      // The CashflowRoute guard issues a Navigate(to="/") on role failure.
      await expect(page).toHaveURL(/\/$/)
      // Confirm the layout rendered (not the login form) so we know the redirect
      // landed inside the authenticated shell, not back to login.
      await expect(
        page.getByRole('button', { name: /log\s*out|odjava/i })
      ).toBeVisible()
      await expect(page.locator('#email')).toHaveCount(0)
    })
  }
})
