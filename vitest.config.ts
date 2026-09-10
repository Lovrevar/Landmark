import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'node',
    /**
     * Stub Supabase credentials, so the suite does not depend on a developer's .env.
     *
     * `src/lib/supabase.ts` calls createClient() at module scope, and createClient throws
     * "supabaseUrl is required" on an undefined URL. Any test that transitively imports it —
     * ticExport.test.ts reaches it through ticExport -> activityLog — therefore fails to load
     * at all on a machine without .env. That is every CI runner, which is why this passed
     * locally and failed in GitHub Actions.
     *
     * These values are never dialled: the client is constructed, never called. Overridden by a
     * real .env when one is present.
     */
    env: {
      VITE_SUPABASE_URL: 'http://stub.supabase.test',
      VITE_SUPABASE_ANON_KEY: 'stub-anon-key',
    },
    include: ['src/**/*.test.ts'],
    exclude: ['e2e/**', 'node_modules/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/**/*.ts'],
    },
  },
});
