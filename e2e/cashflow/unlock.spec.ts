import { test, expect } from '@playwright/test'
import { storageStatePath } from '../support/auth'
import { env } from '../support/env'

// Uses raw @playwright/test (not e2e/support/fixtures) so the addInitScript
// that keeps Cashflow unlocked does NOT run. sessionStorage is not part of
// storageState, so contexts here start with `cashflow_unlocked` unset — which
// is exactly the state the password modal flow requires.
test.describe('cashflow — profile unlock', () => {
  test.use({ storageState: storageStatePath('director') })

  test('wrong password keeps modal open with aria-invalid and does not unlock', async ({ page }) => {
    await page.goto('/', { waitUntil: 'commit' })
    await expect(page.getByRole('button', { name: /log\s*out|odjava/i })).toBeVisible()

    // Sanity: the flag isn't set at context start.
    const initial = await page.evaluate(() => sessionStorage.getItem('cashflow_unlocked'))
    expect(initial).toBeNull()

    await page.getByRole('button', { name: /general/i }).first().click()
    await page.getByRole('button', { name: /^cashflow$/i }).click()

    const pwInput = page.locator('input[type="password"]')
    await expect(pwInput).toBeVisible()

    await pwInput.fill('definitely-not-the-password')
    await pwInput.press('Enter')

    await expect(pwInput).toHaveAttribute('aria-invalid', 'true')

    const afterWrong = await page.evaluate(() => sessionStorage.getItem('cashflow_unlocked'))
    expect(afterWrong).toBeNull()

    // The modal is still visible — submission did not proceed.
    await expect(pwInput).toBeVisible()
  })

  test('correct password closes the modal, sets the flag, and opens Cashflow routes', async ({ page }) => {
    await page.goto('/', { waitUntil: 'commit' })
    await expect(page.getByRole('button', { name: /log\s*out|odjava/i })).toBeVisible()

    await page.getByRole('button', { name: /general/i }).first().click()
    await page.getByRole('button', { name: /^cashflow$/i }).click()

    const pwInput = page.locator('input[type="password"]')
    await expect(pwInput).toBeVisible()

    await pwInput.fill(env.cashflowPassword)
    await pwInput.press('Enter')

    // Modal closes.
    await expect(pwInput).toBeHidden()

    const flag = await page.evaluate(() => sessionStorage.getItem('cashflow_unlocked'))
    expect(flag).toBe('true')

    // The Cashflow guard now lets the Director through to a Cashflow route.
    await page.goto('/accounting-invoices', { waitUntil: 'commit' })
    await expect(page).toHaveURL(/\/accounting-invoices$/)
    await expect(page.locator('#email')).toHaveCount(0)
  })
})
