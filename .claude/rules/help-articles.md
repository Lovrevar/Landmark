---
paths:
  - "help-kb/**"
  - "src/components/Help/**"
  - "scripts/build-help-kb-index.mjs"
  - "scripts/help-screenshots/**"
---

# Help articles

The AI assistant answers "how do I…" questions from `help-kb/*.md`, and the same articles are
shown on the `/help` page and linked from `InfoHint` popovers. Stale articles make the assistant
give wrong answers.

- After editing an article, run `npm run kb:build`
- If the article shows a screenshot of the screen you changed, retake it (`npm run help:shots`,
  needs `.env.demo`)
- A release that users will notice gets a note: `help-kb/news-YYYY-MM.md` with a `date` in the
  frontmatter. The newest one is announced in a banner until each user opens or dismisses it
- Never put production figures in an article — all of them ship to every user's browser
- Frontmatter, grouping and screenshot rules: [`docs/HELP.md`](../../docs/HELP.md)
