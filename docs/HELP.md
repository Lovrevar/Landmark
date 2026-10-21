# Module: Help (in-app guidance)

**Path:** `src/components/Help/`, `src/components/ui/InfoHint.tsx`, `src/lib/helpKb.ts`, `src/lib/helpEvents.ts`, `src/lib/helpNews.ts`, `scripts/help-screenshots/`

## Overview

Three ways the app explains itself, all reading one source — the Croatian articles in `help-kb/*.md`
that the AI assistant also answers from:

| Piece | Where | What it does |
|---|---|---|
| Help page | `/help`, `/help/:articleId` | Searchable list of articles the user's role may read, grouped into page guides, terms and roles |
| Page link | the "?" beside a `PageHeader` title | Opens `/help?page=<pathname>` in a new tab, with that page's articles first. Hidden when no article names the route |
| `InfoHint` | a "?" beside a label | A one- or two-sentence popover with a "more" link to an article |

A "?" in the top bar (`Layout.tsx`) opens `/help` from anywhere. Pages that have a title of their
own instead of `PageHeader` (dashboards, Budget Control, TIC, Tasks, …) render `PageHelpLink`
inside it, so every page with an article has the link.

Two more pieces came in phase 2:

| Piece | Where | What it does |
|---|---|---|
| Starter questions | the assistant's empty panel (`AiChat/lib/starterQuestions.ts`) | Up to three opening questions for the page behind the panel: one about the page, then one per help article written for it |
| "Open TIC" link | `Funding/TIC/OpenTICLink.tsx` | Wherever a project shows "Budžet nije postavljen" (Budget Control, project details), a link to `/tic?project=<id>` for the roles that can save a TIC (`canManageTIC`) |

The Cashflow password prompt is not shown on `/help`: a "?" on a Cashflow page opens Help in a new
tab, where the per-tab unlock is missing, and the prompt used to cover the article.

Phase 3 added four more (record: [GUIDANCE_PHASE_3.md](./GUIDANCE_PHASE_3.md)):

| Piece | Where | What it does |
|---|---|---|
| Assistant ↔ Help | `supabase/functions/_shared/help-search.ts`, the Help page's empty search | An answer taken from an article ends with a link to it; a search that finds nothing offers **Pitaj AI asistenta**, which opens the assistant on a new conversation with the query. See [AI_CHAT.md](./AI_CHAT.md), "search_help retrieval" |
| Release notes | `help-kb/news-*.md`, `WhatsNewBanner.tsx` in `Layout` | "Što je novo" group on the Help page, newest first, and a one-line banner above every page until the user opens the newest note or dismisses the line |
| Screenshots | `help-kb/img/`, `scripts/help-screenshots/` | Pictures inside articles (18 in 18 articles), retaken from the demo data by `npm run help:shots` |
| Hints in forms | six more `InfoHint`s (table below) | |

**Division of labour:** an `InfoHint` says just enough to carry on with the task; the durable
explanation lives in the article it links to. Do not grow hints into paragraphs — they break when
the UI moves, articles do not.

## `help-kb/` is the single source

- The Help page bundles the `.md` files as raw text (`services/helpArticleSource.ts`, an eager
  `import.meta.glob` inside one lazily imported module, so it is a single on-demand chunk).
- The assistant reads `supabase/functions/_shared/help-kb-index.json`, built by `npm run kb:build`.
- `src/lib/helpKb.ts` parses frontmatter with the same rules as that build script. Keep the two in
  step; `helpKb.test.ts` runs against the real `help-kb/` directory.

Frontmatter the page uses:

| Key | Use |
|---|---|
| `id`, `title`, `keywords` | identity and search (title > keywords > body; a word that *starts* with the query outranks one that only contains it, so "račun" lists invoice articles before "Kontrola proračuna"; every query word must match; diacritics ignored) |
| `routes` | route patterns as in `App.tsx` (`/projects/:id`) — which pages the "?" link appears on |
| `roles` | who the article is written for. Empty = everyone. For the assistant this is only a down-rank; on the Help page it is half of the filter (below) |
| `assistant_only: true` | keeps an article off the Help page but in the assistant's index — for notes about stored values a user never sees (`term-status-casing`) |
| `date` | `yyyy-mm-dd`, on a release note: shown beside its title, orders the "Što je novo" group, and is what the banner compares with what the user has seen |

**Who sees an article** (`isVisibleToRole`): the roles it lists, plus any role that can open a page
it is tagged to. `roles` alone hid the Budget Control guide from a Sales user working on Budget
Control. "Can open" is `canRoleAccessRoute` in `src/utils/routeAccess.ts` — the router's guards as
data (Cashflow routes → Director/Accounting; General reports and Activity Log → Director; the
Supervision role → only the pages it is offered). `routeAccess.test.ts` reads `App.tsx` and
`Layout.tsx` and fails if the lists drift from the real guards. An article with no `routes` goes
by `roles` alone.

`[[article-id]]` references become links; one pointing at an article the reader cannot open is
shown as plain text. Group is derived from the id prefix: `news-` → release notes,
`term-`/`terminology-` → terms, `role-` → roles, anything else → page guides.

Articles are Croatian only; the English UI says so above the list.

## Files

### index.tsx
- The page: search box, "for the page you came from" card (from `?page=`), three group cards, and
  the single-article view rendered with `MarkdownView`
- A direct link to an article hidden from the user's role shows "article not available", not the text
- Logs `help.view` once per index visit or article opened

### hooks/useHelpArticles.ts
- `useHelpArticles()` → `{ articles, loading, error, refetch }`, already filtered for the user's role (see above)
- `useHelpArticleCount(pathname)` → number of articles for a route; 0 while loading or on failure,
  so a page header never shows an error because its help could not be counted

### services/helpArticles.ts, services/helpArticleSource.ts
- `loadHelpArticles()` — one cached dynamic import; throws on failure and does not cache the failure

### `src/lib/helpKb.ts` (pure)
- `parseHelpArticle`, `helpGroup`, `isVisibleToRole`, `routeMatches`, `articlesForRoute`,
  `searchArticles`, `resolveWikiLinks`, `helpArticlePath`

### `src/components/ui/InfoHint.tsx`
- See [UI.md](./UI.md). Built on `@floating-ui/react` for positioning only; Escape and focus go
  through the app's own `useEscapeKey` / `useFocusTrap` stacks so a hint inside a modal closes
  without closing the modal

## Release notes ("Što je novo")

- One article per release users will notice: `help-kb/news-YYYY-MM.md`, id with the `news-`
  prefix, a `date`, and normally no `roles` so everyone sees it. Add it to `INDEX.md` and run
  `npm run kb:build` — the assistant then answers "što je novo" from it too.
- **No production figures.** Every article is bundled into the client whatever the reader's role,
  and `roles` only filters the list. Say what changed in how a figure is computed, not the amount.
- `WhatsNewBanner` (in `Layout`, above the page) shows the newest note the role can see while it is
  newer than the date stored for that user. Opening the note or closing the line stores the note's
  date. Storage is `localStorage['help.news.seen.<userId>']` (`src/lib/helpNews.ts`), like the
  Tasks and Calendar view preferences: no table, so the line appears once more on a second
  device. A user's very first sign-in also shows the current note.
- The banner shows nothing while articles load or if they fail to.

## Screenshots

- Files live in `help-kb/img/`; an article shows one with `![opis](img/<file>.png)` on a line of
  its own. `helpArticleSource.ts` bundles their addresses (hashed, under `/assets/`), and
  `resolveHelpImages` points the reference at the file. `kb:build` strips image lines from the
  assistant's index.
- `helpKb.test.ts` fails if an article shows a file that does not exist, if a file is shown by no
  article, or if a file is over 300 KB.
- **Retaking them:** `npm run help:shots`. It builds the frontend against LandmarkDemo
  (`vite build --mode demo` into `dist-demo/`, so `.env.demo` must exist and the demo project must
  be awake — [DEMO_ENVIRONMENT.md](./DEMO_ENVIRONMENT.md)) and runs
  `scripts/help-screenshots/capture.spec.ts`, which signs in as the demo Director and takes every
  shot listed in `shots.ts`. `HELP_SHOTS_ONLY=tic,racun npm run help:shots` retakes only the files
  whose names contain one of the words; `HELP_SHOTS_OUT=<dir>` writes somewhere else for a look
  before overwriting.
- **Safeguards, because the pictures go to every user:** the config refuses to start unless
  `.env.demo` and the built bundle both name LandmarkDemo and nothing else; the run answers
  activity-log writes in the browser and aborts every other write, so a shot that clicks the wrong
  button fails instead of changing a row. It is not the e2e harness, whose setup creates users.
- Pictures are Croatian, light theme, 1280×800, without the top bar and menu; a form is captured
  as its dialog. The run uses the full Chromium build with `--lang=hr`, so the browser's own
  controls (the file picker's "Odaberi datoteku") are Croatian too.
- A step that waits on data waits for something on screen ("Prognoza (EAC)"), not only for the
  network to go quiet: a picture of the page before the cards rendered was the result otherwise. The demo's dates move with each reseed, so retake a picture when its screen
  changes, not on a schedule. Look at each retaken file before committing it.

## Visual check

`npm run help:check` (`scripts/help-screenshots/check.spec.ts`) signs in as the demo Director with
the same guards as `help:shots` and walks the guidance pieces — banner, Help page, release note,
an article with a picture, the empty search and the hand-over to the assistant, every phase 3
hint opened in place — at phone width, in dark mode and in English. Each screen is checked for
sideways scrolling, elements past the window edge, raw i18n keys, hint popovers outside the window
or without their "more" link, and console errors; the test fails with the list. Pictures and a
`findings.txt` per variant go to `docs/screenshots/guidance-phase-3/` (gitignored); the README
there records what was found. Add a screen to `SCREENS` when a new piece of guidance lands.

## Usage logging

`logHelpEvent` (`src/lib/helpEvents.ts`) writes to `activity_logs` under entity `help`, severity
low. No new table or migration.

| Action | When | Metadata |
|---|---|---|
| `help.view` | `/help` index or an article is opened | `article_id` (null for the index), `from_page` |
| `help.page_link_click` | the "?" beside a page title is clicked | `page` |
| `help.hint_open` | an `InfoHint` is opened | `hint_id`, `page` |
| `help.search_no_results` | a search on `/help` found nothing and the box rested 1.5 s on at least three characters | `query` |
| `help.ask_assistant` | that search was handed to the assistant | `query` |

`logActivity` skips the dashboard-cache invalidation for `help.*`, as it does for `export.*` and
`auth.*`. In General → Activity Log (Director only) they are **hidden by default**: tick "Also show
help usage", or pick the **Help** category. Hiding needs the `p_exclude_action_prefix` parameter
added by migration `20261005100000_activity_log_exclude_prefix.sql`; until that is applied the
page falls back to the old call, shows everything as before and does not offer the checkbox.
To see what is used:

```sql
select action, metadata->>'hint_id' as hint, metadata->>'article_id' as article,
       coalesce(metadata->>'page', metadata->>'from_page') as page, count(*)
from activity_logs where entity = 'help' group by 1, 2, 3, 4 order by count(*) desc;

-- what people looked for and did not find
select metadata->>'query' as query, count(*)
from activity_logs where action = 'help.search_no_results' group by 1 order by count(*) desc;
```

## Hints in place

| `hintId` | Screen | Article |
|---|---|---|
| `budget_control.cpi` / `.spi` / `.eac` / `.vac` | General → Budget Control, EVM cards | `term-evm` |
| `invoices.type` | Cashflow → Invoices: Type column header on desktop, beside the type filter below `md` where the table has no header row (`InvoiceTypeHint.tsx`, legend built from `ALL_INVOICE_TYPES`) | `term-invoice-types` |
| `payments.source`, `payments.cesija` | both payment forms (`Cashflow/components/PaymentHints.tsx`) | `term-kompenzacija`, `term-cesija` |
| `tic.phases`, `tic.row_mismatch` | Funding → TIC, Investment tab | `tic` |
| `funding.allocations` | Funding → Investments, allocations heading | `funding-investments` |
| `invoices.multi_vat` | first VAT base field of the invoice form and the retail invoice form (`Cashflow/components/MultiVatHint.tsx`) | `term-multi-vat` |
| `apartments.link_units` | both "link units" dialogs: Sales → Apartments and the Sales project grid (`Sales/components/LinkedUnitsHint.tsx`) | `term-unit-types` |
| `contracts.no_contract` | the "Bez ugovora" checkbox in the Supervision subcontractor form and the note in Cashflow → Suppliers → link to project (`Common/NoContractHint.tsx`) | `term-has-contract` |
| `projects.phases_vs_milestones` | project details → Faze i ugovori, "Faze projekta" heading | `term-faza-vs-prekretnica` |
| `projects.realized` | project details → Podugovaratelji, the "Ukupno realizirano" card (`StatCard`'s `hint`; not the column header, which the phone card view does not show) | `term-realised-budget` |
| `projects.budget_from_tic` | the read-only budget field of the project form | `term-budzet-iz-tic` |

The three project hints are in `General/Projects/ProjectHints.tsx`.

## Adding guidance

1. Durable explanation → write or update the article in `help-kb/`, set `routes` and `roles`, run
   `npm run kb:build`.
2. A label that needs a sentence at the point of use → `InfoHint` with a stable `hintId` and the
   article's id. Strings in both locale files.
3. Add the hint to the table above and its article id to the list in `helpKb.test.ts`, which fails
   if a hint points at an article that no longer exists.
