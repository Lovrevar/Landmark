import { test, expect } from '../support/fixtures'
import { storageStatePath } from '../support/auth'

test.describe('supervision — work logs page', () => {
  test.use({ storageState: storageStatePath('supervision') })

  test('Supervision user reaches /work-logs and the anchor project appears in the project select (RLS + project_managers wiring)', async ({ page }) => {
    await page.goto('/work-logs')
    await expect(page.getByRole('button', { name: /log\s*out|odjava/i })).toBeVisible()
    await expect(page).toHaveURL(/\/work-logs$/)

    // The header button is "New Work Log" / "Novi radni dnevnik" — the regex
    // tolerates both word orders and the optional "Work" / "Radni" middle.
    await page.getByRole('button', { name: /new\s*(work\s*)?log|novi.*(dnevnik|zapis)/i }).click()

    // Scope to the modal portal (same pattern as sales/customers.spec.ts).
    const modal = page.locator('div.fixed.inset-0').last()
    await expect(
      modal.getByRole('heading', { name: /new\s*(work\s*)?log|novi.*(dnevnik|zapis)/i })
    ).toBeVisible()

    // The project <select> is the first select in the modal. The anchor project
    // should be present as an <option> — which is the end-to-end proof that
    // RLS on `projects` (via project_managers) permits the Supervision user to
    // read the anchor row. The smoke test only confirms the shell renders.
    const projectSelect = modal.locator('select').first()
    await expect(projectSelect.locator('option', { hasText: /E2E Anchor Project/i })).toHaveCount(1)
  })
})
