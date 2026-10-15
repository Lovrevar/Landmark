---
name: done
description: Run before saying a change is finished, ready to commit, or ready for review — verifies it (typecheck, unit tests, lint on changed files) and walks the project's housekeeping (activity log, i18n, help articles, docs, backlog).
---

# Done check

Changed so far:

!`git status --short`

!`git diff --stat HEAD`

## 1. Verify

Run these and fix what fails. Report failures with their output; never call the work done
while one is red.

- `npm run typecheck`
- `npm test`
- `npx eslint <changed .ts/.tsx files>`
- Edge functions changed (`supabase/functions/**`): `npm run test:functions` if `deno` is installed
- A screen changed: if you can, look at it running (`/run`); otherwise say it was not seen

## 2. Housekeeping — check each that applies to the diff

- **Mutations:** every new insert/update/delete calls `logActivity()`; updates and deletes that
  must hit a row use `.select('id')` + `assertRowsAffected`
- **Lists** that can pass 1000 rows go through `fetchAllRows`
- **Strings:** new UI text is in both `src/locales/hr` and `src/locales/en`; ambiguous
  translations were asked about, not guessed
- **Help:** a screen's behaviour or content changed → its `help-kb/` article is updated,
  `npm run kb:build` was run, screenshots retaken if the article shows that screen. A release
  users will notice → `help-kb/news-YYYY-MM.md`
- **Docs:** new files or major changes → the module's `docs/*.md` and `docs/CODEBASE_INDEX.md`
- **Migrations:** written, not applied; listed in `docs/backlog/release.md` for applying
- **Backlog:** anything found and not fixed has an entry (`/backlog`); anything fixed is closed

## 3. Report

One short list: what was verified and how, what was skipped and why, and any backlog ids added
or closed.
