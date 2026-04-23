import { test, expect } from './support/fixtures'
import { TEST_USERS, storageStatePath } from './support/auth'

for (const user of TEST_USERS) {
  test.describe(`smoke — ${user.role}`, () => {
    test.use({ storageState: storageStatePath(user.role) })

    test('authenticated app shell loads', async ({ page }) => {
      await page.goto('/')
      await expect(page.locator('#email')).toHaveCount(0)
      await expect(
        page.getByRole('button', { name: /log\s*out|odjava/i })
      ).toBeVisible()
    })
  })
}
