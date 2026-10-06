# User guidance, phase 1 — strings for sign-off

**Date:** 2026-10-05 · **Branch:** `feat/user-guidance-phase-1` · **Status:** awaiting review

Every user-facing string this phase added or changed, in one place, plus the help-article audit.
The strings are already in `src/locales/hr/translation.json` and `src/locales/en/translation.json`
under the keys shown; to change one, edit it there (or mark it up here and it will be applied).

Croatian domain terms and literal spreadsheet column names are kept in Croatian in both languages,
as the project's i18n rules require.

| Section | What |
|---|---|
| 1 | New strings |
| 2 | Changed strings |
| 3 | Wording that changed because a screen now reads a shared label |
| 4 | Spreadsheet template headers |
| 5 | Help articles already edited |
| 6 | Help article audit: outdated content and proposed corrections (not applied) |
| 7 | Decisions needed |
| 8 | Added in the second round: six strings, one article sentence, and what changed in section 7 |

## 1. New strings

### 1.1 Excel apartment import (SALES-12)

Shown: Sales projekti → Uvezi iz Excela, step 1; the same lines are printed on the template's second sheet (Croatian only)

| Key | Hrvatski | English |
|---|---|---|
| `sales_projects.excel_import.download_template` | Preuzmi predložak | Download template |
| `sales_projects.excel_import.template_failed` | Predložak nije moguće preuzeti. Pokušajte ponovno. | The template could not be downloaded. Please try again. |
| `sales_projects.excel_import.template_sheet_data` | Stanovi | Apartments |
| `sales_projects.excel_import.template_sheet_notes` | Upute | Notes |
| `sales_projects.excel_import.format.layout` | Čita se samo prvi list. Zaglavlje je u 1. retku, podaci počinju od 2. retka; važan je redoslijed stupaca, a ne nazivi u zaglavlju. | Only the first sheet is read. Headers are on row 1 and data starts on row 2; the column order matters, not the header names. |
| `sales_projects.excel_import.format.required` | Obavezno: A – zgrada (naziv mora odgovarati postojećoj zgradi projekta), D – oznaka stana, J – stan m2 prodajno, L – cijena stana. | Required: A – zgrada (the name must match an existing building in the project), D – oznaka stana (apartment number), J – stan m2 prodajno (saleable area), L – cijena stana (apartment price). |
| `sales_projects.excel_import.format.details` | Neobavezno: B – ulaz, C – kat, E – tip, F – sobnost, H – otvorena površina, I – otvorena površina s koeficijentom, K – cijena po m2. | Optional: B – ulaz (entrance), C – kat (floor), E – tip (type), F – sobnost (rooms), H – otvorena površina (open area), I – otvorena površina s koeficijentom (open area with coefficient), K – cijena po m2 (price per m²). |
| `sales_projects.excel_import.format.parking` | M–O – parking: oznaka, m2, cijena. Garaža se kreira i povezuje sa stanom samo ako su sva tri polja popunjena. | M–O – parking: oznaka, m2, cijena (label, m², price). A garage is created and linked to the apartment only when all three cells are filled. |
| `sales_projects.excel_import.format.storage` | P–R – repozitorij: oznaka, m2, cijena. Vrijedi isto pravilo kao za parking. | P–R – repozitorij (storage unit): oznaka, m2, cijena. The same rule applies as for parking. |
| `sales_projects.excel_import.format.contract_date` | T – datum potpisa predugovora, u formatu DD.MM.GGGG. To je jedini stupac s datumom. | T – datum potpisa predugovora (pre-contract signing date), as DD.MM.YYYY. This is the only date column. |
| `sales_projects.excel_import.format.amounts` | U – kapara 10 %, V–Y – rate 1–4 (AB konstrukcija 30 %, postava stolarije 20 %, obrtnički radovi 20 %, uporabna 20 %), Z – kredit etažiranje 90 %. U sve te stupce upisuju se iznosi u EUR, a ne datumi. | U – kapara 10% (deposit), V–Y – instalments 1–4 (AB konstrukcija 30%, postava stolarije 20%, obrtnički radovi 20%, uporabna 20%), Z – kredit etažiranje 90% (loan). All of these columns hold amounts in EUR, not dates. |
| `sales_projects.excel_import.format.payment_type` | Način plaćanja određuje se sam: rate ako je popunjen bilo koji od stupaca V–Y, inače kredit ako je popunjen Z. | The payment type is set automatically: instalments if any of columns V–Y is filled, otherwise loan if Z is filled. |
| `sales_projects.excel_import.format.not_imported` | G – zatvorena površina i S – ukupna cijena ne uvoze se. | G – zatvorena površina (closed area) and S – ukupna cijena (total price) are not imported. |
| `sales_projects.excel_import.format.numbers` | Brojevi mogu biti u europskom formatu (npr. „3.000,00”). | Numbers may use the European format (e.g. "3.000,00"). |
| `sales_projects.excel_import.format.existing` | Stan koji već postoji (ista zgrada i oznaka) ažurira se umjesto da se doda ponovno; status mu se ne mijenja. | An apartment that already exists (same building and number) is updated instead of added again; its status is left as it is. |

### 1.2 TIC Excel import

Shown: TIC → Uvoz iz Excela, step 1

| Key | Hrvatski | English |
|---|---|---|
| `tic.import.format_phases` | Faze (neobavezno): na listu INVESTICIJA zaglavlja FAZA 1, FAZA 2 … iznad skupine stupaca svake faze, s istim rasporedom kao ukupni iznos (vlastita sredstva, %, kreditna sredstva). | Phases (optional): on the INVESTICIJA sheet, headers FAZA 1, FAZA 2 … above each phase's group of columns, laid out like the totals (own funds, %, credit funds). |

### 1.3 Help page and help links

Shown: /help, the "?" beside page titles, the "?" in the top bar, and every InfoHint

| Key | Hrvatski | English |
|---|---|---|
| `help.title` | Pomoć | Help |
| `help.description` | Kratke upute za stranice, pojmove i uloge. Iz istih članaka odgovara i AI asistent. | Short guides to pages, terms and roles. The AI assistant answers from the same articles. |
| `help.search_placeholder` | Pretraži upute... | Search help... |
| `help.results_count` | Pronađeno članaka: {{count}} | Articles found: {{count}} |
| `help.no_results_title` | Nema rezultata | No results |
| `help.no_results_description` | Pokušajte s drugim pojmom ili pitajte AI asistenta. | Try another term, or ask the AI assistant. |
| `help.for_this_page` | Za stranicu s koje ste došli | For the page you came from |
| `help.groups.pages` | Upute po stranicama | Page guides |
| `help.groups.terms` | Pojmovi | Terms |
| `help.groups.roles` | Uloge i pristup | Roles and access |
| `help.back_to_all` | Sve upute | All help |
| `help.article_unavailable_title` | Članak nije dostupan | Article not available |
| `help.article_unavailable_description` | Članak ne postoji ili nije namijenjen vašoj ulozi. | The article does not exist or is not meant for your role. |
| `help.croatian_only_note` | Članci pomoći dostupni su samo na hrvatskom jeziku. | Help articles are currently available in Croatian only. |
| `help.page_link` | Pomoć za ovu stranicu | Help for this page |
| `help.hint.button_label` | Objašnjenje: {{topic}} | Explain: {{topic}} |
| `help.hint.more` | Više u pomoći | More in Help |

### 1.4 Activity log labels for the new help events

Shown: General → Dnevnik aktivnosti (Director only)

| Key | Hrvatski | English |
|---|---|---|
| `activity_log.categories.help` | Pomoć | Help |
| `activity_log.actions.help.view` | Otvorena pomoć | Help opened |
| `activity_log.actions.help.page_link_click` | Kliknuta pomoć za stranicu | Page help link clicked |
| `activity_log.actions.help.hint_open` | Otvoreno objašnjenje | Hint opened |

### 1.5 Invoice type, spelled out (shared)

Shown: Hint on the Tip column in Cashflow → Računi; invoice details; payment details; Cashflow calendar

| Key | Hrvatski | English |
|---|---|---|
| `invoice_type_long.ulazni_dob` | Ulazni (Dobavljač) | Incoming (Supplier) |
| `invoice_type_long.ulazni_inv` | Ulazni (Investicije) | Incoming (Investments) |
| `invoice_type_long.ulazni_ured` | Ulazni (Ured) | Incoming (Office) |
| `invoice_type_long.ulazni_banka` | Ulazni (Banka) | Incoming (Bank) |
| `invoice_type_long.ulazni_troskred` | Ulazni (Troškovi kredita) | Incoming (Loan costs) |
| `invoice_type_long.izlazni_ured` | Izlazni (Ured) | Outgoing (Office) |
| `invoice_type_long.izlazni_dob` | Izlazni (Dobavljač) | Outgoing (Supplier) |
| `invoice_type_long.izlazni_prod` | Izlazni (Prodaja) | Outgoing (Sales) |
| `invoice_type_long.izlazni_banka` | Izlazni (Banka) | Outgoing (Bank) |

### 1.6 Hint: invoice type (hotspot 3)

Shown: Cashflow → Računi, "?" in the Tip column header

| Key | Hrvatski | English |
|---|---|---|
| `invoices.hints.type_title` | Tip računa | Invoice type |
| `invoices.hints.type_intro` | Kratica u zagradi govori na što se račun odnosi: | The abbreviation in brackets says what the invoice relates to: |
| `invoices.hints.type_colour` | Crveno označava račune koje plaćamo, zeleno račune po kojima novac primamo. ULAZNI (INV) prikazuje se zeleno. | Red marks invoices we pay, green marks invoices we are paid on. ULAZNI (INV) is shown in green. |

### 1.7 Hints: payment source and cesija (hotspot 4)

Shown: Both payment forms (Plaćanja → Novo plaćanje, and paying an invoice from Računi)

| Key | Hrvatski | English |
|---|---|---|
| `payments.hints.source_title` | Izvor plaćanja | Payment source |
| `payments.hints.source_accounts` | Bankovni račun ili Kredit: plaćanje se knjiži na odabrani račun, odnosno kredit. Gotovina: plaćanje bez bankovnog računa. | Bank account or Credit: the payment is booked against the account or credit you pick. Cash: a payment with no bank account. |
| `payments.hints.source_kompenzacija` | Kompenzacija: međusobni prijeboj dugovanja s drugom stranom. Novac se ne kreće, pa se ne bira ni račun ni način plaćanja. | Kompenzacija: a mutual offset of debts with the other party. No money moves, so neither an account nor a payment method is chosen. |
| `payments.hints.cesija_title` | Cesija | Cesija |
| `payments.hints.cesija_what` | Račun plaća druga vaša firma sa svog bankovnog računa ili kredita, umjesto firme na koju račun glasi. | Another of your companies pays the invoice from its own bank account or credit, instead of the company the invoice is addressed to. |
| `payments.hints.cesija_rules` | Odaberite firmu koja plaća i njezin izvor. Način plaćanja je uvijek virman; cesija se ne može kombinirati s kompenzacijom ni gotovinom. | Pick the paying company and its source. The payment method is always a wire transfer; cesija cannot be combined with kompenzacija or cash. |

### 1.8 Hints: EVM metrics (hotspot 2)

Shown: General → Kontrola proračuna, "?" on the CPI, SPI, EAC and VAC cards

| Key | Hrvatski | English |
|---|---|---|
| `budget_control.hints.cpi_title` | CPI – indeks izvršenja troška | CPI – Cost Performance Index |
| `budget_control.hints.cpi_body` | Ostvarena vrijednost radova podijeljena s plaćenim. 1,00 ili više: troši se u okviru plana (zeleno); 0,90–0,99: malo iznad (žuto); ispod 0,90: iznad proračuna (crveno). Dok ništa nije plaćeno, iznosi 1,00. | Earned value of the work divided by what has been paid. 1.00 or more: spending is within plan (green); 0.90–0.99: slightly over (yellow); below 0.90: over budget (red). Until something is paid it reads 1.00. |
| `budget_control.hints.spi_title` | SPI – indeks izvršenja rokova | SPI – Schedule Performance Index |
| `budget_control.hints.spi_body` | Ostvarena vrijednost radova podijeljena s vrijednošću planiranom do danas. 1,00 ili više: u skladu s planom; 0,90–0,99: malo u zaostatku; ispod 0,90: u zaostatku. Računa se samo iz faza koje imaju datum početka i završetka. | Earned value of the work divided by the value planned to date. 1.00 or more: on schedule; 0.90–0.99: slightly behind; below 0.90: behind. Only phases with both a start and an end date count. |
| `budget_control.hints.eac_title` | EAC – procjena ukupnog troška | EAC – Estimate at Completion |
| `budget_control.hints.eac_body` | Planirani proračun podijeljen s CPI-jem: koliko će projekt koštati ako se trošak nastavi kretati kao dosad. | Planned budget divided by CPI: what the project will cost if spending keeps going the way it has. |
| `budget_control.hints.vac_title` | VAC – odstupanje na kraju projekta | VAC – Variance at Completion |
| `budget_control.hints.vac_body` | Planirani proračun umanjen za EAC. Pozitivan iznos je očekivana ušteda, negativan očekivano prekoračenje. | Planned budget minus EAC. A positive amount is the expected saving, a negative one the expected overrun. |

### 1.9 Hints: TIC phases (hotspot 6)

Shown: Funding → TIC, kartica Investicija: "?" under the table, and the amber triangle on a mismatched row (now clickable)

| Key | Hrvatski | English |
|---|---|---|
| `tic.hints.phases_title` | Faze u TIC-u | Phases in the TIC |
| `tic.hints.phases_phased` | Klik na ćeliju faze otvara raspodjelu tog retka po fazama. Zbroj po fazama treba odgovarati iznosu retka. | Clicking a phase cell opens that row's split across phases. The phase amounts should add up to the row's amount. |
| `tic.hints.phases_unphased` | „—” znači da je trošak na razini projekta (npr. zemljište): računa se jednom i ne pripada nijednoj fazi. | "—" means the cost is at project level (land, for example): it is counted once and belongs to no phase. |
| `tic.hints.mismatch_body` | Iznosi upisani po fazama razlikuju se od vlastitih ili kreditnih sredstava ovog retka. Ništa se ne ispravlja automatski: kliknite ćeliju faze i uskladite raspodjelu, ili ispravite iznos retka. | The amounts entered per phase differ from this row's own or credit funds. Nothing is corrected automatically: click a phase cell and fix the split, or correct the row's amount. |

### 1.10 Hint: credit allocations (hotspot 9)

Shown: Funding → Investicije, "?" beside the Namjene kredita heading of an expanded credit

| Key | Hrvatski | English |
|---|---|---|
| `funding.hints.allocations_title` | Namjene kredita | Credit allocations |
| `funding.hints.allocations_purpose` | Namjena je dio kredita rezerviran za projekt, OPEX (troškove bez projekta) ili refinanciranje firme ili banke. | An allocation is a part of the credit set aside for a project, for OPEX (costs with no project) or for refinancing a company or a bank. |
| `funding.hints.allocations_amounts` | Alocirano je rezervirani iznos, Iskorišteno ono što je s te namjene već plaćeno ili isplaćeno, a Dostupno razlika između njih (crveno ako je namjena prekoračena). | Allocated is the amount set aside, Used is what has already been paid or drawn against it, and Available is the difference (red when the allocation is overdrawn). |
| `funding.hints.allocations_disbursed` | Kod kredita isplaćenog izravno na račun firme cijela se namjena vodi kao iskorištena. | For a credit disbursed straight to the company's account, the whole allocation counts as used. |

## 2. Changed strings

**`tic.import.format_sheets`** — The parser has no first/second-sheet fallback; it matches by name, then by table shape (ticImport.ts).

| | Before | After |
|---|---|---|
| HR | Dva lista: INVESTICIJA i GRAĐENJE (ako nedostaju nazivi, koristi se prvi i drugi list) | Dva lista: INVESTICIJA i GRAĐENJE. Listovi drugačijeg naziva prepoznaju se po obliku tablice (list građenja ima prvi stupac s oznakama A), B), C) i rimskim brojevima). |
| EN | Two sheets: INVESTICIJA and GRAĐENJE (without those names, the first and second sheet are used) | Two sheets: INVESTICIJA and GRAĐENJE. Sheets with other names are recognised by the shape of the table (the construction sheet has a leading column of A), B), C) codes and roman numerals). |

## 3. Wording that changed because a screen now reads a shared label

Finishing the shared Cashflow status and type labels removed four per-screen sets of strings. The keys below are deleted; these are the visible differences.

| Screen | Before → after |
|---|---|
| `cashflow_calendar.invoice_types.*` | Cashflow calendar type column: "Ulazni - Dobavljač", "Ulazni - Investicije", "Ulazni - Office", "Izlazni - Dobavljač", "Izlazni - Prodaja", "Izlazni - Office" → the shared spelled-out labels above ("Ulazni (Dobavljač)" …). The three bank types, which the calendar used to print as raw INCOMING_BANK / OUTGOING_BANK / INCOMING_BANK_EXPENSES, now have labels too. |
| `payments.detail.*` | Payment details, Tip računa: "Ulazni dobavljač", "Ulazni investitor", "Ulazni ured", "Ulazni banka", "Izlazni dobavljač", "Izlazni prodaja", "Izlazni ured", "Izlazni banka" → the shared spelled-out labels. Note "Ulazni investitor" becomes "Ulazni (Investicije)". |
| `office_suppliers.status.*` | Office suppliers invoice list: same words as before (Plaćeno / Djelomično / Neplaćeno), now from the shared `common.*` keys. |
| `invoices.detail.*` | Invoice details status badge: "Djelomično plaćeno" → "Djelomično" (EN "Partially Paid" → "Partial"), matching every other invoice list. Plaćeno / Neplaćeno are unchanged. |

Colours did not change: unpaid red, partial yellow, paid green on every invoice list. Payment methods keep their colours (Virman blue, Gotovina green, Ček yellow, Kartica purple) and now use the standard badge shape.

## 4. Spreadsheet template headers

The **Preuzmi predložak** button produces `predlozak-uvoz-stanova-<date>.xlsx`: sheet **Stanovi** with the header row below, and sheet **Upute** repeating the instruction lines from 1.1 in Croatian. The import reads cells by position, so these names are for the person filling in the sheet; they are not translated and live in `apartmentImportTemplate.ts`, not in the locale files.

| Col | Header | Col | Header |
|---|---|---|---|
| A | zgrada | N | parking m2 |
| B | ulaz | O | parking cijena |
| C | kat | P | repozitorij oznaka |
| D | oznaka stana | Q | repozitorij m2 |
| E | tip | R | repozitorij cijena |
| F | sobnost | S | ukupna cijena |
| G | zatvorena površina m2 | T | datum potpisa predugovora |
| H | otvorena površina m2 | U | kapara 10% |
| I | otvorena površina s koef. m2 | V | 1. rata AB konstrukcija 30% |
| J | stan m2 prodajno | W | 2. rata postava stolarije 20% |
| K | cijena po m2 | X | 3. rata obrtnički radovi 20% |
| L | cijena stana | Y | 4. rata uporabna 20% |
| M | parking oznaka | Z | kredit etažiranje 90% |

Only four of these names were known from the old instructions (zgrada, oznaka stana, stan m2 prodajno, kapara 10%) and three from the garage import (parking oznaka, parking m2, parking cijena). The rest are proposed here — replace them with the names your own "Tablica stanova" uses if they differ.

## 5. Help articles already edited

Four articles were edited because the screen they describe changed in this phase (the project rule is that an article follows its screen). Please review the wording with the rest.

| Article | Change |
|---|---|
| `help-kb/sales-projects.md` | New section **Uvoz stanova iz Excela**: the template button, the column layout, and that U–Z hold EUR amounts, not dates. Same facts as section 1.1 above. The rest of the article is untouched and still has the issues listed in 6.3. |
| `help-kb/tic.md` | One sentence: "(ako nazivi ne odgovaraju, koristi se prvi i drugi list)" → "Listovi drugačijeg naziva prepoznaju se po obliku tablice (list građenja ima prvi stupac s oznakama A), B), C) i rimskim brojevima)." |
| `help-kb/top-nav.md` | New bullet: "**Ikona upitnika** (Pomoć) — otvara stranicu **Pomoć** s uputama za stranice, pojmove i uloge. Na stranicama koje imaju svoju uputu, upitnik uz naslov stranice otvara upravo te upute u novoj kartici." |
| `help-kb/term-status-casing.md` | No text change. Frontmatter `assistant_only: true`, which hides it from `/help` and keeps it for the assistant: it describes stored database values a user never sees (and is partly wrong, see 6.2). |

## 6. Help article audit: outdated content and proposed corrections

25 of the 66 articles were checked claim by claim against the current code: the five `role-*` articles, every article an in-app hint links to, and their close neighbours. **None of the corrections below has been applied** — they are proposals. The other 41 articles were not checked.

No dead `[[links]]` and no non-existent routes were found in any of the 25.

Each row: what the article says now → what the code does → proposed text. "Decide" marks items that need a business answer, not a wording fix.

### 6.1 Roles, profiles and navigation

**Root causes** (each affects several articles):

1. The Supervision role's fixed menu now has three items (Upravljanje gradilištem, Dnevnici radova, Dokumenti), and that role can read no payment rows at all.
2. The Cashflow password prompt does not check the role. A Sales or Investment user with the password gets the Cashflow profile and menu; only opening a Cashflow page sends them back to the start page.
3. The Investment role has no database access to payments, so "Investment sees payments" is false. **Decide:** is that intended, or a gap to fix in the database?
4. Only Cashflow pages, General reports and the Activity Log redirect an unauthorised role. Other pages open and show whatever data the role may read.

| Article | Says now | Proposed |
|---|---|---|
| `role-supervision-restrictions` | "Vide isključivo svoj Supervision izbornik: **Upravljanje gradilištem**, **Dnevnici radova**, **Plaćanja**, **Računi**, **Dokumenti**." | "Vide isključivo svoj fiksni izbornik s tri stavke: **Upravljanje gradilištem**, **Dnevnici radova**, **Dokumenti**." |
| | "Ostali projekti uopće se ne pojavljuju u popisima, plaćanjima ili računima." | "Ostali projekti uopće se ne pojavljuju u popisima. Podatke o plaćanjima uloga Supervision ne vidi ni za jedan projekt." |
| | "**Imaju pristup neplaćenim računima** svojih projekata (u **Računi** stranici), ali ne i globalnim financijskim sažecima." | "**Neplaćene račune** svojih projekata mogu dobiti upitom AI asistentu; stranice **Računi** i **Plaćanja** nisu u njihovom izborniku. Globalne financijske sažetke ne vide." |
| | Invoices "ograničena na dodijeljene projekte" | **Decide:** the database also shows this role invoices of projects that have no assigned manager at all. Intended? |
| `role-cannot-see-cashflow` | "Ako pokušate ući u Cashflow s drugom ulogom (Sales, Supervision, Investment), čak i s ispravnom lozinkom, sustav vas preusmjerava natrag na početnu stranicu." | "Uloge Sales i Investment mogu odabrati Cashflow i unijeti lozinku, pa se profil i njegov izbornik prikažu, ali svaka Cashflow stranica odmah vas vraća na početnu stranicu, a podaci se ne učitavaju. Uloga Supervision nema dropdown profila pa Cashflow ne može ni odabrati." |
| | "Profil **Cashflow** vidljiv je u dropdownu profila svim korisnicima koji ga mogu odabrati" | "Profil **Cashflow** vidljiv je u dropdownu profila svim ulogama osim Supervision, …" |
| | "**Supervision** — vidi plaćanja podugovarateljima i neplaćene račune za vlastite projekte u [[supervision-payments]] i [[supervision-invoices]]" | "**Supervision** — nema pristup plaćanjima; neplaćene račune svojih projekata može zatražiti od AI asistenta." |
| | "**Investment** — vidi investicijske tokove u [[funding-payments]] i [[investment-projects]]" | "**Investment** — vidi investitore, investicije i projekte u Funding profilu ([[investment-projects]]); popis plaćanja u [[funding-payments]] za ovu ulogu ostaje prazan." (depends on root cause 3) |
| `role-cannot-see-financials` | "**Supervision** — plaćanja i račune svojih projekata ([[supervision-payments]], [[supervision-invoices]])" | "**Supervision** — neplaćene račune svojih projekata preko AI asistenta; plaćanja ne vidi." |
| | "**Investment** — investicijske tokove ([[funding-payments]], [[investment-projects]])" | "**Investment** — investitore, investicije i projekte u Funding profilu ([[investment-projects]])." |
| `role-profile-vs-role` | "Profili se mijenjaju u dropdownu pored imena korisnika." | "Profili se mijenjaju u dropdownu u gornjoj traci koji prikazuje naziv trenutnog profila (na mobitelu: u bočnom izborniku, odjeljak **Profil**)." |
| | "Promjena profila ne mijenja prava — vidite samo one stranice na kojima vaša uloga ima pristup." (also in `switch-profile`) | "Promjena profila ne mijenja prava — izbornik se promijeni, ali podatke vidite samo ondje gdje vaša uloga ima pristup." |
| `role-roles-and-permissions` | "Jedina uloga koja vidi [[dashboard]] s direktorskim KPI-jevima i ima pristup Activity Logu." | "**Director** — vidi sve module, sve projekte i sve financijske podatke. Jedina uloga s pristupom stranicama **Dnevnik aktivnosti** i **Izvještaji** u General profilu." |
| | "**Accounting** — vidi sve module i sve financije" | "**Accounting** — vidi sve module i sve financije osim Dnevnika aktivnosti i General izvještaja; jedina osim Director uloge koja može u Cashflow profil." |
| | "(Stanovi, Sales projekti, Kupci, Sales plaćanja)" | "(Stanovi, Sales projekti, Kupci, Plaćanja, Dokumenti, Izvještaji)" |
| | "**Supervision** — vidi samo svoj fiksni Supervision izbornik" | add "(Upravljanje gradilištem, Dnevnici radova, Dokumenti)" |
| | "**Investment** — vidi investicijski (Funding) modul, sve projekte, plaćanja i nadzornu ploču, ali ne i Cashflow." | "**Investment** — vidi investicijski (Funding) modul, sve projekte i nadzornu ploču, ali ne i Cashflow ni podatke o plaćanjima." (root cause 3) |
| | "Ako pokušate pristupiti stranici izvan svojih ovlasti, sustav vas preusmjerava na početnu stranicu." | "Cashflow stranice, General izvještaji i Dnevnik aktivnosti preusmjeravaju neovlaštene uloge na početnu stranicu; ostale stranice se otvore, ali prikazuju samo podatke koje vaša uloga smije vidjeti." |
| `switch-profile` | "Profil mijenjate iz dropdowna u gornjoj desnoj zoni" | add "Na mobitelu se profili nalaze na dnu bočnog izbornika, pod naslovom **Profil**." |
| `cashflow-unlock` | "Ostale uloge — čak i s ispravnom lozinkom — preusmjeravaju se na početnu stranicu." | "Ostale uloge mogu unijeti lozinku i profil će se prikazati, ali svaka Cashflow stranica vraća ih na početnu stranicu i podaci im nisu dostupni." |
| | "Unesite lozinku u polje **Unesite lozinku**" | "Unesite lozinku u polje **Lozinka** i kliknite **Potvrdi**." |
| | "Otključavanje vrijedi do kraja sesije (do odjave ili zatvaranja preglednika)." | "Otključavanje vrijedi do odjave ili zatvaranja kartice preglednika; u novoj kartici lozinku treba unijeti ponovno." (This matters now: help links open in a new tab. `/help` itself needs no unlock.) |
| `top-nav` | "**Ikona kvačice** (Zadaci) — … badge za nove obavijesti" | "…; crveni broj označava nove zadatke" |
| | "**Ikona kalendara** — … badge za podsjetnike" | "…; crveni broj označava pozivnice na događaje na koje još niste odgovorili" |
| | "**Language Switcher** — promjena jezika", "**Sun/Moon ikona**", "**Odjava** (LogOut)" | "**Gumb EN / HR** — promjena jezika", "**Ikona sunca/mjeseca** — …", "**Odjava** — gumb s ikonom izlaza; završava sesiju" |
| | Describes the desktop bar only | add "Na mobitelu gornja traka sadrži samo gumb izbornika, logo te ikone Chat, Zadaci i Kalendar; profil, jezik, tema i **Odjava** nalaze se u bočnom izborniku (odjeljci **Profil** i **Račun**)." |

Also stale for root cause 1, outside the 25: `supervision-payments.md` and `supervision-invoices.md` still list Supervision among their roles.

### 6.2 Cashflow: invoices, payments, cesija, kompenzacija

| Article | Says now | Proposed |
|---|---|---|
| `term-invoice-types` | "Filter **Svi tipovi** … omogućuje sužavanje na **Ulazni** ili **Izlazni**. Detaljna podvarijanta vidljiva je kao značka na svakom retku." | "Prekidač **Ulazni / Izlazni** na stranici [[cashflow-invoices]] bira smjer (uvijek je odabran jedan; zadano **Ulazni**). Padajući filter **Svi tipovi** zatim sužava popis na jednu podvarijantu tog smjera, npr. **ULAZNI (DOB)**. Podvarijanta je ispisana u stupcu **Tip** svakog retka (crveno ili zeleno)." |
| | "**ULAZNI (BANKA)** — bankarski troškovi" | "**ULAZNI (BANKA)** — odljev prema banci/investitoru (otplata kredita); unosi se gumbom **Investicije**, tip **Odljev**" |
| | "**IZLAZNI (BANKA)** — banci" | "**IZLAZNI (BANKA)** — priljev od banke/investitora (isplata/povlačenje kredita); gumb **Investicije**, tip **Priljev**" |
| | "**ULAZNI (TROŠ.KRED)** — troškovi kredita" | "**ULAZNI (TROŠ.KRED)** — troškovi kredita (kamate, naknade); gumb **Investicije**, tip **Troškovi kredita**" |
| | "U Retail profilu … **Ulazni od dobavljača**, **Izlazni od prodaje**." | "U Retail profilu ([[retail-invoices]]) koriste se značke **Ulazni - Dobavljač**, **Ulazni - Investicija**, **Izlazni - Prodaja**, **Izlazni - Dobavljač**." |
| | "**IZLAZNI (DOB)** — prema dobavljaču (re-fakturiranje)" | "**IZLAZNI (DOB)** — izlazni račun izdan dobavljaču (dobavljač je kupac)". **Decide:** nothing in the code says "re-fakturiranje". |
| | "**ULAZNI (INV)** — od investicije" | **Decide:** what does this type mean in business terms? The form calls it "Ulazni (Investicije)" and ties it to a bank; the code treats it as money out in one place and money in in another. The new hint (4.3) and the long label (4.1) depend on the answer. |
| | Does not say how a type is chosen | add: **Novi račun** offers Ulazni (Dobavljač), Ulazni (Investicije), Izlazni (Dobavljač), Izlazni (Prodaja); **Novi Office Račun** gives the URED types; **Investicije** gives the three BANKA / TROŠ.KRED types. |
| `cashflow-invoices` | "Glavni gumb **Novi račun** ima podakcije: **Nova Uredska Faktura**, **Novi Retail Račun**, **Novi Bankovni Kredit**, **Novi Račun o Kupnji Zemlje**." | "U zaglavlju je pet zasebnih gumba: **Kupoprodaja Zemljišta**, **Novi Office Račun**, **Novi Retail Račun**, **Investicije** (račun banke/kredita — otvara **Novi Račun Banka**) i **Novi račun**. Gumb **Polja** omogućuje uključivanje/isključivanje stupaca." |
| | "Filtri: … **Svi tipovi** (Ulazni / Izlazni), **Svi statusi** (…), **Svi projekti**, **Svi dobavljači**, te raspon **Od datuma** / **Do datuma**." | "Filtri: tekstualna pretraga (**Pretraži račune...**), **Svi tipovi** (podvarijante odabranog smjera), **Svi statusi** (Plaćeno, Neplaćeno, Djelomično, Neplaćeno + Djelomično), **Sve firme**, prekidač **Ulazni / Izlazni** te gumb **Očisti** kad je neki filter aktivan." (There is no project, supplier or date filter.) |
| | "Kartice statistike: ukupno računa (filtrirano), neplaćeni iznos (filtrirano), ukupno dug." | "Kartice statistike: **Ukupno računa**, zatim za ulazne **Neplaćeno** (po filtrima) i **Ukupno Neplaćeno**, a za izlazne **Priljev** i **Ukupni Priljev**." |
| `term-multi-vat` | "… tako ih i prikazuje na stranici [[approvals]] (stupci **Osnovica**, **PDV**, **Ukupno**)." | "Sustav razdvaja iznose po stopi i tako ih prikazuje u tablici na stranici [[cashflow-invoices]]: u stupcima **Osnovica** i **PDV** svaka stopa ima svoj red (npr. „25%: €…"). Stranica [[approvals]] prikazuje samo zbrojne iznose **Osnovica**, **PDV**, **Ukupno**." |
| | "kod unosa novog računa moguće je rasporediti osnovicu po više stopa u istom dokumentu." | "Kod unosa računa postoje četiri polja — **Osnovica PDV 25%**, **Osnovica PDV 13%**, **Osnovica PDV 5%** i **Osnovica PDV 0%**; popunite ona koja se odnose na račun (barem jedno), a PDV i ukupan iznos sustav izračuna sam i prikaže u **Pregled računa**." |
| `term-cesija` | "U sustavu se pojavljuje kao zastavica **is_cesija = true** na zapisu plaćanja, ili kao način plaćanja **Cesija** …" | "U sustavu se cesija unosi u obrascu plaćanja kvačicom **Ugovor o cesiji (plaćanje iz druge firme)**. Nakon toga birate **Firma koja plaća (cesija)**, **Izvor plaćanja (cesija)** (Bankovni račun ili Kredit) te **Bankovni račun (cesija)**, odnosno **Kredit (cesija)** i **Projekt (cesija)**. Način plaćanja je tada uvijek **Virman**. Obrazac je dostupan na stranici [[cashflow-payments]] (**Novo plaćanje**) i pri plaćanju računa na stranici [[cashflow-invoices]]." |
| | "Kada na pregledu plaćanja vidite oznaku **Cesija** ili napomenu o cesiji, …" | "U tablici plaćanja cesija se prepoznaje po ljubičastom tekstu **Cesija - {naziv firme}** u stupcu **Opis**; u detaljima plaćanja piše **Način izvora plaćanja: Cesija** i prikazan je odjeljak **Cesija** s firmom koja je platila. Firma koja plaća bira se iz popisa vaših firmi (**Firme**)." |
| | Title and first sentence: "asignacija potraživanja" | **Decide (legal term):** cesija is "ustup potraživanja"; asignacija is a different institute. Suggested title: "Što je cesija (ustup potraživanja)?" |
| `term-kompenzacija` | "U sustavu se pojavljuje kao način plaćanja **Kompenzacija** … (padajući filter **Svi načini plaćanja**)." | "U sustavu se unosi u obrascu plaćanja: u polju **Izvor plaćanja** odaberite **Kompenzacija** (umjesto **Bankovni račun**, **Kredit** ili **Gotovina**). Tada se ne bira ni račun ni kredit, a polje **Način plaćanja** nestaje. U tablici na stranici [[cashflow-payments]] takvo plaćanje u stupcu **Način plaćanja** ima „—", a u detaljima piše **Način izvora plaćanja: Kompenzacija**. Filter **Svi načini plaćanja** nema opciju Kompenzacija." |
| | "Plaćanje s ovim načinom…" | "Plaćanje s ovim izvorom…"; optionally add "Kompenzacija se ne može kombinirati s cesijom." |
| `cashflow-payments` | "**Svi načini plaćanja** (Virman, Gotovina, Ček, Kartica, Kompenzacija, Cesija)" | "**Svi načini plaćanja** (Virman, Gotovina, Ček, Kartica)" |
| | "Plaćanja označena kao **Cesija** (oznaka **is_cesija**) predstavljaju asignaciju potraživanja … Način **Kompenzacija** …" | "Cesija se unosi kvačicom **Ugovor o cesiji (plaćanje iz druge firme)** u obrascu plaćanja; u tablici se vidi kao **Cesija - {firma}** u stupcu **Opis** — pogledajte [[term-cesija]]. **Kompenzacija** je jedna od opcija polja **Izvor plaćanja** (Bankovni račun, Kredit, Kompenzacija, Gotovina) i predstavlja međusobni prijeboj — pogledajte [[term-kompenzacija]]." |
| | "Paginacija ispod prikazuje filtrirani ukupni iznos." | "Uz paginaciju se za filtrirana plaćanja prikazuje **Filtrirano:** s tri iznosa — **PRIHOD**, **RASHOD** i **Neto**." |
| | minor | "**Resetuj datume**" appears only when a date is set; the six stat cards above the table are not mentioned; the table's **Tip** column shows **RASHOD** / **PRIHOD**. |
| `term-status-casing` (now assistant-only) | "**Projekti** — *Title Case*: `Planiranje`, `U tijeku`, `Završeno`, `Na čekanju`" | "**Projekti** — *Title Case*, engleski: `Planning`, `In Progress`, `Completed`, `On Hold` (u sučelju: Planiranje, U tijeku, Završeno, Na čekanju)" |
| | "**Ugovori** — *lowercase*: `active`, `completed`, `pending`..." | "**Ugovori** — *lowercase*: `draft`, `active`, `completed`, `terminated` (retail ugovori: `Active`, `Completed`, `Cancelled`)" |
| | "U izvozima (CSV) ili kroz AI asistenta…" | "Kroz AI asistenta možda vidite originalne vrijednosti." (there is no CSV export) |

### 6.3 Budget control, TIC, funding, sales

| Article | Says now | Proposed |
|---|---|---|
| `term-evm` | "… prikazuje četiri glavne metrike po fazama" | "Stranica [[budget-control]] prikazuje četiri glavne metrike za odabrani projekt (zbrojeno preko svih njegovih faza):" |
| | "Iznad metrika su značke statusa (npr. zelena/žuta/crvena) koje se računaju iz odstupanja od 1.0." | "Kartice CPI i SPI obojane su prema vrijednosti: **1,00 ili više** — zeleno (CPI: „Ispod proračuna ✓", SPI: „U skladu s planom ✓"); **0,90–0,99** — žuto („Malo iznad proračuna" / „Malo u zaostatku"); **ispod 0,90** — crveno („Iznad proračuna ✗" / „U zaostatku ✗")." |
| | "Stupčasti grafikon ispod prikazuje … po fazama. Raspršeni grafikon pozicionira faze u CPI/SPI prostoru." | "Iznad EVM kartica su dva grafikona. Stupčasti grafikon **Kontrola proračuna** uspoređuje četiri iznosa projekta: **Planirano**, **Ugovoreno**, **Plaćeno** i **Prognoza (EAC)**. Grafikon **EVM indeksi performansi** prikazuje trenutni CPI i SPI projekta u odnosu na linije **Cilj (1.0)** i **Upozorenje (0.9)**." |
| | No caveats on EAC, VAC, SPI | add "Ako je CPI 0 (ima plaćanja, ali nema ostvarene vrijednosti), EAC i VAC prikazuju „—" uz napomenu „Nema prognoze". Dok ništa nije plaćeno, CPI iznosi 1,00 jer još nema troška za usporedbu. SPI prikazuje „—" ako nijedna faza nema datum početka i završetka." |
| `budget-control` | "… pregled performansi po fazama jednog projekta" | "… pregled performansi odabranog projekta, zbrojeno preko svih njegovih faza." **The page's own subtitle has the same error** — `budget_control.subtitle`, "EVM pregled performansi po fazama projekta". Not changed in this phase; say if you want it reworded. |
| | "Prikazuje se pet ključnih pokazatelja: CPI… SPI… EAC… VAC… iskorištenost budžeta u postotcima" | "Na vrhu je pet kartica: **TIC** (ukupni investicijski trošak), **Planirani proračun**, **Ugovoreno** (s postotkom od proračuna), **Plaćeno** (s postotkom od ugovorenog) i **Prognoza (EAC)**. Na dnu, pod naslovom **EVM metrike performansi**, nalaze se **CPI** i **SPI** (obojani prema statusu), **EAC**, **VAC** i **Dovršenost** — udio plaćenog u ugovorenom." |
| | "Ispod kartica nalazi se stupčasti grafikon … i raspršeni grafikon CPI/SPI po fazama." | "Između dva reda kartica nalaze se stupčasti grafikon **Kontrola proračuna** (Planirano, Ugovoreno, Plaćeno, Prognoza (EAC)) i grafikon **EVM indeksi performansi** s trenutnim CPI-jem i SPI-jem projekta." |
| | "Ako nijedna faza projekta nema datume, SPI nema osnovu … CPI … računa se uvijek." | "Ako nijedna faza nema oba datuma, kartica SPI prikazuje „—" i napomenu „Nema faza s datumima početka i završetka". CPI se prikazuje uvijek; dok ništa nije plaćeno iznosi 1,00." |
| | "Realizirani budžet računa se iz ugovora (`contracts`), ne iz polja `budget_used` na fazi — to polje nije pouzdano." | "**Plaćeno** je zbroj realiziranih (plaćenih) iznosa po ugovorima projekta; **Ugovoreno** je zbroj iznosa ugovora." |
| | "Projekt bez TIC-a nema plan, pa CPI i SPI za njega nemaju osnovu; brojke se prikazuju iz onoga što je zapisano…" | "Ako faze projekta nemaju budžet (projekt nema TIC), umjesto kartica i grafikona prikazuje se poruka „Nema podataka o proračunu za ovaj projekt". Budžet se postavlja spremanjem [[tic]] projekta." **Also:** that screen's second line tells the user to "add phases with an assigned budget", which contradicts "budget comes only from the TIC". Not changed in this phase. |
| `term-tic` | "(stupci **FAZA 1**, **FAZA 2** …)" | "(stupci **Faza 1**, **Faza 2** … na kartici Investicija, dodaju se gumbom **Dodaj fazu** ili uvozom iz Excela)" |
| | "… svugdje piše „budžet nije postavljen"" (also in `tic`) | "… na karticama i obrascima projekta piše „Budžet nije postavljen"." |
| `tic` | "… iz padajućeg izbornika **Odaberite projekt**." | "… **Odaberi projekt:**." |
| | "Obje kartice imaju stupce: **Namjena**, **Klasifikacija troška**, … te po jedan stupac za svaku fazu" | "Obje kartice imaju stupce **NAMJENA**, **VLASTITA SREDSTVA** (EUR + %), **KREDITNA SREDSTVA** (EUR + %) i **UKUPNA INVESTICIJA**. Kartica Investicija ima još stupac **Klasifikacija troška** i po jedan stupac za svaku fazu (**Faza 1**, **Faza 2** …)." |
| | "Redak bez klasifikacije prikazuje se kao **nemapiran** … ukupan nemapiran iznos, u narančastom" | "Redak bez klasifikacije ima odabrano **— nije klasificirano —** i ne ulazi ni u jedan budžet po klasifikaciji. Ispod tablice, u odjeljku **Plan po klasifikaciji troška**, taj se iznos prikazuje narančasto kao **Neraspoređeno u TIC-u**." |
| | Phases come only from Excel headers | "TIC može planirati i **kada** se novac troši. Faze se dodaju gumbom **Dodaj fazu** ispod tablice ili dolaze iz Excela (zaglavlja **FAZA 1**, **FAZA 2** …). Svaka faza dobiva stupac **Faza n**; klikom na ćeliju faze otvara se **Raspodjela po fazama**, gdje se iznos retka dijeli po fazama (ručno ili gumbom **Ravnomjerno raspodijeli**) ili se označava kao **Trošak na razini projekta (nije fazirano)**. Zbroj po fazi vidi se u retku **UKUPNO:**. Ikona koša u zaglavlju faze uklanja tu fazu iz svih redaka." |
| | Never mentions the mismatch warning | add "Ako zbroj po fazama ne odgovara iznosu retka, uz ukupni iznos retka pojavljuje se žuti trokut upozorenja; klik na njega objašnjava što učiniti. Ništa se ne ispravlja automatski — raspodjela se sprema kako je upisana." (adjusted for this phase: the triangle is now clickable) |
| | "Redak čiji zbroj po fazama ne odgovara njegovu ukupnom iznosu tretira se kao nefaziran, umjesto da se iznos nagađa." | "Redak u kojem svaka faza ponavlja puni iznos retka, ili su mu stupci faza prazni, uvozi se kao nefaziran (u pregledu pod **Nije fazirano:**). Redak čiji zbroj po fazama ne odgovara ukupnom iznosu uvozi se točno kako je napisan i navodi se u pregledu pod **Provjerite raspodjelu:** — treba ga ručno ispraviti." |
| | "**zamjenjuje sve stavke u obje tablice**" | "… zamjenjuje sve stavke na karticama za koje je u datoteci pronađen odgovarajući list (kartica bez lista ostaje nepromijenjena)." |
| | "**Preuzmi Excel**", "**Preuzmi PDF**" | "**Export Excel**", "**Export PDF**" (the buttons' actual labels) |
| | "Ako uvoz nije bio ispravan, dovoljno je promijeniti projekt bez spremanja." | "Ako uvoz nije bio ispravan, promijenite projekt ili napustite stranicu i u dijalogu **Nespremljene promjene** odaberite **Izađi bez spremanja**." |
| | "**Ime investitora**, polje **Za investitora** (potpis) i **Datum**" | "**INVESTITOR:**, **Za investitora:** (mjesto za potpis) i **Datum:**" |
| | "TIC bez ijednog faziranog retka … tada projekt ima jednu fazu." | "TIC bez ijednog faziranog retka opisuje projekt kao cjelinu: cijeli budžet dobiva Faza 1 (stvara se ako projekt nema faza), a ostale postojeće faze ostaju s budžetom 0." |
| | "**Dodaj stavku** / **Dodaj skupinu** … (samo na kartici Građenje)" | "**Dodaj stavku** za novi redak (na obje kartice) i **Dodaj skupinu** za novu skupinu (samo na kartici Građenje)" |
| `term-budzet-iz-tic` | — | OK. Optional: mention the second check, "Iznos ugovora premašuje raspoloživi budžet klasifikacije troška". |
| `term-realised-budget` | "**Važno:** polje **budget_used** na fazi (`project_phases.budget_used`) **nije pouzdano** …" | "Na fazi se prikazuju dvije različite brojke: **ugovoreno** (zbroj iznosa ugovora u fazi) i **realizirano** (stvarno plaćeno po tim ugovorima). Realizirani budžet uvijek znači plaćeno, ne ugovoreno." A later migration made that field a maintained figure; whether it is applied in production was not checked. |
| | Table and tool names (`contracts`, `budget_realized`, `get_project_financial_summary`) | "Realizirani (potrošeni) budžet projekta i faze zbroj je plaćenih iznosa po ugovorima; ažurira se automatski kad se evidentira plaćanje." Delete the last paragraph. |
| | "[[general-reports]] — … polje **Realizirani budžet (%)**" | "[[general-reports]] — sekcija **STATUS GRADNJE I NADZORA**, polja **Realizirani budžet** (iznos) i **Iskorištenost budžeta** (%); dostupno samo ulozi Director" |
| | "[[budget-control]] — EVM prikaz s realiziranim budžetom po fazama" | "[[budget-control]] — kartica **Plaćeno** za cijeli projekt" |
| `term-faza-vs-prekretnica` | Table names (`project_phases`, `project_milestones`, `phase_number`) and "AI asistent posebno pazi…" | "…riječ je o dva različita pojma koji se vode odvojeno." / "Faza ima redni broj, budžet i status…" / "Kada netko kaže "faza 3 projekta X", misli na fazu izvođenja." Delete the AI sentence. |
| | "ako ima stupce **FAZA 1**, **FAZA 2** …" | "ako ima stupce **Faza 1**, **Faza 2** …" |
| `funding-investments` | "Statistički red s pet vrijednosti: **Iznos investicije**, **Alocirano**, **Iskorišteno**, **Dug**, **Nealocirano**." | "U zaglavlju kartice je **Iznos investicije**, a ispod njega četiri vrijednosti: **Alocirano**, **Iskorišteno**, **Dug**, **Nealocirano**." |
| | "Traka napretka je obojana — narančasta (iskorišteno), siva (alocirano), crvena (prealocirano)." | "Traka **Napredak alokacije**: narančasto je iskorišteno, sivo alocirano a još neiskorišteno; ako alokacije i izravne isplate premaše iznos kredita, traka postaje crvena, **Nealocirano** je negativno i ispisuje se „Prekoračenje za €…"." |
| | "**Namjena Investicije** otvara modal … **Refinanciranje** — alokacija prema banci/refinanciranju" | "Gumb **Namjena Investicije** (nema ga na kreditima isplaćenima izravno na račun firme) otvara prozor **Nova namjena kredita** s kategorijama: **Projekt** — odabire se projekt; **OPEX (Bez projekta)** — operativni troškovi; **Refinanciranje** — odabire se **Tip entiteta** (**Firma** ili **Banka**) i konkretna firma/banka. **Alocirani iznos** mora biti veći od 0 i ne smije premašiti prikazani iznos **Nealocirano**." |
| | "Proširena kartica kredita prikazuje vrstu kredita, kamatnu stopu, dospjeli iznos, …" | "Proširena kartica prikazuje **Vrsta kredita**, **Kamatna stopa**, **Preostali dug**, **Vraćeno**, datume (**Datum početka**, **Datum dospijeća**, **Istek korištenja**), popis **Namjene kredita** (za svaku: **Alocirano**, **Iskorišteno**, **Dostupno** i **Računi plaćeni ovom alokacijom**) te odjeljke **Isplate kredita**, **Uplate kredita** i **Troškovi kredita**." |
| `sales-projects` | "**Prodajni projekti** je trorazinska navigacija…" (and the title) | "Stranica **Sales projekti** (naslov na stranici: **Projekti**) je trorazinska navigacija: **Projekti → Zgrade → Jedinice**…" |
| | "**Uvezi stanove iz Excela**, **Masovno kreiraj zgrade**, **Dodaj jednu zgradu**" | "**Uvezi iz Excela** (uvoz stanova za cijeli projekt), **Kreiraj zgrade**, **Dodaj zgradu**" |
| | "… dostupne su sličnice akcije …: **Uvezi garaže iz Excela**, **Masovno kreiraj [jedinice]**, **Dodaj jednu [jedinicu]**." | "U prikazu jedinica, za odabrani tab dostupni su gumbi **Masovno kreiranje** i **Dodaj jednu** (uz naziv tipa); na tabu **Garaže** dodatno i **Uvezi garaže iz Excela**." |
| | "Filtri statusa: **Dostupno / Rezervirano / Prodano**. Dostupne su i akcije **Povezivanje…**, **Masovno usklađivanje cijena** … te **Završetak prodaje**…" | "Filtar statusa: **Svi / Dostupno / Rezervirano / Prodano**. Na kartici jedinice su gumbi **Rezerviraj** / **Dostupno**, a na stanovima i **Prodaj** (otvara **Završi prodaju** s odabirom ili unosom kupca) te ikona lanca **Poveži garažu/repozitorij**. Garaže i repozitoriji prodaju se uz stan. Za promjenu cijena označite jedinice i kliknite **Postavi cijenu** — otvara se **Masovno ažuriranje cijena** (**Povećaj cijenu** / **Smanji cijenu** za iznos po m²; prodane jedinice se preskaču)." |
| `term-unit-types` | "Akcija **Povežite jedinice**…" | "Akcija **Poveži jedinice**…" |
| | "svaki tip ima vlastite akcije masovnog unosa i uvoza iz Excela" | "svaki tip ima masovno kreiranje i pojedinačno dodavanje; uvoz iz Excela postoji za stanove (u prikazu zgrada) i garaže (tab Garaže), a repozitoriji se uvoze zajedno sa stanovima." |
| | "**Dostupno** (zelena pozadina), **Rezervirano** (žuta), **Prodano** (zelena nakon prodaje)" | "**Dostupno** (bijela kartica, plava oznaka), **Rezervirano** (žuta), **Prodano** (zelena)." |
| | "najčešće se kupcu prodaju zajedno" | "…prodaju se kupcu zajedno sa stanom, kao paket (zasebna prodaja garaže ili repozitorija nije moguća u [[sales-projects]])." |

## 7. Decisions needed

1. **`roles` now hides articles.** For the assistant, an article's `roles` only lowers its rank; on `/help` it is a filter, and it also decides who sees the "?" beside a page title. Example: `budget-control`, `tic` and `funding-investments` list Director, Accounting and Investment, so a Sales user who can open those pages gets no help link there. Tighten, loosen, or leave?
2. **ULAZNI (INV).** What it means in business terms, and whether green is right for it (6.2). Until answered, the hint says only what the screen does.
3. **"Ured" or "Office".** The spelled-out labels say "Ulazni (Ured)"; the button that creates such an invoice says "Novi Office Račun".
4. **"Repozitorij" or "spremište"** in the template headers and instructions. The screens say Repozitorij; `docs/SPECIFIKACIJA.md` says spremište.
5. **Investment role and payments** (6.1, root cause 3): intended, or a database gap?
6. **Cesija: "asignacija" or "ustup potraživanja"** (6.2).
7. **Two on-screen strings the audit found misleading but this phase did not touch:** the Budget Control subtitle ("po fazama") and its no-budget message ("Dodajte faze s dodijeljenim proračunom…").
8. **Apply the corrections in section 6?** Say which, and they can be made in one pass with `npm run kb:build`.

## 8. Added in the second round (2026-10-05)

Six new strings from the follow-up work. Example of 8.1 as the user sees it: "Redak 7: Stupac V (1. rata AB konstrukcija 30%): upisan je datum, a očekuje se iznos u EUR".

### 8.1 Apartment import: date in an amount column

Shown: Sales projekti → Uvezi iz Excela, step 2 (the row's error line, after "Redak N:")

| Key | Hrvatski | English |
|---|---|---|
| `sales_projects.excel_import.error_date_in_amount_column` | Stupac {{column}} ({{name}}): upisan je datum, a očekuje se iznos u EUR | Column {{column}} ({{name}}): holds a date where an amount in EUR is expected |

### 8.2 Garage import instructions

Shown: Sales projekti → tab Garaže → Uvezi garaže iz Excela, step 1 (replaces four hardcoded English lines)

| Key | Hrvatski | English |
|---|---|---|
| `sales_projects.excel_import.garage_format.layout` | Zaglavlje je u 1. retku, podaci počinju od 2. retka. | Headers are on row 1 and data starts on row 2. |
| `sales_projects.excel_import.garage_format.label` | A – parking oznaka (oznaka garaže) | A – parking oznaka (garage label or number) |
| `sales_projects.excel_import.garage_format.size` | B – parking m2 (površina u m²) | B – parking m2 (size in m²) |
| `sales_projects.excel_import.garage_format.price` | C – parking cijena (cijena u EUR) | C – parking cijena (price in EUR) |

### 8.3 Activity log: help usage toggle

Shown: General → Dnevnik aktivnosti, checkbox under the filters (Director only)

| Key | Hrvatski | English |
|---|---|---|
| `activity_log.show_help_events` | Prikaži i korištenje pomoći | Also show help usage |

### 8.4 Article edit

`help-kb/sales-projects.md`, import section — one sentence added after the U–Z bullet, because the import now behaves this way: "Redak u kojem je u nekom od tih stupaca upisan datum ne uvozi se; u pregledu se navodi redak i stupac."

### 8.5 What changed in section 7

- **Decision 1 is settled** as you asked: an article is now shown to the roles it lists *and* to any role that can open a page it is tagged to. The rule for "can open" follows the router: Cashflow pages are Director and Accounting, General reports and the Activity Log are Director, and the Supervision role counts only the pages it is offered (its three menu items plus Chat, Tasks, Calendar and Help). An article with no `routes` still goes by its `roles` alone.
- One consequence to know before you mark section 6: `supervision-payments` and `supervision-invoices` still list Supervision in `roles`, so that role sees those two articles on `/help` although it can no longer reach the pages. Removing Supervision from their `roles` fixes it.
- The garage import lines (previously noted as left in English) are translated — 8.2.

### 8.6 Third round (2026-10-05): ULAZNI (INV) decision and the Cashflow profile

No new strings. One string changed and one was removed:

**`invoices.hints.type_colour`** — the hint on the Tip column (4.3 above). ULAZNI (INV) is now red like every other incoming type, so the exception is gone.

| | Before | After |
|---|---|---|
| HR | Crveno označava račune koje plaćamo, zeleno račune po kojima novac primamo. ULAZNI (INV) prikazuje se zeleno. | Crveno označava račune koje plaćamo (svi ulazni), zeleno račune po kojima novac primamo (svi izlazni). |
| EN | Red marks invoices we pay, green marks invoices we are paid on. ULAZNI (INV) is shown in green. | Red marks invoices we pay (every incoming one), green marks invoices we are paid on (every outgoing one). |

**Removed: `retail_projects.invoices_modal.type_incoming_investment`** ("Ulazni (Kupac)" / "Incoming (Customer)"). It labelled the retail "Ulazni + Kupac" combination, which is removed from the form. If such a type ever appears in that modal it now reads "Ulazni (Investicije)", the shared label.

What this settles in sections 6 and 7:

- **Decision 2 (ULAZNI (INV)) is settled: always money out.** In 6.2, the `term-invoice-types` row for it can now read: "**ULAZNI (INV)** — račun financijera (banke) koji plaćamo; u obrascu **Ulazni (Investicije)**, veže se uz banku". Not applied.
- **Root cause 2 in 6.1 no longer holds.** The Cashflow profile is now offered only to Director and Accounting, so the proposed replacements in `role-cannot-see-cashflow` and `cashflow-unlock` that describe other roles entering the password should instead say: "Profil **Cashflow** u dropdownu profila vide samo uloge Director i Accounting." Not applied.
- **`supervision-payments` and `supervision-invoices`** no longer list Supervision in `roles` (frontmatter only, no text change), so that role no longer sees them on `/help`. The assistant index is rebuilt.

### 8.7 Fourth round (2026-10-05): General report cash flow split

Shown: General → Izvještaji, section **ANALIZA NOVČANOG TOKA**, on screen and in the PDF (the PDF is always Croatian). Two tables replace the single one, each with a heading and a one-line note; the totals box has one line per heading plus the total.

| Key | Hrvatski | English |
|---|---|---|
| `reports.general.cash_flow_operating` | Poslovne aktivnosti | Operating activities |
| `reports.general.cash_flow_operating_note` | Naplata od kupaca te plaćanja dobavljačima, uredu i financijerima. | Receipts from customers, and payments to suppliers, the office and financiers. |
| `reports.general.cash_flow_financing` | Financijske aktivnosti | Financing activities |
| `reports.general.cash_flow_financing_note` | Isplate kredita (priljev) te otplate i troškovi kredita (odljev). | Credit drawdowns (inflow), and credit repayments and credit costs (outflow). |
| `reports.general.cash_flow_total` | Ukupni novčani tok | Total cash flow |

Article edit: `help-kb/general-reports.md` — "Analiza novčanog toka" in the list of sections now reads "Analiza novčanog toka (odvojeno **Poslovne aktivnosti** i **Financijske aktivnosti** — isplate, otplate i troškovi kredita — te **Ukupni novčani tok**)".

### 8.8 Fifth and sixth rounds (2026-10-05): financing line, and credit fees as a cost

The note that closed 8.7 about the Companies labels no longer applies: "Promet" and "Dobit/Gubitak" keep their wording and cover operations only.

**New string.** Shown: Cashflow → Firme, on a company's card under "Dobit/Gubitak" — only for a company that has credit drawdowns or repayments, and only once migration `20261005120000` is applied. Example: "Financiranje (primljeno / otplaćeno): €750.000 / €0".

| Key | Hrvatski | English |
|---|---|---|
| `companies.card.financing_label` | Financiranje (primljeno / otplaćeno): | Financing (received / repaid): |

The Croatian wording changed in the sixth round from "primljeno / vraćeno" to "primljeno / otplaćeno": with credit fees now a cost, the second figure is repayments of principal only, so the earlier concern about the label understating its content is gone. English is unchanged.

**Changed strings** (the notes under the two General report cash-flow headings from 8.7), because credit fees moved from financing to operating:

| Key | | Before | After |
|---|---|---|---|
| `reports.general.cash_flow_operating_note` | HR | Naplata od kupaca te plaćanja dobavljačima, uredu i financijerima. | Naplata od kupaca te plaćanja dobavljačima, uredu i financijerima, uključujući troškove kredita. |
| | EN | Receipts from customers, and payments to suppliers, the office and financiers. | Receipts from customers, and payments to suppliers, the office and financiers, including credit costs. |
| `reports.general.cash_flow_financing_note` | HR | Isplate kredita (priljev) te otplate i troškovi kredita (odljev). | Glavnica kredita: isplate (priljev) i otplate (odljev). |
| | EN | Credit drawdowns (inflow), and credit repayments and credit costs (outflow). | Credit principal: drawdowns (inflow) and repayments (outflow). |

**Article edits** (for screens that changed):

- `help-kb/cashflow-companies.md`, after the description of the card: "Promet i dobit/gubitak odnose se samo na poslovanje; isplate i otplate kredita nisu u njima, nego su — za firme koje ih imaju — prikazane u zasebnom retku **Financiranje (primljeno / otplaćeno)**. Troškovi kredita (kamate i naknade) jesu trošak i ulaze u dobit/gubitak."
- `help-kb/general-reports.md`: the section list now reads "Analiza novčanog toka (odvojeno **Poslovne aktivnosti** i **Financijske aktivnosti** — isplate i otplate kredita — te **Ukupni novčani tok**)".

