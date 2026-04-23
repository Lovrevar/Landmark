import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { env } from './env'

export function createAdminClient(): SupabaseClient {
  return createClient(env.supabaseUrl, env.serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  })
}
