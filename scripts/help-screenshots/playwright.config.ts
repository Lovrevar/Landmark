import { readdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from '@playwright/test'
import dotenv from 'dotenv'

// Screenshots for the help articles (help-kb/img/). Run with `npm run help:shots`, which first
// builds the frontend against LandmarkDemo into dist-demo/. See docs/HELP.md, "Screenshots".
//
// Deliberately not the e2e harness: its global setup creates users in whatever database it is
// pointed at. This config only ever signs in as the demo accounts and reads.

/** LandmarkDemo — the seeded showcase project with fabricated data (docs/DEMO_ENVIRONMENT.md). */
const DEMO_PROJECT_REF = 'asvuyvmuzroyrzlgyzij'
const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = join(HERE, '..', '..')
const DEMO_BUILD_DIR = join(ROOT, 'dist-demo')
const PORT = 5183

const demoEnv = dotenv.parse(readFileSync(join(ROOT, '.env.demo')))
if (!demoEnv.VITE_SUPABASE_URL?.includes(DEMO_PROJECT_REF)) {
  throw new Error(`help:shots refuses to run: .env.demo does not point at LandmarkDemo (${DEMO_PROJECT_REF}).`)
}

// The database address is inlined at build time, so the env file alone proves nothing about the
// bundle that will be served. The screenshots are published to every user: they must come from
// the demo data and nothing else.
const bundle = readdirSync(join(DEMO_BUILD_DIR, 'assets'))
  .filter(file => file.endsWith('.js'))
  .map(file => readFileSync(join(DEMO_BUILD_DIR, 'assets', file), 'utf8'))
  .join('\n')
const projectRefs = new Set([...bundle.matchAll(/https:\/\/([a-z0-9]{20})\.supabase\.co/g)].map(match => match[1]))
if (projectRefs.size !== 1 || !projectRefs.has(DEMO_PROJECT_REF)) {
  throw new Error(`help:shots refuses to run: dist-demo/ was built for ${[...projectRefs].join(', ') || 'no project'}, not LandmarkDemo.`)
}

export default defineConfig({
  testDir: HERE,
  testMatch: 'capture.spec.ts',
  workers: 1,
  reporter: [['list']],
  timeout: 300_000,
  expect: { timeout: 20_000 },
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    viewport: { width: 1280, height: 800 },
    locale: 'hr-HR',
    timezoneId: 'Europe/Zagreb',
    colorScheme: 'light',
    actionTimeout: 20_000,
    navigationTimeout: 30_000,
  },
  webServer: {
    command: `npx vite preview --outDir dist-demo --host 127.0.0.1 --port ${PORT} --strictPort`,
    url: `http://127.0.0.1:${PORT}`,
    cwd: ROOT,
    // Never reuse: a server already on the port could be serving a build for another database.
    reuseExistingServer: false,
  },
})
