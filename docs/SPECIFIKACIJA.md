# Cognilion — Specifikacija sustava

> Detaljna funkcionalna i tehnička specifikacija platforme Cognilion, sastavljena na temelju
> izvornog koda, migracija baze i postojeće dokumentacije (stanje 30. 9. 2026.).
>
> Terminologija: hrvatski pravno-financijski pojmovi (cesija, kompenzacija, TIC, OIB,
> mjesto troška, konto, stan, garaža, repozitorij) koriste se u izvornom obliku. Nazivi tablica,
> stupaca, ruta i funkcija navode se točno kako postoje u kodu.

---

## Sadržaj

1. [Svrha i opseg sustava](#1-svrha-i-opseg-sustava)
2. [Tehnološka arhitektura](#2-tehnološka-arhitektura)
3. [Autentikacija i korisnici](#3-autentikacija-i-korisnici)
4. [Uloge, profili i navigacija](#4-uloge-profili-i-navigacija)
5. [Tablica ruta](#5-tablica-ruta)
6. [Sigurnosni model](#6-sigurnosni-model)
7. [Modul Projekti (General)](#7-modul-projekti-general)
8. [Modul Nadzor (Supervision)](#8-modul-nadzor-supervision)
9. [Modul Prodaja (Sales)](#9-modul-prodaja-sales)
10. [Modul Cashflow (računovodstvo)](#10-modul-cashflow-računovodstvo)
11. [Integracija s ERP sustavom 4D Wand](#11-integracija-s-erp-sustavom-4d-wand)
12. [Modul Financiranje (Funding)](#12-modul-financiranje-funding)
13. [Dashboardi](#13-dashboardi)
14. [Izvještaji](#14-izvještaji)
15. [Dokumenti i AI sortiranje e-mailova](#15-dokumenti-i-ai-sortiranje-e-mailova)
16. [AI asistent](#16-ai-asistent)
17. [Zadaci](#17-zadaci)
18. [Kalendar](#18-kalendar)
19. [Chat](#19-chat)
20. [Obavijesti i push](#20-obavijesti-i-push)
21. [Dnevnik aktivnosti](#21-dnevnik-aktivnosti)
22. [Lokalizacija](#22-lokalizacija)
23. [Korisničko sučelje i responzivnost](#23-korisničko-sučelje-i-responzivnost)
24. [Podatkovni sloj](#24-podatkovni-sloj)
25. [Edge funkcije](#25-edge-funkcije)
26. [Testiranje, okruženja i konfiguracija](#26-testiranje-okruženja-i-konfiguracija)
27. [Plan razvoja: glasovni asistent](#27-plan-razvoja-glasovni-asistent)
- [Dodatak A: Pojmovnik](#dodatak-a-pojmovnik)

---

## 1. Svrha i opseg sustava

### 1.1 Problem

Development tvrtke u Hrvatskoj upravljaju projektima vrijednim milijune eura kroz razdvojene
alate: Excel tablice, računovodstveni ERP, e-mail, dijeljene mape i WhatsApp. Posljedice:

- isti se podaci unose više puta,
- uprava nema trenutnu sliku poslovanja,
- financijski izvještaji stižu sa zakašnjenjem i slažu se ručno,
- odjeli rade s različitim verzijama istih brojki.

### 1.2 Rješenje

Cognilion je platforma za upravljanje cijelim životnim ciklusom nekretninskog developmenta:
projekti → gradnja → prodaja → financiranje → računovodstveni uvid → izvještavanje. Nije
zamjena za računovodstveni program, nego operativni sloj iznad njega:

- **računovodstvo knjiži u 4D Wandu**, a Cognilion iz njega preuzima račune, plaćanja i stanja
  računa te ih povezuje s projektima, ugovorima, fazama, stanovima i kreditnim linijama;
- **ostatak firme radi u Cognilionu** — svaka uloga ima vlastito radno okruženje;
- **uprava gleda žive pokazatelje** bez ručne konsolidacije.

### 1.3 Ciljni korisnici

Hrvatske development grupe u kojima svaki projekt često ima vlastitu firmu (SPV), uz matičnu
firmu i eventualno vlastitu građevinsku firmu. Korisnici su direktori, računovodstvo, prodaja,
nadzorni inženjeri i osobe zadužene za investicije i financiranje.

### 1.4 Moduli u opsegu ove specifikacije

| Modul | Mapa u kodu | Sažetak |
|---|---|---|
| Projekti (General) | `src/components/General/` | Registar projekata, faze, milestoneovi, kontrola proračuna (EVM), dnevnik aktivnosti |
| Nadzor (Supervision) | `src/components/Supervision/` | Gradilišta, faze, podizvođači, ugovori, milestoneovi plaćanja, dnevnik rada |
| Prodaja (Sales) | `src/components/Sales/` | Inventar jedinica, CRM kupaca, prodaje, uplate |
| Cashflow | `src/components/Cashflow/` | Računi, plaćanja, firme, banke, dobavljači, kupci, pozajmice, stanje duga, odobravanja, kalendar plaćanja, šifrarnici i ERP uvoz |
| Financiranje (Funding) | `src/components/Funding/` | Kreditne linije, alokacije, povlačenja, investitori, TIC |
| Dashboardi | `src/components/dashboards/` | Početne stranice po profilu |
| Izvještaji | `src/components/Reports/` | PDF i Excel izvještaji |
| Dokumenti | `src/components/Documents/` | Preglednik dokumenata, stablo kategorija, AI sortiranje e-mailova |
| AI asistent | `src/components/AiChat/` | Plutajući Claude asistent nad podacima |
| Zadaci | `src/components/Tasks/` | Zajednička lista zadataka (dijeli shemu s mobilnom aplikacijom) |
| Kalendar | `src/components/Calendar/` | Događaji, RSVP, ponavljanje, prikaz zadataka |
| Chat | `src/components/Chat/` | Razgovori 1-na-1 i grupni |
| Zajedničko | `src/components/Common/`, `src/components/ui/` | Layout, izmjenjivač profila, zajedničke UI komponente |

Izvan opsega: modul Retail (`src/components/Retail/`), `RetailDashboard`, `RetailReports`.

---

## 2. Tehnološka arhitektura

### 2.1 Tehnološki stog

| Sloj | Tehnologija |
|---|---|
| Frontend | React 18.3, TypeScript 5.5, Vite 5.4 |
| Usmjeravanje | React Router DOM 7 (`<BrowserRouter>`) |
| Stilovi | Tailwind CSS 3.4 (`darkMode: 'class'`) |
| Backend | Supabase: PostgreSQL s Row Level Security, Auth, Storage, Realtime, Edge Functions (Deno) |
| PDF | jsPDF 4 (isključivo u pregledniku) s ugrađenim fontom NotoSans |
| Excel | `@e965/xlsx` 0.20 (održavani fork SheetJS-a, ne paket `xlsx`) |
| Grafikoni | Recharts 3 (kontrola proračuna); dashboardi koriste vlastite trake i StatCard komponente |
| Lokalizacija | i18next 25 + react-i18next 16 + detektor jezika preglednika |
| Datumi | date-fns 4 (hrvatski locale), `rrule` 2.8 za ponavljajuće događaje |
| Ikone | lucide-react |
| Markdown | react-markdown 10 + remark-gfm 4 |
| Virtualizacija | `@tanstack/react-virtual` (samo lista zadataka) |
| AI | Anthropic Claude API (asistent i klasifikacija dokumenata) |
| Hosting frontenda | Vercel (SPA rewrite na `/index.html`, `/assets/*` s dugotrajnim cacheom) |

### 2.2 Slojevi aplikacije

```
UI komponenta → custom hook → servisni sloj → Supabase klijent → PostgreSQL
```

- **Komponente** prikazuju podatke i primaju korisničke akcije.
- **Hookovi** vode dohvat i stanje; ugovor hooka za učitavanje je da vraća `error` i `refetch`.
- **Servisi** su obične async funkcije koje **bacaju iznimku** pri grešci (nikad ne vraćaju
  prazan niz umjesto greške).
- **Baza** računa poslovno kritične izvedene vrijednosti (status računa, realizacija ugovora,
  iskorištenost kredita, stanja računa) **triggerima**, pa su one točne bez obzira na to koji
  modul ili proces upiše podatak.

Struktura modula: `index.tsx`, `types.ts`, `components/`, `forms/`, `modals/`, `hooks/`,
`services/`. Mape funkcionalnosti pišu se PascalCaseom, pomoćne podmape malim slovima.
Zajedničke UI primitive žive isključivo u `src/components/ui/`.

### 2.3 Struktura projekta

- `src/components/` — po jedna mapa za svaki modul (vidi 1.4).
- `src/contexts/` — `AuthContext`, `ThemeContext`, `ToastContext`, `UnsavedChangesContext`.
- `src/hooks/` — `useAsyncExport`, `useEscapeKey`, `useFocusTrap`, `useListPreferences`,
  `useMediaQuery`, `useModalOverflow`.
- `src/lib/` — `supabase.ts` (jedini Supabase klijent), `activityLog.ts`, `featureFlags.ts`,
  `useCachedData.ts` (memorijski TTL cache, zadano 5 minuta), `xlsxExport.ts`, `dbErrors.ts`,
  `errorMessage.ts`.
- `src/utils/` — formatiranje (euro, datumi), `dateOnly.ts` (lokalno parsiranje SQL `date`
  stupaca, sprječava pomak dana zbog UTC-a), `permissions.ts`, `evm.ts`, `vatCalculations.ts`
  (stope 25/13/5/0 %), `contractRollup.ts`, `contractVariance.ts`, `excelParsers.ts`,
  `pdfFont.ts`, `exportLanguage.ts`, `downloadFile.ts` i dr.
- `src/types/` — `database.ts` (generirani tipovi za sheme `public` i `erp`), `investment.ts`,
  `tasks.ts`, `chat.ts`, `aiChat.ts`.
- `src/locales/{hr,en}/translation.json` — prijevodi.
- `supabase/migrations/` — migracije baze; `supabase/functions/` — edge funkcije.
- `e2e/` — Playwright testovi; `scripts/` — pomoćne skripte (seed demo podataka, ERP smoke
  test, izgradnja baze znanja za pomoć); `help-kb/` — članci pomoći za AI asistenta.

### 2.4 Pokretanje aplikacije

`src/main.tsx` renderira `<App/>` unutar `StrictMode`. Redoslijed providera:

```
ThemeProvider → AuthProvider → ToastProvider → AiChatProvider → UnsavedChangesProvider → AppContent (Router)
```

Sve stranice učitavaju se lijeno (`React.lazy`) uz `Suspense` i indikator učitavanja unutar
glavnog sadržaja; `LoginForm` i `Layout` učitavaju se odmah.

### 2.5 Build

Vite dijeli build u zasebne chunkove: `i18n-locales` (~380 KB prijevoda), `vendor-react`,
`vendor-supabase`, `vendor-icons`, `vendor-pdf`, `vendor-xlsx`, `vendor-charts`,
`vendor-markdown`, `vendor-date-fns`, `vendor-rrule`, `vendor-i18n`, `vendor-virtual`. PDF i
Excel biblioteke učitavaju se tek kad korisnik pokrene izvoz.

### 2.6 npm skripte

| Skripta | Namjena |
|---|---|
| `dev`, `build`, `preview` | Vite razvojni poslužitelj, build, pregled builda |
| `lint`, `typecheck` | ESLint, provjera tipova |
| `test`, `test:watch`, `test:coverage` | Vitest jedinični testovi |
| `test:functions` | Deno testovi edge funkcija |
| `test:e2e`, `test:e2e:ui`, `test:e2e:debug`, `e2e:serve` | Playwright |
| `db:types` | Generira `src/types/database.ts` (sheme `public` i `erp`) i kopira ga u `supabase/functions/_shared/` |
| `erp:smoke` | Provjera cijelog ERP lanca uvoza |
| `kb:build` | Gradi indeks baze znanja pomoći (`help-kb-index.json`) za AI asistenta |

---

## 3. Autentikacija i korisnici

### 3.1 Supabase klijent

`src/lib/supabase.ts` koristi `VITE_SUPABASE_URL` i `VITE_SUPABASE_ANON_KEY`, s opcijama
`persistSession`, `autoRefreshToken`, `detectSessionInUrl` i vlastitim ključem pohrane
`supabase.auth.token` u `localStorage`. Kad kartica preglednika ponovno postane vidljiva, a
pristupnom tokenu je ostalo manje od 60 sekundi, sesija se osvježava.

### 3.2 Načini prijave

1. **E-mail i lozinka** — `signInWithPassword`, zatim dohvat korisničkog zapisa.
2. **Microsoft Entra ID** — `signInWithOAuth` s providerom `azure` (opsezi
   `openid email profile`, povratak na izvor aplikacije). Oznaka `sso_redirect_pending` u
   `sessionStorage` preživljava preusmjeravanje. Azure provider je u Supabaseu ograničen na
   tenant tvrtke.
3. **Zaboravljena lozinka** — `resetPasswordForEmail` šalje poveznicu za reset.

Nakon uspješne prijave profil se uvijek postavlja na **General**, a u dnevnik aktivnosti
upisuje se `auth.login` (uz `metadata.method: 'microsoft'` za SSO).

**Odjava** najprije upisuje `auth.logout`, zatim poziva globalni `signOut` (opoziva sve sesije
korisnika) i briše lokalno stanje (`currentProfile`, `cashflow_unlocked`, SSO oznaku).

Kodovi grešaka prijave (prikazuju se prevedeni kroz `auth.error_<kod>`):
`invalid_credentials`, `email_not_confirmed`, `too_many_requests`, `network_error`,
`no_user_record`, `sso_not_provisioned`, `unknown`.

### 3.3 Korisnički zapis

Tablica `public.users`:

| Stupac | Tip | Napomena |
|---|---|---|
| `id` | uuid | primarni ključ |
| `auth_user_id` | uuid | jedinstven, veza na `auth.users` |
| `username` | text | |
| `email` | text | |
| `role` | text NOT NULL | CHECK: `Director`, `Accounting`, `Sales`, `Supervision`, `Investment` |
| `created_at` | timestamptz | |

`AuthContext` učitava `id, auth_user_id, username, email, role`; korisnicima uloge Supervision
dodatno učitava dodijeljene projekte iz tablice `project_managers`.

Tablica `public.profiles` zrcali korisnike za mobilnu aplikaciju zadataka (`id` = auth id,
`email`, `name`, `role` = `admin` za direktore, inače `user`); sinkronizira je trigger
`sync_profile_from_user`.

### 3.4 Dodjela korisnika i uloge

Funkcija `handle_new_user()` (trigger `on_auth_user_created` nad `auth.users`):

- **prijava e-mailom** — kreira redak u `public.users`; uloga se čita iz
  `raw_app_meta_data.role`, zadano `Sales`;
- **Microsoft prijava** — samo povezuje: traži unaprijed kreiran redak po e-mailu (bez obzira
  na velika i mala slova) i upisuje mu `auth_user_id`. Ako retka nema, sesija se odbija
  (`sso_not_provisioned`); ako je redak već vezan uz drugog korisnika, povezivanje se odbija.

Uvođenje novog djelatnika znači unos retka u `public.users` (e-mail, korisničko ime, uloga).
Autentificirani identitet bez retka u `public.users` odmah se odjavljuje.

---

## 4. Uloge, profili i navigacija

### 4.1 Uloga i profil

- **Uloga** (stupac `users.role`) određuje što korisnik **smije** — na njoj se temelje RLS
  politike u bazi.
- **Profil** je način rada sučelja koji određuje što korisnik **gleda**: izbornik i početni
  dashboard. Korisnik ga mijenja usred sesije; sprema se u `localStorage.currentProfile` i
  vraća na General pri svakoj prijavi.

Pet uloga: **Director**, **Accounting**, **Sales**, **Supervision**, **Investment**.
Šest profila: **General**, **Supervision**, **Sales**, **Funding**, **Cashflow**, **Retail**.

### 4.2 Izmjenjivač profila

Na desktopu je padajući izbornik u zaglavlju, na mobitelu unutar bočnog izbornika. Prikazuje
svih šest profila svim ulogama osim Supervisiona (njima je sakriven). Promjena profila prolazi
kroz zaštitu od nespremljenih izmjena i vodi na `/`. Profil Cashflow označen je lokotom.

| Uloga | Dostupni profili | Stvarni pristup |
|---|---|---|
| Director | svih 6 | sve; Cashflow nakon lozinke |
| Accounting | svih 6 | Cashflow rute nakon lozinke |
| Sales, Investment | svi osim Cashflowa | spremljeni profil Cashflow vraća se na General; stavka Izvještaji (`/general-reports`) vidljiva je samo direktoru |
| Supervision | nijedan (izmjenjivač skriven) | fiksni izbornik s tri stavke; `/` preusmjerava na `/site-management` |

### 4.3 Lozinka za Cashflow

Ulazak u profil Cashflow traži lozinku iz `VITE_CASHFLOW_PASSWORD`. Točna lozinka postavlja
`sessionStorage.cashflow_unlocked = 'true'` (vrijedi za karticu, briše se pri odjavi). Ako
varijabla nije postavljena, dijalog se zatvara bez mogućnosti otključavanja. Ako je spremljeni
profil Cashflow, a kartica nije otključana, dijalog se otvara automatski. Profil Cashflow nude se
samo ulogama Director i Accounting (`canUseCashflow`), istima koje RLS pušta do financijskih podataka.

Lozinka je **zaštita od slučajnog otkrivanja podataka** (npr. pri dijeljenju ekrana), a ne
sigurnosna granica: stvarnu zaštitu financijskih podataka provode RLS politike u bazi
(poglavlje 6).

### 4.4 Izbornici po profilu

**Uloga Supervision** (vrijedi za bilo koji profil):
1. Upravljanje gradilištem → `/site-management`
2. Dnevnik rada → `/work-logs`
3. Dokumenti → `/documents`

**Profil General:**
1. Dashboard → `/`
2. Projekti → `/projects`
3. Kontrola proračuna → `/budget-control`
4. Dokumenti → `/documents`
5. Izvještaji → `/general-reports` (samo Director)
6. Dnevnik aktivnosti → `/activity-log` (samo Director)

**Profil Supervision:**
1. Dashboard → `/`
2. Upravljanje gradilištem → `/site-management`
3. Podizvođači → `/subcontractors`
4. Dnevnik rada → `/work-logs`
5. Plaćanja → `/payments`
6. Računi → `/invoices`
7. Dokumenti → `/documents`

**Profil Sales:**
1. Dashboard → `/`
2. Stanovi → `/apartments`
3. Prodajni projekti → `/sales-projects`
4. Kupci → `/customers`
5. Uplate → `/sales-payments`
6. Dokumenti → `/documents`
7. Izvještaji → `/sales-reports`

**Profil Funding:**
1. Dashboard → `/`
2. Investitori → `/banks`
3. Investicije → `/funding-credits`
4. Projekti → `/investment-projects`
5. Plaćanja → `/funding-payments`
6. TIC → `/tic`
7. Dokumenti → `/documents`

**Profil Cashflow:**
1. Dashboard → `/`
2. Računi → `/accounting-invoices`
3. Plaćanja → `/accounting-payments`
4. Kalendar dospijeća → `/accounting-calendar`
5. Dobavljači → `/accounting-suppliers`
6. Uredski dobavljači → `/office-suppliers`
7. Moje firme → `/accounting-companies`
8. Investicije (banke i krediti) → `/accounting-banks`
9. Kupci → `/accounting-customers`
10. Pozajmice i prijenosi → `/accounting-loans`
11. Stanje duga → `/debt-status`
12. Odobravanja → `/accounting-approvals`
13. Šifrarnici → `/sifrarnici`
14. ERP uvoz → `/erp-import`
15. Dokumenti → `/documents`

### 4.5 Ponašanje izbornika i zaglavlja

- Aktivna stavka prepoznaje se po točnom podudaranju ili prefiksu (npr. `/projects/:id`
  ostavlja označenim „Projekti").
- Klik prolazi kroz zaštitu od nespremljenih izmjena, zatvara mobilni izbornik i sažima
  desktop bočnu traku na traku ikona.
- Zaglavlje uvijek prikazuje ikone **Chat** (`/chat`), **Zadaci** (`/tasks`) i **Kalendar**
  (`/calendar`) s crvenim brojačem (do „99+"): nepročitane poruke, novi zadaci, RSVP pozivi na
  čekanju u sljedećih 30 dana.
- U zaglavlju su i prekidač jezika, prekidač tamne/svijetle teme i odjava.
- Plutajući AI asistent prikazuje se na svakoj stranici osim `/chat`.

### 4.6 Početni dashboard po profilu

Ruta `/` renderira `Common/Dashboard.tsx`, koji bira dashboard prema profilu:

| Profil | Dashboard |
|---|---|
| General | `DirectorDashboard` |
| Sales | `SalesDashboard` |
| Supervision | `SupervisionDashboard` |
| Funding | `InvestmentDashboard` |
| Cashflow | `AccountingDashboard` |

Korisnici uloge Supervision preusmjeravaju se na `/site-management`. Dashboardi čitaju
podatke kroz `useCachedData` (TTL 5 minuta) i pri neuspjelom učitavanju prikazuju
`DashboardError` — nikad nule umjesto greške.

---

## 5. Tablica ruta

Zaštite ruta:

- **`ProtectedRoute`** — dok se autentikacija učitava prikazuje indikator; neprijavljenom
  korisniku na istom mjestu prikazuje obrazac za prijavu (ne postoji ruta `/login`); inače
  stranicu omata u `Layout`.
- **`CashflowRoute`** — zahtijeva `sessionStorage.cashflow_unlocked === 'true'` **i** ulogu
  Director ili Accounting, inače preusmjerava na `/`.
- **`DirectorRoute`** — samo Director.
- Dnevnik aktivnosti dodatno provjerava ulogu unutar same komponente.

Ostale rute nemaju provjeru uloge na razini rute; što korisnik na njima vidi određuje RLS.

| Ruta | Stranica | Zaštita |
|---|---|---|
| `/` | Dashboard po profilu (Supervision → `/site-management`) | Protected |
| `/projects` | Projekti | Protected |
| `/projects/:id` | Detalji projekta | Protected |
| `/budget-control` | Kontrola proračuna (EVM) | Protected |
| `/subcontractors` | Podizvođači | Protected |
| `/site-management/:projectId?` | Upravljanje gradilištem | Protected |
| `/work-logs` | Dnevnik rada | Protected |
| `/payments` | Plaćanja (nadzor) | Protected |
| `/invoices` | Računi (nadzor) | Protected |
| `/sales-projects` | Prodajni projekti | Protected |
| `/customers` | Kupci | Protected |
| `/apartments` | Stanovi | Protected |
| `/sales-payments` | Uplate kupaca | Protected |
| `/sales-reports` | Prodajni izvještaji | Protected |
| `/banks` | Investitori (banke) | Protected |
| `/investment-projects` | Investicijski projekti | Protected |
| `/funding-credits` | Investicije (krediti) | Protected |
| `/funding-payments` | Plaćanja financiranja | Protected |
| `/tic` | TIC | Protected |
| `/general-reports` | Opći izvještaji | Protected + Director |
| `/accounting-invoices` | Računi | Protected + Cashflow |
| `/accounting-payments` | Plaćanja | Protected + Cashflow |
| `/accounting-suppliers` | Dobavljači | Protected + Cashflow |
| `/office-suppliers` | Uredski dobavljači | Protected + Cashflow |
| `/accounting-companies` | Moje firme | Protected + Cashflow |
| `/accounting-banks` | Banke i krediti | Protected + Cashflow |
| `/accounting-customers` | Kupci | Protected + Cashflow |
| `/accounting-calendar` | Kalendar dospijeća | Protected + Cashflow |
| `/accounting-loans` | Pozajmice i prijenosi | Protected + Cashflow |
| `/debt-status` | Stanje duga | Protected + Cashflow |
| `/accounting-approvals` | Odobravanja | Protected + Cashflow |
| `/sifrarnici` | Šifrarnici (ERP mapiranja) | Protected + Cashflow |
| `/erp-import` | ERP uvoz | Protected + Cashflow |
| `/activity-log` | Dnevnik aktivnosti | Protected + provjera Director u komponenti |
| `/chat` | Chat | Protected |
| `/tasks` | Zadaci | Protected |
| `/calendar` | Kalendar | Protected |
| `/documents` | Dokumenti | Protected |
| `*` | preusmjerenje na `/` | — |

---

## 6. Sigurnosni model

### 6.1 Row Level Security

- RLS je uključen na svim tablicama aplikacije (bazna shema ima 67 tablica s RLS-om i oko 265
  politika; ukupno oko 346 `CREATE POLICY` naredbi kroz migracije).
- Sustav nema dimenziju tenanta (nema `organization_id`) — jedna baza pripada jednoj grupi
  tvrtki. Politike su ili otvorene prijavljenim korisnicima (`USING (true)`) ili provjeravaju
  ulogu.
- Standardni uvjet za ulogu, ugrađen u politike:

```sql
EXISTS (SELECT 1 FROM public.users
        WHERE users.auth_user_id = auth.uid()
          AND users.role IN ('Director','Accounting'))
```

### 6.2 Zaštita financijskih podataka

- `accounting_payments`, `accounting_companies`, `bank_credits`, `company_loans` i
  `company_bank_accounts` dostupni su samo ulogama **Director** i **Accounting**.
- Iznimke s ograničenim opsegom:
  - Sales vidi plaćanja i račune vezane uz prodaju (`apartment_id IS NOT NULL` ili
    `invoice_type = 'OUTGOING_SALES'`);
  - Supervision vidi račune za projekte kojima upravlja;
  - nazivi i OIB-i firmi u `accounting_companies` čitljivi su svima kao referentni podaci.
- `accounting_invoices` je ograničen na Director/Accounting (uz gornje iznimke).
- **SECURITY DEFINER funkcije** ili same provjeravaju ulogu ili im je oduzeto pravo
  izvršavanja: `get_invoice_statistics`, `get_filtered_invoices` i `get_activity_logs`
  bacaju grešku za neovlaštene uloge; `get_apartment_payments`,
  `check_subcontractor_budget_integrity`, `fix_subcontractor_budget_integrity`,
  `recalculate_bank_credit_fields` i `recalculate_contract_budget_realized` nisu izvršive
  klijentskim ulogama.

### 6.3 SQL pomoćne funkcije

| Funkcija | Značenje |
|---|---|
| `user_has_project_access(p_project_id)` | Director ima pristup svim projektima; Supervision samo dodijeljenima |
| `user_has_project_access(user_uuid, proj_id)` | Director, Investment, Sales i Accounting imaju pristup svima; Supervision prema `project_managers` |
| `is_admin()` | semantika mobilne aplikacije: `profiles.role = 'admin'` (direktori) |
| `can_view_task`, `is_task_assignee`, `get_task_creator` | pristup zadacima |
| `is_chat_participant`, `is_event_participant`, `get_event_creator` | pristup chatu i kalendaru |

### 6.4 Klijentske provjere ovlasti

`src/utils/permissions.ts` (za prikaz i sakrivanje akcija u sučelju; stvarnu zaštitu provodi
baza):

| Funkcija | Uloge |
|---|---|
| `canManagePayments` | Director, Accounting, Investment |
| `canViewAllProjects` | Director, Accounting, Investment, Sales |
| `canManageSubcontractors` | Director, Supervision |
| `canManageWorkLogs` | Director, Supervision |
| `canManageProjectPhases` | Director |
| `canViewActivityLog` | Director |
| `canUseCashflow` | Director, Accounting (profil Cashflow i `CashflowRoute`) |
| `getAccessibleProjectIds` | prazan popis (= svi) za uloge s punim pristupom; dodijeljeni projekti za Supervision |

### 6.5 Pohrana datoteka (Supabase Storage)

| Bucket | Javni | Ograničenje | Pravila |
|---|---|---|---|
| `documents` | ne | 50 MB, bilo koji MIME | prijavljeni korisnici; čitanje preko potpisanih URL-ova |
| `contract-documents` | ne | 25 MB, samo PDF | prijavljeni korisnici (stari PDF-ovi ugovora s podizvođačima) |
| `chat-attachments` | da | 25 MB | prijavljeni korisnici učitavaju i čitaju |
| `task-attachments` | ne | 25 MB i 10 datoteka po zadatku (klijent) | čitanje prema `can_view_task`; brisanje učitavatelj ili autor zadatka |
| `ai-chat-attachments` | ne | prema vrsti (vidi 16.7) | samo vlasnik (prva mapa putanje = `auth.uid()`) |

Potpisani URL-ovi vrijede 3600 sekundi.

### 6.6 Autentikacija edge funkcija

- `_shared/auth.ts` → `authenticate(req)`: traži `Authorization: Bearer`, gradi
  `userClient` (anon ključ + korisnikov JWT, dakle RLS vrijedi) i provjerava korisnika, zatim
  preko `serviceClient` čita ulogu iz `public.users` i dodijeljene projekte za Supervision.
  Statusi: 401 `unauthorized`, 403 `no_profile`, 500 `internal_error`.
- `_shared/cors.ts` — CORS zaglavlja i odgovor na preflight.
- `_shared/rateLimit.ts` — ograničenje učestalosti za AI asistenta (vidi 16.9).
- Funkcije pozvane izvana (webhookovi) koriste dijeljene tajne uspoređivane u konstantnom
  vremenu: `x-doc-sort-secret` (sortiranje dokumenata), `x-erp-import-secret` (ERP uvoz),
  `x-reminder-secret` (zakazani podsjetnici).

Otvorene sigurnosne stavke vode se u [`backlog/security.md`](./backlog/security.md).

---

## 7. Modul Projekti (General)

### 7.1 Namjena

Kralježnica sustava: središnji registar svih development projekata. Ugovori, računi, prodaje,
krediti, faze i dokumenti vežu se na projekt, pa je pregled projekta uvijek trenutna slika
bez ručne konsolidacije. Modul sadrži i milestoneove projekta, kontrolu proračuna (EVM) i
dnevnik aktivnosti (poglavlje 21).

### 7.2 Rute (profil General)

| Ruta | Stranica | Ovlast |
|---|---|---|
| `/projects` | Projekti | svi (podaci prema RLS-u) |
| `/projects/:id` | Detalji projekta | svi (podaci prema RLS-u) |
| `/budget-control` | Kontrola proračuna (EVM) | svi (podaci prema RLS-u) |
| `/general-reports` | Opći izvještaj | Director |
| `/activity-log` | Dnevnik aktivnosti | Director |

### 7.3 Podatkovni model

**`projects`:**

| Polje | Opis |
|---|---|
| `name` | naziv (obavezno) |
| `location` | lokacija (obavezno) |
| `aliases` | alternativni nazivi (koristi ih AI sortiranje dokumenata) |
| `start_date` | datum početka (obavezno) |
| `end_date` | datum završetka |
| `budget` | budžet — **piše ga isključivo TIC** |
| `investor` | investitor |
| `status` | `Planning` (Planiranje), `In Progress` (U tijeku), `Completed` (Završeno), `On Hold` (Na čekanju) |
| `category` | `interno`, `retail`, `stambeno` (zadano) |

RLS: Director, Investment, Sales i Accounting vide sve projekte; Supervision samo dodijeljene
(`project_managers`). Kreiranje, izmjena i brisanje: samo Director.

**`project_milestones`** — `project_id`, `name`, `due_date`, `completed`, `phase` (tekstualna
oznaka faze iz predloška). Milestoneovi projekta (npr. građevinska dozvola) razlikuju se od
milestoneova plaćanja ugovora (8.11) i od građevinskih faza (`project_phases`).

**Pravilo budžeta:** projekt bez TIC-a (ili s ukupnim iznosom TIC-a 0) prikazuje
**„Budžet nije postavljen"**, a ne 0 €.

### 7.4 Popis projekata (`/projects`)

- **Novi projekt** (samo Director).
- **Pretraga** po nazivu ili lokaciji; filtri **status** i **vrsta projekta** (Interno,
  Retail, Stambeno).
- **Kartica projekta:**
  - naziv, lokacija, status (Planiranje sivo, U tijeku plavo, Završeno zeleno, Na čekanju
    žuto), vrsta;
  - **budžet** (iz TIC-a) ili „Budžet nije postavljen";
  - **utrošeno** = Σ plaćenog po svim ugovorima projekta (`budget_realized`);
  - **preostalo** = budžet − utrošeno (crveno ako je negativno);
  - traka **napretka** = završeni milestoneovi / svi milestoneovi × 100;
  - **vremenska linija:**

| Stanje | Pravilo | Tekst |
|---|---|---|
| završeno | status Completed | „Završeno" (zeleno) |
| bez roka | nema datuma završetka | „Tekuće" (sivo) |
| kasni | rok prošao | „N dana kašnjenja" (crveno) |
| danas | rok je danas | narančasto |
| uskoro | rok za manje od 30 dana | „još N dana" (narančasto) |
| u roku | 30 i više dana | „još N dana" (zeleno) |

  - brojač „X/Y prekretnica"; klik vodi na detalje.

### 7.5 Kreiranje, uređivanje i brisanje projekta

Samo Director (sučelje i RLS). **Polja:** naziv*, lokacija*, aliasi (odvojeni zarezom),
datum početka* (zadano danas), datum završetka, status (zadano Planiranje), vrsta (zadano
Stambeno). **Budžet se ne unosi** — prikazuje se uz napomenu „Budžet se preuzima iz TIC-a
projekta." Brisanje uz potvrdu. Odbijanje zbog ovlasti prikazuje „Samo Direktor može
kreirati, uređivati ili brisati projekte."

### 7.6 Detalji projekta (`/projects/:id`)

**Zaglavlje:** povratak, „Uredi projekt" (Director), naziv, lokacija, vrsta, status i četiri
pločice:
1. **Budžet** (ili „Budžet nije postavljen") i „Utrošeno";
2. **Vremenski okvir** s datumom početka;
3. **Napredak** — postotak završenih milestoneova;
4. **Tim** — broj ugovora.

**Kartice:**

1. **Pregled** — lokacija, investitor, vrsta, datumi; financijski sažetak:
   - *ukupna investicija* = Σ alociranog iz namjena kredita za projekt;
   - *ukupni rashodi* = Σ plaćenog po ugovorima;
   - *prihodi od prodaje* = Σ cijena prodanih stanova;
   - tri najbliža milestonea.
2. **Faze i ugovori** — ugovori grupirani po fazi, a unutar faze po klasifikaciji troška
   (podizvođač, opis posla, iznos ugovora, plaćeno). Kartica faze prikazuje broj ugovora,
   ugovoreni iznos i traku `plaćeno / budžet faze`. Ugovori bez faze u sekciji „Ostalo".
3. **Stanovi** — brojači prodano / rezervirano / dostupno i tablica (broj, kat, m², cijena,
   status, kupac).
4. **Podugovaratelji** — filtri (naziv, faza, status), pločice nad filtriranim retcima
   (ukupna vrijednost ugovora, ukupno realizirano, ukupno preostalo, broj ugovora) i tablica
   sa sortiranjem: podizvođač (+ „BEZ UGOVORA"), faza, klasifikacija, iznos ugovora,
   realizirano, preostalo, status, kontakt.
5. **Financiranje** — kartica po namjeni kredita: banka, kredit i vrsta, datum početka, opis,
   alocirano, iskorišteno.
6. **Prekretnice** — vidi 7.7.

### 7.7 Milestoneovi projekta

**Akcije:** dodavanje (naziv, rok), uređivanje, označavanje završenim/nezavršenim, brisanje
(uz potvrdu), **primjena predloška**, proširi/sažmi sve.

**Stanje milestonea:**

| Stanje | Pravilo |
|---|---|
| Završeno (zeleno) | `completed = true` |
| Kasni (crveno) | nije završen i rok je prošao |
| U tijeku (plavo) | ostalo |

**Pregled:** broj završenih, u tijeku i zakašnjelih te napredak u %. Milestoneovi su
grupirani po fazi predloška (faze predloška redom, zatim ostale abecedno, zatim „Ostalo");
unutar grupe po roku. Zaglavlje grupe: traka napretka, „X/Y završeno", oznaka „N kasni".
Grupe s zakašnjelim stavkama otvorene su, potpuno završene sažete.

**Predložak „Hrvatski stambeni razvoj"** (29 stavki, u zagradi pomak u danima od početka):

| Faza | Stavke |
|---|---|
| Kupnja zemljišta | Predugovor o kupoprodaji (0), Uplata kapare (7), Pravna provjera / due diligence (14), Glavni ugovor o kupoprodaji (30), Isplata pune kupoprodajne cijene (45), Upis u zemljišne knjige (75) |
| Ishođenje dozvola | Idejni projekt (90), Posebni uvjeti gradnje (120), Glavni projekt (180), Tehnička kontrola (210), Građevinska dozvola (240), Komunalni doprinos (250), Izvedbeni projekt (280), Tenderiranje izvođača (300), Ugovori s izvođačima (330) |
| Gradnja | Prijava početka građenja (340), Pripremni radovi (350), Temelji (380), Gruba gradnja (470), Krov (540), Fasada (600), Instalacije (630), Završni radovi (690), Uređenje okoliša (720), Tehnički pregled (750) |
| Uporabna dozvola i etažiranje | Geodetski elaborat (760), Uporabna dozvola (800), Etažiranje (830), Uknjižba etažnog vlasništva (870) |

**Primjena predloška:** opseg — sve stavke, jedna faza ili ručni odabir; datumi — bez datuma
ili **automatski** (`rok = datum početka + pomak`, datum početka zadano iz projekta). Pregled
prikazuje broj stavki po fazi i raspon datuma.

### 7.8 Kontrola proračuna — EVM (`/budget-control`)

Pregled izvedbe projekta po metodi **Earned Value Management**, metodologiji koju razumiju
banke i investitori. Samo za čitanje.

**Ulazni podaci:** projekt, TIC, faze, ugovori (nacrt, aktivni, završeni) i milestoneovi
plaćanja ugovora.

**Osnovne veličine:**
- *planirani proračun* = Σ budžeta faza (iz TIC-a);
- *ugovoreno* = Σ iznosa ugovora;
- *plaćeno* = Σ `budget_realized`;
- *dovršenost* = min(100, plaćeno / ugovoreno × 100).

**Postotak dovršenosti ugovora:** ako ugovor ima milestoneove plaćanja, zbroj postotaka
milestoneova u statusu *djelomično* ili *plaćeno* (najviše 100 %); inače
`budget_realized / iznos ugovora × 100`.

**Po fazi:**
- dovršenost faze = Σ(iznos ugovora × dovršenost ugovora) / Σ iznosa ugovora;
- **EV** (ostvarena vrijednost) = budžet faze × dovršenost faze;
- **AC** (stvarni trošak) = Σ plaćenog po ugovorima faze;
- **PV** (planirana vrijednost), samo za faze s datumima početka i završetka: budžet faze ×
  udio proteklog vremena faze (0–100 %).

**Na razini projekta:**

| Pokazatelj | Formula | Kad nema podataka |
|---|---|---|
| **BAC** | Σ budžeta faza | — |
| **CPI** | EV / AC | 1 ako je AC = 0 |
| **SPI** | EV / PV | 1 ako je PV = 0 |
| **CV** | EV − AC | — |
| **SV** | EV − PV | — |
| **EAC** | BAC / CPI | BAC ako je CPI = 0 |
| **VAC** | BAC − EAC | — |

**Ekran:**
- odabir projekta („Naziv — Stambeno");
- pet kartica: **TIC** (ukupni investicijski trošak), **planirani proračun**, **ugovoreno**
  (% proračuna), **plaćeno** (% ugovorenog), **prognoza EAC** („Ispod proračuna" ili „Iznad
  proračuna");
- stupčasti graf: planirano, ugovoreno, plaćeno, prognoza;
- graf indeksa CPI i SPI s referentnim linijama 1,0 („Cilj") i 0,9 („Upozorenje");
- kartice CPI i SPI:

| Vrijednost | CPI | SPI |
|---|---|---|
| ≥ 1,0 | „Ispod proračuna ✓" (zeleno) | „U skladu s planom ✓" |
| ≥ 0,9 | „Malo iznad proračuna" (žuto) | „Malo u zaostatku" |
| < 0,9 | „Iznad proračuna ✗" (crveno) | „U zaostatku ✗" |

- EAC, VAC i dovršenost s trakom;
- ako nijedna faza nema datume, SPI se prikazuje kao „—" uz objašnjenje.

### 7.9 Dnevnik aktivnosti

`project.create`, `project.update`, `project.delete`, `milestone.create`,
`milestone.update`, `milestone.delete`, `milestone.bulk_create`, `export.general_pdf`.

---

## 8. Modul Nadzor (Supervision)

### 8.1 Namjena

Upravljanje gradilištem: građevinske faze s budžetima iz TIC-a, podizvođači i ugovori
raspoređeni po fazama, klasifikacijama troška i kategorijama ugovora, milestoneovi plaćanja,
građevinski dnevnik rada i dokumentacija. Nadzorni inženjer i računovodstvo gledaju **isti
ugovor**: kad se račun podizvođača proknjiži i plati, plaćeni iznos ugovora ažurira se sam.
Sve brojke napretka u modulu temelje se na **plaćanjima**.

### 8.2 Rute i izbornici

| Ruta | Komponenta |
|---|---|
| `/site-management/:projectId?` | `Supervision/SiteManagement` — upravljanje gradilištem |
| `/subcontractors` | `Supervision/Subcontractors` — registar podizvođača |
| `/work-logs` | `Supervision/WorkLogs` — dnevnik rada |
| `/payments` | `Supervision/Payments` — plaćanja podizvođačima |
| `/invoices` | `Supervision/Invoices` — računi podizvođača |
| `/` (profil Supervision) | `dashboards/SupervisionDashboard` |

- **Uloga Supervision:** fiksni izbornik (upravljanje gradilištem, dnevnik rada, dokumenti),
  vidi samo projekte koji su joj dodijeljeni (`project_managers`), a `/` je vodi na
  upravljanje gradilištem.
- **Profil Supervision** (za ostale uloge): Dashboard, Upravljanje gradilištem, Podizvođači,
  Dnevnik rada, Plaćanja, Računi, Dokumenti.
- Poveznica `/site-management/<id>` otvara izravno projekt; nepoznat ili nedostupan projekt
  vraća na popis.

### 8.3 Ovlasti

**Prikaz plaćanja** — `canManagePayments` (Director, Accounting, Investment). Korisnicima bez
tog prava skrivaju se svi iznosi plaćanja: pločice „Plaćeno" i „Neplaćeno", stupac plaćenog,
traka iskorištenosti faze, statusi i boje plaćenosti ugovora, gumbi „Plaćanja" i „Računi",
plaćeni stupci milestoneova. Iznosi ugovora, rokovi i budžeti ostaju vidljivi.

**RLS:**

| Tablica | Čitanje | Upis/izmjena | Brisanje |
|---|---|---|---|
| `projects` | Director, Investment, Sales, Accounting sve; Supervision dodijeljene | Director | Director |
| `project_phases` | kao projekti | Director, Supervision | Director |
| `contracts` | svi | Director, Supervision, Accounting | Director |
| `subcontractors` | svi | Director, Supervision, Accounting | Director |
| `work_logs` | svi | Director, Supervision | Director, Supervision |
| `contract_types`, `cost_classifications` | svi | Director i nadzorne uloge | Director |
| `phase_classification_budgets` | kao faze | održava ih TIC | — |
| `accounting_invoices` | Director/Accounting sve; Supervision računi za projekte kojima upravlja | Director, Accounting | Director |
| `accounting_payments` | Director/Accounting | Director, Accounting | Director, Accounting |

### 8.4 Podatkovni model

**`projects`** — `name`, `location`, `start_date`, `end_date`, `budget` (iz TIC-a), `investor`,
`status` (`Planning`, `In Progress`, `Completed`, `On Hold`), `category`.

**`project_phases`** — `project_id` (CASCADE), `phase_number` (jedinstven u projektu),
`phase_name`, `budget_allocated` (iz TIC-a), `budget_used` (Σ preuzetih iznosa ugovora faze, v. 8.7 „Status ugovora”),
`start_date`, `end_date`, `status` (`planning`, `active`, `completed`, `on_hold`).

**`cost_classifications`** — `code`, `name` (jedinstven), `description`, `sort_order`,
`is_system`, `is_active`. Sistemske klasifikacije: Zemljište (`zemljiste`), Priprema i razvoj
(`priprema_i_razvoj`), Izgradnja i uređenje (`izgradnja_i_uredenje`), Opremanje
(`opremanje`), Kontrola (`kontrola`), Financiranje i nadzor (`financiranje_i_nadzor`),
Nepredviđeni troškovi (`nepredvideni_troskovi`). Trigger štiti sistemske klasifikacije od
brisanja i promjene naziva ili koda; mogu se deaktivirati i preslagivati.

**`phase_classification_budgets`** — budžet po (faza, klasifikacija), izgrađuje ga TIC.
Zbroj ne mora dosezati budžet faze; ostatak je „Neraspoređeno".

**`contracts`** — jedan redak po angažmanu podizvođača:

| Polje | Opis |
|---|---|
| `contract_number` | jedinstven, format `CNT-{GGGG}-{redni broj}-{sufiks}` |
| `project_id`, `phase_id` | projekt (CASCADE), faza (SET NULL) |
| `subcontractor_id` | podizvođač (CASCADE) |
| `job_description` | opis posla |
| `base_amount`, `vat_rate` (0, 5, 13, 25), `vat_amount`, `total_amount` | osnovica, PDV i ukupno |
| `contract_amount` | = `total_amount` (bruto) |
| `budget_realized` | plaćeno po ugovoru — održava baza |
| `start_date`, `end_date` | datum ugovora i rok |
| `status` | `draft`, `active`, `completed`, `terminated` (novi ugovori `active`) |
| `has_contract` | `false` = dobavljač bez formalnog ugovora (iznosi 0, prati se kroz račune) |
| `contract_type_id` | kategorija ugovora |
| `classification_id` | klasifikacija troška |

**`subcontractors`** — `name`, `contact`, `notes`, `financed_by_type` (`investor`/`bank`),
`financed_by_bank_id` / `financed_by_investor_id`.

**`contract_types`** — kategorije ugovora (npr. Javni bilježnici, Zemljište, Razno, Rušenje).

**`subcontractor_milestones`** — milestoneovi plaćanja ugovora: `contract_id` (CASCADE),
`milestone_number`, `milestone_name`, `description`, `percentage` (0–100), `due_date`,
`status` (`pending`, `completed` = djelomično plaćeno, `paid`), `completed_date`,
`paid_date`.

**`subcontractor_comments`** — `subcontractor_id`, `user_id`, `comment`, `comment_type`
(`general` bilješka, `completed` rad završen, `issue` problem).

**`work_logs`** — `subcontractor_id`, `contract_id`, `project_id`, `phase_id`, `date`,
`work_description`, `notes`, `status`, `blocker_details`, `created_by`.

**Veza s računovodstvom:** račun podizvođača (`accounting_invoices`) nosi `supplier_id`
(podizvođač), `contract_id`, `milestone_id` i `project_id`; kategorija `SUBCONTRACTOR`.

### 8.5 Izračuni u bazi

- **PDV ugovora** (`calculate_contract_vat_trigger`):
  `vat_amount = round(base_amount × vat_rate / 100, 2)`,
  `total_amount = base_amount + vat_amount`, `contract_amount = total_amount`.
- **Status računa** iz plaćanja (`update_invoice_payment_status`):
  `paid_amount = Σ plaćanja`, `remaining_amount = ukupno − plaćeno`; status `UNPAID` (0),
  `PAID` (plaćeno ≥ ukupno), inače `PARTIALLY_PAID`.
- **Plaćeno po ugovoru** (`recalculate_contract_budget_realized`):
  `contracts.budget_realized = Σ plaćanja svih računa s tim contract_id` (bruto). Pokreće se
  pri svakoj promjeni plaćanja te pri povezivanju, odvezivanju ili brisanju računa.
- **Fakturirano po ugovoru:** `contracts.total_invoices_amount = Σ ukupnih iznosa računa`.
- **Status milestonea** (`update_milestone_status_on_payment_trigger`): plaćeno na računu
  milestonea ≥ iznos računa → `paid` (s datumom); > 0 → `completed` (djelomično); inače
  `pending`. Brisanje računa ili promjena milestonea vraća stari milestone u `pending`.
- **Budžeti iz TIC-a:** vidi 12.9.

### 8.6 Upravljanje gradilištem — popis projekata

Kartica projekta: naziv, lokacija, status, kategorija, broj faza; crvena oznaka broja
zakašnjelih ugovora (rok prošao, a plaćeno < ugovoreno); traka **alokacije budžeta**
`ugovoreno / budžet projekta` (s prikazom plaćenog za korisnike s pravom); budžet (ili „budžet
nije postavljen" bez TIC-a), alocirano po fazama, isplaćeno; broj podizvođača i trošak;
vremenska linija (završeno / kasni / danas / „još N dana", narančasto unutar 30 dana).

### 8.7 Upravljanje gradilištem — detalji projekta

**Zaglavlje:** naziv, lokacija, budžet s oznakom „✓ iz TIC-a" ili „⚠ budžet nije postavljen",
alocirano po fazama, kategorija i status; prekidač grupiranja **Po fazi / Po klasifikaciji**
(pamti se); „Sakrij završene i raskinute" (samo ako projekt ima takav ugovor);
„Upravljanje klasifikacijama troška"; „Postavi faze" / „Uredi faze".

**Alocirana sredstva:** kartice namjena kredita za projekt (kredit, firma, alocirano,
iskorišteno, dostupno, kamata, traka iskorištenosti — narančasto od 80 %, crveno od 100 %).

**Sažetak projekta:** broj podizvođača (i koliko je potpuno plaćeno) te pločice:
1. **Ugovoreno**
2. **Plaćeno** *
3. **Neplaćeno** *
4. **Preostali budžet** = budžet − ugovoreno − neplaćeno bez ugovora
5. **Nije raspoređeno po fazama** (stavke TIC-a bez faze)

(* samo uz pravo prikaza plaćanja)

**Stablo ugovora** s tri razine grupiranja:
- *po fazi:* faza → klasifikacija troška → kategorija ugovora;
- *po klasifikaciji:* klasifikacija → faza → kategorija ugovora.

Uvijek se prikazuju sve faze i svi budžeti (faza, klasifikacija), i kad nemaju ugovora.

**Status ugovora:** Nacrt, Aktivan, Završen, Raskinut (mijenja se u uređivanju ugovora). Završeni i
raskinuti ugovori ostaju u stablu s oznakom statusa (sivo / crveno), ne prikazuju se kao
zakašnjeli i nastavljaju se brojati u svim zbrojevima. **Preuzeti iznos** ugovora
(`committedAmount`, u bazi `contract_committed_amount`): za nacrt, aktivan i završen ugovor iznos
ugovora; za **raskinut** samo plaćeni iznos — neplaćeni ostatak se oslobađa. Gumb „Sakrij završene i
raskinute" skriva samo njihove kartice (skupina navodi koliko ih je skriveno); zbrojevi ostaju isti.

**Formule sažimanja** (`rollupContracts`):
- ugovor s ugovorom (`has_contract` i iznos > 0): `ugovoreno += preuzeti iznos`,
  `neplaćeno += max(0, iznos − plaćeno)`;
- redak bez ugovora: `neplaćeno += dugovanje po računima` (i `neplaćeno bez ugovora`);
- `plaćeno` = Σ plaćenog svih redaka;
- `preostali budžet = budžet − ugovoreno − neplaćeno bez ugovora`;
- `neraspoređeno (faza) = budžet faze − Σ budžeta klasifikacija faze`;
- potpuno plaćeno: plaćeno ≥ iznos (s ugovorom) ili nema dugovanja i plaćeno > 0 (bez
  ugovora).

**Kartica faze:** „Faza n · naziv", broj podizvođača, planirani budžet; gumbi za budžete po
klasifikaciji, uređivanje i brisanje faze, **+ Dodaj podizvođača**; pločice Ugovoreno,
Plaćeno*, Neplaćeno*, Preostali budžet, Neraspoređeno; **traka iskorištenosti**
`plaćeno / budžet faze` (≤ 80 % tirkizno, > 80 % narančasto, > 100 % crveno uz „prekoračeno
za").

**Kartica klasifikacije:** naziv, broj faza i podizvođača, budžet klasifikacije (zbroj po
fazama), Ugovoreno, Plaćeno*, Neplaćeno*, Preostalo.

**Redak skupine:** budžet, preostalo, trošak (ugovoreno), plaćeno*.

**Kartica ugovora:**
- naziv podizvođača, oznaka **„BEZ UGOVORA"**, kontakt, opis posla;
- status ugovora (Završen / Raskinut) kad nije aktivan;
- status plaćenosti*: Prekoračenje / Plaćeno / Djelomično / Neplaćeno (i boja ruba);
- rok (crveno ako kasni; nikad za završen ili raskinut ugovor), iznos ugovora (bruto);
- plaćeno*, preostalo za platiti*, **odstupanje**: prekoračenje (plaćeno > ugovoreno) ili
  ušteda (potpuno plaćeno, a plaćeno < ugovoreno);
- za dobavljače bez ugovora: plaćeno ukupno i ukupno dugovanje;
- akcije: **Plaćanja***, **Računi***, **Uredi**, **Detalji**, **Milestoneovi**, **Obriši**.

### 8.8 Faze

- **Postavljanje faza:** 1–10 faza, svaka s nazivom (zadano „Faza n") i datumima. Budžet se ne
  unosi — dolazi iz TIC-a.
- **Uređivanje svih faza:** izmjena, dodavanje i uklanjanje uz potvrdu; faza s ugovorima ili
  dnevnicima rada ne može se ukloniti (poruka s brojem ugovora i dnevnika).
- **Uređivanje faze:** naziv, budžet (samo prikaz), datumi, status (Planiranje, Aktivno,
  Završeno, Na čekanju).
- **Brisanje faze:** blokirano ako ima ugovore ili dnevnike rada; nakon brisanja preostale se
  faze prenumeriraju (`renumber_project_phases`).

### 8.9 Dodavanje ugovora („+ Dodaj podizvođača")

Podnaslov: „faza • Raspoloživi budžet X €" (`budžet faze − budget_used`).

**Polja:**
- „Nema ugovora" (dobavljač bez formalnog ugovora; iznosi 0);
- klasifikacija troška (obavezno, uz mogućnost dodavanja nove);
- kategorija ugovora (obavezno, uz mogućnost dodavanja nove);
- novi podizvođač (naziv i kontakt) ili postojeći iz registra;
- s ugovorom: osnovica, PDV stopa (0, 5, 13, 25 %), izračunati PDV i ukupno, datum ugovora,
  rok;
- opis posla;
- „Financira" — banka iz namjena kredita projekta;
- PDF dokumenti ugovora.

**Kontrole budžeta:**
1. **budžet klasifikacije:** ako je za (fazu, klasifikaciju) postavljen budžet, iznos ugovora
   ne smije premašiti `budžet − Σ preuzetih iznosa ugovora` — „Iznos ugovora premašuje raspoloživi
   budžet klasifikacije troška";
2. **budžet faze:** ako faza ima budžet, iznos ne smije premašiti `budžet faze − budget_used`
   — „Iznos ugovora premašuje raspoloživi budžet faze".

Broj ugovora dodjeljuje se automatski (`CNT-GGGG-nnnn-…`, do 3 pokušaja pri sudaru).
`budget_used` faze održava okidač `trg_sync_phase_budget_used` pri svakoj promjeni ugovora.

**Uređivanje ugovora:** naziv i kontakt podizvođača, faza (unutar projekta), ima li ugovor,
**status** (Aktivan, Završen, Raskinut; Nacrt samo dok je ugovor nacrt), klasifikacija, kategorija, opis, osnovica i PDV, rok; prikaz plaćenog, preostalog i
**napretka** `min(100, plaćeno / ukupno × 100)` („izračunato iz plaćanja"); dokumenti.
Povećanje iznosa provjerava se prema budžetu klasifikacije.

**Brisanje ugovora:** kaskadno briše milestoneove i dnevnike rada ugovora; računi ostaju, ali
gube vezu na ugovor.

### 8.10 Detalji ugovora

Opis posla; broj ugovora, rok, kategorija, osnovica, PDV, ukupno; dokumenti ugovora; pločice
Ugovoreno, Plaćeno i Prekoračenje/Ušteda/Preostalo*; „Financira"; upravljanje milestoneovima;
**komentari** (bilješka, rad završen, problem) s autorom, ulogom i vremenom.

### 8.11 Milestoneovi plaćanja

Plan plaćanja ugovora kao postotci ugovorene (bruto) vrijednosti.

- **Pločice:** ukupno raspoređeno (% i €), preostalo (% i €), broj milestoneova (plaćeni /
  na čekanju*), ukupno plaćeno*.
- **Tablica:** redni broj, naziv, opis, %, iznos = ugovor × % / 100, plaćeno* (Σ plaćenog na
  računima milestonea), rok, status* (Plaćeno, Djelomično, Na čekanju).
- **Dodavanje/uređivanje:** naziv, opis, postotak (> 0 i ne više od preostalog do 100 %),
  rok.
- Status postavljaju isključivo triggeri iz plaćanja; račun se vezuje uz milestone u obrascu
  računa u modulu Cashflow.

### 8.12 Plaćanja i računi ugovora

- **Povijest plaćanja:** fakturirano (Σ računa), plaćeno, preostalo; popis plaćanja (datum,
  broj i status računa, način plaćanja, referenca, opis). Plaćanja se vode u računovodstvu.
- **Računi ugovora:** broj i status, firma, iznos (+ plaćeno), dospijeće, opis; zakašnjeli
  računi crveno.

### 8.13 Klasifikacije troška i kategorije ugovora

- **Upravljanje klasifikacijama:** popis (uključujući neaktivne), redoslijed, aktivacija i
  deaktivacija, brisanje nesistemskih (samo ako nisu u upotrebi), nova klasifikacija.
- **Nova kategorija ugovora:** naziv (jedinstven) i opis.
- **Budžeti po klasifikaciji faze (pregled):** za svaku klasifikaciju plan iz TIC-a, iznos u
  drugim fazama i u ovoj fazi; upozorenja za nemapirani iznos TIC-a i nepostojeći TIC;
  budžet faze, raspoređeno, neraspoređeno.

### 8.14 Dokumenti ugovora i podizvođača

PDF do 25 MB, drag & drop. Dokumenti se spremaju u središnji modul Dokumenti (kategorija
`IZVODACI`) s vezama na podizvođača, ugovor, projekt i fazu. Pregled otvara dokument preko
potpisanog URL-a (1 sat); dokumenti se mogu brisati. Isti dokumenti vidljivi su na
`/documents`.

### 8.15 Registar podizvođača (`/subcontractors`)

- **Statistika:** broj podizvođača, aktivni ugovori, ukupno plaćeno, preostalo.
- **Pretraga, filtri** (aktivni, s dugovanjem, plaćeni, bez ugovora), filtar projekta,
  sortiranje (naziv, preostalo, vrijednost, plaćeno), prikaz kartica ili tablice.
- **Po podizvođaču:** vrijednost ugovora (s ugovorom iznos ugovora, bez ugovora zbroj računa),
  plaćeno, preostalo, broj aktivnih i završenih ugovora, traka plaćenosti.
- **Detalji:** svi ugovori (projekt, faza, opis, „BEZ UGOVORA", napredak, ugovoreno/plaćeno/
  preostalo/rok, „⚠ kasni N dana"), dokumenti firme.
- **Dodavanje/uređivanje:** naziv, kontakt, bilješke. **Brisanje** kaskadno briše ugovore
  podizvođača; blokirano je ako na podizvođača glase računi.

### 8.16 Dnevnik rada (`/work-logs`)

Građevinski dnevnik — tko je što radio, po danima.

**Unos:** projekt, faza, ugovor (aktivni ugovori faze; podizvođač se određuje iz ugovora),
datum (zadano danas), status, opis rada, detalji problema (za blokadu i problem kvalitete),
bilješke.

| Status | Oznaka |
|---|---|
| `work_finished` | Rad završen (zeleno) |
| `in_progress` | U tijeku (plavo) |
| `blocker` | Blokada (crveno) |
| `quality_issue` | Problem kvalitete (narančasto) |
| `waiting_materials` | Čekanje materijala (žuto) |
| `weather_delay` | Kašnjenje zbog vremena (sivo) |

**Popis:** kartice s bojom statusa, podizvođačem, projektom i fazom, ugovorom, datumom,
vremenom unosa, opisom, detaljima problema i bilješkama; uređivanje i brisanje.

### 8.17 Računi i plaćanja podizvođača (profil Supervision)

**Računi (`/invoices`):** računi kategorije `SUBCONTRACTOR` s projektom.
- statistika: broj i iznos, ovaj mjesec;
- filtri: pretraga (broj, dobavljač, projekt, ugovor), nedavno/velika (> 10.000 €),
  odobreno/neodobreno, raspon datuma;
- stupci: odobreno (kvačica), broj, kategorija, datum, dobavljač, projekt, faza, firma,
  iznos, status;
- **odobravanje** računa (Director, Accounting);
- izvoz u Excel `racuni-nadzor.xlsx`.

**Plaćanja (`/payments`):** plaćanja ulaznih računa podizvođača.
- statistika, filtri (pretraga, nedavno/velika, raspon datuma);
- stupci: datum, podizvođač, projekt, faza, **platitelj** (cesijska firma kod cesije, inače
  firma kredita, inače firma žiro računa), iznos, bilješke;
- izvoz u Excel `placanja-nadzor.xlsx`.

### 8.18 Dnevnik aktivnosti

`phase.create`, `phase.bulk_update`, `phase.update`, `phase.delete`, `contract.create`,
`subcontractor.create`, `subcontractor.update`, `subcontractor.delete`,
`subcontractor.comment`, `contract_type.create`, `cost_classification.create`,
`cost_classification.update`, `cost_classification.delete`, `contract_milestone.create`,
`contract_milestone.update`, `contract_milestone.delete`, `work_log.create`,
`work_log.update`, `work_log.delete`, `invoice.approve`,
`export.supervision_invoices_excel`, `export.supervision_payments_excel`,
`document.upload`, `document.delete`.

---

## 9. Modul Prodaja (Sales)

### 9.1 Namjena

CRM i inventar prilagođen prodaji stanova, garaža i spremišta — od prvog upita kupca do zadnje
rate. Navigacija prati stvarnost: projekt → zgrada → jedinica. Garaže i spremišta vežu se uz
stan i prodaju u paketu.

### 9.2 Rute i izbornik (profil Sales)

| Stavka izbornika | Ruta | Komponenta |
|---|---|---|
| Dashboard | `/` | `dashboards/SalesDashboard` |
| Stanovi | `/apartments` | `Sales/Apartments` |
| Prodajni projekti | `/sales-projects` | `Sales/SalesProjects` |
| Kupci | `/customers` | `Sales/Customers` |
| Uplate | `/sales-payments` | `Sales/Payments` |
| Dokumenti | `/documents` | zajednički modul |
| Izvještaji | `/sales-reports` | `Reports/SalesReports` |

### 9.3 Podatkovni model

**`projects`** (zajednička tablica) — modul koristi `id, name, location, status, category,
start_date, budget`. `category` CHECK: `interno`, `retail`, `stambeno` (zadano `stambeno`).
Kategorija projekta `retail` nije isto što i modul Retail.

**`buildings`** — `project_id` (CASCADE), `name`, `description`, `total_floors` (zadano 1).

**`apartments`** (stan):

| Skupina | Polja |
|---|---|
| Identitet i cijena | `project_id`, `building_id`, `number`, `floor`, `size_m2` (prodajna površina), `price`, `price_per_m2` |
| Status | `status` CHECK: `Available`, `Reserved`, `Sold` (zadano `Available`); `buyer_name` (prikazno ime kupca) |
| Hrvatska specifikacija | `ulaz`, `tip_stana`, `sobnost`, `povrsina_otvoreno`, `povrsina_ot_sa_koef` |
| Ugovoreno | `datum_potpisa_predugovora`, `contract_payment_type` (`credit` / `installments`), `kapara_10_posto`, `rata_1_ab_konstrukcija_30`, `rata_2_postava_stolarije_20`, `rata_3_obrtnicki_radovi_20`, `rata_4_uporabna_20`, `kredit_etaziranje_90` |

**`garages`** (garaža; u Excelu „parking") i **`repositories`** (repozitorij/spremište) — iste
strukture: `building_id` (CASCADE), `number`, `floor`, `size_m2`, `price`, `price_per_m2`,
`status` (`Available`/`Reserved`/`Sold`), `buyer_name`. Projekt se određuje preko zgrade.

**`apartment_garages`** i **`apartment_repositories`** — veze M:N između stana i garaže odnosno
spremišta (jedinstveni par). Poslovno: **paket** stan + garaža + spremište.

**`customers`** (kupci):

| Polje | Opis |
|---|---|
| `name`, `surname` | obavezno |
| `email` | opcionalno, jedinstveno |
| `phone`, `address`, `bank_account`, `id_number` (OIB) | kontakt i identifikacija |
| `status` | CHECK: `lead` (potencijalni kupac), `interested` (zainteresiran), `buyer` (kupac); zadano `interested` |
| `customer_number` | redni broj iz sekvence |
| `preferences` | jsonb: `budget_min`, `budget_max`, `preferred_size_min`, `preferred_size_max`, `preferred_floor`, `preferred_location`, `bedrooms`, `notes` |
| `last_contact_date` | zadnji kontakt |
| `interested_project_id` | projekt interesa (ON DELETE SET NULL) |
| `notes` | bilješke |

**`sales`** (prodaja): `apartment_id` (CASCADE), `customer_id` (CASCADE), `sale_price`,
`down_payment` (kapara), `total_paid`, `remaining_amount`, `monthly_payment`,
`payment_method` (CHECK: `cash`, `credit`, `bank_loan`, `installments`; zadano `bank_loan`),
`sale_date`, `contract_signed`, `notes`.

**Veze:** projekt 1—N zgrada 1—N {stan, garaža, spremište}; stan N—M garaža i N—M spremište;
kupac 1—N prodaja N—1 stan; kupac 1—N izlazni račun (`OUTGOING_SALES`) 1—N uplata; kupac N—1
projekt interesa.

**Brisanje:** brisanje projekta ili zgrade kaskadno briše zgrade, jedinice, prodaje i veze;
brisanje stana ili kupca blokirano je ako na njih glasi račun (`ON DELETE RESTRICT` iz
`accounting_invoices`).

Sve izvedene vrijednosti prodaje (status jedinice nakon prodaje, status povezanih jedinica,
zbrojevi) računa aplikacija; na tablicama prodaje nema triggera. Status računa kupca i
plaćeni iznos održava trigger računovodstva (poglavlje 10).

### 9.4 Stanovi (`/apartments`)

**Popis:** kartice s paginacijom na poslužitelju (24 po stranici), sortirano po broju.
Pretraga (odgoda 500 ms) po broju stana i imenu kupca; filtri projekt, zgrada (ovisi o
projektu) i status (svi / dostupno / rezervirano / prodano).

**Kartica stana:** broj, kat, projekt, zgrada, površina, cijena; povezane garaže i spremišta s
cijenama i **ukupnom cijenom paketa** (`cijena stana + Σ cijena garaža + Σ cijena spremišta`).
Za prodane stanove: kupac i traka naplate `uplaćeno / ukupno` (zelena ≥ 100 %, plava ≥ 50 %,
inače narančasta), gdje je uplaćeno zbroj uplata na računima tog stana.

**Akcije:**
1. **Skupno kreiranje** — projekt, zgrada, početni broj (zadano 101), količina (10), kat,
   površina, cijena; stvara stanove `A{broj}` sa statusom Dostupno.
2. **Pojedinačni stan** — sva polja specifikacije i sekcija **Ugovoreno**.
3. **Uređivanje** — sva polja uključujući status.
4. **Detalji** — lokacija, specifikacija, ugovoreni iznosi.
5. **Brisanje** — uz potvrdu; odbija se ako na stan glasi račun.
6. **Povijest uplata** — ukupna vrijednost paketa, uplaćeno, preostalo, postotak, raspodjela
   cijene (stan / garaže / spremišta) i popis uplata (iznos, datum, kupac, vrsta: kapara,
   rata, završna uplata, ostalo). Uplate se vode u računovodstvu, ovdje su samo za čitanje.
7. **Povezivanje jedinica** — odabir garaža i spremišta iz iste zgrade (dostupne ili već
   povezane); spremanje zamjenjuje sve veze stana.

**Sekcija „Ugovoreno":** datum potpisa predugovora, način plaćanja i planirani iznosi. Odabir
načina plaćanja popunjava iznose iz cijene stana:

| Način | Raspodjela |
|---|---|
| Rate (`installments`) | kapara 10 %, rata 1 (AB konstrukcija) 30 %, rata 2 (postava stolarije) 20 %, rata 3 (obrtnički radovi) 20 %, rata 4 (uporabna dozvola) 20 % |
| Kredit (`credit`) | kapara 10 %, kredit po etažiranju 90 % |

Iznosi se nakon toga mogu slobodno mijenjati.

### 9.5 Prodajni projekti (`/sales-projects`)

Pregled u tri razine unutar iste stranice: **projekti → zgrade → jedinice**.

**Razina projekata:** kartice **Stambeno** i **Retail** (projekti kategorije `interno` se ne
prikazuju). Kartica projekta: naziv, lokacija, status, broj zgrada, ukupno jedinica, postotak
prodanosti `prodano / ukupno × 100` s trakom, i prihod (naplaćeni iznos).

**Razina zgrada:** kartice s brojem katova, brojem stanova, garaža i spremišta (uz „N
prodano") i prihodom. Akcije: **uvoz iz Excela** (stanovi), **kreiranje više zgrada** (1–20
odjednom), **nova zgrada** (naziv, opis, broj katova), brisanje zgrade (kaskadno, uz potvrdu).

**Razina jedinica:**
- kartice po vrsti (stanovi, garaže, spremišta) s brojačima i filtrom statusa;
- kartica jedinice: broj, kat, površina, **cijena po m²** (`price_per_m2`, a ako nije
  postavljena `cijena / površina`), cijena; za stanove s vezama **ukupna cijena paketa** i
  podkartice povezanih garaža i spremišta s gumbom za odvezivanje; za prodane: kupac, prodajna
  cijena, kapara, mjesečna rata i traka naplate;
- statusne oznake Dostupno / Rezervirano / Prodano;
- akcije za neprodane jedinice: **Rezerviraj**, **Oslobodi**, **Prodaj**, brisanje,
  povezivanje (stanovi);
- garaža ili spremište povezano sa stanom, a spremljeno kao Dostupno, prikazuje se kao
  **Rezervirano**;
- **višestruki odabir** jedinica (prodane se ne mogu odabrati), „Odaberi sve" i
  **Konfiguriraj cijenu**.

**Pojedinačna jedinica:** broj, kat, površina, cijena po m²; cijena = površina × cijena po m².

**Skupno kreiranje jedinica:**

| Parametar | Zadano |
|---|---|
| od kata / do kata | 1 / 10 |
| jedinica po katu | 4 |
| prefiks broja | A / G / R ovisno o vrsti |
| osnovna površina, varijacija | 85 m², 15 m² |
| osnovna cijena po m² | 5.000 € |
| premija po katu | 10.000 € po jedinici za svaki kat iznad početnog |

Za svaki kat *k* i jedinicu *j*:
- `površina = round(osnovna + (slučajno − 0,5) × varijacija)`
- `premija = (k − početni kat) × premija po katu`
- `cijena_po_m2 = osnovna cijena po m² + premija / površina`
- `cijena = round(površina × cijena_po_m2)`
- `broj = prefiks + k + dvoznamenkasti j` (npr. A101, G305)

Pregled prije kreiranja prikazuje broj jedinica, prosječnu cijenu i ukupnu vrijednost.

**Skupna promjena cijene:** povećanje ili smanjenje za iznos u **€/m²**. Pregled prikazuje
trenutni i novi raspon cijena po m², trenutnu i novu ukupnu vrijednost i razliku; ako bi
cijena postala negativna, spremanje je onemogućeno. Za svaku odabranu **neprodanu** jedinicu:
`nova cijena po m² = stara ± iznos` (ne ispod 0), `cijena = površina × nova cijena po m²`.
Prodane jedinice se preskaču (i ako su prodane u međuvremenu). Rezultat: „Ažurirano X od Y
odabranih jedinica (prodane se preskaču)".

**Povezivanje i odvezivanje:** povezivanje garaže ili spremišta s prodanim stanom automatski
ih označava prodanima s istim kupcem; odvezivanje vraća jedinicu u status Dostupno.

### 9.6 Uvoz iz Excela

**Stanovi** (iz razine zgrada projekta; `.xlsx`, `.xls`, `.csv`; prvi list, prvi redak je
zaglavlje). Tri koraka: učitavanje datoteke → pregled (ukupno, valjanih, nevaljanih s
razlozima) → rezultat.

| Stupac | Sadržaj | Odredište |
|---|---|---|
| A | zgrada | uparuje se po nazivu sa zgradama projekta |
| B | ulaz | `ulaz` |
| C | kat | `floor` |
| D | oznaka stana | `number` (obavezno) |
| E | tip | `tip_stana` |
| F | sobnost | `sobnost` |
| G | zatvorena površina | (samo čitanje) |
| H | otvorena površina | `povrsina_otvoreno` |
| I | otvorena površina s koeficijentom | `povrsina_ot_sa_koef` |
| J | prodajna površina m² | `size_m2` (obavezno) |
| K | €/m² | `price_per_m2` |
| L | cijena stana | `price` (obavezno) |
| M–O | parking: oznaka, m², cijena | garaža |
| P–R | spremište: oznaka, m², cijena | spremište |
| S | ukupna cijena | (samo čitanje) |
| T | datum potpisa predugovora | Excel datum, `DD.MM.YYYY` ili ISO |
| U | kapara 10 % | `kapara_10_posto` |
| V–Y | rate 1–4 | `rata_*` |
| Z | kredit etažiranje 90 % | `kredit_etaziranje_90` |

- Brojevi se čitaju u europskom formatu (točka tisućice, zarez decimale).
- Način plaćanja određuje se automatski: rate ako je bilo koji od stupaca V–Y popunjen, inače
  kredit ako je Z popunjen.
- **Detekcija duplikata:** postojeći stan (isti projekt, zgrada i broj) se **ažurira**, novi
  se **dodaje**. Garaže i spremišta traže se po zgradi i oznaci — postojeće se ažuriraju, nove
  kreiraju — i povezuju sa stanom.
- Rezultat: uspješno, neuspješno, povezanih garaža i spremišta, sažetak (ništa uvezeno /
  djelomično / uspjeh) i prvih 10 grešaka.

**Garaže** (s kartice garaža zgrade): stupci A = oznaka, B = m², C = cijena. Pregled označava
svaki redak kao „novi" ili „ažurira se"; postojeće garaže (ista oznaka u zgradi) se
ažuriraju, nove se kreiraju.

### 9.7 Prodaja jedinice

**Obrazac prodaje:**
- kupac: **novi** (ime i prezime, e-mail, telefon, adresa) ili **postojeći** (odabir iz
  popisa);
- prodajna cijena (predložena cijena jedinice), način plaćanja (gotovina, kredit, bankarski
  zajam, rate), kapara, mjesečna rata, datum prodaje, potpisan ugovor, bilješke;
- sažetak uživo: cijena, kapara, **preostalo = cijena − kapara**, mjesečna rata.

**Tijek spremanja:**
1. novi kupac se kreira sa statusom `buyer`;
2. upisuje se redak u `sales` (`total_paid = kapara`, `remaining_amount = cijena − kapara`);
3. jedinica dobiva status `Sold` i ime kupca;
4. sve garaže i spremišta povezani sa stanom postaju `Sold` s istim kupcem;
5. postojeći kupac prelazi u status `buyer`.

Prodaja se evidentira na stanu; garaže i spremišta prodaju se kao dio paketa stana.

**Životni ciklus statusa jedinice:**

| Prijelaz | Način |
|---|---|
| Dostupno → Rezervirano | gumb „Rezerviraj" ili uređivanje stana |
| Rezervirano → Dostupno | gumb „Oslobodi" ili uređivanje stana |
| → Prodano | prodaja, povezivanje s prodanim stanom ili uređivanje stana |
| Prodano → Dostupno | uređivanje stana ili odvezivanje garaže/spremišta |

**Status kupca:** `lead` → `interested` → `buyer`; ručno u obrascu kupca ili automatski u
`buyer` pri prodaji.

### 9.8 Kupci (`/customers`)

- **Kartice:** Potencijalni, Zainteresirani, Kupci (s brojačima); klik na aktivnu karticu
  prikazuje sve.
- **Pretraga** po imenu, prezimenu, e-mailu i telefonu; **filtar projekta** (projekt interesa
  ili projekt kupljene jedinice).
- **Kartica kupca:** kontakt, projekt interesa, zadnji kontakt; za kupce kupljene jedinice
  (+ garaža, + spremište), ukupna cijena, uplaćeno i preostalo; za ostale preferencije.
- **Akcije:** pregled, uređivanje, brisanje (odbija se ako kupac ima račune), „Ažuriraj
  kontakt" (postavlja zadnji kontakt na sada), **e-mail** — otvara poruku sa svim odabranim
  (ili svim prikazanim) adresama u BCC-u.
- **Obrazac kupca:** ime, prezime, e-mail, telefon, status, projekt interesa, adresa,
  bankovni račun, OIB; za potencijalne i zainteresirane i preferencije (budžet, površina,
  broj soba, kat, lokacija, bilješke). Dupli e-mail javlja „e-mail već postoji".
- **Detalji:** kontakt, kupnje grupirane po projektu (ukupno, uplaćeno, preostalo po projektu
  i ukupno), preferencije, bilješke.
- Podaci se čuvaju u memorijskom cacheu 5 minuta i poništavaju pri svakoj promjeni.

### 9.9 Uplate kupaca (`/sales-payments`)

Pregled svih uplata kupaca (samo za čitanje) — uplate na izlaznim računima tipa
`OUTGOING_SALES` vezanima uz stan.

- **Statistika:** broj uplata, ukupni iznos, broj i iznos ovog mjeseca.
- **Filtri:** pretraga (stan, projekt, kupac, broj računa, opis), brzi filtri (sve / zadnjih 7
  dana / iznad 10.000 €), raspon datuma.
- **Tablica:** datum uplate, broj računa, kupac, stan, projekt, iznos računa, iznos uplate,
  način plaćanja (virman, gotovina, ček, kartica), banka; podnožje s brojem i zbrojem.
- **Izvoz u Excel** (`placanja-prodaja.xlsx`, list „Plaćanja"): datum uplate, račun, datum
  računa, stan, projekt, kupac, iznos računa, uplata, način, banka, opis.

### 9.10 Veza s računovodstvom

- Računi kupcima i uplate vode se u modulu **Cashflow** — izvorno iz **4D Wanda** (poglavlja 10
  i 11). Račun kupcu ima tip `OUTGOING_SALES`, kategoriju `CUSTOMER`, kupca, projekt i stan.
- Trigger na uplatama održava `paid_amount`, `remaining_amount` i status računa (`UNPAID`,
  `PARTIALLY_PAID`, `PAID`).
- Budući da se garaže i spremišta ne fakturiraju zasebno, uplate za cijeli paket knjiže se na
  račune stana; uplaćeni iznos stana pokriva cijeli paket.
- Moduli prodaje prikazuju „uplaćeno" iz stvarnih uplata u računovodstvu.

### 9.11 Ovlasti

Tablice prodaje dostupne su svim prijavljenim korisnicima. Uloga Sales u računovodstvu vidi
samo račune i uplate vezane uz prodaju (`apartment_id IS NOT NULL` ili
`invoice_type = 'OUTGOING_SALES'`); Director i Accounting vide sve.

### 9.12 Dnevnik aktivnosti

`building.create`, `building.bulk_create`, `building.delete`, `apartment.create`,
`garage.create`, `repository.create`, `{vrsta}.bulk_create`, `{vrsta}.delete`,
`{vrsta}.update`, `{vrsta}.bulk_price_update`, `apartment.link_garage`,
`apartment.link_repository`, `apartment.unlink_garage`, `apartment.unlink_repository`,
`apartment.link_units`, `apartment.import_excel`, `apartment.import_excel_summary`,
`garage.import_excel`, `customer.create`, `customer.update`, `customer.delete`,
`sale.create`, `export.sales_payments_excel`, `export.sales_pdf`, `export.customer_pdf`.

---

## 10. Modul Cashflow (računovodstvo)

### 10.1 Namjena

Financijsko srce sustava: svaki račun i svako plaćanje grupe, povezano s projektom, ugovorom,
milestoneom, stanom ili kreditnom linijom kojoj pripada. Pokriva ulazne i izlazne račune s
više PDV stopa, plaćanja (uključujući cesiju i kompenzaciju), firme grupe i njihove žiro
račune, dobavljače i kupce, pozajmice unutar grupe, stanje duga, odobravanje računa, kalendar
dospijeća s mjesečnim budžetima te šifrarnike i uvoz iz ERP-a 4D Wand (poglavlje 11).

### 10.2 Pristup

- Rute modula zaštićene su s `CashflowRoute`: potrebna je uloga **Director** ili
  **Accounting** i otključan profil (lozinka, vidi 4.3).
- Stvarnu zaštitu provode RLS politike (6.2). `get_invoice_statistics` i
  `get_filtered_invoices` odbijaju sve osim uloga Director i Accounting.
- Brisanje računa, firmi i uredskih dobavljača dopušteno je samo direktoru.

**Izbornik:** Dashboard, Računi, Plaćanja, Kalendar dospijeća, Dobavljači, Uredski
dobavljači, Moje firme, Investicije, Kupci, Pozajmice i prijenosi, Stanje duga, Odobravanja,
Šifrarnici, ERP uvoz, Dokumenti.

### 10.3 Podatkovni model — računi (`accounting_invoices`)

**Vrste računa** (`invoice_type`), s gledišta firme:

| Vrsta | Značenje |
|---|---|
| `INCOMING_SUPPLIER` | ulazni račun dobavljača/podizvođača |
| `INCOMING_OFFICE` | ulazni račun uredskog dobavljača |
| `INCOMING_INVESTMENT` | ulazni račun investicije (banka/investitor) |
| `INCOMING_BANK` | otplata kredita banci |
| `INCOMING_BANK_EXPENSES` | kamate, naknade i troškovi kredita |
| `OUTGOING_SUPPLIER` | izlazni račun dobavljaču |
| `OUTGOING_SALES` | izlazni račun kupcu (prodaja stanova) |
| `OUTGOING_OFFICE` | izlazni račun uredskom partneru |
| `OUTGOING_BANK` | isplata tranše kredita |

**Kategorija** (`invoice_category`): `SUBCONTRACTOR`, `OFFICE`, `APARTMENT`, `CUSTOMER`,
`BANK_CREDIT`, `INVESTOR`, `MISCELLANEOUS`, `GENERAL`, `RETAIL`. Dodatno `category` — naziv
slobodne kategorije iz `invoice_categories` (npr. `land_purchase` za kupnju zemljišta).

**Polja:**

| Skupina | Polja |
|---|---|
| Stranke | `company_id` (vlastita firma), `supplier_id`, `customer_id`, `office_supplier_id`, `bank_id` (točno jedna stranka ovisno o vrsti) |
| Dokument | `invoice_number`, `reference_number` (poziv na broj), `iban`, `issue_date`, `due_date`, `description`, `approved`, `refund_id` |
| **Multi-PDV** | `base_amount_1..4`, `vat_rate_1..4`, `vat_amount_1..4` |
| Zbrojevi | `base_amount`, `vat_amount`, `total_amount` |
| Stanje plaćanja | `paid_amount`, `remaining_amount`, `status` (`UNPAID`, `PARTIALLY_PAID`, `PAID`) |
| Veze | `project_id`, `contract_id`, `milestone_id`, `apartment_id`, `bank_credit_id`, `credit_allocation_id` |
| Porijeklo | `source` (`manual` / `erp`), `erp_document_key`, `erp_content_hash`, `erp_synced_at` |

**Ograničenja u bazi:** iznosi ≥ 0; `paid_amount ≤ total_amount` (preplata se odbija);
`remaining_amount = total_amount − paid_amount`; svaka vrsta računa zahtijeva točno svoju
stranku (npr. `OUTGOING_SALES` → kupac, `*_BANK` → banka).

**Multi-PDV — četiri fiksna mjesta po stopi:**

| Mjesto | Stopa |
|---|---|
| 1 | 25 % |
| 2 | 13 % |
| 3 | 0 % |
| 4 | 5 % |

Trigger `calculate_invoice_amounts` računa `vat_amount_n = round(base_n × stopa, 2)`,
`total_amount = Σ (base_n + vat_n)`, `base_amount = Σ base_n`, `vat_amount = Σ vat_n` i
`remaining_amount`. Za račune iz 4D Wanda (`source = 'erp'`) PDV i ukupni iznos preuzimaju se
kako su proknjiženi (dopušta djelomično priznati pretporez), a trigger računa samo zbrojeve.

### 10.4 Podatkovni model — plaćanja (`accounting_payments`)

| Polje | Opis |
|---|---|
| `invoice_id` | račun (brisanje računa briše njegova plaćanja) |
| `payment_date`, `amount` (> 0) | datum i iznos |
| `payment_method` | `WIRE` (virman), `CASH`, `CHECK`, `CARD` |
| `payment_source_type` | `bank_account`, `credit`, `kompenzacija`, `gotovina` |
| `company_bank_account_id` | žiro račun s kojeg/na koji ide plaćanje |
| `credit_id`, `credit_allocation_id` | plaćanje iz kredita i namjene |
| `is_cesija`, `cesija_company_id`, `cesija_bank_account_id`, `cesija_credit_id`, `cesija_credit_allocation_id` | cesija: tko je stvarni platitelj i iz kojeg izvora |
| `reference_number`, `description` | referenca i opis |
| `source`, `erp_document_key` | porijeklo (ručno / ERP) |

**Trigger `update_invoice_payment_status`:** nakon svake promjene plaćanja
`paid_amount = Σ plaćanja`, `remaining_amount = ukupno − plaćeno`, status `UNPAID` (0),
`PAID` (≥ ukupno) ili `PARTIALLY_PAID`. Isto vrijedi za obična plaćanja, cesiju i
kompenzaciju.

### 10.5 Ostale tablice

| Tablica | Sadržaj |
|---|---|
| `accounting_companies` | vlastite firme grupe: `name`, `oib` (jedinstven, 11 znamenki) |
| `company_bank_accounts` | žiro računi firmi: `bank_name`, `account_number`, `initial_balance`, `current_balance`, `balance_reset_at` |
| `company_loans` | pozajmice: od firme/računa, prema firmi/računu, `amount`, `loan_date` |
| `monthly_budgets` | mjesečni budžet: `year`, `month`, `budget_amount`, `notes` |
| `hidden_approved_invoices` | odobreni računi označeni kao obrađeni |
| `office_suppliers` | uredski dobavljači: naziv, kontakt, e-mail, adresa, porezni broj, PDV broj |
| `invoice_categories` | slobodne kategorije računa |
| `accounting_invoices_refund` | refundacije |

### 10.6 Stanje žiro računa

Trigger `update_bank_account_balance_trigger` nakon svake promjene plaćanja potpuno
preračunava stanje svakog pogođenog računa (`recalc_company_bank_account_balance`):

```
stanje = početno stanje
       + Σ plaćanja izlaznih računa (OUTGOING_*) na tom računu
       − Σ plaćanja ulaznih računa (INCOMING_*) s tog računa
       − Σ cesija plaćenih s tog računa (za druge firme)
       − Σ pozajmica danih s tog računa
       + Σ pozajmica primljenih na taj račun
```

Broje se samo stavke od datuma `balance_reset_at`. Isti preračun pokreće se pri promjeni
pozajmica.

### 10.7 Računi (`/accounting-invoices`)

**Popis** — RPC `get_filtered_invoices` (paginacija na poslužitelju, 100 po stranici) i
`get_invoice_statistics`:
- **smjer:** ulazni (zadano) / izlazni;
- **kategorija po smjeru:** ulazni — dobavljač, uredski, investicija, banka, troškovi banke;
  izlazni — dobavljač, uredski, prodaja, banka;
- **status:** svi, plaćeni, neplaćeni, djelomično, neplaćeni + djelomično;
- **firma**, **pretraga** (odgoda 500 ms; broj računa, kategorija, opis, nazivi stranaka,
  firme, banke);
- **sortiranje** po broju (prirodni redoslijed brojeva) ili dospijeću.

**Statistika:** ukupan broj; neplaćeno u filtru (za izlazne „priljev"); ukupno neplaćeno u
smjeru (neovisno o filtru firme i pretrage).

**Tablica** (stupci se mogu skrivati i pamte se): odobreno, vrsta, broj, firma,
dobavljač/kupac, kategorija, datum izdavanja, dospijeće, osnovica i PDV po stopama, ukupno,
plaćeno, preostalo, status. Račun je zakašnjeli ako nije plaćen, a dospijeće je prije danas.
Akcije: pregled, **plati** (za neplaćene), uređivanje, brisanje.

**Unos računa** (za ručne dokumente uz one koji stižu iz 4D Wanda) — gumbi: kupnja zemljišta,
uredski račun, bankovni račun, novi račun.

**Obrazac računa:**
- vrsta: `INCOMING_SUPPLIER`, `INCOMING_INVESTMENT`, `OUTGOING_SUPPLIER`, `OUTGOING_SALES`
  (uredski način: `INCOMING_OFFICE`, `OUTGOING_OFFICE`);
- stranka prema vrsti (dobavljač, uredski dobavljač, banka, kupac);
- projekt (za prodaju samo projekti kupca, za dobavljača samo projekti na kojima ima ugovor),
  ugovor, **milestone** (iznos, plaćeno, preostalo), stan;
- vlastita firma, broj, poziv na broj (npr. `HR12-3456-7890`), IBAN, datum izdavanja,
  dospijeće, **osnovice po stopama 25 %, 13 %, 5 %, 0 %**, kategorija, opis;
- pregled PDV-a po stopi i ukupno (`b1 × 1,25 + b2 × 1,13 + b4 × 1,05 + b3`).

**Provjere:** obavezni vrsta, firma, broj, kategorija, datumi; dospijeće ≥ datum izdavanja;
stranka; za dobavljača s projektom obavezan ugovor; barem jedna osnovica > 0. **Duplikat:**
isti broj računa, firma i stranka u istoj kalendarskoj godini.

**Automatsko odobrenje:** uredski računi, računi investicije i bankovni računi odobreni su pri
unosu; računi dobavljača i prodaje čekaju odobrenje.

**Bankovni račun:** vrsta „odljev" (`INCOMING_BANK`, otplata), „priljev" (`OUTGOING_BANK`,
isplata tranše) ili „troškovi kredita" (`INCOMING_BANK_EXPENSES`); vlastita firma, banka,
kreditna linija (obavezna za troškove), namjena (samo za isplatu), broj, datumi, osnovice,
kategorija, opis.

**Kupnja zemljišta:** firma → dobavljač (s ugovorom) → projekt → faza → ugovor; naziv,
IBAN, iznos kapare s dospijećem, preostali iznos s dospijećem. Stvara do dva ulazna računa
(`{naziv}-Kapara`, `{naziv}-Preostalo`) sa stopom 0 % i kategorijom `land_purchase`.

**Detalji računa:** osnovni podaci, datumi, stranke, projekt i ugovor, poziv na broj, IBAN,
osnovice po stopama, PDV, ukupno, plaćeno, preostalo, kategorija, opis.

### 10.8 Plaćanja (`/accounting-payments`)

**Popis:** pretraga (broj računa, referenca, opis, firma, stranka), način plaćanja, vrsta
(prihod `OUTGOING_*` / rashod `INCOMING_*`), raspon datuma; 100 po stranici; stupci se mogu
skrivati.

**Statistika:** broj, prihod, rashod, neto, **PDV ulaz** i **PDV izlaz** — udio PDV-a
plaćanja = `iznos plaćanja / ukupno računa × PDV računa`.

**Obrazac plaćanja** (s popisa ili gumbom „Plati" na računu): račun (ukupno / plaćeno /
preostalo), iznos (zadano preostalo), datum (zadano danas), izvor i način plaćanja,
referenca, opis.

| Izvor | Traži se | Dopušteni načini |
|---|---|---|
| Žiro račun | račun firme računa (sa stanjem) | virman, kartica, ček |
| Kredit | kredit firme (dostupno = iznos − iskorišteno) i namjena (dostupno = alocirano − iskorišteno) | virman |
| Kompenzacija | ništa dodatno | — |
| Gotovina | ništa dodatno | gotovina |

**Cesija** — „Ugovor o cesiji — plaćanje iz druge firme": platitelj je druga firma grupe, a
izvor njezin žiro račun ili njezin kredit s namjenom. Način je virman.

**Provjere:** iznos > 0 i ne veći od preostalog (pri izmjeni uz dodani stari iznos); obavezan
račun ili kredit s namjenom prema izvoru; kod cesije obavezni platitelj i njegov izvor;
način mora odgovarati izvoru.

**Učinak pojedinih vrsta plaćanja:**

| Vrsta | Račun | Žiro račun | Kredit |
|---|---|---|---|
| Virman sa žiro računa | status i preostalo | kreće se stanje računa firme | — |
| Iz kredita | status i preostalo | — | raste iskorištenost kredita i namjene |
| Gotovina | status i preostalo | — | — |
| **Kompenzacija** | status i preostalo | — | — |
| **Cesija** | status i preostalo | tereti se račun **platitelja** | kod cesije iz kredita raste iskorištenost kredita platitelja |

**Kompenzacija** se evidentira kao plaćanje vrste `kompenzacija` na svakom od dva računa koji
se međusobno prebijaju (npr. ulazni račun dobavljača i naš izlazni račun tom dobavljaču).

**Cesija** ne dira račune firme na koju glasi račun; u detaljima firme cesijski računi
prikazuju se u oba smjera, s nazivom druge firme.

### 10.9 Moje firme (`/accounting-companies`)

Podaci iz pogleda `company_statistics` po firmi: ukupno stanje računa i broj računa, dostupni
krediti (Σ iznos − iskorišteno), **prihodi** (računi koje je firma izdala: `OUTGOING_SALES`,
`OUTGOING_OFFICE`, `OUTGOING_SUPPLIER` — broj, ukupno, plaćeno, preostalo) i **rashodi** (računi
poslovanja koje plaća: `INCOMING_SUPPLIER`, `INCOMING_OFFICE`, `INCOMING_INVESTMENT` i troškovi
kredita `INCOMING_BANK_EXPENSES`, s plaćenim uključujući cesije koje je firma platila za druge).
Glavnica kredita je **financiranje** i ne ulazi ni u prihode ni u rashode: isplate (`OUTGOING_BANK`)
i otplate (`INCOMING_BANK`) prikazuju se zasebno, u retku „Financiranje (primljeno / otplaćeno)”.
Dobit = plaćeni prihodi − plaćeni rashodi. Pogled poštuje RLS pozivatelja. Pravilo je jedno za
cijelu aplikaciju: `src/utils/invoiceCashDirection.ts` (smjer i kategorija za svaki tip računa).

- **Statistika:** broj firmi, ukupno stanje, ukupni prihod, dobit/gubitak.
- **Pretraga** po nazivu ili OIB-u.
- **Kartica firme:** stanje, izdano / isplaćeno, prihod, dobit, neplaćeni prihodi i rashodi.
- **Nova firma:** naziv, OIB (11 znamenki, jedinstven — „OIB već postoji u sustavu!"), broj
  žiro računa (1–10), za svaki banka i trenutno stanje.
- **Uređivanje:** naziv i OIB; za svaki račun **reset stanja** — novo stanje i datum; od tog
  datuma stanje se preračunava iz plaćanja, cesija i pozajmica.
- **Brisanje:** samo direktor; nije moguće ako firma ima račune.
- **Detalji:** žiro računi, krediti s namjenama, zadnjih 100 računa i cesijski računi u oba
  smjera.

### 10.10 Banke i krediti (`/accounting-banks`, „Investicije")

Pregled za čitanje: ukupni limit, iskorišteno, vraćeno i preostali dug svih kredita; po banci
→ po kreditu → po namjeni. Kartica kredita ista je kao u modulu Financiranje (12.6), sa
sekcijama isplata, otplata i troškova.

### 10.11 Kupci i dobavljači

**Kupci (`/accounting-customers`)** — isti kupci kao u prodajnom CRM-u; po kupcu: broj
računa, ukupno, plaćeno, preostalo, vrijednost nekretnina (stan + povezane garaže i
spremišta), broj stanova. Zbrojevi: računi, vrijednost nekretnina, plaćeno, dug
(vrijednost − plaćeno). Detalji s karticama računa.

**Dobavljači (`/accounting-suppliers`)** — podizvođači s gradilišta: broj i vrijednost
ugovora (bez ugovora: zbroj osnovica računa), računi, plaćeno, preostalo, projekti. Filtri po
statusu (aktivni, s dugovanjem, plaćeni, bez ugovora) i projektu, sortiranje, prikaz kartica
ili tablice. Akcije: dodavanje i uređivanje (uz projekt i fazu automatski se stvara ugovor),
povezivanje s projektom, detalji (ugovori, računi, plaćanja), brisanje.

**Uredski dobavljači (`/office-suppliers`)** — naziv, kontakt, e-mail, adresa, porezni i PDV
broj; statistika osnovice, bruto iznosa, plaćenog i preostalog; računi dobavljača.

### 10.12 Stanje duga (`/debt-status`)

Pregled dugovanja grupiran po dobavljaču (podizvođači i uredski dobavljači): po dobavljaču
**neplaćeno** (Σ preostalog neplaćenih i djelomično plaćenih računa), **plaćeno** i broj
računa. Filtar po projektu (preko ugovora). Statistika: ukupno neplaćeno, ukupno plaćeno,
broj dobavljača, dobavljači s dugom. Sortiranje po nazivu, neplaćenom (zadano) ili plaćenom.
**Izvoz** u Excel (list „Stanje duga") i PDF (A4). Potraživanja od kupaca prikazuju se na
stranici Kupci.

### 10.13 Pozajmice i prijenosi (`/accounting-loans`)

Pozajmice i prijenosi novca između firmi grupe. Tablica: datum, firma i račun davatelja,
firma i račun primatelja, iznos; pretraga po firmi. Nova pozajmica: od firme → račun, prema
firmi → račun (sa stanjima), iznos, datum. Povrat se evidentira kao pozajmica u suprotnom
smjeru. Trigger preračunava stanja oba računa.

### 10.14 Odobravanja (`/accounting-approvals`)

Red računa za obradu u računovodstvu.
- **Odobravanje** računa podizvođača radi se na stranici Računi u profilu Nadzor (8.17; uloge
  Director i Accounting); uredski, investicijski i bankovni računi odobreni su automatski.
- **Popis:** odobreni računi podizvođača s projektom, osim onih označenih kao obrađeni;
  sortirano po datumu izdavanja.
- **Statistika:** broj na čekanju, ukupni iznos, najstariji datum.
- **Stupci:** kategorija, broj, dobavljač, projekt, faza, ugovor, datumi, osnovica, PDV,
  ukupno, status plaćanja.
- **Akcije:** označi obrađenim (pojedinačno ili skupno, uz potvrdu s brojem i iznosom).
  Račun ostaje u sustavu.

### 10.15 Kalendar dospijeća i mjesečni budžeti (`/accounting-calendar`)

- **Mjesečni kalendar** s računima po danu dospijeća; klik na dan otvara popis računa.
- **Statistika mjeseca:** ukupno, plaćeno, neplaćeno, zakašnjelo (broj i iznos).
- **Ulazni** (troškovi): plaćeno i neplaćeno; **izlazni**: plaćeno; **neto** = izlazni
  plaćeni − ulazni plaćeni.
- **Budžet:** ako je za mjesec postavljen, razlika `budžet − plaćeni ulazni` („ispod" ili
  „iznad budžeta").
- **Unos budžeta:** odabir godine i iznosi za 12 mjeseci, uz godišnji zbroj.

### 10.16 Dnevnik aktivnosti

`invoice.create`, `invoice.update`, `invoice.delete`, `invoice.bulk_create`,
`invoice.approve`, `invoice.hide`, `invoice.bulk_hide`, `payment.create`,
`payment.update`, `payment.delete`, `company.create`, `company.update`, `company.delete`,
`bank_account.create`, `bank_account.balance_reset`, `loan.create`, `loan.delete`,
`monthly_budget.update`, `supplier.create`, `supplier.update`, `supplier.delete`,
`office_supplier.create`, `office_supplier.update`, `office_supplier.delete`,
`export.debt_excel`, `export.debt_pdf`; za ERP vidi 11.10.

---

## 11. Integracija s ERP sustavom 4D Wand

### 11.1 Načelo

**Računovodstvo knjiži jednom — u 4D Wandu.** 4D Wand je izvor istine za račune, plaćanja i
stanja žiro računa. Cognilion ih uvozi, razvrstava i povezuje s poslovnim entitetima, a sve
što je nizvodno (dashboardi, stanje duga, realizacija ugovora, milestoneovi, praćenje uplata
kupaca, iskorištenost kredita) i dalje čita iste tablice `accounting_invoices` i
`accounting_payments` i ažurira se postojećim triggerima.

| Što | Kako |
|---|---|
| Računi i plaćanja | uvoze se iz 4D Wanda |
| Projekt računa | automatski iz **mjesta troška** |
| Kategorija troška | automatski iz **konta** |
| Firma grupe | automatski po **OIB-u** |
| Partner (dobavljač, kupac, banka…) | preko šifrarnika partnera |
| Ugovor, milestone, stan, kreditna linija | dodjeljuje korisnik u Cognilionu |

### 11.2 Prijenos podataka

4D Wand ne nudi API, pa se podaci prenose **izvozom datoteka**:

- **lokalni agent** na poslužitelju firme prati mapu izvoza i svaku novu datoteku šalje edge
  funkciji `import-erp` (`POST /functions/v1/import-erp`, multipart, zaglavlje
  `x-erp-import-secret`, polja `feed` i `file`; CSV ili XLSX do 25 MB);
- **ručni uvoz** kroz ekran ERP uvoz (za uloge Director i Accounting).

Oba puta koriste isti parser i isti revizijski trag (`erp.import_runs.transport` = `agent` /
`manual`).

**Redoslijed feedova u ciklusu:** `accounts` → `cost_centers` → `partners` → `invoices` →
`payments` → `bank_balances`. Naziv datoteke određuje feed (npr.
`invoices_20260831_060000.csv`).

**Pravila agenta:** čeka stabilnu veličinu datoteke; nakon slanja datoteku premješta u
`processed/` (nikad je ne briše); ponavlja pokušaj pri greškama 5xx i mrežnim greškama, a
nikad pri 4xx; bilježi `run_id`. Ponovno slanje iste datoteke je sigurno (SHA-256 hash
datoteke i hash sadržaja svakog dokumenta).

**Izvoz je snimka, ne razlika:** svaki izvoz sadrži sve dokumente tekuće i prethodne
poslovne godine.

**Odgovor funkcije:** `{run_id, feed, rows_total, rows_staged, rows_rejected, problems, resolved, unresolved, promoted, skipped}`.
Statusi: 200 (parsirano i staged), 401 (pogrešna tajna), 400 (neispravan feed ili datoteka),
413 (prevelika datoteka), 500 (greška tijekom obrade — pokretanje se označava neuspjelim).

**Format:** UTF-8 (agent pretvara CP1250), razdjelnik `;`, decimalna točka, ISO datumi,
zaglavlje. Parser je tolerantniji: prepoznaje razdjelnik, BOM, windows-1250, brojeve
`1234.56`, `1.234,56` i `1234,56`, datume ISO, `DD.MM.YYYY` i `DD/MM/YYYY`; XLSX se čita kao
prikazani tekst.

### 11.3 Shema `erp`

Uvozni podaci žive u zasebnoj shemi `erp`, a korisnicima su izloženi kroz `security_invoker`
poglede u shemi `public`. Čitanje je dopušteno ulogama Director i Accounting; pisanje radi
isključivo uvoznik (service role), osim tablica mapiranja.

| Tablica | Sadržaj |
|---|---|
| `erp.import_runs` | svako pokretanje uvoza: feed, način prijenosa, datoteka i hash, status (`received`, `parsing`, `staged`, `promoting`, `completed`, `failed`), brojači redaka, greška, vrijeme, korisnik |
| `erp.chart_of_accounts` | kontni plan (konto, naziv, aktivan) |
| `erp.cost_centers` | mjesta troška (šifra, naziv, aktivno) |
| `erp.partners` | komitenti 4D Wanda (id, naziv, OIB, vrsta, adresa, IBAN, e-mail, telefon) |
| `erp.account_map` | mapiranje konta → uloga i kategorija računa |
| `erp.cost_center_map` | mapiranje mjesta troška → projekt |
| `erp.partner_map` | mapiranje komitenta → entitet Cognilona |
| `erp.staging_invoices` | stavke računa iz uvoza, s rezultatima provjere i razvrstavanja |
| `erp.staging_payments` | raspodjele plaćanja iz uvoza |
| `erp.bank_balances` | stanja računa po IBAN-u i datumu (vremenski niz) |
| `erp.link_carry_forward` | prijenos ručnih veza pri povijesnom uvozu |

Pogledi u `public`: `erp_import_runs`, `erp_staging_problems`, `erp_review_queue`,
`erp_unmapped_codes`, `erp_chart_of_accounts`, `erp_cost_centers`, `erp_partners`,
`erp_account_map`, `erp_cost_center_map`, `erp_partner_map`.

Na `accounting_invoices` i `accounting_payments` dodani su stupci porijekla: `source`
(`manual` / `erp`), `erp_document_key` (jedinstven), `erp_content_hash`, `erp_synced_at`.

### 11.4 Feed računa (`invoices`)

Jedan redak po **stavci računa**.

**Obavezni stupci:** `erp_id` (stabilan, nikad se ne ponavlja), `line_no`, `direction`
(`INCOMING` / `OUTGOING`), `document_type` (`INVOICE`, `CREDIT_NOTE`, `ADVANCE`, `STORNO`),
`company_oib`, `partner_erp_id`, `partner_name`, `invoice_number`, `issue_date`, `due_date`,
`cost_center_code`, `account_code`, `base_amount`, `vat_rate`, `vat_amount`, `line_total`,
`invoice_total` (bruto cijelog dokumenta, ponovljen na svakoj stavci), `updated_at`.
**Opcionalno:** `original_erp_id`, `partner_oib`, `reference_number`, `description`,
`currency` (zadano EUR).

**Provjere retka:** obavezna polja i dopuštene vrijednosti; `|osnovica + PDV − iznos stavke| ≤ 0,005`;
dospijeće ≥ datum izdavanja. PDV se ne provjerava prema stopi — djelomično priznati pretporez
je legitiman.

**Provjere dokumenta:** zbroj stavki = `invoice_total` (± 0,005, otkriva skraćene datoteke);
najviše 4 različite PDV stope (peta je greška, nikad rezanje); bez dupliciranih `line_no`.

Neispravni retci također se spremaju u staging, zajedno s greškama.

### 11.5 Feed plaćanja (`payments`)

Jedan redak po **raspodjeli plaćanja na račun**.

**Obavezni stupci:** `erp_id`, `allocation_no`, `invoice_erp_id`, `allocated_amount`,
`payment_date`, `payment_method` (`WIRE`, `CASH`, `CHECK`, `CARD`), `settlement_type`
(`BANK`, `KOMPENZACIJA`, `CESIJA`, `GOTOVINA`). **Opcionalno:** `payment_total`,
`company_iban`, `counterparty_iban`, `cesija_payer_oib`, `kompenzacija_reference`,
`reference_number`, `description`.

**Provjere:** iznos ≠ 0; `CESIJA` zahtijeva OIB platitelja; `BANK` zahtijeva IBAN firme;
zbroj raspodjela ne smije premašiti ukupni iznos plaćanja.

Način plaćanja i vrsta namire namjerno su odvojeni jer kompenzacija i cesija nisu načini
plaćanja.

### 11.6 Referentni feedovi

| Feed | Polja |
|---|---|
| `accounts` | `account_code`, `name`, `active` |
| `cost_centers` | `code`, `name`, `active` |
| `partners` | `erp_id`, `name` (obavezno), `oib` (11 znamenki), `partner_type`, adresa, IBAN, e-mail, telefon, `active` |
| `bank_balances` | `company_oib`, `iban`, `balance`, `balance_as_of` (obavezno), `bank_name`, valuta |

Referentni feed zamjenjuje cijeli registar; stanja računa se nadopunjuju (ključ IBAN +
datum).

### 11.7 Razvrstavanje (`erp.resolve_invoices`)

Za svaku ispravnu stavku, bez upisa u `public` (može se ponavljati):

1. **Firma** — `accounting_companies.oib = company_oib`.
2. **Partner** — `erp.partner_map` prema `partner_erp_id` daje vrstu i id entiteta.
3. **Projekt** — `erp.cost_center_map` prema mjestu troška.
4. **Kategorija** — `erp.account_map` prema kontu (konto ne smije biti `unclassified`).
5. **PDV stopa** — mora biti 0, 5, 13 ili 25 %.
6. **Vrsta računa** — iz smjera i vrste partnera:

| Smjer | Partner | Vrsta |
|---|---|---|
| ulazni | podizvođač | `INCOMING_SUPPLIER` |
| ulazni | uredski dobavljač | `INCOMING_OFFICE` |
| ulazni | investitor | `INCOMING_INVESTMENT` |
| ulazni | banka, konto uloge `expense` | `INCOMING_BANK_EXPENSES` |
| ulazni | banka, ostalo | `INCOMING_BANK` |
| izlazni | kupac | `OUTGOING_SALES` |
| izlazni | podizvođač | `OUTGOING_SUPPLIER` |
| izlazni | uredski partner | `OUTGOING_OFFICE` |
| izlazni | banka | `OUTGOING_BANK` |

Uvoznik **nikad ne pogađa**: ako bilo što nedostaje, dokument čeka u redu za provjeru uz
opis problema.

### 11.8 Prijenos u Cognilion (`erp.promote_invoices`, `erp.promote_payments`)

**Računi:**
- **sve ili ništa po dokumentu** — ako je bilo koja stavka neispravna ili nerazvrstana, cijeli
  dokument čeka;
- stavke se spajaju po `erp_id`; osnovice i PDV zbrajaju se u **četiri fiksna PDV mjesta**
  (25 / 13 / 0 / 5 %), a PDV i ukupni iznos preuzimaju se kako su proknjiženi;
- postavlja se točno jedna stranka prema vrsti partnera;
- upis je `INSERT … ON CONFLICT (erp_document_key) DO UPDATE` samo ako se hash sadržaja
  promijenio — nepromijenjen dokument ne pokreće nijedan trigger;
- ažuriranje **ne dira ručne veze** (ugovor, milestone, stan, kredit, namjena) ni oznaku
  odobrenja, pa one preživljavaju ponovni uvoz;
- `paid_amount` i status i dalje održava trigger plaćanja.

**Plaćanja:**
- račun se pronalazi po `erp_document_key`; žiro račun po IBAN-u; platitelj cesije po OIB-u;
- ključ plaćanja `erp_id#allocation_no`, uz preskakanje nepromijenjenih.

| Vrsta namire | Zapis u Cognilionu |
|---|---|
| `BANK` | plaćanje sa žiro računa (pomiče se stanje računa) |
| `KOMPENZACIJA` | plaćanje vrste `kompenzacija` (bez utjecaja na stanje računa); protustavka stiže kao zasebna raspodjela na drugom računu |
| `GOTOVINA` | plaćanje vrste `gotovina` |
| `CESIJA` | cesija s platiteljem određenim po OIB-u |

Nakon prijenosa status računa, realizacija ugovora, milestoneovi, iskorištenost kredita i
stanja računa ažuriraju se postojećim triggerima.

### 11.9 Red za provjeru i šifrarnici

**Red za provjeru** (`erp_review_queue`, „nepovezani računi"): po jedan redak za svaki
dokument koji čeka — broj računa, partner, datum, iznos, šifre partnera, mjesta troška i
konta, popis problema i broj stavki.

**Postupak:** u Šifrarnicima se mapira šifra koja nedostaje, a zatim se za to pokretanje
klikne **„Ponovno razvrstaj"** (`erp_reclassify(run_id)`), što ponovno pokreće razvrstavanje
i prijenos.

**Šifrarnici (`/sifrarnici`)** — pretraga i prekidač „samo nemapirano"; tri kartice s brojem
nemapiranih:
- **Konta:** šifra, naziv, **uloga** (`unclassified`, `liability_supplier`,
  `liability_customer`, `liability_other`, `receivable_advance`, `expense`, `vat_input`,
  `vat_output`, `bank`, `ignore`) i cilj ovisno o ulozi — kategorija računa (trošak), PDV
  stopa (PDV uloge) ili banka;
- **Mjesta troška:** šifra, naziv, projekt;
- **Komitenti:** ERP id, naziv, OIB (upozorenje ako nedostaje), vrsta (podizvođač, uredski
  dobavljač, kupac, banka, investitor…) i konkretni entitet.

Svaka promjena odmah se sprema; „Očisti" briše mapiranje.

### 11.10 Ekran ERP uvoz (`/erp-import`)

- **Odabir feeda** (redom: konta, mjesta troška, komitenti, računi, plaćanja, stanja računa) i
  datoteke (`.csv`, `.xlsx`, `.xls`, `.txt`), uz napomenu da se referentni feedovi uvoze prvi.
- **Rezultat:** ukupno, staged, odbijeno i prvih 10 odbijenih redaka s greškama.
- **Povijest pokretanja** (zadnjih 50): vrijeme, feed, datoteka, način prijenosa, status,
  brojači; proširivanjem se vide problemi retka.
- **Red za provjeru** s gumbom „Ponovno razvrstaj" po pokretanju.

Dnevnik aktivnosti: `erp_import.upload`, `erp_import.reclassify`,
`erp_account_map.upsert` / `.delete`, `erp_cost_center_map.upsert` / `.delete`,
`erp_partner_map.upsert` / `.delete`.

### 11.11 Faze integracije

| Faza | Sadržaj |
|---|---|
| 0 Temelj | shema `erp`, evidencija uvoza, stupci porijekla, jedinstveni ključevi |
| 1 Referentni podaci i mapiranja | kontni plan, mjesta troška, komitenti, šifrarnici |
| 2 Uvoz | staging, stanja računa, `import-erp`, ekran ERP uvoza |
| 3 Razvrstavanje i prijenos | razvrstavanje, prijenos računa i plaćanja, red za provjeru |
| 4 Povijesni uvoz | prijenos ručnih veza na uvezene dokumente po prirodnom ključu (broj, firma, datum, iznos, vrsta) |
| 5 Uklanjanje ručnog unosa | obrasci za unos računa i plaćanja uklanjaju se; upis u te tablice dopušten je samo uvozniku; obrazac računa služi samo za veze |
| 6 Usklađivanje | kontrolni zbrojevi, usporedba snimaka, alarm zastarjelosti uvoza |
| 7 Produkcija | lokalni agent i prelazak na produkciju |

Detalji: [`erp-integration/`](./erp-integration/README.md).

---

## 12. Modul Financiranje (Funding)

### 12.1 Namjena

Odgovara na pitanje **odakle dolazi novac**: bankovne kreditne linije i vlasnički kapital
investitora, njihova raspodjela na projekte, povlačenja, otplate i troškovi te **TIC** —
planirana struktura troškova investicije koja je jedini izvor planiranog budžeta projekta.
Ključno pitanje koje modul rješava: *koliko smo povukli iz koje kreditne linije, za koji
projekt, i koliko je ostalo?*

Terminologija u sučelju: zajmodavci i investitori zajedno su **„Investitori"** (tablica
`banks`), a kreditna linija ili vlasnički ulog prikazuje se kao **„Investicija"**.

### 12.2 Rute i izbornik (profil Funding)

| Stavka | Ruta | Komponenta |
|---|---|---|
| Dashboard | `/` | `dashboards/InvestmentDashboard` |
| Investitori | `/banks` | `Funding/Investors` |
| Investicije | `/funding-credits` | `Funding/Investments` |
| Projekti | `/investment-projects` | `Funding/Projects` |
| Plaćanja | `/funding-payments` | `Funding/Payments` |
| TIC | `/tic` | `Funding/TIC` |
| Dokumenti | `/documents` | zajednički modul |

Profil nije zaštićen lozinkom. Povlačenja, otplate i troškovi kredita knjiže se kao bankovni
računi u računovodstvu (izvor: 4D Wand; ručni unos kroz obrazac bankovnog računa u
`Cashflow/Banks`), a modul Financiranje ih prikazuje i agregira.

### 12.3 Podatkovni model

**`banks`** — registar investitora i banaka: `name`, `contact_person`, `contact_email`,
`contact_phone` (+ zbirna polja koja se računaju u aplikaciji).

**`bank_credits`** — kreditna linija ili vlasnički ulog:

| Polje | Opis |
|---|---|
| `bank_id` | investitor/banka (CASCADE) |
| `company_id` | firma korisnik kredita |
| `credit_name` | naziv |
| `credit_type` | `term_loan`, `line_of_credit`, `construction_loan`, `bridge_loan`, `equity` |
| `credit_seniority` | `senior` / `junior` |
| `amount` | iznos (limit) |
| `interest_rate` | kamatna stopa % godišnje (kod equityja očekivani IRR) |
| `start_date`, `maturity_date`, `usage_expiration_date` | početak, dospijeće, kraj razdoblja korištenja |
| `grace_period` | poček u mjesecima |
| `repayment_type` | oznaka uz `monthly_payment`; od 1. 10. 2026. uvijek `monthly` |
| `principal_repayment_type`, `interest_repayment_type` | `monthly`, `quarterly`, `biyearly`, `yearly` |
| `monthly_payment` | mjesečni ekvivalent servisa duga na početku otplate (vidi niže) |
| `used_amount`, `repaid_amount`, `outstanding_balance` | **održava baza** (vidi 12.4) |
| `status` | `active`, `paid`, `defaulted` |
| `purpose` | namjena |
| `disbursed_to_account`, `disbursed_to_bank_account_id` | isplata na žiro račun firme (ako je označeno, račun je obavezan) |

**`credit_allocations`** — namjena kredita (raspodjela):

| Polje | Opis |
|---|---|
| `credit_id` | kredit (CASCADE) |
| `allocation_type` | `project`, `opex`, `refinancing` |
| `project_id` | obavezno za `project`, prazno za ostale |
| `refinancing_entity_type`, `refinancing_entity_id` | `company` ili `bank` — obavezno za `refinancing` |
| `allocated_amount` | alocirani iznos |
| `used_amount` | iskorišteno (održava baza) |
| `description` | opis |

Trigger `validate_refinancing_entity_trigger` provjerava da firma ili banka koja se
refinancira postoji.

**Kretanja novca** vode se u tablicama računovodstva:

| `invoice_type` | Značenje | Oznaka u sučelju | Smjer |
|---|---|---|---|
| `OUTGOING_BANK` | isplata tranše — novac dolazi od banke | „Isplate kredita" | priljev |
| `INCOMING_BANK` | otplata glavnice banci | „Uplate kredita" | odljev |
| `INCOMING_BANK_EXPENSES` | kamate, naknade i ostali troškovi kredita | „Troškovi kredita" | odljev |

Bankovni računi nose `bank_credit_id` (i `credit_allocation_id` za isplate). Račun dobavljača
plaćen **iz kredita** nosi na plaćanju `credit_id` i `credit_allocation_id` — tako se kredit
„troši" na podizvođače i druge dobavljače. Cesija iz kredita koristi `cesija_credit_id` i
`cesija_credit_allocation_id`.

### 12.4 Izračuni u bazi

**Iskorištenost kredita** — `recalculate_bank_credit_fields(p_credit_id)`, pokreću je triggeri
`trg_sync_bank_credit_on_invoice` i `trg_sync_bank_credit_on_payment`:

- `used_amount` = Σ iznosa plaćanja (bez dvostrukog brojanja) iz tri skupa:
  1. plaćanja računa dobavljača iz kredita (`credit_id`);
  2. cesije iz kredita (`cesija_credit_id`);
  3. plaćanja isplata (`OUTGOING_BANK`) tog kredita;
- `repaid_amount` = Σ `iznos plaćanja × (osnovica / ukupni iznos)` na otplatama
  (`INCOMING_BANK`) — dakle udio bez PDV-a;
- `outstanding_balance = used_amount − repaid_amount`;
- troškovi kredita (`INCOMING_BANK_EXPENSES`) samo se prikazuju i ne ulaze u ove iznose.

**Kredit isplaćen na račun** (`disbursed_to_account`): pri kreiranju se iznos kredita dodaje
stanju odabranog žiro računa, a `used_amount = outstanding_balance = amount`; isključivanje
oznake ili brisanje kredita oduzima iznos s računa.

**Iskorištenost namjene** (`credit_allocations.used_amount`) ažurira se inkrementalno:
- plaćanje s `credit_allocation_id` dodaje iznos, cesija s `cesija_credit_allocation_id`
  ga oduzima (brisanje obrnuto, izmjena usklađuje razliku);
- isplata (`OUTGOING_BANK`) vezana uz namjenu dodaje ukupni iznos računa pri kreiranju.

**Stanje žiro računa** — `recalc_company_bank_account_balance`: početno stanje + plaćanja
izlaznih računa (uključujući isplate kredita) − plaćanja ulaznih računa (uključujući otplate i
troškove kredita) − cesije ± pozajmice, od trenutka `balance_reset_at`.

### 12.5 Investitori (`/banks`)

**Kartica investitora:** naziv, kontakt, **Ukupno** (Σ iznosa kredita), **Iskorišteno**
(Σ `used_amount`), **Preostalo** (Σ `outstanding_balance`), **iskorištenost**
`iskorišteno / ukupno × 100` s trakom (≥ 90 % crveno, ≥ 70 % narančasto, inače zeleno) i broj
aktivnih kredita.

**Akcije u zaglavlju:**
1. **Dodaj investitora** — naziv (obavezno), kontakt osoba, e-mail, telefon.
2. **Dodaj kredit** — obrazac kreditne linije (niže).
3. **Dodaj dionički kapital** — obrazac vlasničkog uloga (niže).

**Brisanje investitora:** dijalog upozorava na broj računa vezanih uz njegove kredite; potvrda
odvezuje te račune od kredita i briše investitora s kreditima i namjenama.

**Detalji investitora:** kontakt; paneli *Kreditni instrumenti* (ukupno, iskorišteno,
preostali dug), *Pregled* (aktivni i ukupni krediti) i *Procjena rizika*:
- kreditni rizik prema iskorištenosti: > 80 % visok, > 60 % srednji, inače nizak;
- koncentracija = dug investitora / ukupni dug svih investitora × 100.

**Kartica kredita:**
- oznake vrste (equity ljubičasto, građevinski plavo, oročeni zeleno, premosni narančasto,
  okvirni sivo) i statusa (Aktivan, Otplaćen, U kašnjenju); „DOSPJELO" nakon datuma
  dospijeća, „USKORO DOSPIJEVA" unutar 90 dana;
- iznos i kamatna stopa;
- iskorišten iznos (+ % iskorištenosti), vraćeno banci, preostali dug, **dostupno za
  korištenje** = iznos − iskorišteno;
- mjesečna ili godišnja rata, dospijeće, napredak otplate `vraćeno / iznos × 100`;
- uređivanje i brisanje (uz upozorenje o vezanim računima).

**Obrazac kredita:** investitor, naziv, firma, vrsta (građevinski senior, oročeni senior,
okvirni senior/junior, premosni senior), iznos, kamatna stopa, poček (mjeseci), učestalost
otplate glavnice (zadano godišnje) i kamata (zadano mjesečno), datum početka, dospijeća i
kraja korištenja, namjena, **isplata na račun** (odabir žiro računa firme sa stanjem).
Obavezno: investitor, naziv, iznos, datum početka.

**Model otplate:** glavnica se vraća u **jednakim ratama** prema učestalosti otplate glavnice,
počevši nakon počeka; **kamata se obračunava na preostali dug** prema učestalosti otplate kamata,
od datuma početka (poček odgađa glavnicu, ne kamatu). Rate zato padaju tijekom otplate.
- broj rata glavnice = cijeli mjeseci od početka otplate do dospijeća ÷ mjeseci između rata
  (zaokruženo naviše); zadnja rata zatvara ostatak;
- kamata se obračunava mjesečno na stanje duga i plaća na svaki datum plaćanja kamata.

**Mjesečni servis duga** (`monthly_payment`) = glavnica po rati ÷ mjeseci između rata + iznos ×
stopa ÷ 12 — mjesečni ekvivalent na početku otplate glavnice (najveći iznos); 0 bez datuma
dospijeća. Zbraja se kao „mjesečni servis duga" na direktorskom dashboardu i u općem izvještaju.

**Pregled plana otplate** (uživo u obrascu): glavnica po rati i broj rata, prva kamata i iznos na
koji pada do kraja, broj plaćanja kamata i ukupna kamata, datum početka otplate glavnice te
napomena da se kamata plaća i tijekom počeka. Učestalost se prikazuje opisno („Svaki mjesec",
„Svako tromjesečje", „Svakih 6 mjeseci", „Svake godine").

**Obrazac dioničkog kapitala:** investitor, firma, iznos, očekivani IRR %, plan isplate
(godišnje/mjesečno), pregled novčanog toka, **multiplikator** `(1 + IRR)^godine`, datum
ulaganja, datum izlaska, kraj korištenja, poček, uvjeti (hipoteke). Sprema se kao kredit vrste
`equity`, seniornosti `junior`.

### 12.6 Investicije (`/funding-credits`)

Kartica po kreditu s nazivom, oznakama, „banka • firma" i iznosom. **Pločice
iskorištenosti:**

| Pločica | Formula |
|---|---|
| Alocirano | Σ `allocated_amount` namjena |
| Iskorišteno | Σ `used_amount` namjena + izravne isplate (isplate bez namjene) |
| Dug | `outstanding_balance` |
| Nealocirano | iznos − alocirano − izravne isplate (crveno ako je negativno) |

Za kredit isplaćen na račun: iskorišteno = iznos, nealocirano = 0. Dvodijelna traka prikazuje
iskorišteno i alocirano-a-neiskorišteno; prekoračenje alokacije prikazuje se crveno uz poruku
o iznosu prekoračenja.

**Proširena kartica:**
1. detalji — vrsta, kamata, preostali dug, vraćeno, datumi;
2. **namjene** — za svaku: projekt, „OPEX" ili „Refinanciranje: firma/banka"; alocirano,
   iskorišteno, dostupno; opis i popis plaćenih računa iz te namjene (broj računa,
   dobavljač, datum i iznos plaćanja, ukupni iznos, status);
3. **Isplate kredita** (s kolonom namjene), **Uplate kredita**, **Troškovi kredita** —
   tablice bankovnih računa (broj, firma, investitor, datum izdavanja, datum plaćanja, plaćeni
   iznos, ukupno, status), učitavaju se pri prvom otvaranju;
4. namjena kredita (tekst).

**Nova namjena:** kategorija Projekt / OPEX (bez projekta) / Refinanciranje (firma ili
banka), iznos (> 0, ne veći od iznosa kredita umanjenog za postojeće alokacije), opis.
Namjena se može obrisati (plaćanja i računi pritom gube vezu na namjenu, ali ostaju).

### 12.7 Investicijski projekti (`/investment-projects`)

Za svaki projekt, iz namjena kredita vezanih uz projekt:

| Pokazatelj | Formula |
|---|---|
| Dug | Σ alociranog iz kredita koji nisu equity |
| Kapital | Σ alociranog iz equity ulaganja |
| Pokrivenost financiranjem | (dug + kapital) / budžet projekta × 100 |
| Dug / kapital | dug / kapital |
| Prosječna kamata | ponderirani prosjek: Σ(alocirano × stopa) / Σ alocirano |
| Rizik | **visok** ako je dug > 70 % budžeta, kašnjenje > 30 dana ili pokrivenost < 80 %; **srednji** ako je dug > 50 %, postoji kašnjenje ili pokrivenost < 90 %; inače **nizak** |

**Kartica:** naziv, status, rizik, datum završetka, budžet, kapital i dug (s % budžeta),
prosječna kamata, status financiranja („Potpuno financirano" ≥ 100 %, inače „Potrebno
financiranje"), traka ukupnog financiranja i do tri financijera.

**Detalji — Pregled:** ukupni budžet, broj financijera, dužničko financiranje, prosječna
kamata; struktura financiranja po namjeni (banka, kredit, vrsta, kamata, alocirano,
iskorišteno, dostupno, dospijeće); poluga (dug/kapital: > 2 crveno, > 1 narančasto); razdoblje
ulaganja; vremenska linija (preostalo ili zakašnjelo dana); čimbenici rizika (visoka poluga,
nedovoljno financiranje, prekoračenje roka).

**Detalji — Financiranje:** po izvoru: primljeno, istječe, oznake „ISTEKLO" / „USKORO ISTJEČE"
(30 dana), odobreno, potrošeno, dostupno, iskorištenost % i upozorenja (≥ 80 %, istek,
iscrpljena sredstva).

### 12.8 Plaćanja financiranja (`/funding-payments`)

Registar svih plaćanja po bankovnim računima kredita (samo za čitanje):
- **statistika:** ukupno isplaćeno (priljevi), ukupno otplate i troškovi (odljevi), neto,
  neto ovog mjeseca;
- **filtri:** pretraga (banka, projekt, bilješke), nedavno (7 dana), velika (> 50.000 €),
  raspon datuma;
- **tablica:** datum, vrsta (PRIHOD / RASHOD), primatelj (banka), projekt, kategorija (vrsta
  kredita), iznos, bilješke; podnožje s brojem, priljevima, odljevima i neto iznosom
  filtriranih redaka;
- **izvoz u Excel** (`placanja-financiranje.xlsx`, list „Plaćanja").

### 12.9 TIC — Troškovna Informatička Struktura (`/tic`)

**Namjena:** planirana struktura troškova investicije po projektu; svaka stavka dijeli se na
**vlastita** i **kreditna** sredstva (EUR i %). TIC je **jedini izvor planiranog budžeta**:
iz njega se automatski izvode budžet projekta, budžeti faza i budžeti po klasifikaciji
troška. Jedan TIC po projektu.

**Tablica `tic_cost_structures`:** `project_id` (jedinstveno), `investor_name`,
`document_date`, `line_items` (jsonb), `construction_sections` (jsonb), `created_by`.

- Stavka investicije: `{name, vlastita, kreditna, classification_id?, phases?: [{phase_number, vlastita, kreditna}]}`
- Sekcija građenja: `{code: 'A)', name, items: [{numeral: 'I.', name, vlastita, kreditna}]}`

**Kartica „Investicija":**
- stupci: Namjena, Klasifikacija, Vlastita EUR i %, Kreditna EUR i %, Ukupno EUR, po jedan
  stupac za svaku fazu, akcije; postoci su udio u ukupnom iznosu;
- dodavanje, brisanje i premještanje redaka;
- ispod tablice zbrojevi po klasifikaciji troška, nemapirani iznos i **UKUPNO**;
- **faze:** „Dodaj fazu" dodaje stupac; brisanje faze prenumerira više faze; klik na ćeliju
  faze otvara **raspodjelu po fazama** — trošak na razini projekta ili raspodjela
  vlastitih/kreditnih sredstava po fazama, uz „Raspodijeli ravnomjerno" (ostatak ide zadnjoj
  fazi) i provjeru da zbroj odgovara retku (tolerancija 0,02 €); neslaganje se označava
  upozorenjem.
- Zadani sadržaj novog TIC-a: 16 standardnih stavki.

**Kartica „Građenje":** sekcije (A), B), C)…) sa stavkama (rimski broj, naziv, vlastita,
kreditna), međuzbrojevi „Ukupno" i „SVEUKUPNO"; dodavanje, preimenovanje, brisanje i
premještanje. Zadano tri sekcije s 28 stavki. Neovisna je o retku „Građenje" na kartici
Investicija.

**Podnožje:** investitor, potpis „Za investitora", datum dokumenta.

**Spremanje:** zahtijeva projekt; zatvara praznine u numeraciji faza; upisuje ili ažurira TIC.
Nakon spremanja trigger `trg_sync_project_budget_from_tic` pokreće `sync_project_from_tic`:

1. ukupno = Σ (vlastita + kreditna) svih stavki; ako je 0, ništa se ne mijenja;
2. `projects.budget` = ukupno;
3. **TIC bez faza:** ako projekt nema faza, kreira se „Faza 1" s cijelim budžetom (status
   `planning`); inače faza 1 dobiva cijeli budžet, a ostale 0;
4. **TIC s fazama:** svaka faza dobiva svoj zbroj (nedostajuće „Faza n" se kreiraju); faze
   iznad broja TIC faza brišu se, osim ako imaju ugovore ili dnevnike rada (tada se
   postavljaju na 0);
5. `phase_classification_budgets` se ponovno izgrađuju: zbroj po (faza, klasifikacija).

Samo kartica Investicija utječe na budžete; kartica Građenje je informativna.

**Uvoz iz Excela** (tri koraka): zaglavlje se pronalazi po stupcu `NAMJENA`, iznosi po
`VLASTITA SREDSTVA`; listovi se prepoznaju po nazivu (`INVESTICIJ*`, `GRAĐENJ*`); retci
„Ukupno" i „SVEUKUPNO" i postoci se zanemaruju; skupina stupaca `FAZA n` postaje raspodjela po
fazama (tolerancija 0,05). Pregled upozorava da uvoz zamjenjuje obje tablice. Uvoz mijenja
samo prikaz; sprema se tek na „Spremi".

**Izvoz:** Excel (listovi `INVESTICIJA` i `GRAĐENJE` u izvornom obliku) i PDF (dvije
vodoravne A4 stranice); naziv datoteke `TIC_<projekt>_<datum>`.

**Zadano mapiranje stavki na klasifikacije troška:**

| Stavke | Klasifikacija |
|---|---|
| vrijednost zemljišta, porez na promet nekretnina | `zemljiste` |
| priprema projekta, projektna dokumentacija, komunalni i vodni doprinos, priključci | `priprema_i_razvoj` |
| građenje, unutarnje uređenje | `izgradnja_i_uredenje` |
| opremanje | `opremanje` |
| stručni nadzor, konzalting, uknjižba | `kontrola` |
| posredovanje, financijski nadzor, financiranje | `financiranje_i_nadzor` |
| nepredviđeni troškovi | `nepredvideni_troskovi` |

**Plan naspram ostvarenja:** TIC sadrži samo plan. Usporedba sa stvarnim troškovima radi se
nad budžetima izvedenima iz TIC-a — budžeti po klasifikaciji naspram ugovorenih iznosa
(upravljanje gradilištem) te budžet naspram realiziranog u kontroli budžeta (poglavlje 7).

### 12.10 Ovlasti

- `bank_credits`: čitanje i upis za Director, Accounting i Investment; brisanje Director.
- Računi i plaćanja (isplate, otplate, troškovi) vidljivi su ulogama Director i Accounting.
- `banks`, `credit_allocations`: dostupne prijavljenim korisnicima.
- TIC: vidljiv svima koji vide projekt.

### 12.11 Dnevnik aktivnosti

`investor.create`, `investor.update`, `investor.delete`, `bank_credit.create`,
`bank_credit.update`, `bank_credit.delete`, `invoice.bulk_detach_credit`,
`equity_investment.create`, `credit_allocation.create`, `credit_allocation.delete`,
`tic.create`, `tic.update`, `tic.import_excel`, `export.tic_excel`, `export.tic_pdf`,
`export.funding_payments_excel`, `export.investment_pdf`.

---

## 13. Dashboardi

Svaki profil ima vlastitu početnu stranicu sa živim pokazateljima (4.6). Dashboardi su
agregacije podataka samo za čitanje; brojke koje korisnik vidi ograničene su RLS-om njegove
uloge. Podaci se čuvaju u memoriji 5 minuta; neuspjelo učitavanje prikazuje poruku s gumbom
„Pokušaj ponovno".

Budući da računi i plaćanja stižu iz 4D Wanda, dashboardi prikazuju knjigovodstveno stanje
ubrzo nakon knjiženja, bez mjesečnog ciklusa izvještavanja.

### 13.1 Direktorski dashboard (profil General)

„Opća nadzorna ploča" — cijela firma na jedan pogled; prikazuje i vrijeme zadnjeg ažuriranja.

**Kritična upozorenja** (do 10, prikazuje se prvih 6):
- milestone plaćanja koji kasni — **kritično** („{naziv} kasni N dana");
- milestone plaćanja s rokom u 0–3 dana — **upozorenje** „Hitan rok";
- kredit (bez equityja, aktivan) koji dospijeva za 0–30 dana — **upozorenje**
  „Dospijeće kredita";
- omjer duga i kapitala > 2 — **upozorenje** „Visoka zaduženost";
- stopa prodaje < 30 % — **informacija** „Niska stopa prodaje".

**Financijski pregled:**

| Pokazatelj | Formula |
|---|---|
| Ukupni prihod | Σ prodajnih cijena (`sales.sale_price`) |
| Ukupni troškovi | Σ plaćenog na ulaznim računima dobavljača i uredskim računima |
| Neto profit | prihod − troškovi; marža = profit / prihod × 100 |
| Ukupni dug | Σ preostalog duga aktivnih kredita (bez equityja) |
| Novčani tok (mjesec) | Σ uplata kupaca u tekućem mjesecu |
| Omjer duga i kapitala | ukupni dug / Σ equity ulaganja |
| Potraživanja | Σ neplaćenog na računima kupcima |
| Obveze | Σ neplaćenog na ulaznim računima dobavljača i uredskim računima |

**Prodajni učinak** (stanovi; poveznica na prodajne projekte): prodano, rezervirano,
dostupno, stopa prodaje, ukupni prihod od prodaje, prosječna cijena po jedinici, prodaja u
tekućem mjesecu (broj i iznos).

**Gradnja i upravljanje gradilištem** (poveznica na upravljanje gradilištem): broj
podizvođača i aktivnih ugovora, završeni ugovori, zakašnjeli milestoneovi plaćanja, kritični
rokovi (0–7 dana), ukupna vrijednost ugovora, ukupno plaćeno podizvođačima, plaćanja na
čekanju.

**Financiranje i investicije** (poveznica na investicije): financirani projekti, broj
investitora, iskorištenost kredita (iskorišteno / iznos), nadolazeći rokovi (0–90 dana),
ukupni krediti, prosječna kamatna stopa (ponderirana iznosom), neplaćeni dug, mjesečni servis
duga (Σ rata).

**Portfelj projekata** (klik vodi na detalje projekta): projekt (vrsta, lokacija), status,
budžet, troškovi (računi dobavljača i uredski računi projekta), prihod (prodani stanovi),
**profitna marža** (≥ 20 % zeleno, ≥ 10 % plavo, ≥ 0 narančasto, < 0 crveno) i **završenost
prodaje** (prodani / svi stanovi).

### 13.2 Računovodstveni dashboard (profil Cashflow)

„Računovodstvena nadzorna ploča" za tekuće razdoblje.

**Smjer novca po vrsti računa:**
- priljev: svi izlazni računi (`OUTGOING_*`);
- odljev: svi ulazni računi (`INCOMING_*`), uključujući `INCOMING_INVESTMENT`.

Isto pravilo koriste stanja žiro računa, popisi plaćanja, opći izvještaj i kalendar dospijeća.

**PDV** (plaćeni računi od 1. siječnja):
- *naplaćeni PDV* = PDV svih izlaznih računa (+ tekući mjesec);
- *plaćeni PDV (pretporez)* = PDV ulaznih računa dobavljača, uredskih i bankovnih (+ tekući
  mjesec);
- *neto PDV pozicija* — „Za platiti poreznoj upravi" ili „Za primiti od porezne uprave";
- *neto PDV tekućeg mjeseca*.

**Mjesečni budžet** (ako je postavljen): planirano, potrošeno (odljevi tekućeg mjeseca),
preostalo ili prekoračenje, status „U redu" / „Prekoračenje" i postotak iskorištenosti.

**Novčani tok** (plaćanja od 1. siječnja): ukupno ulazno i izlazno s iznosom tekućeg mjeseca
i promjenom u odnosu na prethodni mjesec (%); neto novčani tok.

**Top 5 firmi po neto saldu:** po firmi grupe priljevi i odljevi ove godine, neto i broj
računa.

**Mjesečni trendovi:** za svaki mjesec od siječnja zelena traka priljeva, crvena traka
odljeva i neto iznos.

### 13.3 Prodajni dashboard (profil Sales)

Jedinice = stanovi + garaže + spremišta; prihod = naplaćene uplate na računima za stanove (s
PDV-om).

| Pločica | Formula |
|---|---|
| Ukupni prihod | Σ uplata kupaca (+ broj prodanih jedinica) |
| Naplaćeno ovaj mjesec | Σ uplata od početka mjeseca |
| Stopa prodaje | prodane / sve jedinice × 100 |
| Prosječna cijena prodaje | Σ prodajnih cijena / broj prodaja |
| Aktivni potencijalni kupci | kupci statusa lead ili interested (od ukupno) |

**Ostalo:** prodajni trend za 6 mjeseci (broj prodaja i naplaćeno po mjesecu), status
inventara (prodano, rezervirano, dostupno u %), učinak projekata (jedinice, prodano,
rezervirano, dostupno, stopa prodaje, iznos), načini plaćanja (gotovina, kredit, bankarski
zajam, rate — broj i %), nedavne prodaje (projekt, jedinica, kupac, cijena, datum).

### 13.4 Nadzorni dashboard (profil Supervision)

Tjedan od ponedjeljka do nedjelje. Napredak ugovora = isplaćeno / iznos ugovora × 100.

| Pločica | Značenje |
|---|---|
| Završeno ovaj tjedan | podizvođači označeni završenima u tjednu |
| Aktivne ekipe | podizvođači s nedovršenim ugovorom |
| Aktivna gradilišta | faze s nedovršenim ugovorima |
| Dnevnici radova | broj unosa u tjednu |
| Zakašnjelo | ugovori s prošlim rokom i napretkom < 100 % |
| Kritično | rok u sljedećih 7 dana i napretak < 100 % |

**Kartice:**
1. **Aktivnosti ovog tjedna** — unosi dnevnika sa statusom, ugovorom, opisom, detaljima
   problema i napomenama;
2. **Status podugovaratelja** — po ugovoru traka isplaćenosti, rok (narančasto ≤ 7 dana,
   crveno ako kasni) i zadnja aktivnost;
3. **Problemi i upozorenja** — zakašnjeli, kritični rokovi, bez aktivnosti ovaj tjedan, ili
   „Sve je u redu!".

### 13.5 Investicijski dashboard (profil Funding)

| Pokazatelj | Formula |
|---|---|
| Vrijednost portfelja | Σ budžeta projekata |
| Ukupne kreditne linije | Σ iznosa kredita |
| Iskorišteno | Σ `used_amount` |
| Vraćeno | Σ `repaid_amount` |
| Neplaćeni dug | max(0, iskorišteno − vraćeno) |
| Dostupno | max(0, linije − iskorišteno) |
| Iskorištenost | iskorišteno / linije × 100 |
| Prosječna kamata | Σ(stopa × iznos) / Σ iznosa |
| Nadolazeća dospijeća | krediti s dospijećem u 0–90 dana |

**Sekcije:** sažetak (četiri kartice), pregled investicija, partneri (investitori, aktivne
investicije, firme, dospijeća), kritična upozorenja (dospijeća i istek razdoblja korištenja u
90 dana), nedavne aktivnosti (novi krediti, dospijeća, istek korištenja) i **tablica
kredita** (iznos, iskorišteno, vraćeno, dostupno, preostali dug, kamata, datumi s brojem
dana, traka iskorištenosti ≥ 90 % crveno, ≥ 70 % narančasto; oznake „uskoro dospijeva" i
„ističe korištenje").

**Izvoz u PDF** (`izvjestaj-investicije-GGGG-MM-DD.pdf`): sažetak, KPI uvidi (linije, aktivni
krediti, prosječna kamata, dospijeća, krediti s iskorištenošću ≥ 80 %), kružni graf raspodjele
po projektu, graf alokacija po projektu, detalji svakog kredita s namjenama, projekti
portfelja.

---

## 14. Izvještaji

Izvještaji se generiraju u pregledniku iz živih podataka — bez poslužitelja za izvještaje.
Izvozi su uvijek na hrvatskom, s ugrađenim fontom Noto Sans, a svaki izvoz upisuje se u
dnevnik aktivnosti.

**Pregled izvoza u sustavu:**

| Izvoz | Format | Gdje |
|---|---|---|
| Opći izvještaj (portfelj) | PDF | `/general-reports` |
| Izvještaj prodaje projekta | PDF | `/sales-reports` |
| Izvještaj o kupcima | PDF | `/sales-reports` |
| Investicijski izvještaj | PDF | Investicijski dashboard |
| Stanje duga | PDF i Excel | `/debt-status` |
| TIC | PDF i Excel | `/tic` |
| Uplate kupaca | Excel | `/sales-payments` |
| Plaćanja financiranja | Excel | `/funding-payments` |
| Računi podizvođača | Excel | `/invoices` |
| Plaćanja podizvođačima | Excel | `/payments` |
| Dokumenti AI asistenta | PDF, Excel, Markdown | AI asistent |

### 14.1 Opći izvještaj (`/general-reports`, samo Director)

Sveobuhvatni izvještaj za upravu i banke za **sve projekte**, s novčanim tokom za zadnjih šest
mjeseci. Objedinjuje podatke iz više od dvadeset tablica. Ako bilo koje čitanje ne uspije, izvještaj se ne
prikazuje djelomično nego nudi ponovni pokušaj.

**Sekcije na ekranu:**

1. **Sažetak za upravu** — portfelj (ukupno, aktivni, završeni projekti), financije (prihod,
   rashodi, dobit, marža), struktura kapitala, prodaja, gradnja.
2. **KPI:**

| KPI | Formula |
|---|---|
| Vrijednost portfelja | Σ ukupnih iznosa TIC-ova |
| Ukupni prihod | Σ cijena prodanih stanova |
| Neto profit | prihod − plaćeni ulazni računi dobavljača i uredski računi |
| ROI | profit / kapital × 100 |
| Stopa prodaje | prodani / svi stanovi |
| Omjer D/K | dug / kapital |
| Aktivni projekti | projekti u statusu „U tijeku" |
| Ukupno kupaca | broj kupaca |

3. **Prodaja** — stanovi po statusu, prihod, prosječna cijena, broj prodaja, kupci, aktivni
   potencijalni kupci, konverzija (kupci / svi × 100).
4. **Struktura financiranja** — kapital, dug, D/K, kreditne linije, broj financijera i banaka,
   broj kredita, prosječna kamata, mjesečni servis duga.
5. **Status gradnje** — ugovori (ukupno, aktivni, završeni), vrijednost ugovora, realizirano i
   iskorištenost, podizvođači, faze (ukupno i završene), dnevnici rada, milestoneovi.
6. **Računovodstvo** — računi (broj i iznos), plaćeni, na čekanju, zakašnjeli, postotak
   plaćenosti.
7. **Uredski troškovi** — broj uredskih dobavljača, broj, iznos i prosjek uredskih računa.
8. **Investicije firmi** — krediti, iznos, dostupno, iskorišteno, cesijska plaćanja iz
   kredita, namjene.
9. **Žiro računi** — broj, ukupno stanje, računi s pozitivnim i negativnim stanjem.
10. **Zgrade i jedinice** — zgrade, stanovi po statusu, garaže, spremišta.
11. **Vrste ugovora** — broj ugovora po kategoriji.
12. **Novčani tok po mjesecima** — priljev (plaćanja svih izlaznih računa), odljev (plaćanja
    svih ulaznih računa, uključujući otplate i troškove kredita), neto, s ukupnim retkom.
13. **Projekti** — po projektu: vrsta, status, **razina rizika**, budžet (TIC ili „Budžet nije
    postavljen"), prihod (stanovi s garažama i spremištima), rashodi, prodane jedinice,
    ugovori, faze, kapital i dug.

| Rizik | Pravilo |
|---|---|
| Visok | stopa prodaje < 20 % ili negativna marža |
| Srednji | stopa prodaje < 50 % ili marža < 15 % |
| Nizak | ostalo |

14. **Procjena rizika** — „SPORA PRODAJA": projekti sa stopom prodaje ispod 40 %.
15. **Uvidi** — tri projekta s najvećim prihodom i preporuke (marketing ako je stopa prodaje
    < 50 %, zalihe ako je dostupnih više od prodanih, te uvijek praćenje budžeta i partnera).

**PDF** (`izvjestaj-portfelj-GGGG-MM-DD.pdf`): naslovnica, sažetak i KPI, stranica analitike
(struktura kapitala, status jedinica, neto novčani tok, projekti po prihodu), prodaja s
trakama napretka, financijska struktura, gradnja, računi i plaćanja s grafom statusa, **TIC —
upravljanje troškovima** (planirana investicija, projekti s TIC-om i bez njega), uredski
troškovi, investicije, žiro računi, vrste ugovora, trend novčanog toka, portfelj s maržom po
projektu, procjena rizika i preporuke. Podnožje s brojem stranice.

### 14.2 Prodajni izvještaji (`/sales-reports`)

**Postavke:** vrsta izvještaja (prodaja projekta / kupci), projekt, razdoblje (zadano zadnjih
6 mjeseci).

**A. Izvještaj prodaje projekta:**
- pregled projekta: lokacija, datum početka, budžet, izvori financiranja (banke iz kredita i
  namjena);
- jedinice (stanovi): ukupno, prodano, dostupno, rezervirano, stopa prodaje;
- **prihod** = Σ prodaja u razdoblju (prodajna cijena + cijene povezanih garaža i spremišta);
- prosječna cijena paketa;
- mjesečni pregled: broj prodaja, prihod, prosjek;
- ocjena: „Odlično" (> 70 %), „Dobro" (> 50 %), „Treba poboljšanje";
- preporuke: marketing (< 50 %), konverzija (dostupno > prodano), rezervacije, analiza.

**B. Izvještaj o kupcima:** ukupno kupaca, kupci / zainteresirani / potencijalni, prihod i
prosječna kupnja u razdoblju, stopa konverzije, prilike.

**PDF:** `izvjestaj-prodaja-GGGG-MM-DD.pdf` (pregled, mjesečni trend, popis svih stanova s
brojem, katom, m², cijenom, statusom i kupcem) i `izvjestaj-kupci-GGGG-MM-DD.pdf` (pregled i
popis kupaca s kontaktima i statusom).

### 14.3 Ostali izvozi

- **Investicijski izvještaj** — 13.5.
- **Stanje duga** — 10.12.
- **TIC** — 12.9.
- **Excel izvozi** popisa (uplate kupaca, plaćanja financiranja, računi i plaćanja
  podizvođača) — pravi `.xlsx` s numeričkim iznosima (`#,##0.00 €`) i datumskim ćelijama.

---

## 15. Dokumenti i AI sortiranje e-mailova

### 15.1 Namjena

Središnji preglednik svih dokumenata firme (ugovori, računi, dozvole, izvodi…) organiziranih u
hijerarhijsko stablo kategorija i povezanih s poslovnim entitetima. Dokumenti stižu na dva
načina: ručnim učitavanjem u aplikaciji i **automatski iz e-maila** — zaposlenik proslijedi
dokument na namjensku adresu, a AI ga pročita, razvrsta i poveže.

Ruta: `/documents`, u izborniku svakog profila i u sažetom izborniku uloge Supervision. Nema
ograničenja po ulozi.

### 15.2 Podatkovni model

**`document_categories`** — hijerarhija kategorija:
`id`, `code`, `name_hr`, `parent_id`, `path` (npr. `PRAVNO/KUPOPRODAJNI_UGOVORI`),
`display_order`, `required_associations` (jsonb — koje veze kategorija obavezno traži),
`is_active`. Primjeri korijenskih kodova: `PRAVNO`, `PRODAJA`, `FINANCIJE`.

**`documents`**:

| Stupac | Opis |
|---|---|
| `file_path`, `file_name`, `file_size`, `mime_type` | datoteka u bucketu |
| `category_id` | kategorija; `NULL` = nekategorizirano |
| `source` | CHECK: `app_upload`, `legacy_subcontractor`, `accounting_sync`, `filesystem_scan`, `email_import` |
| `description` | opis; kod e-mail uvoza obrazloženje klasifikacije koje je napisao AI |
| `uploaded_by` | auth id korisnika; `NULL` za e-mail uvoz |
| `uploaded_at` | vrijeme učitavanja |
| `search_text` | tsvector za pretraživanje |
| `content_hash` | SHA-256 sadržaja (detekcija duplikata) |

**`document_associations`** — veze dokumenta s entitetima: `document_id`, `entity_type`,
`entity_id`. `entity_type` CHECK: `project`, `phase`, `subcontractor`, `contract`, `unit`,
`customer`, `credit`, `company`.

### 15.3 RPC funkcije

- `search_documents(...)` — filtri: popis kategorija, projekt (preko veze), tip i id entiteta,
  naziv datoteke (ILIKE), raspon datuma učitavanja, limit/offset. Vraća retke s ugrađenom
  kategorijom i vezama.
- `get_document_category_counts(filtri…)` — broj dokumenata po kategoriji uz iste filtre;
  dokumenti bez kategorije broje se kao **Nekategorizirano**.
- `replace_document_associations(p_document_id, p_associations jsonb)` — atomarna zamjena veza.

### 15.4 Korisničko sučelje

- **Lijeva traka:** stablo kategorija sa zbrojenim brojevima (uključuju potkategorije), „Svi
  dokumenti" s ukupnim brojem i brojač nekategoriziranih. Odabir kategorije filtrira nju i sve
  njezine potomke.
- **Traka filtara:** pretraga po nazivu (s odgodom), projekt, podizvođač, datum učitavanja
  od–do, „Očisti filtre".
- **Tablica:** naziv, putanja kategorije, oznake projekata, vrijeme učitavanja. Akcije:
  **Otvori** (potpisani URL, bucket se bira prema `source`) i **Obriši** (uz potvrdu).
  Proširivi redak prikazuje opis, veze i veličinu. 100 dokumenata po stranici.
- **Učitavanje (`DocumentUploadModal`):**
  - više datoteka odjednom, drag & drop; duplikati (isti naziv i veličina) se izbacuju;
    datoteke veće od 50 MB se odbijaju;
  - **kategorija je obavezna**;
  - polja za veze prikazuju se ovisno o kategoriji: veze iz `required_associations` su
    obavezne; projekt se nudi uvijek; stan i kupac pod `PRODAJA`; kredit pod `FINANCIJE`;
    podizvođač („prodavatelj") pod `PRAVNO/KUPOPRODAJNI_UGOVORI`; ugovor nakon odabira
    podizvođača;
  - opcionalni opis;
  - datoteke se učitavaju redom; pri grešci učitavanje staje, a već učitane ostaju spremljene;
  - putanja u bucketu: `{uuid}/{očišćeni_naziv}`;
  - ako upis retka ne uspije, datoteka se briše iz bucketa; ako ne uspije upis veza, brišu se i
    redak i datoteka.
- Isti modal koristi se iz drugih modula sa zaključanim ili unaprijed postavljenim vezama
  (npr. dokumenti ugovora u upravljanju gradilištem).

Dnevnik aktivnosti: `document.upload` (medium), `document.update` (medium),
`document.delete` (high).

### 15.5 AI sortiranje e-mailova

**Tijek:**

```
Mailbox documents@…  →  Make.com scenarij  →  edge funkcija sort-document  →  Claude  →  Storage + baza
```

**Make.com scenarij:**
1. prati INBOX namjenskog mailboxa (serije od ~5 poruka, označava ih pročitanima);
2. iterira kroz privitke;
3. filtrira po MIME tipu;
4. za svaki privitak šalje HTTP POST (timeout 120 s, greška ne zaustavlja scenarij) sa
   zaglavljima `x-doc-sort-secret` i `apikey`, i tijelom
   `{email_subject, email_body, email_from, email_message_id, attachment: {file_name, mime_type, data_base64}}`.

**Podržani formati:**

| Format | Obrada |
|---|---|
| PDF | šalje se Claudeu kao dokument |
| PNG, JPEG, WEBP | šalje se Claudeu kao slika |
| XML (e-Račun/UBL), TXT, CSV | izvlači se tekst |
| DOCX | tekst se izvlači (mammoth) |
| XLSX, XLS | prvi list pretvara se u CSV |
| Stari DOC | sprema se, ali se ne čita — klasifikacija samo iz e-maila i naziva datoteke |
| `application/octet-stream` | tip se određuje po ekstenziji; nepoznata ekstenzija → 415 |

Izvučeni tekst ograničen je na 50.000 znakova (uz oznaku `[skraćeno]`). Ako izvlačenje ne
uspije, dokument se svejedno uvozi, a klasifikacija se radi iz metapodataka.

**Obrada zahtjeva:**
1. provjera metode, tajne (401 pri pogrešnoj), JSON-a i obaveznih polja (400);
2. provjera tipa (415), base64 sadržaja (400) i veličine (413 iznad 50 MB);
3. **provjera duplikata** po SHA-256 hashu — duplikat vraća
   `200 {document_id, duplicate: true}` bez poziva AI-a;
4. izvlačenje teksta;
5. klasifikacija (vidi niže); greška modela → 502 `classification_failed`;
6. učitavanje u `documents/{uuid}/{naziv}`;
7. upis retka (`source = 'email_import'`, `uploaded_by = NULL`, `content_hash`,
   `description` = obrazloženje AI-a);
8. upis veza; svaka greška vraća sve natrag (datoteku i redak).

Uspjeh: `200 {document_id, duplicate: false, category_id, confidence, associations_count}`.

**Klasifikacija u tri prolaza:**

1. **Kategorija** — jedan poziv Claudea s prisilnim alatom `classify_document`: model dobiva
   cijelo aktivno stablo kategorija s UUID-ovima te predmet i tijelo e-maila, a vraća
   `category_id` (ili null), `confidence` (0–1), opis na hrvatskom i `entity_hints` (tip
   entiteta + pojmovi za pretragu).
2. **Entiteti** — uparivanje u kodu: normalizacija (mala slova, bez dijakritika, `đ`→`d`) i
   traženje podniza u kandidatima iz baze (do 10.000 redaka po vrsti): projekti (naziv,
   lokacija, aliasi), faze, podizvođači, firme (naziv, OIB), ugovori (broj, opis posla), kupci,
   krediti, stanovi, garaže i spremišta. Jedan pogodak → veza; više pogodaka → dodatni kratki
   poziv `pick_entity` nad najviše 10 kandidata; nijedan → nema veze. Zaštita odbacuje
   izmišljene id-eve.
3. **Projekt** — ako projekt nije pronađen, `pick_entity` nad svim projektima bira
   najvjerojatniji ili nijedan.

**Red za ljudsku provjeru:** ako je pouzdanost ispod **0,6** ili kategorija nije valjana,
dokument se sprema bez kategorije (`category_id = NULL`) i pojavljuje se među
nekategoriziranima; pronađene veze se ipak upisuju. Ništa se ne gubi pogrešnim spremanjem.

Model: `DOC_SORT_MODEL` (zadano `claude-sonnet-4-6`). Sistemski prompt i alat koriste prompt
caching.

---

## 16. AI asistent

### 16.1 Namjena

Plutajući chat asistent dostupan na svakoj stranici (osim `/chat`) za sve uloge. Korisnik
postavlja pitanja o projektima, ugovorima, podizvođačima, računima i plaćanjima običnim
jezikom, a asistent odgovara iz živih podataka, pretražuje pomoć za korištenje aplikacije i na
zahtjev izrađuje dokumente za preuzimanje (PDF, Excel, Markdown). **Asistent podatke samo
čita** — ne može ništa mijenjati.

### 16.2 Arhitektura

- Frontend: `src/components/AiChat/` (Provider, Widget, Trigger, Panel, Header, Input,
  MessageList, Message, kartice dokumenata, `documentGenerator.ts`, servisi).
- Backend: edge funkcija `supabase/functions/ai-chat` (`verify_jwt = true`) i zajednički
  moduli u `_shared/` (`auth`, `tools`, `tool-handlers`, `prompts`, `rateLimit`,
  `context-window`, `help-search`, `help-score`, `routeLabels`).
- Model: `AI_CHAT_MODEL` (zadano `claude-sonnet-4-6`); model za sažimanje konteksta
  `AI_CHAT_SUMMARY_MODEL`.

| Postavka | Vrijednost |
|---|---|
| max_tokens po odgovoru | 8192 |
| najveća duljina poruke | 4.000 znakova |
| timeout zahtjeva | 90 s |
| najviše iteracija alata po odgovoru | 10 |
| timeout pojedinog alata | 15 s |
| keepalive | svakih 15 s |

### 16.3 Komunikacija (SSE)

Klijent šalje POST (`session_id`, `message`, `parent_message_id`, `edit_message_id`,
`current_route`, `proposed_session_id`, `attachments[]`) i čita tok događaja preko
`fetch` + ReadableStream. Događaji:

- `session {session_id}`
- `turn {role: 'assistant', text}`
- `tool_call {tool, input, tool_use_id}`
- `tool_result {tool, output, tool_use_id, is_error}`
- `done {stop_reason, usage}`
- `error {code, message}`

Trenutna ruta korisnika pretvara se u čitljiv naziv stranice i dodaje uz poruku kao kontekst
(`[Kontekst: korisnik je trenutno na …]`), pa asistent zna gdje se korisnik nalazi.

**Prekid:** gumb za zaustavljanje upisuje `ai_sessions.cancel_requested_at`; petlja to
provjerava na granici svake iteracije i nakon svakog alata.

Kodovi grešaka: `model_rate_limited`, `model_timeout`, `model_unreachable`,
`model_bad_request`, `model_auth_failed`, `model_error`, `persistence_error`,
`request_timeout`, `internal_error`; prije toka HTTP 429 `rate_limited` i 400
(`too_many_attachments`, `invalid_attachment*`, `unsupported_attachment_type`,
`edit_with_attachments_unsupported`, `invalid_request`).

### 16.4 Alati

Asistent ima **15 alata**. Čitanja idu preko korisnikovog JWT-a, pa vrijede RLS pravila.
Popis alata filtrira se prema ulozi i ponovno provjerava pri izvršavanju.

| # | Alat | Uloge | Što radi |
|---|---|---|---|
| 1 | `search_projects` | sve | traži projekte po nazivu; ako ništa ne nađe, ponavlja s hrvatskim korijenom riječi |
| 2 | `get_project_details` | sve | puni zapis projekta i broj faza, ugovora i milestoneova |
| 3 | `list_project_phases` | sve | faze projekta s datumima, statusom i alociranim budžetom |
| 4 | `search_subcontractors` | sve | traži podizvođače; vraća kontakt i broj aktivnih ugovora |
| 5 | `list_cost_classifications` | sve | klasifikacije troškova |
| 6 | `list_contracts` | sve | ugovori s filtrima (projekt, faza, klasifikacija, podizvođač, status `draft`/`active`/`completed`/`terminated`); Supervision samo za dodijeljene projekte |
| 7 | `get_subcontractor_payment_status` | Director, Accounting | ugovoreno, fakturirano, plaćeno i preostalo po podizvođaču |
| 8 | `list_unpaid_invoices` | Director, Accounting, Supervision | neplaćeni i djelomično plaćeni računi po podizvođaču ili projektu |
| 9 | `list_payments_for_subcontractor` | Director, Accounting | plaćanja podizvođaču (datum, iznos, način, cesija, broj računa) |
| 10 | `get_invoice_summary` | Director, Accounting | sažetak računa preko `get_invoice_statistics` (broj, neplaćeni zbroj) |
| 11 | `get_project_financial_summary` | Director, Accounting | budžet (iz TIC-a), ugovoreno, realizirano, fakturirano, neplaćeno, preostalo za ugovaranje i trošenje, prekoračenje |
| 12 | `search_help` | sve | pretraga baze znanja pomoći (top 5 članaka) |
| 13 | `list_documents_for_entity` | sve | dokumenti vezani uz entitet (projekt, faza, podizvođač, ugovor, stan, kupac, kredit, firma) uz provjeru pristupa |
| 14 | `get_document_download_link` | sve | podaci za preuzimanje spremljenog dokumenta; preglednik potpisuje URL tek na klik |
| 15 | `create_document` | sve | izrađuje dokument za preuzimanje: PDF, Excel ili Markdown |

**Izrada dokumenata:** `create_document` ne čita podatke — provjerava specifikaciju (naslov do
200 znakova; markdown do 50.000 znakova ili do 10 listova, svaki do 50 stupaca i 5.000 redaka;
ukupno do 60 KB). Specifikacija ostaje u povijesti razgovora, a datoteku gradi preglednik na
klik „Preuzmi": PDF preko jsPDF-a (NotoSans), Excel preko `@e965/xlsx`, Markdown kao običnu
datoteku.

### 16.5 Pravila ponašanja i jezik

- Asistent je strogo **read-only**. Zahtjeve za izmjenom odbija standardnom rečenicom:
  „Trenutno mogu samo odgovarati na pitanja o postojećim podacima — promjene podataka nisu
  podržane u ovoj verziji."
- Za podatke izvan korisnikove uloge: „Pristup ovim podacima zahtijeva ulogu Director ili
  Accounting."
- **Uvijek odgovara na hrvatskom**, bez obzira na jezik pitanja i sučelja — namjerno, jer
  miješanje zapisa brojeva u financijama (zarez i točka) može promijeniti iznos 100 puta.
  Formati: `1.234,56 EUR`, `dd.MM.yyyy.`
- Sistemski prompt (na hrvatskom) sadrži: identitet, opis alata, pravila izrade dokumenata,
  pomoć i navigaciju, privitke, ono što je izvan opsega, zamke podatkovnog modela (faze ≠
  milestoneovi, faza ≠ klasifikacija troška, TIC je jedini planirani budžet i sl.), domenske
  oznake (cesija, ugovor bez ugovora), ton (bez uvoda, bez poslovnih prosudbi). Drugi dio
  prompta je kontekst korisnika (e-mail, uloga, ograničenje za Supervision).
- Podaci modula Retail izvan su opsega asistenta.

### 16.6 Povijest razgovora

| Tablica | Ključna polja |
|---|---|
| `ai_sessions` | `user_id`, `title` (prvih 60 znakova prve poruke), `cancel_requested_at`, `context_summary`, `summary_through_message_id` |
| `ai_messages` | `session_id`, `role` (`user`/`assistant`), `content` (jsonb blokovi), `model`, `input_tokens`, `output_tokens`, `stop_reason`, `parent_id` |
| `ai_message_attachments` | `message_id`, `storage_path`, `file_name`, `file_size`, `mime_type`, `kind` (`image`/`pdf`/`text`), `extracted_text` |
| `ai_help_searches` | zapis svake pretrage pomoći (vidljivo samo direktoru) |

Razgovor je **stablo** (`parent_id`): uređivanje poruke ili ponovno generiranje odgovora stvara
novu granu, a strelice ‹ N/M › prebacuju između verzija. Aktivna grana je najnoviji list. RLS:
svaki korisnik vidi samo svoje razgovore.

### 16.7 Privitci

Najviše **4 privitka po poruci**; provjeravaju se i MIME tip i ekstenzija.

| Vrsta | Ograničenje | Tipovi |
|---|---|---|
| Slika | 5 MB | png, jpg/jpeg, webp |
| PDF | 10 MB | pdf |
| Tekst | 2 MB | txt, csv, xls, xlsx |

Tekst se izvlači u pregledniku (Excel: prvi list kao CSV, do 50 KB). Slike i PDF-ovi šalju se
modelu kao multimodalni blokovi. Bucket `ai-chat-attachments`, putanja
`{auth_user_id}/{session_id}/{uuid}.{ext}`. Pri uređivanju poruke privitci se ne prenose.

### 16.8 Kontekstni prozor

- Iznad ~60.000 procijenjenih tokena starija povijest sažima se u
  `ai_sessions.context_summary`; doslovno se zadržava najnovijih ~20.000 tokena.
- Base64 slike i PDF-ovi zamjenjuju se oznakama osim u zadnjih 6 poruka.
- Tvrda granica 130.000 tokena (reže se po cijelim izmjenama).
- Prompt caching na sistemskom promptu, alatima i zadnjoj poruci.

### 16.9 Ograničenje učestalosti

Po korisniku: **20 poruka u 5 minuta** i **200 poruka u 24 sata**. Prekoračenje vraća 429 s
porukom na hrvatskom.

### 16.10 Baza znanja pomoći

Članci u `help-kb/*.md` (frontmatter: id, naslov, ključne riječi, rute, uloge) pretvaraju se
naredbom `npm run kb:build` u `help-kb-index.json`. Pretraga je leksička (BM25): uklanjanje
dijakritika i zaustavnih riječi, korjenovanje na 6 znakova, težine naslov ×3, ključne riječi
×3, tijelo ×1, bonus za doslovno podudaranje; prag 0,12, +0,05 za članke vezane uz trenutnu
rutu, −0,10 za članke druge uloge; vraća do 5 članaka.

### 16.11 Korisničko sučelje

- Plutajući gumb otvara panel; datoteke se mogu povući na panel.
- Izbornik „Razgovori": popis razgovora, „Novi razgovor", „Preimenuj", „Obriši".
- Polje „Pošaljite poruku…": Enter šalje, Shift+Enter novi red, spajalica za privitke, gumb
  za zaustavljanje.
- Poruke: uređivanje korisničke poruke, „Generiraj ponovno" za zadnji odgovor, strelice za
  verzije, oznake alata (u tijeku / gotovo / greška), kartice za preuzimanje dokumenata.
- Dnevnik aktivnosti: `ai_session.update` (preimenovanje, medium), `ai_session.delete` (high).

---

## 17. Zadaci

### 17.1 Namjena

Jednostavna, zajednička lista zadataka cijele organizacije, grupirana po projektima.
Pojednostavljena je u srpnju 2026. na zahtjev direktora: status je samo otvoreno/riješeno.
**Shemu dijeli sa zasebnom mobilnom aplikacijom za zadatke** koja radi nad istom bazom; ovaj
repozitorij je vlasnik sheme, a ugovori obiju aplikacija opisani su u
[`SHARED_SCHEMA.md`](./SHARED_SCHEMA.md).

Ruta: `/tasks` (ikona u zaglavlju, za sve uloge).

### 17.2 Vidljivost

- Svaki prijavljeni korisnik vidi **sve zadatke koji nisu privatni**.
- Privatni zadatak vidi samo autor (koji mu je i jedini zaduženi).
- Uređivati smiju autor i zaduženi; brisati samo autor (u mobilnoj aplikaciji i admin).

### 17.3 Podatkovni model

Svi korisnički stupci u tablicama zadataka sadrže **auth id** (`auth.users.id`) s vezom na
`public.profiles`, a ne `public.users.id`.

| Tablica | Ključna polja |
|---|---|
| `tasks` | `title`, `description`, `created_by`, `deadline` (datum), `is_private`, `completed`, `completed_at`, `project_id`, `color` (`blue`, `green`, `yellow`, `red`, `purple`, `gray` ili NULL), `description_format` (`plain`/`markdown`), `created_at`, `updated_at` |
| `task_assignees` | `(task_id, assignee_id)`, `acknowledged_at` (NULL = nepročitano) |
| `task_subtasks` | `task_id`, `title`, `position`, `completed`, `completed_at` |
| `task_comments` | `task_id`, `user_id`, `comment` |
| `task_attachments` | `task_id`, `uploaded_by`, `storage_path`, `file_name`, `mime_type`, `size_bytes` |
| `task_reminders` | `(task_id, kind, sent_on)`; `kind`: `day_before`, `due_today`, `overdue` |
| `push_subscriptions` | `endpoint`, `user_id`, `p256dh`, `auth`, `user_agent` |

**Trigger `task_subtasks_sync_parent`:** kad su sve stavke kontrolne liste riješene, zadatak se
automatski označava riješenim; kad je bilo koja otvorena, zadatak se ponovno otvara.

**RPC za mobilnu aplikaciju** (nazivi i redoslijed argumenata su zamrznuti ugovor):
`create_task_with_assignees(...)` (traži barem jednog zaduženog) i
`update_task_with_assignees(...)` (samo autor ili admin; usklađuje zadužene i stavke bez
gubitka statusa pročitanosti i riješenosti).

### 17.4 Korisničko sučelje

**Lista (`/tasks`):**
- kartice **Svi** (zadano), **Dodijeljeni meni**, **Moji**, **Privatni**, s brojačima;
- pretraga, prekidač „Prikaži riješene" (zadano uključen) i „Označi sve pročitanim";
- zadaci su **uvijek grupirani po projektu** (abecedno, „bez projekta" na kraju); grupe se
  sklapaju, prikazuju broj zadataka i crvenu oznaku „N kasni";
- unutar grupe: otvoreni po roku (bez roka na kraju), zatim riješeni po datumu rješavanja;
- **brzi unos** u svakoj grupi: naslov + Enter stvara zadatak u tom projektu;
- iznad 100 redaka lista se virtualizira.

**Redak zadatka:** kvačica (onemogućena za čitatelje i za kontrolne liste, uz prikaz „3/6"),
naslov, plava točka za nepročitano, lokot za privatno, obojena kartica prema boji zadatka,
crveni rub i relativni rok za zakašnjele, broj privitaka i komentara, avatari zaduženih,
brisanje za autora.

**Novi zadatak:** naslov, projekt, rok, boja, privatno, zaduženi (skriveno za privatne), opis,
stavke kontrolne liste. Ctrl+Enter sprema.

**Detalji (bočna ladica, automatsko spremanje):** naslov, projekt, rok, boja, privatnost,
zaduženi, kontrolna lista (kvačica, preimenovanje, premještanje, brisanje, dodavanje), opis,
privitci (drag & drop, do 25 MB i 10 datoteka), komentari s **@spominjanjem**
(`@[ime](uuid)`), brisanje zadatka.

**Nepročitano:** zadatak je nepročitan dok `acknowledged_at` zaduženog nije postavljen;
čisti se otvaranjem zadatka ili „Označi sve pročitanim". Brojač u zaglavlju osvježava se
svakih 20 s. Promjene stižu uživo (Realtime).

Dnevnik aktivnosti: `task.create`, `task.update`, `task.status_change`, `task.delete`,
`task.assign`, `task.unassign`, `task.comment`, `task.comment_delete`,
`task.attachment_add`, `task.attachment_remove`, `task.subtask_add`,
`task.subtask_toggle`, `task.subtask_rename`, `task.subtask_reorder`,
`task.subtask_delete`, `task.acknowledge`, `task.acknowledge_all`.

---

## 18. Kalendar

### 18.1 Namjena

Kalendar događaja s pozivnicama i potvrdama dolaska (RSVP), ponavljajućim događajima i
prikazom vlastitih rokova zadataka. Ruta: `/calendar` (ikona u zaglavlju). Kalendar
dospijeća plaćanja u profilu Cashflow zaseban je modul (poglavlje 10).

### 18.2 Podatkovni model

Korisnički stupci ovdje sadrže `public.users.id`.

| Tablica | Ključna polja |
|---|---|
| `calendar_events` | `title`, `description`, `location`, `created_by`, `start_at`, `end_at` (> start), `event_type` (`meeting`, `personal`, `deadline`, `reminder`), `is_private`, `project_id`, `recurrence` (RRULE, RFC 5545), `reminder_offsets` (minute), `busy` |
| `calendar_event_participants` | `event_id`, `user_id`, `response` (`pending`, `accepted`, `declined`) — odgovor za cijelu seriju |
| `calendar_event_exceptions` | `(event_id, original_start_at)`, `override_start_at`, `override_end_at`, `override_title`, `is_cancelled` |
| `calendar_occurrence_responses` | odgovor za pojedino ponavljanje; ima prednost pred odgovorom za seriju |
| `calendar_notifications` | obavijesti o podsjetnicima po korisniku |
| `calendar_reminder_sends` | evidencija poslanih podsjetnika (sprječava dvostruko slanje) |

**Vidljivost:** događaj vide samo autor i pozvani sudionici. Uređuje i briše samo autor;
sudionik mijenja samo svoj odgovor.

`get_busy_blocks(p_user_ids, p_from, p_to)` vraća zauzete termine odabranih korisnika za
prikaz ukupno zauzetih sati tima.

### 18.3 Prikazi i akcije

- **Prikazi:** dan, tjedan, mjesec, agenda (sljedećih 30 dana); prethodno/sljedeće/danas.
  Odabrani prikaz i filtri pamte se po korisniku.
- **Mjesec:** mreža 6×7, višednevni događaji kao trake, „+N više" otvara popis dana; klik na
  prazno polje stvara događaj 09:00–10:00.
- **Tjedan i dan:** vremenska os s preklapanjima, oznakom trenutnog vremena i trakom
  „Zadaci"; povlačenjem se označava termin novog događaja.
- **Filtri:** vrste događaja, projekt, sudionici, pretraga.
- **Novi/uredi događaj:** naslov, opis, lokacija, početak/kraj, vrsta, privatno,
  zauzeto/slobodno, projekt, sudionici, ponavljanje (nijedno, dnevno, tjedno, mjesečno,
  godišnje, prilagođeno; kraj: nikad, na datum, nakon N ponavljanja). Kod ponavljajuće serije
  datum, vrijeme i pravilo nakon kreiranja su samo za čitanje.
- **Detalji događaja:** pozvani odgovaraju prihvaćam/odbijam za pojedino ponavljanje ili za
  cijelu seriju; autor uređuje ili briše — kod serije može obrisati jedno ponavljanje ili
  cijelu seriju.
- **Bočna traka:** mini-mjesec s oznakama zauzetih dana, „Sljedeće" (događaji i zadaci s
  rokom u 24 h), „Čeka odgovor" (pozivi na čekanju u 30 dana, s prihvaćanjem/odbijanjem na
  licu mjesta), kalendari tima.
- **Zadaci u kalendaru:** prekidač „Prikaži zadatke" prikazuje zadatke koje je korisnik
  stvorio ili su mu dodijeljeni, prema roku; kvačica mijenja status, klik otvara detalje
  zadatka.
- **Boje:** sastanak plavo, osobno sivo, rok crveno, podsjetnik jantarno.
- **Brojač u zaglavlju:** pozivi na čekanju u sljedećih 30 dana.
- Ponavljanja se razvijaju u pregledniku (`rrule`); promjene stižu uživo.

**Podsjetnici (isključeni):** obrazac događaja nema polje za podsjetnike. Pozadina postoji, ali je
isključena: stupac `reminder_offsets`, edge funkcija `dispatch-calendar-reminders` (pregledava
događaje u sljedećih 48 h, razvija ponavljanja i upisuje obavijesti; isključena u `config.toml` i
nije zakazana) te tablice `calendar_notifications` / `calendar_reminder_sends`.

Dnevnik aktivnosti: `calendar_event.create`, `calendar_event.update`,
`calendar_event.respond`, `calendar_event.delete`, `calendar_event.exception_create`,
`calendar_event.exception_delete`.

---

## 19. Chat

### 19.1 Namjena

Razgovori među korisnicima: 1-na-1 i grupni, s privicima i oznakom nepročitanih poruka u
stvarnom vremenu. Ruta: `/chat` (ikona u zaglavlju).

### 19.2 Podatkovni model

- `chat_conversations` — `name`, `is_group`, `created_by`
- `chat_participants` — `conversation_id`, `user_id`, `joined_at`, `last_read_at`
- `chat_messages` — `conversation_id`, `sender_id`, `content`, `file_url`, `file_name`,
  `file_size`, `file_type`, `created_at`

Poruke vide samo sudionici razgovora. RPC `get_chat_conversation_summaries()` vraća sve
razgovore korisnika sa zadnjom porukom i brojem nepročitanih.

### 19.3 Korisničko sučelje

- Dva okna: popis razgovora i poruke (na mobitelu se izmjenjuju).
- **Novi razgovor:** odabir korisnika i opcionalni naziv grupe. Razgovor 1-na-1 ponovno
  koristi postojeći; grupni je uvijek novi.
- **Popis:** zadnja poruka, broj nepročitanih, pretraga, relativno vrijeme.
- **Poruke:** zaglavlje s nazivom i brojem sudionika (za grupe otvara popis članova), polje za
  unos (Enter šalje, Shift+Enter novi red), jedan privitak po poruci (do 25 MB), odvajanje po
  danima (Danas / Jučer / datum), pregled slika. Učitava se zadnjih 50 poruka.
- **Nepročitano:** otvoreni razgovor automatski se označava pročitanim; brojač u zaglavlju
  osvježava se uživo (Realtime) i dodatno svakih 60 s.

Dnevnik aktivnosti: `conversation.create`. Poruke se namjerno ne bilježe.

---

## 20. Obavijesti i push

- **Obavijesti u aplikaciji:** tri brojača u zaglavlju (nepročitane poruke, nepročitani
  zadaci, pozivi na čekanju) i toast poruke.
- **Web Push** isporučuje se na mobitele preko mobilne aplikacije za zadatke; Cognilion
  obavijesti šalje, a mobilna aplikacija ih prima.

### 20.1 Edge funkcija `send-push`

Zahtjev: `POST {event, taskId, newAssigneeIds?}`. Dva načina ovjere: **korisnik** (JWT;
pozivatelj mora biti zaduženi, autor ili admin) i **planer** (`x-reminder-secret`). Događaji
podsjetnika smiju doći samo od planera, a korisnički samo od korisnika.

| Događaj | Pošiljatelj | Primatelji | Sadržaj |
|---|---|---|---|
| `task_assigned` | korisnik | novi zaduženi | „Novi zadatak", naslov (+ projekt) |
| `task_completed` | korisnik | zaduženi + autor | „Zadatak završen", „{osoba} je završio: {naslov}" |
| `reminder_day_before` | planer | zaduženi | „Rok je sutra" |
| `reminder_due_today` | planer | zaduženi | „Rok je danas" |
| `reminder_overdue` | planer | zaduženi + autor | „Zadatak kasni", „{naslov} — rok: dd.MM.yyyy." |

Pozivatelj nikad ne prima vlastitu obavijest; podsjetnici se preskaču za riješene zadatke;
neaktivne pretplate brišu se pri odgovoru 404/410.

Klijent (`Tasks/services/pushNotify.ts`) obavijesti šalje bez čekanja i nikad ne ruši spremanje
zadatka: pri kreiranju zadatka i dodavanju zaduženih (`task_assigned`) te pri prelasku u
riješeno (`task_completed`).

### 20.2 Podsjetnici za rokove zadataka

Funkcija `dispatch_due_reminders()` pokreće se **svaki sat** (pg_cron posao
`deadline-reminders`, `0 * * * *`) i djeluje između 07 i 09 h po zagrebačkom vremenu. Za
neriješene zadatke s rokom od prije najviše 30 dana do sutra određuje vrstu (`overdue`,
`due_today`, `day_before`), zauzima termin upisom u `task_reminders` (bez duplikata) i poziva
`send-push` preko pg_net. Tajne su u Supabase Vaultu.

---

## 21. Dnevnik aktivnosti

### 21.1 Namjena

Središnji revizijski trag: svako kreiranje, izmjena, brisanje, skupna operacija, uvoz i izvoz
u sustavu bilježi se — tko, što, kada i nad kojim entitetom. U poslu koji okreće milijune
eura pitanje „tko je promijenio ovu cijenu i kada" mora imati odgovor.

### 21.2 Tablica `activity_logs`

| Stupac | Opis |
|---|---|
| `id` | uuid |
| `user_id` | `public.users.id` |
| `user_role` | uloga u trenutku akcije |
| `action` | naziv akcije u obliku `entitet.glagol` |
| `entity` | vrsta entiteta |
| `entity_id` | id entiteta |
| `project_id` | projekt (ON DELETE SET NULL) |
| `metadata` | jsonb, uključuje `severity` |
| `created_at` | vrijeme |

Indeksi po akciji, vremenu, projektu i korisniku. RLS: upis za sve prijavljene korisnike,
čitanje samo za direktora; izmjena i brisanje nisu dopušteni — zapisi su nepromjenjivi.

### 21.3 Pravila bilježenja

- Poziv: `logActivity({action, entity, entityId?, projectId?, metadata?, severity?})` iz
  `src/lib/activityLog.ts`. Poziv je „fire-and-forget": nikad ne baca grešku i ne blokira
  korisnikovu operaciju; pri isteku JWT-a jednom osvježava sesiju i pokušava ponovno.
- **Naziv akcije:** `entitet.glagol`, entitet u jednini prema nazivu tablice (npr.
  `invoice.create`, `apartment.bulk_price_update`, `export.tic_pdf`).
- **Razine ozbiljnosti:**
  - `low` — čitanja, povezivanja, prijave, izvozi, dnevnici rada;
  - `medium` — uobičajena kreiranja i izmjene;
  - `high` — brisanja, financijske operacije, skupne operacije, uvozi, odobravanja.
- **Metapodaci:** kreiranja `entity_name`; izmjene `changed_fields`; skupne operacije
  `count`; uvozi `filename`, `row_count`, `created_count`; izvozi `format`, `row_count`.
- Namjerno se ne bilježe: izvedeni preračuni, poruke chata, poruke AI asistenta.
- Za kreiranja se id novog zapisa dohvaća lancem `.select('id').maybeSingle()`.
- Sustav trenutno bilježi oko 140 različitih akcija; oznake su prevedene pod
  `activity_log.actions` u oba jezika.

### 21.4 Pregled dnevnika

Ruta `/activity-log`, samo za direktora (skrivena stavka izbornika, preusmjeravanje u
komponenti, RLS i provjera u RPC-u). RPC `get_activity_logs(p_user_id, p_action_prefix,
p_severity, p_search_term, p_date_from, p_date_to, p_project_id, p_offset, p_limit)` vraća
zapise s imenom korisnika, nazivom projekta i ukupnim brojem.

Sučelje: pretraga (odgoda 500 ms), filtri po korisniku, kategoriji akcije, ozbiljnosti,
projektu i razdoblju, paginacija na poslužitelju, modal s detaljima i gumb „Prikaži entitet"
koji vodi na stranicu entiteta prema mapi `ENTITY_ROUTE_MAP`
(`src/components/General/ActivityLog/types.ts`), npr.:

| Entitet | Ruta |
|---|---|
| project, milestone | `/projects` |
| invoice | `/accounting-invoices` |
| payment | `/accounting-payments` |
| company | `/accounting-companies` |
| supplier / office_supplier | `/accounting-suppliers` / `/office-suppliers` |
| bank_account | `/accounting-banks` |
| customer | `/customers` |
| apartment | `/apartments` |
| building, garage, repository | `/sales-projects` |
| sale | `/sales-payments` |
| subcontractor | `/subcontractors` |
| work_log | `/work-logs` |
| investor | `/banks` |
| bank_credit, credit_allocation | `/funding-credits` |
| contract, contract_type, cost_classification, phase_classification_budget, phase | `/site-management` |
| monthly_budget | `/accounting-calendar` |
| payment_notification, subcontractor_payment | `/funding-payments` |
| tic_cost_structures | `/tic` |
| erp_import_run | `/erp-import` |
| erp_account_map, erp_cost_center_map, erp_partner_map | `/sifrarnici` |
| conversation / calendar_event / task / document | `/chat` / `/calendar` / `/tasks` / `/documents` |

---

## 22. Lokalizacija

- Jezici: **hrvatski** (zadani i rezervni) i **engleski**. Prijevodi su u
  `src/locales/{hr,en}/translation.json` (53 imenska prostora, oko 4.700 ključeva).
- Konfiguracija (`src/i18n.ts`): `fallbackLng: 'hr'`, `supportedLngs: ['hr','en']`,
  `load: 'languageOnly'` (npr. `hr-HR` → `hr`). Redoslijed otkrivanja jezika: spremljeni
  odabir (`localStorage.i18nextLng`), zatim jezik preglednika; nepoznat jezik → hrvatski.
- Prekidač jezika u zaglavlju prikazuje „EN" / „HR".
- **Izvozi (PDF i Excel) uvijek su na hrvatskom**, bez obzira na jezik sučelja (`exportT()`).
- **Domenski pojmovi se ne prevode** — cesija, kompenzacija, stan, garaža, repozitorij, TIC,
  OIB, Šifrarnici, kategorije projekata Interno/Retail/Stambeno ostaju isti u oba jezika.
- Tekstovi koji se pojavljuju u više komponenti koriste zajedničke ključeve `common.*`.
- Statusi se u bazi spremaju na engleskom (uz CHECK ograničenja), a prevode se tek pri
  prikazu (`statusDisplay.ts`).
- Datumi: hrvatski format `dd.MM.yyyy.`, nazivi mjeseci u samostalnom obliku (`LLLL`).
- Automatski testovi provjeravaju da se u sučelju ne pojavljuju engleski nazivi mjeseci i da
  su obje datoteke prijevoda usklađene.

---

## 23. Korisničko sučelje i responzivnost

### 23.1 Zajednička biblioteka komponenti

`src/components/ui/` sadrži 30 komponenti koje se koriste u cijeloj aplikaciji (puni popis s
propsima: [`UI.md`](./UI.md)):

- **Osnovne:** Button (16 varijanti, 6 veličina, spinner dok traje akcija), Badge, Card,
  Alert, LoadingSpinner, AvatarStack, ToggleSwitch, SegmentedControl, Tabs.
- **Obrasci:** Form (sprječava dvostruko slanje), FormField (automatski povezuje oznaku i
  kontrolu, aria atributi), Input, Select, Textarea, SearchInput, SearchableSelect.
- **Dijalozi:** Modal (portal, zadržavanje fokusa, zatvaranje Escapeom samo najgornjeg
  sloja), ConfirmDialog (zamjenjuje `window.confirm`; fokus na „Odustani").
- **Podaci:** Table (ljepljivi stupci, gusti način, kartični prikaz na mobitelu), Pagination,
  StatCard, StatGrid, FilterBar, FilterChip, EntityList (prekidač kartice/tablica, sortiranje).
- **Stanja:** EmptyState, ErrorState, InlineLoadError, Toast (preko `useToast()`,
  automatski nestaje nakon ~4,5 s), MarkdownView, PageHeader.

**Pravilo stanja stranice:** učitavanje → greška u području sadržaja → zastarjeli podaci uz
upozorenje → prazno stanje. Brojka iz neuspjelog učitavanja prikazuje se kao `—`, nikad kao 0.

### 23.2 Zaštita nespremljenih izmjena

`UnsavedChangesContext`: `useUnsavedChanges(isDirty, save?)` uključuje zaštitu; dijalog nudi
„spremi i izađi" ako postoji funkcija spremanja. Sva navigacija u Layoutu prolazi kroz
`requestLeave`, a `beforeunload` pokriva osvježavanje i zatvaranje kartice.

### 23.3 Tema

Tamna i svijetla tema (`ThemeContext`); odabir se pamti u `localStorage.theme`, a zadana
vrijednost prati postavku operativnog sustava.

### 23.4 Responzivnost

- `useMediaQuery` i omotači `useIsMobile()` (< 768 px), `useIsTabletUp()` (≥ 768 px),
  `useIsDesktop()` (≥ 1024 px).
- Ispod 1024 px bočna traka postaje izbornik preko cijele širine s pozadinom i blokadom
  pomicanja; profil, jezik, tema i odjava sele se u izbornik.
- **Kartični prikaz tablica:** ispod 768 px zaglavlje tablice se skriva, a svaki redak postaje
  kartica s oznakama polja (`Td label`).
- Pomoćne klase za iOS sigurne zone (`.safe-top`, `.safe-bottom`) i veće dodirne površine
  (`.touch-target`).
- `useListPreferences` pamti odabrani prikaz i sortiranje liste po korisniku.

### 23.5 Generiranje PDF-a i Excela

- **PDF:** jsPDF u pregledniku, bez poslužitelja za izvještaje. Ugrađen je font NotoSans
  (Regular i Bold) jer standardni fontovi ne podržavaju č, ć, đ. Grafikoni u PDF-u crtaju se
  primitivama jsPDF-a. Generatori: opći izvještaj, prodajni izvještaji, investicijski
  izvještaj, stanje duga, TIC, dokumenti AI asistenta.
- **Excel:** `src/lib/xlsxExport.ts` (`buildWorkbook`, `downloadWorkbook`, ćelije za datume,
  iznose u formatu `#,##0.00 €` i tekst zaštićen od formula). TIC ima vlastiti fiksni format
  uvoza i izvoza.
- Nazivi datoteka: ASCII oznaka + lokalni datum (`exportFileName`).
- Dugi izvozi ne blokiraju sučelje (`yieldToUI`, `useAsyncExport`), a svaki izvoz upisuje se u
  dnevnik aktivnosti.

---

## 24. Podatkovni sloj

### 24.1 Migracije

- Migracije su u `supabase/migrations/` (350 datoteka). Bazna shema
  `00000000000000_baseline_schema.sql` (~9.900 redaka, shema `public`) konsolidirala je
  povijest 15. 5. 2026.; starije migracije su od tada prazne. Nakon baze slijedi 46 aktivnih
  migracija.
- Migracije sheme `erp` nalaze se u `supabase/parked-migrations/erp/`.
- Zastarjele tablice premještene su u shemu `deprecated`.
- `todoMigrations/` pripada mobilnoj aplikaciji za zadatke i nikad se ne izvršava nad ovom
  bazom.

### 24.2 Glavne tablice po domeni

| Domena | Tablice |
|---|---|
| Identitet | `users`, `profiles`, `project_managers`, `push_subscriptions` |
| Projekti | `projects`, `project_phases`, `project_milestones`, `phase_classification_budgets`, `cost_classifications`, `tic_cost_structures` |
| Nadzor | `subcontractors`, `contracts`, `contract_types`, `subcontractor_milestones`, `subcontractor_comments`, `work_logs` |
| Prodaja | `buildings`, `apartments`, `garages`, `repositories`, `apartment_garages`, `apartment_repositories`, `customers`, `sales` |
| Računovodstvo | `accounting_invoices`, `accounting_invoices_refund`, `accounting_payments`, `accounting_companies`, `company_bank_accounts`, `company_loans`, `monthly_budgets`, `office_suppliers`, `hidden_approved_invoices`, `invoice_categories` |
| Financiranje | `banks`, `bank_credits`, `credit_allocations` |
| Dokumenti | `documents`, `document_categories`, `document_associations` |
| Suradnja | `tasks`, `task_assignees`, `task_comments`, `task_attachments`, `task_subtasks`, `task_reminders`, `chat_conversations`, `chat_participants`, `chat_messages`, `calendar_events`, `calendar_event_participants`, `calendar_event_exceptions`, `calendar_occurrence_responses`, `calendar_notifications`, `calendar_reminder_sends` |
| AI | `ai_sessions`, `ai_messages`, `ai_message_attachments`, `ai_help_searches` |
| Revizija | `activity_logs` |
| ERP (shema `erp`) | `import_runs`, `staging_invoices`, `staging_payments`, `bank_balances`, `partners`, `partner_map`, `cost_centers`, `cost_center_map`, `chart_of_accounts`, `account_map`, `link_carry_forward` |

Pogledi: `company_statistics`, `payment_totals_by_category` i `erp_*` pogledi sa
`security_invoker` koji izlažu shemu `erp` (`erp_account_map`, `erp_chart_of_accounts`,
`erp_cost_center_map`, `erp_cost_centers`, `erp_import_runs`, `erp_partner_map`,
`erp_partners`, `erp_review_queue`, `erp_staging_problems`, `erp_unmapped_codes`).

### 24.3 Ključni triggeri

Ukupno 52 definicije triggera. Najvažnije skupine:

- **Iznosi i PDV računa:** `trigger_calculate_invoice_amounts` (računi),
  `calculate_contract_vat_trigger` (ugovori).
- **Plaćanje → status računa:** `trg_update_invoice_on_payment_change`
  (`update_invoice_payment_status`).
- **Plaćeno po ugovoru (`contracts.budget_realized`):** `trg_update_contract_budget_realized`
  (plaćanja) i `sync_contract_budget_realized_from_invoice` (računi).
- **Stanja žiro računa:** `update_bank_account_balance_trigger`,
  `recalc_company_bank_account_balance`, `trigger_recalculate_balances_on_loan_change`.
- **Krediti:** `trg_sync_bank_credit_on_invoice`, `trg_sync_bank_credit_on_payment`,
  `trigger_update_credit_allocation_used_amount`, `trigger_disbursed_credit_balance`,
  `validate_refinancing_entity_trigger`.
- **Milestoneovi plaćanja:** `update_milestone_status_on_payment_trigger`,
  `reset_milestone_status_on_invoice_change`.
- **TIC kao jedini izvor planiranog budžeta:** `trg_sync_project_budget_from_tic`.
- **Ostalo:** zaštita sistemskih klasifikacija troškova, prenumeriranje faza projekta,
  sinkronizacija završetka zadatka iz kontrolne liste, sinkronizacija `profiles` iz `users`,
  brojač ugovora podizvođača, `updated_at` triggeri.

### 24.4 RPC funkcije

- Pristup: `can_view_task`, `is_admin`, `is_chat_participant`, `is_event_participant`,
  `is_task_assignee`, `user_has_project_access`.
- Zadaci: `create_task_with_assignees`, `update_task_with_assignees`, `get_task_creator`.
- Raspored: `dispatch_due_reminders`, `get_busy_blocks`, `get_event_creator`.
- Upiti: `get_activity_logs`, `get_apartment_payments`, `get_chat_conversation_summaries`,
  `get_document_category_counts`, `get_filtered_invoices`, `get_invoice_statistics`,
  `get_subcontractor_payments`, `search_documents`.
- Održavanje: `check_subcontractor_budget_integrity`, `fix_subcontractor_budget_integrity`,
  `recalculate_all_phase_budgets`, `recalculate_bank_credit_fields`,
  `replace_document_associations`, `save_push_subscription`,
  `update_overdue_notifications`.
- ERP: `erp_reclassify`; u shemi `erp` funkcije `resolve_invoices`, `resolve_payments`,
  `promote_invoices`, `promote_payments`.

### 24.5 Zakazani poslovi

pg_cron posao `deadline-reminders` (`0 * * * *`) poziva `dispatch_due_reminders()`, koja
preko pg_net poziva edge funkciju `send-push`. Potrebna su proširenja pg_cron i pg_net.

### 24.6 Tipovi

`npm run db:types` generira `src/types/database.ts` iz povezanog Supabase projekta (sheme
`public` i `erp`) i kopira ga u `supabase/functions/_shared/database.ts`. Datoteka se ne
uređuje ručno.

---

## 25. Edge funkcije

Sve edge funkcije pišu se u Deno TypeScriptu u `supabase/functions/`.

| Funkcija | Namjena | Ovjera | Varijable okruženja |
|---|---|---|---|
| `ai-chat` | AI asistent: SSE tok, petlja alata (15 alata), povijest, sažimanje konteksta | `verify_jwt` + `authenticate()`; ograničenje učestalosti | `ANTHROPIC_API_KEY`, `AI_CHAT_MODEL`, `AI_CHAT_SUMMARY_MODEL`, `AI_CHAT_DEBUG_ENABLED`, `SUPABASE_*` |
| `sort-document` | Webhook iz Make.com: klasifikacija i spremanje dokumenata iz e-maila | dijeljena tajna `x-doc-sort-secret` | `ANTHROPIC_API_KEY`, `DOC_SORT_MODEL`, `DOC_SORT_WEBHOOK_SECRET`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` |
| `import-erp` | Uvoz izvoza iz 4D Wanda u staging tablice sheme `erp` | `x-erp-import-secret` (lokalni agent) ili JWT uloge Director/Accounting | `ERP_IMPORT_SECRET`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` |
| `send-push` | Web Push za mobilnu aplikaciju zadataka (događaji zadataka i podsjetnici za rokove) | JWT (korisnik) ili `x-reminder-secret` (planer) | `REMINDER_SECRET`, `VAPID_KEYS`, `VAPID_SUBJECT`, `SUPABASE_*` |
| `dispatch-calendar-reminders` | Podsjetnici kalendara (48 h unaprijed, razvijanje RRULE-ova) | isključena u `config.toml` | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` |

Zajednički moduli (`_shared/`): `auth.ts`, `cors.ts`, `rateLimit.ts`, `database.ts`,
`prompts.ts`, `tools.ts`, `tool-handlers.ts`, `context-window.ts`, `help-search.ts`,
`help-score.ts`, `help-kb-index.json`, `routeLabels.ts`.

---

## 26. Testiranje, okruženja i konfiguracija

### 26.1 Jedinični testovi (Vitest)

63 testne datoteke u `src/`: formatiranje, PDV, EVM, datumi, lokalizacija, prikaz statusa,
PDF font, Excel parseri i izvoz, sažeci ugovora, hookovi (Escape, fokus) te servisi modula
(Zadaci, Kalendar, Cashflow, TIC, Prodaja, Nadzor, dashboardi, izvještaji). Okruženje je Node,
bez potrebe za `.env`.

### 26.2 Testovi edge funkcija (Deno)

Testovi alata AI asistenta i bodovanja pomoći, klasifikatora i izvlačenja teksta za
sortiranje dokumenata, parsera ERP uvoza (38 testova) te 106 karakterizacijskih testova
petlje AI asistenta s lažnim Anthropic i Supabase klijentima. Pokretanje:
`npm run test:functions`.

### 26.3 E2E testovi (Playwright)

- Chromium, 2 radnika, timeout 120 s, jedno ponavljanje u CI-ju.
- Prije testova kreiraju se korisnici za svaku ulogu i spremaju stanja prijave; podaci se
  imenuju po pokretanju i čiste nakon testa.
- Zaštita: testovi odbijaju raditi ako `VITE_SUPABASE_URL` nije jednak
  `E2E_ALLOWED_SUPABASE_URL` (nikad nad produkcijom).
- 13 specifikacija: smoke, prijava, sesija, ovlasti, Cashflow odobravanja i otključavanje,
  pristup financiranju, kupci i završetak prodaje, dnevnik rada, navigacija upravljanja
  gradilištem, neuspjelo učitavanje izvještaja.

### 26.4 CI (GitHub Actions)

- `test.yml` — na push u `main` i PR prema `main`/`development`: `npm test` i
  `npm run test:functions` (Node 20, Deno 2).
- `e2e.yml` — Playwright s tajnama za testni Supabase projekt.
- Ručne testne liste: `docs/test/` i [`MANUAL_TESTSHEET.md`](./MANUAL_TESTSHEET.md).

### 26.5 Okruženja

- **Produkcija** — glavni Supabase projekt i Vercel.
- **Razvoj/E2E** — zaseban Supabase projekt.
- **Demo** — zaseban Supabase projekt „LandmarkDemo" s hrvatskim demo podacima
  (`scripts/seed-demo-users.mjs` stvara 5 demo korisnika, po jednog za svaku ulogu;
  `scripts/seed-demo-data.mjs` puni poslovne podatke i stvarne PDF-ove). Zaseban projekt je
  nužan jer shema nema dimenziju tenanta. Postupak: [`DEMO_ENVIRONMENT.md`](./DEMO_ENVIRONMENT.md).

### 26.6 Varijable okruženja (samo nazivi)

| Gdje | Varijable |
|---|---|
| Preglednik (ugrađuju se u build) | `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_CASHFLOW_PASSWORD` |
| Lokalni `.env` (skripte) | gore navedene + `SUPABASE_SERVICE_ROLE_KEY`, `ANTHROPIC_API_KEY`, `ERP_IMPORT_SECRET` |
| E2E | `E2E_ALLOWED_SUPABASE_URL`, `E2E_BASE_URL`, `E2E_RUN_ID`, `CI` |
| Demo skripte | `DEMO_USER_PASSWORD` |
| Edge funkcije | vidi poglavlje 25 |

---

## 27. Plan razvoja: glasovni asistent

**Cilj:** korisnik razgovara na hrvatskom s **istim** asistentom koji radi u aplikaciji — isti
backend, isti prompt, isti alati. Chat nastavlja raditi kroz sve faze.

**Integracija:** nova edge funkcija `voice-llm` izlaže streaming endpoint kompatibilan s
OpenAI formatom, koji poziva platforma za glasovne agente (Vapi ili Retell — odluka otvorena),
a interno pokreće postojeću petlju agenta.

**v1 — gumb za poziv u aplikaciji (WebRTC), odlučeno 23. 9. 2026.:**
- koristi postojeću prijavu; korisnikov JWT predaje se na poslužitelju preko neprozirnog
  tokena poziva (nova tablica `voice_calls`), pa ga dobavljač nikad ne vidi;
- nova funkcija `voice-session`;
- popis dopuštenih alata za glas (12 alata; bez izrade i preuzimanja dokumenata);
- glasovni prompt na hrvatskom i govor „za popunjavanje" dok alati rade;
- vlastita ograničenja učestalosti;
- rad na latenciji: streaming tokena, paralelno izvršavanje alata, ograničeno čitanje
  povijesti.

**v2 — telefonski broj (nakon v1):** prepoznavanje pozivatelja prema zapisu identiteta,
kratkotrajni JWT, **obavezni PIN (DTMF) za financijske uloge** uz zaključavanje nakon
pogrešaka, zaštita od lažiranja broja. Kasnije i WhatsApp.

| Faza | Sadržaj |
|---|---|
| 0 | Prototip prepoznavanja i sinteze hrvatskog govora (odluka ide/ne ide) |
| 1 | Karakterizacijski testovi postojećeg asistenta — **završeno** |
| 2 | Latencija i ispravci otvorenih pitanja |
| 3 | Izdvajanje orkestratora u zajednički modul |
| 4 | `voice-llm`, popis alata, prompt |
| 5 | `voice-session`, predaja tokena, gumb za poziv |
| 6 | Uvođenje v1 |
| 7–9 | v2 |

Procjena za v1: 27–40 radnih dana. Faza 0 je u pripremi (skripta snimanja zamrznuta nakon
izvorne recenzije). Detalji: [`voice/`](./voice/).

---

## Dodatak A: Pojmovnik

| Pojam | Značenje |
|---|---|
| **Cesija** | Ustup tražbine: treća firma plaća dug u ime druge firme. U sustavu je prvorazredna vrsta plaćanja (oznaka `is_cesija`, stvarni platitelj). |
| **Kompenzacija** | Međusobni prijeboj dugovanja dviju strana, uz broj izjave o kompenzaciji. |
| **Multi-PDV račun** | Jedan račun s do 4 različite PDV stope (25 %, 13 %, 5 %, 0 %), svaka s vlastitom osnovicom i iznosom. |
| **TIC** | Troškovna Informatička Struktura — razrada planiranih troškova investicije po projektu, stavku po stavku; jedini izvor planiranog budžeta projekta. |
| **OIB** | Osobni identifikacijski broj; ključ za uparivanje firmi i partnera s ERP-om. |
| **Mjesto troška** | Dimenzija knjiženja u ERP-u; u Cognilionu određuje projekt računa. |
| **Konto** | Račun kontnog plana; u Cognilionu određuje kategoriju troška. |
| **Šifrarnici** | Tablice mapiranja ERP šifri (mjesta troška, konta, partneri) na entitete Cognilona. |
| **Stan, garaža, repozitorij** | Tri vrste prodajnih jedinica; garaže i repozitoriji (spremišta) vežu se uz stanove. |
| **Kapara** | Predujam kupca pri sklapanju kupoprodajnog ugovora. |
| **Pozajmica** | Zajam između firmi unutar grupe. |
| **Milestone plaćanja** | Postotni dio ugovorene vrijednosti s podizvođačem koji se plaća po ispunjenju; povezan s računima. |
| **EVM** | Earned Value Management — metoda praćenja planiranog i ostvarenog napretka i troška. |
| **SPV** | Zasebna firma osnovana za pojedini projekt. |
| **RLS** | Row Level Security — pravila pristupa na razini redaka u bazi PostgreSQL. |
