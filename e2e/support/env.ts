import dotenv from 'dotenv'
import path from 'node:path'

dotenv.config({ path: path.resolve(process.cwd(), '.env') })
dotenv.config({ path: path.resolve(process.cwd(), '.env.test') })

function required(name: string): string {
  const value = process.env[name]
  if (!value) {
    throw new Error(
      `[e2e] Missing required env var: ${name}. See .env.test.example and e2e/README.md.`
    )
  }
  return value
}

export const env = {
  supabaseUrl: required('VITE_SUPABASE_URL'),
  supabaseAnonKey: required('VITE_SUPABASE_ANON_KEY'),
  serviceRoleKey: required('SUPABASE_SERVICE_ROLE_KEY'),
  allowedSupabaseUrl: required('E2E_ALLOWED_SUPABASE_URL'),
  cashflowPassword: process.env.VITE_CASHFLOW_PASSWORD ?? 'admin',
  // 127.0.0.1 (not "localhost") keeps Playwright's browser on IPv4. Under
  // WSL2, /etc/hosts resolves "localhost" to ::1 (IPv6) while Vite's dev
  // server binds to 127.0.0.1 by default, and Chromium hangs on the IPv6
  // attempt rather than falling back to IPv4. Override with E2E_BASE_URL in
  // environments where this is not needed.
  baseUrl: process.env.E2E_BASE_URL ?? 'http://127.0.0.1:5173',
}

if (env.supabaseUrl !== env.allowedSupabaseUrl) {
  throw new Error(
    `[e2e] Prod-safety check failed.\n` +
      `  VITE_SUPABASE_URL           = ${env.supabaseUrl}\n` +
      `  E2E_ALLOWED_SUPABASE_URL    = ${env.allowedSupabaseUrl}\n` +
      `Refusing to run tests. Set E2E_ALLOWED_SUPABASE_URL to the dev Supabase URL ` +
      `and ensure VITE_SUPABASE_URL points to the same project.`
  )
}
