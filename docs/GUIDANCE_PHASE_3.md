# User guidance, phase 3

**Date:** 2026-10-12 · **Branch:** `feat/user-guidance-phase-3` (off `development`) · **Status:** written, not committed

Phases 1 and 2 built the Help page, the "?" links, `InfoHint` and the corrected articles. Phase 3
connects the assistant with the Help page, puts hints into forms, adds release notes and puts
screenshots into articles. How the pieces work is in [HELP.md](./HELP.md); this file records what
the phase changed, what needs sign-off and what it found.

## 1. What changed

| # | Item | Result |
|---|---|---|
| 1 | Assistant → article | `search_help` gives the model each article's Help-page path, and the prompt tells it to end an answer with that link. No link for an `assistant_only` article or one written for other roles. `/help` is now a known route for the assistant's page context. |
| 2 | Help → assistant | A search on `/help` that finds nothing offers **Pitaj AI asistenta**: a new conversation, the panel opened, the query sent. On a phone, following a link in an answer closes the full-screen panel. |
| 3 | Search logging | `help.search_no_results` (with the query) and `help.ask_assistant` in the activity log. No migration. |
| 4 | Hints in forms | Six `InfoHint`s: VAT bases in both invoice forms, linked units in both linking dialogs, "Bez ugovora" in two forms, project phases, the "Realizirano" column, the read-only budget field. |
| 5 | Release notes | `help-kb/news-2026-10.md`, a "Što je novo" group on the Help page, and a dismissible banner above every page until the note is opened or the line closed (remembered per user in the browser). |
| 6 | Screenshots | 13 pictures in 13 articles, taken from LandmarkDemo by a committed script (`npm run help:shots`) that cannot write to the database and refuses any project but the demo. |

Also changed because they were in the way: `MarkdownView` no longer treats `//host` as an app
route and draws only the app's own images; the `Alert` close button has a label and
`type="button"`.

## 2. Needs sign-off

### 2.1 The release note

[`help-kb/news-2026-10.md`](../help-kb/news-2026-10.md) is a first draft. Three things to decide:

- **Date.** It says 2026-10-12, the day it was written. Set it to the day the release goes live.
- **Scope.** It covers guidance phases 1 to 3 and the changed financial figures from
  [DEPLOY_GUIDANCE_PHASE_1.md](./DEPLOY_GUIDANCE_PHASE_1.md) sections 4 and 5, **without amounts**
  (articles ship to every user's browser). If some of that has not shipped, or phase 3 ships
  later, cut the note accordingly.
- **Audience.** One note for everyone, with a section headed "Financijski prikazi (Director i
  Accounting)" that other roles also see. Splitting it into a second note with
  `roles: [Director, Accounting]` is a five-minute change.

### 2.2 New strings (24)

Accepted on the same terms as phases 1 and 2 unless you say otherwise. To change one, edit it in
`src/locales/hr|en/translation.json`.

| Key | Hrvatski | English |
|---|---|---|
| `help.ask_assistant` | Pitaj AI asistenta | Ask the AI assistant |
| `help.groups.news` | Što je novo | What's new |
| `help.whats_new.lead` | Što je novo: | What's new: |
| `help.whats_new.read` | Pročitajte | Read |
| `activity_log.actions.help.search_no_results` | Pretraga pomoći bez rezultata | Help search with no results |
| `activity_log.actions.help.ask_assistant` | Pitanje iz pomoći proslijeđeno AI asistentu | Help question passed to the AI assistant |
| `invoices.hints.multi_vat_title` | Više PDV stopa | Several VAT rates |
| `invoices.hints.multi_vat_fields` | Jedan račun može imati do četiri PDV stope. Upišite osnovicu u polje svake stope koja se na računu pojavljuje; ostala ostavite prazna. | One invoice can carry up to four VAT rates. Enter the base amount in the field of each rate that appears on the invoice and leave the others empty. |
| `invoices.hints.multi_vat_calc` | PDV i ukupan iznos sustav računa sam, za svaku stopu posebno, i prikazuje ih u pregledu u obrascu. | VAT and the total are calculated for you, separately for each rate, and shown in the preview in the form. |
| `apartments.hints.link_units_title` | Povezane jedinice | Linked units |
| `apartments.hints.link_units_package` | Garaže i repozitoriji povezani sa stanom prodaju se kupcu zajedno s njim, kao paket. | Garages and storage units linked to an apartment are sold to the buyer together with it, as a package. |
| `apartments.hints.link_units_price` | Uz takav stan prikazuje se i cijena „Ukupni paket”: stan i povezane jedinice zajedno. | Such an apartment also shows a "Total package" price: the apartment and its linked units together. |
| `common.hints.no_contract_title` | Bez ugovora | No contract |
| `common.hints.no_contract_what` | Posao se vodi na temelju usmenog dogovora, pa nema ugovorenog iznosa s kojim bi se plaćanja uspoređivala. | The work is based on a verbal agreement, so there is no contracted amount to compare payments with. |
| `common.hints.no_contract_tracking` | Trošak se prati samo kroz račune, a posao nosi oznaku BEZ UGOVORA. | The cost is tracked through invoices only, and the engagement carries the NO CONTRACT badge. |
| `general_projects.hints.phases_title` | Faze projekta | Project phases |
| `general_projects.hints.phases_what` | Faza je vremenski dio izvođenja, s vlastitim budžetom i ugovorima. Prekretnica je ključni datum projekta i vodi se zasebno, na kartici Prekretnice. | A phase is a period of construction with its own budget and contracts. A milestone is a key date of the project and is kept separately, on the Milestones tab. |
| `general_projects.hints.phases_budget` | Budžet faze ne upisuje se ovdje: dolazi iz TIC-a projekta. | A phase's budget is not entered here: it comes from the project's TIC. |
| `general_projects.hints.realized_title` | Realizirano | Realized |
| `general_projects.hints.realized_what` | Realizirano je iznos stvarno plaćen po ugovoru, a ne ugovoreni iznos. | Realized is the amount actually paid under the contract, not the contracted amount. |
| `general_projects.hints.realized_update` | Mijenja se sam kad se evidentira plaćanje računa po tom ugovoru. | It changes by itself when a payment is recorded against an invoice under that contract. |
| `general_projects.hints.budget_title` | Budžet projekta | Project budget |
| `general_projects.hints.budget_what` | Planirani budžet ne upisuje se ručno: izvodi se iz TIC-a projekta svaki put kad se TIC spremi. | The planned budget is not typed in: it is derived from the project's TIC each time the TIC is saved. |
| `general_projects.hints.budget_missing` | „Budžet nije postavljen” znači da projekt još nema TIC ili su u njemu svi iznosi nula. | "Budget not set" means the project has no TIC yet, or every amount in it is zero. |

The prompt addition (Croatian, in `supabase/functions/_shared/prompts.ts`) and the line the tool
gives the model, `Članak u Pomoći: /help/<id>`, are not user-facing.

### 2.3 Article edits

`top-nav` (the banner), `ai-chat-widget` (answers end with a link; **Pitaj AI asistenta**), and
one image line in each of: `dashboard`, `projects-list`, `project-details`, `budget-control`,
`tic`, `site-management`, `cashflow-invoices`, `cashflow-payments`, `term-multi-vat`, `apartments`,
`term-unit-types`, `switch-profile`, `ai-chat-widget`.

## 3. Before it is live

- **Deploy `ai-chat`.** The link line and the prompt change are in the edge function; until it is
  redeployed the assistant answers as before. Editing the static prompt invalidates the shared
  prompt cache once.
- **`feature/voice-assistant`** pins assistant behaviour with characterisation tests. The tool
  output and the prompt changed here; that branch was not inspected and may need its fixtures
  updated when it is rebased.

## 4. What was checked

- `npm run typecheck`, `npm test`, `npm run test:functions`, ESLint on the changed files.
- New tests: `_shared/help-search.test.ts` (what the tool returns, which articles get a link);
  in `helpKb.test.ts`, release-note dates and ordering, hint articles, and that every screenshot
  an article shows exists, is shown somewhere and is under 300 KB.
- In a browser against LandmarkDemo, with every write refused or answered locally, as the demo
  Sales user: the banner appears, its link opens the note and the banner is gone afterwards and
  after a reload; the "Što je novo" group heads the Help page; an article draws its screenshot;
  an empty search shows the button, which opens the assistant with the query as the first
  message; the two new events are logged. The assistant's actual reply was not seen: calls to the
  edge function were blocked so that nothing was written.
- Each of the 13 screenshots was looked at. Three of the six new hints are visible in them (VAT
  base, linked units, project phases).

Not checked: the assistant producing a link in a real answer (needs the function deployed), the
hints in the subcontractor form, the link-supplier form, the project form and the Realizirano
column on screen, English UI, dark mode, and phone width for the new pieces.

## 5. Found and not fixed

| Id | What |
|---|---|
| UI-11 | Amounts run past their card at laptop width on Budget Control and Companies |
| GEN-22 | With an unphased TIC and several phases, Budget Control credits the whole budget to phase 1, so CPI and the forecast are wrong |

Two things first written up here turned out to be known already: the unreadable top label of the
EVM chart's axis is GEN-7, and the customer's name in the Companies subtitle is GEN-19 (CASH-31
was opened for it and closed as a duplicate).

These are why there is no screenshot of the Companies page or of the lower half of Budget
Control. The Cashflow calendar has none because the demo has nothing due this month.

## 6. Left for later

- More screenshots: the plan was about 20 articles; 13 are done. Candidates: the apartment import
  dialog, the TIC with phases, Cashflow calendar (a month with data), Funding investments.
- The `projects.realized` hint is on the table header only, so not on a phone.
- A "start here" card for new users, an article for the Activity Log, English articles.
- Reading the usage data: `help.*` in `activity_logs` and `ai_help_searches`.
