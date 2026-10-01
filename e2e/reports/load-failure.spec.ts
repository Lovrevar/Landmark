import { test, expect } from '../support/fixtures'
import { storageStatePath } from '../support/auth'

/**
 * A failed load must never render as an empty report. These two specs force the failure with
 * Playwright's request interception and assert the three things that distinguish the states:
 * the error copy is shown, the "nothing here" copy is not, and a retry recovers the page.
 *
 * Read-only: nothing is created, so the `ns` cleanup has nothing to sweep.
 *
 * Note the route patterns are deliberately narrow. Aborting all of `**\/rest\/v1\/**` also kills
 * AuthContext's `users` lookup, and a session with no user row is dropped — the app redirects to
 * /login and the page under test never mounts. Abort only the reads the report itself makes.
 */

// `common.load_error_title` and `common.retry`, in both locales (hr is the default, en the
// fallback, and which one renders depends on the test user's stored preference).
const LOAD_ERROR = /Failed to load|Učitavanje nije uspjelo/i
const RETRY = /Try again|Pokušaj ponovno/i
const NO_DATA = /^(No data|Nema podataka)$/i
// `reports.sales.total_customers_stat` — the StatCard label, which renders in its own element.
const TOTAL_CUSTOMERS_STAT = /^(Total Customers|Ukupno kupaca)$/

test.describe('reports — retail report load failure', () => {
  test.use({ storageState: storageStatePath('director') })

  const RETAIL_READS = '**/rest/v1/retail_*'

  test('a dead connection reads as a failure with a retry, not as an empty portfolio', async ({ page }) => {
    await page.route(RETAIL_READS, route => route.abort())

    await page.goto('/retail-reports')
    // The app shell still loads — only the report's own queries are cut.
    await expect(page.getByRole('button', { name: /log\s*out|odjava/i })).toBeVisible()
    await expect(page).toHaveURL(/\/retail-reports$/)

    // The page says it failed and offers a way out…
    await expect(page.getByText(LOAD_ERROR)).toBeVisible()
    const retry = page.getByRole('button', { name: RETRY })
    await expect(retry).toBeVisible()

    // …and does not claim the portfolio is empty, or offer to export the zeros it doesn't have.
    await expect(page.getByText(NO_DATA)).toHaveCount(0)
    await expect(page.getByRole('button', { name: /PDF Report|PDF izvještaj/i })).toHaveCount(0)

    // Retry after the network comes back renders the real report.
    await page.unroute(RETAIL_READS)
    await retry.click()

    await expect(page.getByRole('button', { name: /^(Overview|Pregled)$/ })).toBeVisible()
    await expect(page.getByRole('button', { name: /PDF Report|PDF izvještaj/i })).toBeVisible()
    await expect(page.getByText(LOAD_ERROR)).toHaveCount(0)
  })
})

test.describe('reports — sales customer report load failure', () => {
  test.use({ storageState: storageStatePath('sales') })

  const CUSTOMER_READS = '**/rest/v1/customers*'

  test('a failed customer report shows the error, not a report of zeros', async ({ page }) => {
    await page.goto('/sales-reports')
    await expect(page.getByRole('button', { name: /log\s*out|odjava/i })).toBeVisible()

    // Cut the customer report's own read only. The page, its header and its filters have
    // already loaded, which is the point: they must stay mounted through the failure.
    await page.route(CUSTOMER_READS, route => route.abort())

    // Switching the report type is what triggers the fetch.
    await page.getByLabel(/Report Type|Vrsta izvještaja/i).selectOption('customer')

    await expect(page.getByText(LOAD_ERROR)).toBeVisible()
    const retry = page.getByRole('button', { name: RETRY })
    await expect(retry).toBeVisible()

    // The filters survive the failure, so the user can retry in place…
    await expect(page.getByLabel(/Report Type|Vrsta izvještaja/i)).toBeVisible()
    // …and no stat card claims a customer count that was never loaded. Anchored, because the
    // loaded report also has prose containing the words ("N total customers in database").
    await expect(page.getByText(TOTAL_CUSTOMERS_STAT)).toHaveCount(0)

    await page.unroute(CUSTOMER_READS)
    await retry.click()

    await expect(page.getByText(TOTAL_CUSTOMERS_STAT)).toBeVisible()
    await expect(page.getByText(LOAD_ERROR)).toHaveCount(0)
  })
})
