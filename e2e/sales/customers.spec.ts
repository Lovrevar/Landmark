import { test, expect } from '../support/fixtures'
import { storageStatePath } from '../support/auth'

test.describe('sales — customers', () => {
  test.use({ storageState: storageStatePath('sales') })

  test('Sales user creates a customer via the form; row persists in the DB', async ({ page, admin, ns }) => {
    await page.goto('/customers')
    await expect(page.getByRole('button', { name: /log\s*out|odjava/i })).toBeVisible()
    await expect(page).toHaveURL(/\/customers$/)

    // Header "Add Customer" / "Dodaj kupca" button opens the form modal. The modal's submit
    // button uses the same label, so the header one is taken before the dialog exists.
    const openButton = page.getByRole('button', { name: /Add Customer|Dodaj kupca/i }).first()
    await openButton.click()

    // Modal renders role="dialog" named by its header title, and FormField links each <label>
    // to its control, so fields are found by label rather than by position.
    const dialog = page.getByRole('dialog', { name: /Add Customer|Dodaj kupca/i })
    await expect(dialog).toBeVisible()

    const first = `${ns}-first`
    const last = `${ns}-last`
    const email = `${ns}@e2e.test`
    const phone = '0912345678'

    await dialog.getByLabel(/^(First Name|Ime)( \*)?$/).fill(first)
    await dialog.getByLabel(/^(Last Name|Prezime)( \*)?$/).fill(last)
    await dialog.getByLabel(/^Email( \*)?$/).fill(email)
    await dialog.getByLabel(/^(Phone|Telefon)( \*)?$/).fill(phone)

    await dialog.getByRole('button', { name: /Add Customer|Dodaj kupca/i }).click()

    await expect(dialog).toBeHidden()

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

  test('the customer form dialog holds keyboard focus and hands it back on Escape', async ({ page }) => {
    await page.goto('/customers')
    await expect(page.getByRole('button', { name: /log\s*out|odjava/i })).toBeVisible()

    const openButton = page.getByRole('button', { name: /Add Customer|Dodaj kupca/i }).first()
    await openButton.focus()
    await page.keyboard.press('Enter')

    const dialog = page.getByRole('dialog', { name: /Add Customer|Dodaj kupca/i })
    await expect(dialog).toBeVisible()

    const focusInsideDialog = () =>
      dialog.evaluate(node => node.contains(document.activeElement))

    // Focus moves into the dialog on open…
    expect(await focusInsideDialog()).toBe(true)

    // …and Tab never walks out to the page behind it, however far it goes.
    for (let i = 0; i < 40; i++) {
      await page.keyboard.press('Tab')
      expect(await focusInsideDialog()).toBe(true)
    }
    await page.keyboard.press('Shift+Tab')
    expect(await focusInsideDialog()).toBe(true)

    // Clicking a label focuses its field.
    await dialog.getByText(/^(Last Name|Prezime)( \*)?$/).click()
    await expect(dialog.getByLabel(/^(Last Name|Prezime)( \*)?$/)).toBeFocused()

    // Escape closes the dialog and focus returns to the button that opened it.
    await page.keyboard.press('Escape')
    await expect(dialog).toBeHidden()
    await expect(openButton).toBeFocused()
  })
})
