import { createAdminClient } from './support/supabase-admin'
import { cleanupByPrefix } from './support/cleanup'
import { runId } from './support/namespace'

export default async function globalTeardown(): Promise<void> {
  const admin = createAdminClient()
  try {
    await cleanupByPrefix(admin, runId)
    console.log(`[e2e] globalTeardown: swept rows with prefix '${runId}'`)
  } catch (err) {
    console.warn(`[e2e] globalTeardown failed:`, (err as Error).message)
  }
}
