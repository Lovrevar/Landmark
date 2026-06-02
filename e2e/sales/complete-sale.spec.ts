import { test, expect } from '../support/fixtures'
import { storageStatePath } from '../support/auth'
import { createSellableApartment } from '../support/factories/salesUnits'

// Exercises the apartment "complete sale" money-write path end to end:
// completeSale() creates a customer + a sale row, flips the apartment to Sold,
// and (via updateLinkedUnitsAfterSale) flips linked units to Sold too. Assertions
// go through the service-role admin client so we check the persisted state, not
// just the UI.
//
// Runs as the Sales user (the real actor — RLS on customers/sales is granted to
// Director/Sales/Accounting, and apartments/garages are open to all authenticated).
// Deliberately NOT Director: auth/session.spec logs the Director out with a
// global-scope signOut, which under parallel workers would invalidate this
// longer flow's session mid-test (it surfaced as intermittent drops to /login).
test.describe('sales — complete sale', () => {
  test.use({ storageState: storageStatePath('sales') })

  test('selling an apartment marks it Sold, records the sale + buyer, and sells linked units', async ({ page, admin, ns }) => {
    const price = 120000
    const downPayment = 20000
    const seed = await createSellableApartment(admin, { ns, price, withLinkedGarage: true })

    await page.goto('/sales-projects')
    await expect(page.getByRole('button', { name: /log\s*out|odjava/i })).toBeVisible()

    // Drill in: project card → building card → units grid (cards are clickable divs).
    await page.locator('div.cursor-pointer', { hasText: seed.projectName }).first().click()
    await page.locator('div.cursor-pointer', { hasText: seed.buildingName }).first().click()
    await expect(page.getByText(seed.apartmentNumber)).toBeVisible()

    // The freshly-seeded building has exactly one apartment → a single Sell button.
    await page.getByRole('button', { name: /^sell$|prodaj/i }).first().click()

    // Scope to the modal that contains the sale heading, NOT `.last()` of every
    // fixed overlay — `.last()` can resolve to another fixed-position element
    // (e.g. the always-mounted AI widget) and make the modal-close check below
    // pass prematurely, racing the DB read.
    const modal = page.locator('div.fixed.inset-0').filter({
      has: page.getByRole('heading', { name: /complete sale|prodaja/i }),
    })
    await expect(modal).toBeVisible()

    // New-customer mode (radio value="new"); fill the required fields.
    await modal.locator('input[type="radio"][value="new"]').check()
    const buyerName = `${ns}-buyer`
    await modal.locator('input[type="text"]').first().fill(buyerName) // full_name (#0; #1 is address)
    await modal.locator('input[type="email"]').fill(`${ns}@e2e.test`)
    // Number inputs in DOM order: sale_price (prefilled from unit price), down_payment, monthly_payment.
    const numberInputs = modal.locator('input[type="number"]')
    await expect(numberInputs.first()).toHaveValue(String(price)) // sale_price prefilled → validation passes
    await numberInputs.nth(1).fill(String(downPayment))
    await expect(modal.locator('input[type="email"]')).toHaveValue(`${ns}@e2e.test`)

    // Submit. handleCompleteSale (index.tsx) closes the modal ONLY after
    // completeSale() resolves; on error it leaves the modal open + toasts. So
    // waiting for THIS modal to disappear is a reliable gate that every write
    // (customer → sale → apartment → linked units) has finished.
    await modal.getByRole('button', { name: /complete sale|dovrši prodaju|prodaj/i }).click()
    await expect(modal).toBeHidden({ timeout: 15_000 })

    // --- Verify the persisted money-write path via the admin client ---
    // (Poll the last write — the linked garage — to absorb any read-after-write lag.)
    await expect
      .poll(async () => {
        const { data } = await admin.from('garages').select('status').eq('id', seed.garageId!).single()
        return data?.status
      }, { timeout: 10_000, message: 'linked garage should be flipped to Sold by updateLinkedUnitsAfterSale' })
      .toBe('Sold')

    const { data: apt } = await admin
      .from('apartments').select('status, buyer_name').eq('id', seed.apartmentId).single()
    expect(apt!.status).toBe('Sold')

    const { data: sale } = await admin
      .from('sales')
      .select('sale_price, down_payment, total_paid, remaining_amount')
      .eq('apartment_id', seed.apartmentId)
      .maybeSingle()
    expect(sale).not.toBeNull()
    expect(Number(sale!.sale_price)).toBe(price)
    expect(Number(sale!.down_payment)).toBe(downPayment)
    expect(Number(sale!.total_paid)).toBe(downPayment)
    expect(Number(sale!.remaining_amount)).toBe(price - downPayment)

    const { data: buyer } = await admin
      .from('customers').select('status').ilike('name', `${ns}%`).maybeSingle()
    expect(buyer).not.toBeNull()
    expect(buyer!.status).toBe('buyer')
  })
})
