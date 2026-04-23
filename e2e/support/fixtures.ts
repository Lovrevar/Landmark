import { test as base, expect } from '@playwright/test'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createAdminClient } from './supabase-admin'
import { testNamespace } from './namespace'
import { cleanupByPrefix } from './cleanup'

export interface TestFixtures {
  ns: string
  admin: SupabaseClient
}

export const test = base.extend<TestFixtures>({
  ns: async ({}, use, testInfo) => {
    await use(testNamespace(testInfo.title))
  },
  admin: async ({}, use) => {
    const client = createAdminClient()
    await use(client)
  },
  context: async ({ context }, use) => {
    // Keep the Cashflow profile unlocked for any role that reaches it; CashflowRoute
    // still enforces the role check, so this is harmless for non-Cashflow users.
    await context.addInitScript(() => {
      try {
        sessionStorage.setItem('cashflow_unlocked', 'true')
      } catch {
        // sessionStorage unavailable on about:blank; ignore
      }
    })
    await use(context)
  },
  page: async ({ page }, use) => {
    // Default page.goto uses waitUntil: 'load', but Vite's dev server serves
    // hundreds of unbundled ES modules per navigation — the 'load' event can
    // take 30-60s on the first visit to a route that wasn't warmed by
    // globalSetup. Patch page.goto to use 'commit' so the wait returns as
    // soon as the response headers arrive; subsequent selectors gate on the
    // actual UI readiness we care about.
    const originalGoto = page.goto.bind(page)
    page.goto = ((url: string, options?: Parameters<typeof originalGoto>[1]) =>
      originalGoto(url, { waitUntil: 'commit', ...options })) as typeof page.goto
    await use(page)
  },
})

test.afterEach(async ({ ns, admin }) => {
  await cleanupByPrefix(admin, ns)
})

export { expect }
