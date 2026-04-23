import { defineConfig, devices } from '@playwright/test'
import { env } from './e2e/support/env'
import './e2e/support/namespace'

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  // Cap workers to 2 locally too. The Vite dev server is single-process; under
  // default parallelism (~half of CPU count) concurrent hydration of freshly
  // loaded React routes pushes past the expect timeout and produces flakes
  // even though the page eventually renders correctly.
  workers: 2,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : [['list']],
  timeout: 120_000,
  // Bumped from 15s to 60s so expect.toBeVisible() tolerates cold-start
  // hydration: on the first navigation to a route whose modules Vite hasn't
  // compiled yet, React can take 30-45s to mount even after the HTTP navigation
  // has committed. Genuinely broken tests will still fail, just slightly
  // slower.
  expect: { timeout: 60_000 },
  globalSetup: './e2e/globalSetup.ts',
  globalTeardown: './e2e/globalTeardown.ts',
  use: {
    baseURL: env.baseUrl,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    // Bumped to match expect timeout: locator.click() / .fill() use
    // actionTimeout, not expect timeout, and the first interaction with a
    // cold-compiled route (Vite dev lazily serves each module on first
    // visit) can take 30-45s before the element is actually clickable.
    actionTimeout: 60_000,
    // Vite dev compiles modules on first request; per-spec navigations after
    // globalSetup are mostly cached, but component routes that weren't yet
    // traversed (e.g. /retail-customers, /work-logs) still pay compile cost.
    navigationTimeout: 60_000,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    // Use a production build + preview rather than `vite` dev: the dev server
    // serves hundreds of unbundled ES modules on first visit to each route,
    // and on constrained environments (WSL2, low-memory) each cold-start
    // navigation can take 45-60s before React mounts. Preview serves one
    // pre-built bundle — every page.goto completes in <1s.
    //
    // Build is incremental, so rebuilds are fast when source hasn't changed.
    command: 'npm run build && npm run e2e:serve',
    url: env.baseUrl,
    reuseExistingServer: !process.env.CI,
    timeout: 300_000,
    stdout: 'pipe',
    stderr: 'pipe',
  },
})
