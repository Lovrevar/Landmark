# Integracija s ERP sustavom — specifikacija API-ja (nacrt)

**Svrha:** ERP sustav računovodstva postaje **mjerodavni izvor (source of truth) za račune i plaćanja**. Cognilion prestaje kreirati račune u aplikaciji i umjesto toga periodički povlači financijske podatke iz ERP-a te ih sinkronizira u svoje lokalne tablice `accounting_invoices` / `accounting_payments`. Sve postojeće funkcionalnosti (dashboardi, stanje duga, napredak ugovora i situacija, praćenje kupaca u Prodaji, krediti u Financiranju) i dalje rade nad lokalnom kopijom, koju postojeći database triggeri drže konzistentnom.

**Što tražimo od ERP tima:** dolje navedene endpointe za čitanje (pull) s podrškom za inkrementalnu sinkronizaciju.

---

## 1. Model integracije

```
ERP (izvor istine) ──pull──▶ Cognilion sync ──upsert──▶ accounting_invoices / accounting_payments
                                                              │
                                            DB triggeri izvode: status računa,
                                            status situacija, realizaciju ugovora,
                                            stanja računa, iskorištenost kredita
                                                              │
                                       Automatsko povezivanje: projekt ← mjesto troška,
                                       kategorija ← konto (kontni plan)
                                                              │
                                       Ručno povezivanje u Cognilionu: ugovor /
                                       situacija / stan / kreditna linija
```

- Cognilion perioidčki (npr. svakih 15 min) poziva ERP API s parametrom `updated_since` (kursor).
- **Projekt se automatski izvodi iz mjesta troška (MT)** koje računovodstvo unosi pri knjiženju — održavamo šifrarnik mapiranja MT → projekt.
- **Kategorija/klasifikacija troška izvodi se iz konta** (kontni plan) — održavamo mapiranje konto → interna kategorija.
- Ostale poveznice koje ERP ne poznaje (ugovor, situacija/milestone, stan, kreditna linija) dodjeljuju se u Cognilionu nakon uvoza (vidi §6).
- Uparivanje partnera i vlastitih firmi radi se preko **OIB-a**.

## 2. Opći zahtjevi na API

| Zahtjev | Detalj |
|---|---|
| Autentikacija | API ključ ili OAuth2 client-credentials, isključivo HTTPS |
| ID-evi | Svaki zapis ima **stabilan, nepromjenjiv ID** koji se nikad ne mijenja niti ponovno koristi |
| Inkrementalna sinkronizacija | Svaki list-endpoint prima `updated_since` (timestamp ili kursor) i vraća zapise promijenjene **ili stornirane/obrisane** od tada (tombstone zapisi s `voided: true` / `deleted: true` — tiho hard-brisanje ruši sinkronizaciju) |
| Paginacija | Kursor ili stranice, dokumentiran maksimalni broj zapisa |
| Formati | Datumi ISO 8601 (`YYYY-MM-DD`), timestampovi s vremenskom zonom, iznosi kao decimalni brojevi (ne float), valuta eksplicitna (EUR) |
| Ispravci | Storna / odobrenja moraju biti prepoznatljiva (oznaka + referenca na izvorni račun) |

## 3. Metode — Računi

### `GET /invoices`
Query parametri: `updated_since`, `direction` (ulazni/izlazni), `company_oib`, `date_from`/`date_to`, `page`/`cursor`.

Obavezna polja po računu:

| Polje | Napomena |
|---|---|
| `id` | stabilan ERP ID |
| `direction` | ulazni / izlazni |
| `document_type` | račun, odobrenje (storno), avansni račun… |
| `original_invoice_id` | za odobrenja / ispravke |
| `company` | **naša** firma: `{ oib, name }` — mapira se na `accounting_companies` |
| `partner` | druga strana: `{ id, oib, name, type: firma/osoba, iban }` |
| `invoice_number` | broj računa kako piše na dokumentu |
| `reference_number` | poziv na broj |
| `iban` | račun primatelja s dokumenta |
| `issue_date`, `due_date` | datum izdavanja, datum dospijeća |
| `mjesto_troska` | `{ sifra, naziv }` — **ključno**: iz njega izvodimo projekt |
| `konto` | `{ broj, naziv }` — iz kontnog plana; iz njega izvodimo kategoriju/klasifikaciju |
| `vat_breakdown[]` | **do 4 retka**: `{ base_amount, vat_rate, vat_amount }` — hrvatski multi-PDV zahtjev; spremamo kao `base_amount_1–4` / `vat_rate_1–4` / `vat_amount_1–4` |
| `total_amount` | bruto ukupno |
| `paid_amount`, `payment_status` | ako ERP to vodi (inače izvodimo iz plaćanja) |
| `description` | opis |
| `currency` | valuta |
| `updated_at`, `voided` | za sinkronizaciju |

### `GET /invoices/{id}`
Pojedinačni račun, isti oblik.

### `GET /invoices/{id}/document` *(poželjno, nije nužno)*
PDF/sken računa, za prikaz detalja u aplikaciji.

> **Pitanje granularnosti:** ako se mjesto troška ili konto u ERP-u knjiže **po stavkama** računa (a ne na razini zaglavlja), trebamo i `stavke[]` s `{ konto, mjesto_troska, iznos }` po stavci — jedan račun tada može teretiti više projekata. Molimo potvrdu kako je modelirano (vidi §9).

## 4. Metode — Plaćanja

### `GET /payments`
Query parametri: `updated_since`, `company_oib`, `date_from`/`date_to`, `page`/`cursor`.

Obavezna polja po plaćanju:

| Polje | Napomena |
|---|---|
| `id` | stabilan ERP ID |
| `allocations[]` | `{ invoice_id, amount }` — **molimo pojasniti: može li jedno plaćanje zatvoriti više računa?** Naš trenutni model je jedno plaćanje → jedan račun; ako ERP podržava razdiobu, raspodijelit ćemo je pri uvozu |
| `payment_date` | datum plaćanja |
| `amount` | iznos |
| `method` | virman / gotovina / ček / kartica / **kompenzacija** / **cesija** |
| `company_bank_account_iban` | naš žiro račun preko kojeg je plaćeno (null za gotovinu/kompenzaciju) |
| `counterparty_iban` | račun druge strane |
| `reference_number` | poziv na broj |
| `description` | opis |
| `cesija` | ako je metoda cesija: `{ payer_oib, payer_name }` — treća firma koja je platila u naše ime; mapiramo na `cesija_company_id` |
| `kompenzacija_reference` | broj izjave o kompenzaciji, ako postoji |
| `updated_at`, `voided` | |

### `GET /payments/{id}`

> Cesija i kompenzacija su prvorazredni koncepti u Cognilionu (polja na `accounting_payments`, trigger logika za stanja računa). Ako ih ERP modelira drugačije (npr. kao temeljnice), moramo dogovoriti kako se prikazuju kroz ovaj API.

## 5. Metode — Šifrarnici

### `GET /partners`
Svi dobavljači/kupci, s `updated_since`. Polja: `id`, `oib`, `name`, `type` (firma/osoba), `address`, `iban(s)`, `email`, `phone`. Služi za automatsko uparivanje ERP partnera s Cognilion dobavljačima (`subcontractors`, `retail_suppliers`, `office_suppliers`) i kupcima preko OIB-a.

### `GET /companies`
Naše vlastite firme: `id`, `oib`, `name`, `vat_id`. Mapira se na `accounting_companies`.

### `GET /mjesta-troska`
Šifrarnik mjesta troška: `sifra`, `naziv`, `active`, s `updated_since`. **Osnova za automatsko povezivanje računa s projektima** — u Cognilionu održavamo mapiranje MT → projekt; novo MT bez mapiranja diže upozorenje.

### `GET /kontni-plan`
Kontni plan: `broj`, `naziv`, `active`, s `updated_since`. Osnova za mapiranje konto → interna kategorija troška (danas lokalna tablica `invoice_categories`).

### `GET /bank-accounts`
Po firmi: `iban`, `bank_name`, `currency`, `current_balance`, `balance_as_of`. Danas Cognilion sam preračunava stanja iz plaćanja (triggeri); s ERP-om kao izvorom istine radije prikazujemo **mjerodavno ERP stanje** i radimo usklađenje.

## 6. Povezivanje s internim entitetima

Cognilion svaki račun veže na interne entitete. Plan povezivanja:

| Interni entitet | Izvor poveznice | Način |
|---|---|---|
| **Projekt** | `mjesto_troska` s računa | automatski, preko šifrarnika mapiranja MT → projekt (održava se u Cognilionu) |
| **Kategorija troška** | `konto` s računa | automatski, preko mapiranja konto → kategorija |
| **Firma (naša)** | `company.oib` | automatski, preko OIB-a |
| **Dobavljač / kupac** | `partner.oib` | automatski, preko OIB-a; nepoznat partner → red za uparivanje |
| **Ugovor** | — | ručno u Cognilionu (unutar projekta izvedenog iz MT-a lista je kratka) |
| **Situacija / milestone** | — | ručno u Cognilionu |
| **Stan / nekretnina** | — | ručno u Cognilionu (prodajni računi) |
| **Kreditna linija** | — | ručno u Cognilonu, osim ako ERP može dostaviti identifikator kredita (§9) |

Računi koje nije moguće automatski povezati (nepoznato MT, nepoznat OIB) ulaze u **red "nepovezani računi"** u Cognilionu, gdje ih naš tim klasificira — postojeća forma za unos računa prenamjenjuje se iz *unosa* u *klasifikaciju*.

## 7. Mehanika sinkronizacije

- **Polling:** `GET /invoices?updated_since=…` + `GET /payments?updated_since=…` svakih N minuta; kursor se pamti po entitetu.
- **Webhooci (opcionalno, poželjno):** `invoice.created/updated/voided`, `payment.created/updated/voided` prema Cognilion endpointu — smanjuje kašnjenje; polling ostaje kao rezerva.
- **Inicijalni uvoz:** isti endpointi bez `updated_since` (ili bulk export) za povijesne podatke.
- **Usklađenje:** periodički endpoint s kontrolnim sumama ili mjesečnim totalima (`GET /invoices/summary?month=…`) pomogao bi u otkrivanju odstupanja — poželjno.

## 8. Što ostaje u Cognilionu (ne tražimo od ERP-a)

- Poveznice na ugovor / situaciju / stan / kreditnu liniju i sva izvedena stanja napretka (održavaju postojeći DB triggeri nad sinkroniziranim recima).
- Mapiranja MT → projekt i konto → kategorija (šifrarnici u Cognilionu).
- Kreditne linije banaka, alokacije, planovi povlačenja (modul Financiranje) — osim ako ERP vodi i kredite; izvan opsega faze 1.
- Međukompanijske pozajmice, mjesečni budžeti, statistike (`get_invoice_statistics` i sl. nastavljaju raditi nad lokalnom kopijom).
- UI za kreiranje računa se uklanja; zamjenjuje ga UI za klasifikaciju/povezivanje.

## 9. Otvorena pitanja za ERP / računovodstvo

1. Knjiže li se **mjesto troška i konto na razini zaglavlja ili po stavkama** računa? Ako po stavkama, trebamo `stavke[]` u API-ju (jedan račun može teretiti više projekata).
2. Je li **mjesto troška obavezno** pri knjiženju svakog ulaznog računa? Bez njega automatsko povezivanje s projektom ne radi.
3. Izdaju li se i **izlazni računi kupcima stanova** u ERP-u? Modul Prodaja ovisi o njima (`OUTGOING_SALES` + plaćanja kupaca). Ako da, kupci (fizičke osobe) moraju dolaziti kroz `partner` s OIB-om.
4. Može li **jedno plaćanje zatvoriti više računa** (razdioba)? Što s plaćanjima bez računa (avansi)?
5. Kako su u ERP-u prikazane **kompenzacija i cesija** i mogu li se izložiti kako je opisano u §4?
6. Knjiže li se **bankovne naknade / kamate po kreditima** (danas `INCOMING_BANK` / `INCOMING_BANK_EXPENSES` vezani na kreditne linije) u ERP-u i mogu li nositi identifikator kreditne partije?
7. Izlaže li ERP **stanja žiro računa / izvode** (§5) ili samo knjiženja?
8. Koja je **mehanika promjena**: `updated_since` polling, webhooci ili oboje? Jesu li stornirani dokumenti vidljivi kao tombstone zapisi?
