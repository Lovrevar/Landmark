# Module: Help (in-app guidance)

**Path:** `src/components/Help/`, `src/components/ui/InfoHint.tsx`, `src/lib/helpKb.ts`, `src/lib/helpEvents.ts`

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

**Who sees an article** (`isVisibleToRole`): the roles it lists, plus any role that can open a page
it is tagged to. `roles` alone hid the Budget Control guide from a Sales user working on Budget
Control. "Can open" is `canRoleAccessRoute` in `src/utils/routeAccess.ts` — the router's guards as
data (Cashflow routes → Director/Accounting; General reports and Activity Log → Director; the
Supervision role → only the pages it is offered). `routeAccess.test.ts` reads `App.tsx` and
`Layout.tsx` and fails if the lists drift from the real guards. An article with no `routes` goes
by `roles` alone.

`[[article-id]]` references become links; one pointing at an article the reader cannot open is
shown as plain text. Group is derived from the id prefix: `term-`/`terminology-` → terms,
`role-` → roles, anything else → page guides.

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

## Usage logging

`logHelpEvent` (`src/lib/helpEvents.ts`) writes to `activity_logs` under entity `help`, severity
low. No new table or migration.

| Action | When | Metadata |
|---|---|---|
| `help.view` | `/help` index or an article is opened | `article_id` (null for the index), `from_page` |
| `help.page_link_click` | the "?" beside a page title is clicked | `page` |
| `help.hint_open` | an `InfoHint` is opened | `hint_id`, `page` |

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
```

## Hints in place

| `hintId` | Screen | Article |
|---|---|---|
| `budget_control.cpi` / `.spi` / `.eac` / `.vac` | General → Budget Control, EVM cards | `term-evm` |
| `invoices.type` | Cashflow → Invoices: Type column header on desktop, beside the type filter below `md` where the table has no header row (`InvoiceTypeHint.tsx`, legend built from `ALL_INVOICE_TYPES`) | `term-invoice-types` |
| `payments.source`, `payments.cesija` | both payment forms (`Cashflow/components/PaymentHints.tsx`) | `term-kompenzacija`, `term-cesija` |
| `tic.phases`, `tic.row_mismatch` | Funding → TIC, Investment tab | `tic` |
| `funding.allocations` | Funding → Investments, allocations heading | `funding-investments` |

## Adding guidance

1. Durable explanation → write or update the article in `help-kb/`, set `routes` and `roles`, run
   `npm run kb:build`.
2. A label that needs a sentence at the point of use → `InfoHint` with a stable `hintId` and the
   article's id. Strings in both locale files.
3. Add the hint to the table above and its article id to the list in `helpKb.test.ts`, which fails
   if a hint points at an article that no longer exists.
