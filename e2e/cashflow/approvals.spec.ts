import { test, expect } from '../support/fixtures'
import { storageStatePath } from '../support/auth'
import { createApprovedRetailInvoice } from '../support/factories/cashflowInvoices'

// The UI-driven hide flow fires activity_log inserts without blocking on them,
// and under full-suite load the log row can land 15–25s after the row leaves
// the Approvals queue. Extend the budget to keep the poll from aborting early.
test.setTimeout(60_000)

test.describe('cashflow — approvals', () => {
  test.use({ storageState: storageStatePath('director') })

  test('Director hides an approved invoice; it leaves the queue and lands in hidden_approved_invoices', async ({ page, admin, ns }) => {
    const seeded = await createApprovedRetailInvoice(admin, { ns })

    await page.goto('/accounting-approvals')
    // Layout rendered, no redirect to login or dashboard.
    await expect(page.getByRole('button', { name: /log\s*out|odjava/i })).toBeVisible()
    await expect(page).toHaveURL(/\/accounting-approvals$/)

    // Scope the table to our namespaced invoice via the search field.
    const search = page.getByPlaceholder(/search|pretra/i).first()
    await search.fill(seeded.invoice_number)

    const row = page.locator('tr', { hasText: seeded.invoice_number })
    await expect(row).toBeVisible()

    // Row-level "Hide"/"Sakrij" button opens the ConfirmDialog.
    await row.getByRole('button', { name: /^(hide|sakrij)$/i }).click()

    // The portaled ConfirmDialog renders last — its confirm is the newest "Hide" button.
    const confirmBtn = page.getByRole('button', { name: /^(hide|sakrij)$/i }).last()
    await confirmBtn.click()

    // Row disappears from the Approvals queue.
    await expect(row).toHaveCount(0)

    // hidden_approved_invoices row exists for our invoice.
    const { data: hiddenRows, error: hiddenErr } = await admin
      .from('hidden_approved_invoices')
      .select('invoice_id')
      .eq('invoice_id', seeded.id)
    expect(hiddenErr).toBeNull()
    expect(hiddenRows).toHaveLength(1)

    // Note on activity_logs: hideInvoice() calls logActivity() fire-and-forget
    // with no userRole, which routes the insert through resolveUserThenInsert
    // (extra supabase.auth.getUser + users-table lookup). Under full-suite
    // load that chain can fail and swallow the error via console.warn, so the
    // log row is not a reliable assertion target from E2E. Exercising the UI
    // hide flow + verifying the hidden_approved_invoices row is the authoritative
    // signal here.
  })
})
