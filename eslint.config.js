import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist', 'dist-demo', 'coverage'] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      // eslint-plugin-react-hooks 7 turns the React Compiler rules on as errors. The code base
      // predates them: three rules stay warnings (171 findings on 2026-11-05, 142 of them setState
      // inside an effect, the "load on mount, store the result" shape of the form hooks) until
      // backlog UI-18 walks them. The `lint` script's --max-warnings ceiling keeps the count from
      // growing; lower it whenever some are cleared.
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/immutability': 'warn',
      'react-hooks/preserve-manual-memoization': 'warn',
      'react-refresh/only-export-components': [
        'warn',
        { allowConstantExport: true },
      ],
      // Allow underscore-prefixed names as an explicit "intentionally unused"
      // signal — e.g. `const { created_by: _omit, ...rest } = payload`.
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          destructuredArrayIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],
      // Confirmations go through ConfirmDialog (CLAUDE.md "Architecture and
      // Conventions"). Separate rules from no-restricted-syntax, which the
      // hooks block below overrides per file.
      'no-restricted-globals': [
        'error',
        { name: 'confirm', message: 'Use ConfirmDialog from src/components/ui, never the native confirm().' },
      ],
      'no-restricted-properties': [
        'error',
        { object: 'window', property: 'confirm', message: 'Use ConfirmDialog from src/components/ui, never window.confirm().' },
      ],
    },
  },
  {
    // Playwright e2e tests are not React: fixture signatures use empty `{}`
    // destructuring patterns, and the `use` callback is the Playwright fixture
    // API — the React Hooks plugin otherwise misreads it as the `use` hook.
    files: ['e2e/**/*.{ts,tsx}'],
    rules: {
      'react-hooks/rules-of-hooks': 'off',
      'no-empty-pattern': 'off',
    },
  },
  {
    // Enforce the documented architecture: UI → Hook → Service → Supabase.
    // Hooks should orchestrate state and call services; services own the DB
    // queries (and the logActivity calls that go with them).
    files: ['src/components/**/hooks/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: "ImportDeclaration[source.value=/lib\\u002Fsupabase$/] ImportSpecifier[imported.name='supabase']",
          message: 'Hooks must call services, not supabase directly. Move queries/mutations to a services/ file and import the function from there. See CLAUDE.md "Architecture and Conventions".',
        },
      ],
    },
  },
  {
    // Realtime/notification hooks legitimately need supabase.channel() and
    // .removeChannel(); there is no analogous service layer for subscriptions.
    files: [
      'src/components/Tasks/hooks/useTasksRealtime.ts',
      'src/components/Chat/hooks/useChat.ts',
      'src/components/Chat/hooks/useChatNotifications.ts',
      'src/components/Calendar/hooks/useTasksInRange.ts',
      'src/components/Calendar/hooks/useEventsInRange.ts',
      'src/components/Calendar/hooks/useCalendarReminderToasts.ts',
    ],
    rules: {
      'no-restricted-syntax': 'off',
    },
  }
);
