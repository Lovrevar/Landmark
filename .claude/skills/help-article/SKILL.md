---
name: help-article
description: Use after changing what a screen shows or does, or when adding a feature users will notice — updates the matching help-kb article, the release note and screenshots, and rebuilds the assistant's index.
---

# Update the help

Articles: !`ls help-kb/*.md | wc -l` in `help-kb/`, newest release note:
!`ls help-kb/news-*.md | tail -1`

1. Find the article for the screen: `grep -l` the route or component name in `help-kb/`, or the
   `routes:` frontmatter. Read `docs/HELP.md` for frontmatter and linking (`[[id]]`) rules
2. Update the text to match what the screen does now. Articles are in Croatian; keep domain
   terms as they appear on screen. **No production figures** — every article ships to every
   user's browser
3. A change users will notice → add a bullet to this month's `help-kb/news-YYYY-MM.md` (create
   it with a `date` in the frontmatter if the month has none yet)
4. `npm run kb:build`
5. If the article embeds a screenshot of the changed screen, say it needs `npm run help:shots`
   (needs `.env.demo`); run it only if the user agrees
