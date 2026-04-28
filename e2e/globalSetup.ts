import { chromium } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'
import { env } from './support/env'
import { runId } from './support/namespace'
import { TEST_USERS, loginThroughForm, storageStatePath } from './support/auth'

export default async function globalSetup(): Promise<void> {
  const authDir = path.resolve('e2e/.auth')
  fs.mkdirSync(authDir, { recursive: true })

  console.log(`[e2e] runId = ${runId}`)
  console.log(`[e2e] target = ${env.supabaseUrl}`)
  console.log(`[e2e] base URL = ${env.baseUrl}`)

  const browser = await chromium.launch()
  try {
    for (const user of TEST_USERS) {
      const context = await browser.newContext({ baseURL: env.baseUrl })
      const page = await context.newPage()

      try {
        await loginThroughForm(page, user)
      } catch (err) {
        // Screenshot is best-effort diagnostic; under font-loading hangs it can
        // itself time out and mask the original login error. Short timeout +
        // animations off keeps the failure surface the real cause.
        try {
          await page.screenshot({
            path: path.join(authDir, `${user.role}-login-failure.png`),
            timeout: 5000,
            animations: 'disabled',
          })
        } catch {
          // ignore screenshot failures; the primary error below is what matters
        }
        throw new Error(
          `[e2e] globalSetup: login failed for ${user.email} (role=${user.role}). ` +
            `Cause: ${(err as Error).message}`
        )
      }

      if (user.unlockCashflow) {
        await page.evaluate(() => {
          sessionStorage.setItem('cashflow_unlocked', 'true')
        })
      }

      await context.storageState({ path: storageStatePath(user.role) })
      console.log(`[e2e] stored auth for ${user.role} -> ${storageStatePath(user.role)}`)
      await context.close()
    }
  } finally {
    await browser.close()
  }
}
