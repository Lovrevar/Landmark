// Demo-user provisioner for the showcase Supabase project.
//
// scripts/seed-demo-data.mjs needs users to already exist — it reads public.users
// for created_by / project_managers / task assignees and refuses to run against an
// empty roster. Until now the only way to create app users was the Playwright
// globalSetup, which provisions e2e-*@mail.com accounts. Those are fine for tests
// and wrong for a demo, so this script owns the demo roster.
//
// Idempotent: re-running leaves existing users alone and only fixes their
// public.users mapping. Safe to run before every reseed.
//
// Usage:  node --env-file=.env scripts/seed-demo-users.mjs
//         DEMO_USER_PASSWORD=... node --env-file=.env scripts/seed-demo-users.mjs

import { createClient } from '@supabase/supabase-js'

// Same allowlist as seed-demo-data.mjs. Production is deliberately absent: this
// script creates working logins, which is the last thing prod needs.
const SEEDABLE_PROJECTS = [
  'nxvbglegqcgxlxvyfuht', // LandmarkDev
  'asvuyvmuzroyrzlgyzij', // LandmarkDemo
]

const url = process.env.VITE_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) throw new Error('VITE_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY missing (run with --env-file=.env)')
if (!SEEDABLE_PROJECTS.some((ref) => url.includes(ref))) {
  throw new Error(`Safety check failed: ${url} is not a seedable project (${SEEDABLE_PROJECTS.join(', ')}).`)
}

const DEFAULT_PASSWORD = 'cognilion-demo'
const password = process.env.DEMO_USER_PASSWORD ?? DEFAULT_PASSWORD

const db = createClient(url, key, { auth: { persistSession: false } })

// `username` is what the Chat sender label, the task assignee chips and the
// calendar participant list render — hence real names rather than email stems.
// `role` is constrained to these five values by users_role_check.
const DEMO_USERS = [
  { email: 'direktor@adriatic-demo.hr', username: 'Ivan Kovačević', role: 'Director' },
  { email: 'racunovodstvo@adriatic-demo.hr', username: 'Ana Novak', role: 'Accounting' },
  { email: 'prodaja@adriatic-demo.hr', username: 'Marina Babić', role: 'Sales' },
  { email: 'nadzor@adriatic-demo.hr', username: 'Petar Jurić', role: 'Supervision' },
  { email: 'investicije@adriatic-demo.hr', username: 'Luka Marasović', role: 'Investment' },
]

console.log(`Provisioning ${DEMO_USERS.length} demo users on ${url}`)
if (password === DEFAULT_PASSWORD) {
  console.log(`  ! using the default password "${DEFAULT_PASSWORD}" — set DEMO_USER_PASSWORD to override`)
}

/**
 * Resolve an existing auth user id by email.
 *
 * public.users is checked first (plain PostgREST, unaffected by a malformed
 * auth.users row). The GoTrue admin listUsers endpoint is the fallback for the
 * one case public.users cannot see: an auth user that exists with no mapping row,
 * which is what a half-finished earlier run leaves behind. listUsers can fail
 * wholesale, so its failure is reported rather than swallowed.
 */
async function findAuthUserId(email) {
  const { data, error } = await db.from('users').select('auth_user_id').eq('email', email).maybeSingle()
  if (error) throw new Error(`lookup ${email}: ${error.message}`)
  if (data?.auth_user_id) return data.auth_user_id

  const { data: page, error: listErr } = await db.auth.admin.listUsers({ perPage: 1000 })
  if (listErr) throw new Error(`listUsers (resolving ${email}): ${listErr.message}`)
  return page?.users?.find((u) => u.email?.toLowerCase() === email.toLowerCase())?.id ?? null
}

const created = []
for (const user of DEMO_USERS) {
  let id = await findAuthUserId(user.email)

  if (id) {
    console.log(`  = ${user.email} already exists`)
  } else {
    const { data, error } = await db.auth.admin.createUser({
      email: user.email,
      password,
      email_confirm: true, // no inbox exists for adriatic-demo.hr, so confirm up front
      app_metadata: { role: user.role },
    })
    if (error) throw new Error(`createUser ${user.email}: ${error.message}`)
    id = data.user.id
    created.push(user.email)
    console.log(`  + ${user.email} (${user.role})`)
  }

  // Written explicitly rather than left to handle_new_user(): the app reads the
  // role from public.users, and that trigger does not reliably survive a
  // migrations-only database build. The upsert also repairs a drifted role.
  const { error: upErr } = await db
    .from('users')
    .upsert({ auth_user_id: id, username: user.username, email: user.email, role: user.role }, { onConflict: 'auth_user_id' })
  if (upErr) throw new Error(`users upsert ${user.email}: ${upErr.message}`)
}

console.log(`\nDone. ${created.length} created, ${DEMO_USERS.length - created.length} already present.`)
console.log('\n  Role          Email                              Password')
console.log('  ' + '-'.repeat(68))
for (const u of DEMO_USERS) {
  console.log(`  ${u.role.padEnd(13)} ${u.email.padEnd(34)} ${password}`)
}
console.log('\nNext: node --env-file=.env scripts/seed-demo-data.mjs')
