# Cognilion Help Knowledge Base — Index

Procedural notes for the in-app AI assistant to retrieve. All entries in Croatian.
Files live alongside this index; each is self-contained markdown with frontmatter.

---

## Construction core

- [projects-list](projects-list.md) — **Stranica Projekti (popis projekata)** — Pregled svih gradilišnih projekata kao mreže kartica, s filtriranjem po statusu.
- [project-details](project-details.md) — **Detalji projekta (kartice projekta)** — Tabovi Pregled, Faze i ugovori, Stanovi, Podugovaratelji, Financiranje, Prekretnice.
- [budget-control](budget-control.md) — **Kontrola proračuna (EVM)** — EVM pregled performansi po fazama: CPI, SPI, EAC, VAC, iskorištenost budžeta.
- [subcontractors](subcontractors.md) — **Podugovaratelji** — Središnji popis podugovaratelja s ugovorima, plaćanjima i dokumentima.
- [site-management](site-management.md) — **Upravljanje gradilištem** — Glavni Supervision pregled projekata s harmonikom faza i plaćanja.
- [work-logs](work-logs.md) — **Radni dnevnik (dnevnici radova)** — Evidencija aktivnosti i statusa rada (završeno, blokada, kvaliteta...) po fazi i ugovoru.
- [supervision-payments](supervision-payments.md) — **Upravljanje plaćanjima (podugovaratelji)** — Sva plaćanja prema podugovarateljima kroz projekte, s CSV izvozom.
- [supervision-invoices](supervision-invoices.md) — **Računi projekata (Supervision)** — Računi dobavljača/nadzora; odobravanje, filteri statusa, CSV izvoz.
- [general-reports](general-reports.md) — **Opći izvještaji (Izvještaj za rukovodstvo)** — Sveobuhvatni PDF izvještaj s KPI-jevima, prodajom, gradnjom i financijama.

## Sales

- [apartments](apartments.md) — **Stanovi (jedinice za prodaju)** — Mreža stanova s filterom statusa (Dostupno/Rezervirano/Prodano) i povezanim garažama/repozitorijima.
- [sales-projects](sales-projects.md) — **Prodajni projekti** — Trorazinska navigacija Projekti → Zgrade → Jedinice; bulk kreiranje i Excel uvoz.
- [customers](customers.md) — **Kupci (prodaja)** — Kupci stanova s kategorijama (kupci/zainteresirani/leadovi) i grupnim e-mail izvozom.
- [sales-payments](sales-payments.md) — **Plaćanja prodaje** — Uplate kupaca po projektima i stanovima; ista stranica služi i retail rutu.
- [sales-reports](sales-reports.md) — **Izvještaji prodaje** — Dvije vrste izvještaja: po projektu i po kupcima; PDF izvoz.

## Funding

- [funding-investors](funding-investors.md) — **Investitori (Funding)** — Banke i investitori; dodavanje pozajmica i kapitala.
- [funding-investments](funding-investments.md) — **Investicije (krediti i alokacije)** — Kreditne linije banaka s alokacijama prema projektima, OPEX-u ili refinanciranju.
- [investment-projects](investment-projects.md) — **Projektne investicije** — Pregled svakog projekta s podjelom na kapital, dug i očekivani povrat.
- [funding-payments](funding-payments.md) — **Uplate financiranja** — Sve uplate vezane uz bankarsko financiranje; CSV izvoz.
- [tic](tic.md) — **TIC — Struktura troškova investicije** — Matrica troškova investicije po namjeni s vlastitim/kreditnim sredstvima; Excel/PDF izvoz.

## Cashflow

- [cashflow-invoices](cashflow-invoices.md) — **Računi (Cashflow)** — Knjiga ulaznih i izlaznih računa s multi-VAT podrškom i tipovima ULAZNI/IZLAZNI.
- [cashflow-payments](cashflow-payments.md) — **Plaćanja (Cashflow)** — Sva plaćanja s podrškom za cesiju i kompenzaciju.
- [cashflow-suppliers](cashflow-suppliers.md) — **Dobavljači (Cashflow)** — Isti zapisi kao podugovaratelji, prikazani iz računovodstvene perspektive.
- [office-suppliers](office-suppliers.md) — **Office Dobavljači** — Zasebna tablica vendora za uredske/administrativne troškove.
- [cashflow-companies](cashflow-companies.md) — **Moje firme** — Financijski pregled svih firmi pod grupom Landmark.
- [cashflow-banks](cashflow-banks.md) — **Banke / Investicije (Cashflow)** — Read-only pregled bankovnih računa, kredita i alokacija.
- [cashflow-customers](cashflow-customers.md) — **Kupci (Cashflow)** — Pregled kupaca s računima i dugovanjima iz računovodstvene perspektive.
- [cashflow-calendar](cashflow-calendar.md) — **Kalendar dospijeća** — Mjesečni kalendar dospijeća računa s planiranim budžetom.
- [cashflow-loans](cashflow-loans.md) — **Pozajmice i prijenosi** — Interne pozajmice i prijenosi između firmi grupe.
- [debt-status](debt-status.md) — **Stanje duga** — Pregled neisplaćenih obveza prema dobavljačima, s filtrom po projektu i Excel/PDF izvozom.
- [approvals](approvals.md) — **Odobrenja računa** — Odobreni računi podizvođača koji čekaju računovodstvenu obradu; bulk operacije.

## Retail

- [retail-projects](retail-projects.md) — **Retail projekti** — Projekti razvoja zemljišta s tabovima Pregled, Čestice, Kupci, Prodaja, Računi.
- [retail-land-plots](retail-land-plots.md) — **Zemljišne čestice** — Popis kupljenih parcela s površinom, ulaganjima i statusom plaćanja.
- [retail-customers](retail-customers.md) — **Retail kupci** — Kupci zemljišnih čestica, zaseban modul od kupaca stanova.
- [retail-sales](retail-sales.md) — **Retail prodaja (čestice)** — Prodaja čestica kupcima s plaćanjem, statusima i dospijećima.
- [retail-invoices](retail-invoices.md) — **Računi (Retail)** — Računi retail strane s filterima tipa i odobrenja; CSV izvoz.
- [retail-reports](retail-reports.md) — **Retail izvještaji** — PDF izvještaji za retail portfelj s tabovima Pregled/Projekti/Prodaja/Troškovi.

## Cross-cutting

- [dashboard](dashboard.md) — **Nadzorna ploča (po profilu)** — Početna stranica koja se mijenja prema aktivnom profilu.
- [documents](documents.md) — **Dokumenti** — Središnja upload/preuzimanje datoteka s hijerarhijskim kategorijama i filterima.
- [chat](chat.md) — **Chat (poruke između korisnika)** — Modul za 1:1 i grupne razgovore među korisnicima sustava.
- [tasks](tasks.md) — **Zadaci** — Praćenje zadataka s tabovima i statusima (todo / u tijeku / gotovo).
- [calendar](calendar.md) — **Kalendar** — Sastanci, podsjetnici i događaji s RSVP-om i pregledima mjesec/tjedan/dan/agenda.
- [top-nav](top-nav.md) — **Gornja navigacija (header)** — Logo, profil dropdown, ikone obavijesti, jezik, tema, odjava.
- [exporting-data](exporting-data.md) — **Izvoz podataka (CSV, Excel, PDF)** — Mapa stranica i gumba za sve dostupne izvoze.
- [language-and-theme](language-and-theme.md) — **Promjena jezika i teme** — Kako promijeniti jezik i temu iz gornje navigacije.
- [ai-chat-widget](ai-chat-widget.md) — **AI asistent (chat widget)** — Plutajući AI widget; što može i ne može, opseg i odgovornost.

## Domain terms

- [term-cesija](term-cesija.md) — **Što je cesija (asignacija potraživanja)?** — Plaćanje od strane treće osobe; oznaka is_cesija na zapisu plaćanja.
- [term-kompenzacija](term-kompenzacija.md) — **Što je kompenzacija (prijeboj)?** — Međusobni prijeboj duga između dvije strane; način plaćanja bez stvarnog protoka novca.
- [term-faza-vs-prekretnica](term-faza-vs-prekretnica.md) — **Faza vs. prekretnica (milestone)** — Razlika između dvije različite tablice i pojmova.
- [term-has-contract](term-has-contract.md) — **Usmeni dogovor (has_contract = false)** — Što znači kada ugovor nema potpisanu pisanu verziju.
- [term-multi-vat](term-multi-vat.md) — **Multi-VAT računi (više PDV stopa)** — Hrvatska računovodstvena specifičnost: do 4 PDV stope po dokumentu.
- [term-unit-types](term-unit-types.md) — **Tipovi jedinica: stan, garaža, repozitorij** — Tri tipa prodajnih jedinica i njihovo povezivanje.
- [term-tic](term-tic.md) — **TIC — što znači skraćenica?** — Troškovna Informatička Struktura, strukturirani prikaz troškova investicije.
- [terminology-dobavljac-vs-podugovaratelj](terminology-dobavljac-vs-podugovaratelj.md) — **Dobavljač vs. podugovaratelj (terminološka razlika)** — Razjašnjenje kako se isti pojam koristi u različitim modulima.
- [term-status-casing](term-status-casing.md) — **Statusi se razlikuju po tablicama** — Razlika između Title Case, lowercase i SHOUTING_SNAKE_CASE statusa.
- [term-realised-budget](term-realised-budget.md) — **Realizirani budžet — odakle dolazi?** — Točan iznos potrošnje računa se iz ugovora, ne iz budget_used.
- [term-invoice-types](term-invoice-types.md) — **Tipovi računa (ULAZNI / IZLAZNI varijante)** — Podjela računa na ulazne i izlazne s podvarijantama (DOB, INV, URED, BANKA, PROD, TROŠ.KRED).
- [term-evm](term-evm.md) — **EVM metrike: CPI, SPI, EAC, VAC** — Objašnjenje četiri ključne metrike Earned Value Managementa.
- [term-number-format](term-number-format.md) — **Hrvatski format brojeva, valute i datuma** — Konvencije: 1.234,56 EUR, dd.MM.yyyy.

## Roles / access

- [role-roles-and-permissions](role-roles-and-permissions.md) — **Pet uloga i što one mogu** — Pregled svih 5 uloga (Director, Accounting, Sales, Supervision, Investment) i njihovih ovlasti.
- [role-profile-vs-role](role-profile-vs-role.md) — **Profil vs. uloga — u čemu je razlika?** — Razlika između trajne uloge i izbornog profila sučelja.
- [switch-profile](switch-profile.md) — **Kako promijeniti profil?** — Procedura promjene profila iz dropdowna u gornjoj navigaciji.
- [cashflow-unlock](cashflow-unlock.md) — **Kako otključati Cashflow profil?** — Lozinka, role check, ponašanje sesije.
- [role-cannot-see-cashflow](role-cannot-see-cashflow.md) — **Zašto ne vidim Cashflow profil?** — Cashflow je rezerviran za Director i Accounting; alternativne stranice za druge uloge.
- [role-supervision-restrictions](role-supervision-restrictions.md) — **Ograničenja Supervision uloge** — Fiksni izbornik, automatski redirect, RLS scoping na dodijeljene projekte.
- [role-cannot-see-financials](role-cannot-see-financials.md) — **Zašto ne vidim financijske sažetke?** — Tko vidi koje financijske rollupe i koje su alternative za ostale uloge.
