# User guidance, phase 2

**Date:** 2026-10-06 · **Branch:** `feat/user-guidance-phase-2` (off `development`) · **Status:** written, not committed

Phase 1 built the pieces (the `/help` page, the "?" beside page titles, `InfoHint`, usage logging).
Phase 2 makes them reach every page and corrects what they say. How the pieces work is in
[HELP.md](./HELP.md); this file records what the phase changed and what it found.

## 1. What changed

| # | Item | Result |
|---|---|---|
| 1 | Help articles | All 66 articles in `help-kb/` were compared with the code and corrected: button and menu names, who can do what, steps that no longer exist. The phase 1 audit's proposed corrections were re-checked first, since some had gone stale. `INDEX.md` and the assistant's index (`npm run kb:build`) are rebuilt. |
| 2 | Two misleading Budget Control strings | The subtitle claimed more than the page shows; the "no budget" text now says the budget comes from the TIC. |
| 3 | Help link on every page | The 15 pages that draw their own title instead of using `PageHeader` now carry the same "?" through `PageHelpLink`: the six dashboards, Budget Control, project details, General reports, Tasks, Calendar, TIC, the Cashflow calendar, Chat and Site management. |
| 4 | Empty states | 18 lists that said only "no data" now say what belongs there and where it is added; a list emptied by a search or filter says so instead ("Nema rezultata pretrage"). The Sales project and building grids had no empty state at all (SALES-15, closed). |
| 5 | "Budget not set" leads somewhere | Budget Control and project details link to the project's TIC (`/tic?project=<id>`, which now opens on that project) for Director, Accounting and Investment. |
| 6 | Profile is not role | One line under the profile switcher, desktop and mobile. |
| 7 | Assistant starter questions | The empty assistant panel offers up to three questions for the page behind it. |
| 8 | Cashflow password prompt on Help | A "?" on a Cashflow page opens Help in a new tab; the prompt used to cover the article there. It is no longer shown on `/help`. |

Also fixed because they were one word each and on screen: the menu item "Stanje dugu" (now
"Stanje duga") and a supplier-link note that printed `(has_contract = false)`.

## 2. Strings

Accepted on the same terms as phase 1: the people who use the screens will say if a term is
wrong. To change one, edit it in `src/locales/hr|en/translation.json`.

### 2.1 New (30)

| Key | Hrvatski | English |
|---|---|---|
| `common.no_results_description` | Očistite pretragu ili promijenite filtere. | Clear the search or change the filters. |
| `profiles.hint` | Profil mijenja izbornik i nadzornu ploču, ne i vaše ovlasti. | A profile changes the menu and dashboard, not what you are allowed to do. |
| `invoices.table.no_invoices_description` | Ovdje se prikazuju računi odabranog smjera (ulazni ili izlazni). Novi unesite gumbom „Novi račun” u zaglavlju stranice. | Invoices of the selected direction (incoming or outgoing) are listed here. Enter a new one with the "New Invoice" button in the page header. |
| `payments.table.no_payments_description` | Ovdje se prikazuju plaćanja evidentirana po računima. Dodajte prvo gumbom „Novo plaćanje”. | Payments recorded against invoices are listed here. Add the first one with the "New Payment" button. |
| `accounting_customers.empty_description` | Ovdje se prikazuju kupci s njihovim računima i uplatama. Kupci se dodaju u profilu Sales, na stranici Kupci, gumbom „Dodaj kupca”. | Customers are listed here with their invoices and payments. Add customers in the Sales profile, on the Customers page, with the "Add Customer" button. |
| `general_projects.open_tic` | Otvori TIC projekta | Open the project's TIC |
| `general_projects.no_credit_allocations_description` | Izvori financiranja pojavljuju se ovdje kad se kreditu u profilu Funding, na stranici Investicije, gumbom „Namjena Investicije” dodijeli ovaj projekt. | Funding sources appear here once this project is assigned to a credit in the Funding profile, on the Investments page, with the "Investment Purpose" button. |
| `general_projects.no_projects_description` | Ovdje se prikazuju svi projekti tvrtke. Dodajte prvi gumbom „Novi projekt”. | All of the company's projects are listed here. Add the first one with the "New Project" button. |
| `general_projects.no_projects_description_readonly` | Ovdje se prikazuju svi projekti tvrtke. Novi projekt može dodati samo korisnik s ulogom Director. | All of the company's projects are listed here. Only a user with the Director role can add a new project. |
| `general_projects.no_phases_description` | Faze se postavljaju u profilu Supervision, na stranici Upravljanje gradilištem, gumbom „Postavi faze”. Ugovori se zatim prikazuju ovdje po fazama. | Phases are set up in the Supervision profile, on the Site Management page, with the "Setup Phases" button. Contracts are then listed here by phase. |
| `general_projects.no_contracts_description` | Ugovori s podugovarateljima pojavljuju se ovdje kad se dodaju fazama projekta u profilu Supervision, na stranici Upravljanje gradilištem. | Subcontractor contracts appear here once they are added to the project's phases in the Supervision profile, on the Site Management page. |
| `sales_projects.no_projects_title` | Nema projekata u ovoj kategoriji | No projects in this category |
| `sales_projects.no_projects_description` | Ovdje se prikazuju projekti kategorija stambeno i retail. Projekti se dodaju u profilu General, na stranici Projekti, gumbom „Novi projekt”. | Projects in the stambeno and retail categories are listed here. Projects are added in the General profile, on the Projects page, with the "New Project" button. |
| `sales_projects.no_buildings_title` | Projekt još nema zgrada | This project has no buildings yet |
| `sales_projects.no_buildings_description` | Dodajte ih gumbom „Kreiraj zgrade” ili „Dodaj zgradu”, ili ih uvezite gumbom „Uvezi iz Excela” u zaglavlju stranice. | Add them with the "Create Buildings" or "Add Building" button, or import them with the "Import from Excel" button in the page header. |
| `apartments.payment_history_modal.no_payments_description` | Uplate kupca pojavljuju se ovdje kad se u profilu Cashflow evidentiraju plaćanja po računima za ovaj stan. | The buyer's payments appear here once payments are recorded in the Cashflow profile against this apartment's invoices. |
| `apartments.empty_title` | Nema stanova | No apartments |
| `apartments.empty_description` | Ovdje se prikazuju stanovi svih projekata. Dodajte ih gumbom „Dodaj stan” ili „Masovno dodavanje”. | Apartments from all projects are listed here. Add them with the "Add Apartment" or "Bulk Create" button. |
| `customers.empty_title` | Nema kupaca | No customers |
| `customers.empty_description` | Kupci se dodaju gumbom „Dodaj kupca” i razvrstavaju u kartice Potencijalni, Zainteresirani i Kupci. | Customers are added with the "Add Customer" button and sorted into the Leads, Interested and Buyers tabs. |
| `supervision.payment_history.no_payments_description` | Plaćanja se pojavljuju ovdje kad se u profilu Cashflow evidentiraju po računima ovog podugovaratelja. | Payments appear here once they are recorded in the Cashflow profile against this subcontractor's invoices. |
| `retail_projects.invoices_modal.no_invoices_description` | Računi se pojavljuju ovdje kad se u profilu Cashflow, na stranici Računi, unesu gumbom „Novi Retail Račun” i povežu s ovim ugovorom. | Invoices appear here once they are entered in the Cashflow profile, on the Invoices page, with the "New Retail Invoice" button and linked to this contract. |
| `funding.projects.modal.no_funding_sources_description` | Krediti i ulaganja pojavljuju se ovdje kad im se na stranici Investicije gumbom „Namjena Investicije” dodijeli ovaj projekt. | Loans and equity appear here once this project is assigned to them on the Investments page with the "Investment Purpose" button. |
| `reports.general.no_data_description` | Izvještaj se sastavlja iz projekata, prodaje, ugovora i financiranja. Kad ti podaci budu uneseni, učitajte ga ponovno gumbom „Osvježi”. | The report is built from projects, sales, contracts and funding. Once that data has been entered, reload it with the "Refresh" button. |
| `reports.retail.no_data` | Nema podataka za retail izvještaj | No data for the retail report |
| `reports.retail.no_data_description` | Izvještaj se sastavlja iz retail projekata, zemljišta, ugovora i računa. Kad ti podaci budu uneseni, učitajte ga ponovno gumbom „Osvježi”. | The report is built from retail projects, land plots, contracts and invoices. Once that data has been entered, reload it with the "Refresh" button. |
| `reports.sales_analysis.no_customers_description` | Kupci se pojavljuju ovdje kad se s njima sklopi prodajni ugovor na retail projektu. | Customers appear here once a sales contract is signed with them on a retail project. |
| `reports.costs.no_supplier_types` | Nema troškova po tipu dobavljača | No costs by supplier type |
| `reports.costs.no_supplier_types_description` | Raspodjela se prikazuje kad dobavljači dobiju ugovore na retail projektima. | The breakdown appears once suppliers have contracts on retail projects. |
| `reports.costs.no_suppliers_description` | Dobavljači se pojavljuju ovdje kad dobiju ugovor na retail projektu. | Suppliers appear here once they have a contract on a retail project. |

### 2.2 Changed (4)

| Key | Before (hr) | Now (hr) | Now (en) |
|---|---|---|---|
| `nav.debt_status` | Stanje dugu | Stanje duga | Debt Status |
| `suppliers.link.info` | Dobavljač će biti dodan u odabranu fazu bez ugovora (has_contract = false) | Dobavljač će biti dodan u odabranu fazu bez ugovora | Supplier will be added to the selected phase without a contract (has_contract = false) |
| `budget_control.subtitle` | EVM pregled performansi po fazama projekta | EVM pregled performansi odabranog projekta | EVM performance overview of the selected project |
| `budget_control.no_budget_data_sub` | Dodajte faze s dodijeljenim proračunom i ugovore za prikaz EVM performansi. | Budžet projekta dolazi iz TIC-a. Spremite TIC za ovaj projekt i dodajte ugovore kako bi se prikazale EVM performanse. | A project's budget comes from its TIC. Save a TIC for this project and add contracts to see EVM performance. |

### 2.3 Assistant starter questions (Croatian only, like the assistant)

- `Što mogu raditi na ovoj stranici?`
- `Kako se koristi „<article title>”?` for a page guide
- `Objasni pojam „<article title>”` for a glossary article whose title is not already a question

## 3. What was checked

- `npm run typecheck`, `npm test`, `npm run test:functions`, ESLint on the changed files.
- Every article's frontmatter parses, and every role still sees its articles
  (Director 62, Accounting 61, Sales 47, Investment 47, Supervision 18).
- In a browser against LandmarkDemo, as Director, with activity-log writes intercepted: the "?"
  on eight of the pages in item 3 and on project details, the filtered empty state on Projects,
  Apartments and Customers, the TIC link and the project it opens on, the profile hint, the
  assistant's questions on Budget Control, and the dashboard at phone width.

Not checked in a browser: the "nothing here yet" empty states (the demo data has no empty lists),
the other four roles, and dark mode.

## 4. Found and not fixed

Comparing 66 articles with the code turned up defects in the code. They are in `docs/backlog/`:

| Id | What |
|---|---|
| RETAIL-4 | Approving a retail invoice is not role-gated and fails silently |
| RETAIL-5 | `/retail-sales` cannot be reached from the menu |
| GEN-20 | Budget Control shows a healthy CPI and SPI when there is nothing to measure |
| CASH-24 | The calendar's "Neplaćeno" card leaves out partly paid invoices |
| FUND-17 | Funding payments label a drawdown PRIHOD and a repayment RASHOD |
| CASH-25 to CASH-28, FUND-18, GEN-21, SALES-16 to SALES-19, RETAIL-6, SUP-13, SUP-14, UI-10 | Low: missing role checks on buttons, dead buttons, wording, hardcoded strings, unused keys |

Where the code and the intended behaviour disagree, the articles describe what the screen does
today, so they need another look when one of these is fixed.

## 5. Left for later

- More `InfoHint`s: wait for the `help.*` usage events to show where people open Help.
- English articles, and screen recordings.
- On a phone the "?" wraps under a long dashboard title.
