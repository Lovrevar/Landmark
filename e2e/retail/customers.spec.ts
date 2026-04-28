import { test, expect } from '../support/fixtures'
import { storageStatePath } from '../support/auth'

test.describe('retail — customers', () => {
  test.use({ storageState: storageStatePath('director') })

  test('Director creates a retail customer via the form; row persists in the DB', async ({ page, admin, ns }) => {
    await page.goto('/retail-customers')
    await expect(page.getByRole('button', { name: /log\s*out|odjava/i })).toBeVisible()
    await expect(page).toHaveURL(/\/retail-customers$/)

    // Header "New Customer" / "Novi kupac" opens the form modal.
    await page.getByRole('button', { name: /^(new customer|novi kupac)$/i }).first().click()

    // Scope selectors to the portaled modal (FormField does not link label -> input).
    const modal = page.locator('div.fixed.inset-0').last()
    await expect(
      modal.getByRole('heading', { name: /new customer|novi kupac/i })
    ).toBeVisible()

    const name = `${ns}-retail`
    const email = `${ns}-retail@e2e.test`
    const phone = '0911111111'

    // Modal field order: name, phone, email (type=email), oib, address (textarea).
    // Name and phone are both Input without explicit type (defaults to text).
    const textInputs = modal.locator('input:not([type]), input[type="text"]')
    await textInputs.nth(0).fill(name)
    await textInputs.nth(1).fill(phone)
    await modal.locator('input[type="email"]').fill(email)

    // Submit button inside the modal footer. For a new retail customer the
    // app uses t('common.add') — "Add" / "Dodaj" — not Save/Spremi.
    await modal.getByRole('button', { name: /^(add|dodaj)$/i }).click()

    await expect(modal).toBeHidden()

    const { data, error } = await admin
      .from('retail_customers')
      .select('id, name, contact_email, contact_phone')
      .eq('contact_email', email)
      .maybeSingle()
    expect(error).toBeNull()
    expect(data).not.toBeNull()
    expect(data!.name).toBe(name)
    expect(data!.contact_phone).toBe(phone)
  })
})
