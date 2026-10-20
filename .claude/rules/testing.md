---
paths:
  - "src/**"
  - "supabase/migrations/**"
  - "supabase/tests/**"
---

# Tests

Why these rules exist, and the rest of the plan: [`docs/REGRESSION_PREVENTION.md`](../../docs/REGRESSION_PREVENTION.md).

- **Fixing a bug: the failing test comes first.** Name it after the backlog id
  (`it('GEN-23: …')`), run it, see it fail, then fix the code until it passes
- **Assert what the user sees** — the total on the card, the CPI, the forecast, the row count, the
  refusal — not an intermediate value. GEN-22's test checked only PV, and the bug came back in
  CPI and EAC as GEN-23
- **Never delete, skip or loosen an existing assertion to get to green.** An expectation that is
  genuinely wrong is changed on purpose, with a comment naming the backlog id, and listed in the
  `/done` report. A hook (`.claude/hooks/guard-tests.mjs`) asks the user before any such edit
- **A figure that is "1 by construction" is not a measurement.** When there is nothing to measure,
  return an availability flag and let the screen show "—" with the reason (GEN-20, GEN-23)
- **Check a figure change against real data before calling it done.** Run old and new code over
  the read-only rows of LandmarkDemo and, for a release, production; report what moves
- **A policy, function or trigger is tested in SQL**, in `supabase/tests/database/` (pgTAP, run
  with `npm run test:db` after `supabase start`), acting as a real user of each role. How to
  write one: `docs/TESTING.md` → Database tests. Undo the fix in a scratch migration and see
  the test fail, then delete the scratch migration
- Tests that read a migration's text only hold while that migration is the latest definition —
  `src/lib/migrationSupersession.test.ts` checks it. Add a row there for every new text test
