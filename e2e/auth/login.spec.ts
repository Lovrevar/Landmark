import { test, expect } from '../support/fixtures'
import { TEST_USERS } from '../support/auth'

const dashboardPathForRole = (role: string): string =>
  role === 'supervision' ? '/site-management' : '/'

// Login tests run serially: every test in this file issues a real Supabase auth
// request. Running the 5-role matrix in parallel hits auth rate limiting on the
// shared dev project and also spikes contention on the single dev webServer
// during parallel UI renders. Serial keeps the suite deterministic and within
// the ~4–6 minute budget (each login completes in ~2s).
test.describe.configure({ mode: 'serial' })

test.describe('login — valid credentials', () => {
  // No storageState — each test exercises the real login form end to end.
  test.use({ storageState: { cookies: [], origins: [] } })

  for (const user of TEST_USERS) {
    test(`${user.role} user logs in and lands on the expected route`, async ({ page }) => {
      await page.goto('/')

      await page.locator('#email').fill(user.email)
      await page.locator('#password').fill(user.password)
      await page.locator('button[type="submit"]').click()

      await page.locator('#email').waitFor({ state: 'detached' })
      await expect(page).toHaveURL(new RegExp(`${dashboardPathForRole(user.role)}$`))
      await expect(
        page.getByRole('button', { name: /log\s*out|odjava/i })
      ).toBeVisible()
    })
  }
})

test.describe('login — invalid credentials', () => {
  test.use({ storageState: { cookies: [], origins: [] } })

  test('wrong password keeps user on login form with an error', async ({ page }) => {
    await page.goto('/')

    await page.locator('#email').fill('e2e-director@mail.com')
    await page.locator('#password').fill('definitely-not-the-password')
    await page.locator('button[type="submit"]').click()

    // Password field surfaces the auth error via aria-invalid — language-independent.
    await expect(page.locator('#password')).toHaveAttribute('aria-invalid', 'true')
    // Login form is still rendered; layout (logout button) is not.
    await expect(page.locator('#email')).toBeVisible()
    await expect(
      page.getByRole('button', { name: /log\s*out|odjava/i })
    ).toHaveCount(0)
  })
})
