import { chromium } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'
import { env } from './support/env'
import { runId } from './support/namespace'
import { createAdminClient } from './support/supabase-admin'
import { SETUP_USERS, LOGOUT_USER, loginThroughForm, storageStatePath } from './support/auth'

// Provision the E2E auth users via the Admin API (idempotent). This replaces the
// brittle raw-SQL auth.users seeding — GoTrue owns the password hash + identity
// invariants, so createUser is the only reliable way to make a loginable user.
// After a dev-DB reset the users simply re-create themselves on the next run.
async function ensureSeedUsers(): Promise<void> {
  const admin = createAdminClient()

  for (const user of SETUP_USERS) {
    // Existence check via public.users (PostgREST, public schema) rather than the
    // GoTrue admin listUsers endpoint — listUsers fails wholesale ("Database error
    // finding users") if any auth.users row is malformed, whereas this query is
    // unaffected. public.users.auth_user_id mirrors auth.users.id.
    const { data: existing, error: selErr } = await admin
      .from('users')
      .select('auth_user_id')
      .eq('email', user.email)
      .maybeSingle()
    if (selErr) throw new Error(`[e2e] ensureSeedUsers: lookup ${user.email} failed: ${selErr.message}`)
    let id: string | undefined = (existing?.auth_user_id as string | undefined) ?? undefined

    // The logout user is owned entirely by the suite (no dependent data), so
    // force a clean slate: delete the auth user if present and clear any stale
    // public.users row before recreating. (A prior seed could leave the auth row
    // and its public.users mapping out of sync, so tolerate "user not found".)
    // The five role users may carry dependent data (e.g. the Supervision
    // project_managers link), so they are only created when missing, never deleted.
    if (user === LOGOUT_USER) {
      if (id) {
        const { error: delErr } = await admin.auth.admin.deleteUser(id)
        if (delErr && !/not[\s_-]?found/i.test(delErr.message)) {
          throw new Error(`[e2e] ensureSeedUsers: deleteUser ${user.email} failed: ${delErr.message}`)
        }
      }
      const { error: clrErr } = await admin.from('users').delete().eq('email', user.email)
      if (clrErr) throw new Error(`[e2e] ensureSeedUsers: clear stale ${user.email} failed: ${clrErr.message}`)
      id = undefined
    }

    if (!id) {
      const { data, error } = await admin.auth.admin.createUser({
        email: user.email,
        password: user.password,
        email_confirm: true,
        app_metadata: { role: user.appRole },
      })
      if (error) throw new Error(`[e2e] ensureSeedUsers: createUser ${user.email} failed: ${error.message}`)
      id = data.user!.id
      console.log(`[e2e] provisioned auth user ${user.email} (${user.appRole})`)
    }

    // Ensure the public.users role mapping independently of the auth.users
    // trigger (which may not survive a migrations-only reset).
    const { error: upErr } = await admin
      .from('users')
      .upsert(
        { auth_user_id: id, username: user.email.split('@')[0], email: user.email, role: user.appRole },
        { onConflict: 'auth_user_id' },
      )
    if (upErr) throw new Error(`[e2e] ensureSeedUsers: users upsert ${user.email} failed: ${upErr.message}`)
  }
}

export default async function globalSetup(): Promise<void> {
  const authDir = path.resolve('e2e/.auth')
  fs.mkdirSync(authDir, { recursive: true })

  console.log(`[e2e] runId = ${runId}`)
  console.log(`[e2e] target = ${env.supabaseUrl}`)
  console.log(`[e2e] base URL = ${env.baseUrl}`)

  await ensureSeedUsers()

  const browser = await chromium.launch()
  try {
    for (const user of SETUP_USERS) {
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
