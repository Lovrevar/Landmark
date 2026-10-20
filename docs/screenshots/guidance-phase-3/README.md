# Visual check — user guidance phase 3

**Date:** 2026-10-14 · **Branch:** `feat/user-guidance-phase-3` · **Run with:** `npm run help:check`
(`scripts/help-screenshots/check.spec.ts`)

## What it covers

Signed in as the demo Director on LandmarkDemo, in three variants: phone 390×844 light Croatian,
desktop 1280×800 dark Croatian, desktop 1280×800 light English. Each variant visits:

- the "Što je novo" banner, the Help index, the release note, an article with a screenshot;
- an empty Help search with **Pitaj AI asistenta**, and the assistant panel after the hand-over;
- each of the six phase 3 hints opened in place (VAT bases, linked units, "Bez ugovora" in the
  subcontractor form and in the supplier link form, project phases, "Ukupno realizirano", the
  project form's budget).

Every screen is checked automatically for a page that scrolls sideways, an element past the edge
of the window, a raw i18n key on screen, a hint popover outside the window or without its "more"
link, and console errors. The pictures (gitignored, one folder per variant) were then looked at.

**Read-only:** the same guards as `help:shots` — demo project only, writes refused, activity-log
rows answered in the browser, the assistant's edge function blocked. That is why the hand-over
screen shows the assistant's error bubble under the question.

## Findings

Fixed on the branch:

1. **English supplier link note** showed a database column: "…without a contract
   (has_contract = false)". Phase 2 had removed it from the Croatian string only.
2. **English linked-units hint** quoted "Total package"; the screen says "Total Package".
3. **"Realizirano" hint unreachable on phones** (known before the check): it moved from the
   column header, which the phone card view does not show, to the "Ukupno realizirano" card,
   through a new `hint` prop on `StatCard`.

Seen and left as they are:

- In the English UI the banner shows the release note's Croatian title. Articles are Croatian
  only; the Help page says so above every article.
- Help screenshots are light-theme pictures; in dark mode they show as a bright panel with a
  border. Readable; not worth a second set of pictures.
- On a phone a hint popover can cover the text right below its "?" (the "Bez ugovora" note, the
  supplier link dialog's title). It closes on the next tap.

Not checked: following an app link in an assistant answer on a phone. It needs a real reply,
which means the deployed function and a write to `ai_messages`.
