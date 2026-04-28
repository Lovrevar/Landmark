import { test, expect } from '../support/fixtures'
import { storageStatePath } from '../support/auth'

test.describe('sales — customers', () => {
  test.use({ storageState: storageStatePath('sales') })

  test('Sales user creates a customer via the form; row persists in the DB', async ({ page, admin, ns }) => {
    await page.goto('/customers')
    await expect(page.getByRole('button', { name: /log\s*out|odjava/i })).toBeVisible()
    await expect(page).toHaveURL(/\/customers$/)

    // Header "Add Customer" / "Dodaj kupca" button opens the form modal.
    // The modal submit button uses the same label, so target the first (header) here
    // and the last (submit) after the modal has opened.
    await page.getByRole('button', { name: /Add Customer|Dodaj kupca/i }).first().click()

    // FormField does not link its <label> to the wrapped <Input>, so getByLabel
    // does not resolve. Scope to the modal's backdrop (Modal.tsx renders
    // "<div class='fixed inset-0 ...'>" as a portal child of document.body) and
    // select inputs by type / position.
    const modal = page.locator('div.fixed.inset-0').last()
    await expect(modal.getByRole('heading', { name: /Add Customer|Dodaj kupca/i })).toBeVisible()

    const first = `${ns}-first`
    const last = `${ns}-last`
    const email = `${ns}@e2e.test`
    const phone = '0912345678'

    // First two text inputs in the modal's DOM order are first name + last name.
    await modal.locator('input[type="text"]').nth(0).fill(first)
    await modal.locator('input[type="text"]').nth(1).fill(last)
    await modal.locator('input[type="email"]').fill(email)
    await modal.locator('input[type="tel"]').fill(phone)

    // Submit button inside the open modal.
    await page.getByRole('button', { name: /Add Customer|Dodaj kupca/i }).last().click()

    // Modal closes: the heading is gone.
    await expect(page.getByRole('heading', { name: /Add Customer|Dodaj kupca/i })).toBeHidden()

    // Verify via admin client that the row landed with the expected fields.
    const { data, error } = await admin
      .from('customers')
      .select('id, name, surname, email, phone')
      .eq('email', email)
      .maybeSingle()
    expect(error).toBeNull()
    expect(data).not.toBeNull()
    expect(data!.name).toBe(first)
    expect(data!.surname).toBe(last)
    expect(data!.phone).toBe(phone)
  })
})
