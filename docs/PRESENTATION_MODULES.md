# Cognilion — Pregled modula za prezentaciju

> Izvorni materijal za prezentaciju na startup eventu. Svako poglavlje pisano je tako da
> se može prenijeti na slajd: rečenica-sažetak, što modul radi, i "talking pointovi" koji
> ga čine zanimljivim na pozornici.
>
> **Napomena o okviru prezentacije:** ERP integracija ovdje je opisana kao sastavni dio
> proizvoda — računi, plaćanja i stanja žiro računa u Cognilion **stižu automatski iz
> ERP sustava računovodstva**, bez ručnog unosa. Tako se predstavlja na eventu.
> Tehnička specifikacija: [`ERP_INTEGRATION_SPEC.md`](./ERP_INTEGRATION_SPEC.md).

---

## Elevator pitch

**Cognilion je platforma za upravljanje cijelim životnim ciklusom nekretninskog
developmenta, skrojena za hrvatske development tvrtke.** Pokriva sve od kupnje
zemljišta i nadzora gradnje, preko prodaje stanova i bankovnog financiranja, do
računovodstvenog uvida i izvještaja za upravu — u jednom sustavu koji govori jezikom
hrvatskog poslovanja: multi-PDV računi, cesija, kompenzacija, mjesta troška, OIB.

Umjesto da projekt živi raspršen po Excel tablicama, zasebnom računovodstvenom programu
i e-mail nitima, sve je na jednom mjestu: **svaki račun automatski stiže iz ERP-a i
vezan je na svoj projekt, ugovor, građevinsku fazu ili kreditnu liniju** — pa su brojke
na direktorskom dashboardu uvijek stvarne, bez ručne konsolidacije.

### Verzija u jednoj rečenici, po publici

- **Za investitore i developere:** „Profitabilnost u stvarnom vremenu po projektu, po
  zgradi, po stanu — s iskorištenošću kredita i izloženošću dugu na jednom ekranu."
- **Za operativu:** „Nadzor gradilišta, ugovori s podizvođačima, prodajni CRM i
  knjigovodstvo međusobno razgovaraju automatski — knjiži se jednom, u ERP-u."
- **Za tehničku publiku:** „React + TypeScript + Supabase (PostgreSQL s row-level
  security), AI klasifikacija dokumenata, ugrađeni AI analitičar i ERP sync sloj."

---

## Platforma ukratko

| | |
|---|---|
| Frontend | React 18 + TypeScript + Vite, Tailwind CSS |
| Backend | Supabase (PostgreSQL) — svaka tablica zaštićena Row Level Security politikama |
| Podatkovna kičma | ERP sustav računovodstva kao izvor istine za račune i plaćanja; Cognilion sinkronizira i obogaćuje |
| Izvještaji | PDF (jsPDF) i Excel (xlsx) generirani u pregledniku — bez izvještajnog servera |
| AI | Claude API — ugrađeni asistent za pitanja nad podacima + automatska klasifikacija dokumenata iz e-maila |
| Uloge | Director, Accounting, Sales, Supervision, Investment |
| Profili | 6 radnih okruženja koja korisnik mijenja u hodu (General, Supervision, Sales, Funding, Cashflow, Retail) — svaki sa svojom navigacijom i dashboardom |
| Revizija | Svaka promjena podataka u sustavu bilježi se u središnji dnevnik aktivnosti |
| Lokalizacija | Hrvatsko / englesko sučelje; hrvatski pravno-financijski pojmovi ostaju izvorni |

**Arhitektura (ako netko pita):** UI komponenta → custom hook → servisni sloj →
Supabase → PostgreSQL. Poslovno kritične izvedenice (status računa, realizacija
ugovora, iskorištenost kredita, stanja računa) računaju **database triggeri** — točne su
bez obzira koji modul ili sync proces upiše podatak.

---

## Kako podaci teku kroz sustav

Ovo je slajd koji publici objašnjava zašto je Cognilion drugačiji:

```
ERP (računovodstvo)          Gradilište              Prodajni ured
      │ automatska                 │ dnevnik rada,          │ prodaja stana,
      │ sinkronizacija             │ situacije              │ uplate kupaca
      ▼                            ▼                        ▼
              ┌──────────────────────────────────┐
              │            COGNILION             │
              │  računi ↔ projekti ↔ ugovori ↔   │
              │  faze ↔ stanovi ↔ kreditne linije │
              └──────────────────────────────────┘
                               │
              dashboardi po ulozi · izvještaji · AI asistent · alarmi
```

Računovodstvo knjiži račun **jednom, u ERP-u**. Petnaestak minuta kasnije račun je u
Cognilionu — već pridružen projektu i kategoriji troška — i vidljiv je na realizaciji
ugovora, iskorištenosti kredita i direktorskom dashboardu. Nema dvostrukog unosa, nema
prepisivanja, nema „čija je tablica točna".

---

## Poslovni moduli

### 1. Projekti (General)

**U jednoj rečenici:** Kralježnica sustava — svaki development projekt s budžetom, milestoneovima, fazama i financijama na jednom mjestu.

Što modul radi:
- Središnji registar svih projekata: budžet, lokacija, rokovi, status.
- Vremenska linija milestoneova i razrada projekta po fazama.
- Financijski presjek po projektu, agregiran uživo iz ostalih modula: ukupno potrošeno,
  prihodi, računi na čekanju, izvori financiranja (koje banke i krediti financiraju
  projekt).
- Pregled ugovora i podizvođača po fazama, tablice stanova, sažetak financiranja —
  sve unutar detalja jednog projekta.
- **EVM (Earned Value Management)** po fazi i po projektu — planirano naspram ostvarenog
  napretka, metodologijom koju razumiju banke i investitori.

**Talking point:** sve ostalo u sustavu (ugovori, računi, prodaje, krediti) visi na
projektu — pa je pogled na projekt uvijek istinita, trenutna slika. Konsolidacija se ne
radi, ona *postoji*.

---

### 2. Prodaja

**U jednoj rečenici:** CRM i inventar skrojen za prodaju stanova, garaža i spremišta — od prve ponude do zadnje rate.

Što modul radi:
- Navigacija prati stvarnost: projekt → zgrada → pojedina jedinica.
- Tri povezana tipa jedinica — **stan, garaža, repozitorij** — garaže i spremišta vežu
  se uz stan i prodaju u paketu; veze su vidljive na kartici svake jedinice.
- Masovne operacije: kreiranje desetaka jedinica odjednom, masovna korekcija cijene po
  m² za označene jedinice, uvoz inventara iz Excela (s detekcijom duplikata).
- CRM kupaca sa statusima (lead → pregovori → kupac), evidencija prodajnih ugovora,
  kapare, način plaćanja, obročne uplate po kupcu.
- Praćenje uplata po stanu: ugovoreno vs. stvarno uplaćeno, izvedeno iz izlaznih računa
  i uplata kupaca koje stižu kroz ERP sinkronizaciju.
- Živi prodajni pokazatelji po projektu i zgradi: prodano jedinica, prihod, progress
  barovi.

**Talking point:** u trenutku evidentiranja prodaje ažuriraju se inventar jedinica,
prihod projekta, plan uplata kupca i direktorski dashboard — jedan unos, nula
usklađivanja.

---

### 3. Nadzor (Supervision)

**U jednoj rečenici:** Upravljanje gradilištem — podizvođači, ugovori, situacije i građevinski dnevnik, s financijama po fazi.

Što modul radi:
- Aktivna gradilišta s građevinskim fazama i budžetom po fazi; budžet faze automatski se
  preračunava iz aktivnih ugovora.
- Ugovori s podizvođačima vezani na faze, s praćenjem **situacija** (privremenih i
  okončanih) — postotak realizacije ugovora izvodi se automatski iz proknjiženih računa
  koji stižu iz ERP-a.
- Dnevnik rada s gradilišta (work logs) — tko je što radio, po danima; tjedni pregled na
  dashboardu nadzora.
- Financijski sažetak po fazi: ugovoreno vs. budžet vs. fakturirano vs. plaćeno.
- Upravljanje dokumentacijom po gradilištu i ugovoru (upload, pregled).
- Registar podizvođača s ugovorima, dokumentima, računima i plaćanjima po svakome.

**Talking point:** nadzorni inženjer i računovodstvo gledaju **isti ugovor** — kada
računovodstvo u ERP-u proknjiži račun po situaciji, realizacija ugovora u Cognilionu se
ažurira sama. Nestaje e-mail „koliko smo do sada stvarno platili ovom izvođaču?".

---

### 4. Cashflow / Računovodstvo

**U jednoj rečenici:** Financijsko srce sustava — svaki račun i svako plaćanje firme, automatski povučeno iz ERP-a i povezano s projektom, ugovorom ili kreditom kojem pripada.

Ovo je najveći modul u sustavu. Što pokriva:

- **Računi (ulazni i izlazni)** s punom podrškom za **multi-PDV**: jedan račun može
  nositi do 4 različite PDV stope (osnovica + stopa + iznos po retku) — tvrda hrvatska
  računovodstvena potreba koju generički alati ne znaju modelirati. Pregled računa s
  filtrima, statistikom, paginacijom i PDF pregledom dokumenta.
- **Plaćanja s prvorazrednim hrvatskim instrumentima:**
  - **Cesija** — treća firma plaća u naše ime (ustup tražbine); sustav pamti tko je
    stvarni platitelj i to vodi kroz svu trigger logiku stanja računa.
  - **Kompenzacija** — međusobni prijeboj dugovanja dviju strana, s referencom na izjavu
    o kompenzaciji.
- **Banke:** žiro računi po firmi, kreditne linije s planom otplate (kamata, glavnica,
  frekvencija), računi vezani na kredit.
- **Firme:** registar vlastitih firmi grupe (uparivanje preko OIB-a s ERP-om).
- **Kupci i dobavljači:** registri s automatskim uparivanjem ERP partnera preko OIB-a.
- **Stanje duga:** pregled obveza i potraživanja — tko nama duguje, kome mi dugujemo,
  po dospijeću.
- **Pozajmice:** međukompanijske pozajmice unutar grupe.
- **Odobravanje:** tijek odobravanja računa prije plaćanja, s masovnim operacijama.
- **Kalendar plaćanja:** mjesečni pregled dospijeća i planiranih plaćanja + mjesečni
  budžeti.

**ERP integracija u praksi (predstaviti kao način na koji modul radi):**
- Računi i plaćanja **ne unose se ručno** — sinkroniziraju se iz ERP-a inkrementalno,
  svakih ~15 minuta.
- **Projekt se pridružuje automatski iz mjesta troška** koje računovodstvo ionako unosi
  pri knjiženju; **kategorija troška izvodi se iz konta** (kontni plan). Partneri i
  vlastite firme uparuju se preko **OIB-a**.
- Ono što ERP ne zna — veza na konkretan ugovor, situaciju, stan ili kreditnu liniju —
  dodjeljuje se u Cognilionu u par klikova; računi koje nije moguće automatski povezati
  čekaju u redu **„nepovezani računi"** za klasifikaciju.
- **Stanja žiro računa prikazuju se mjerodavno iz ERP-a** (banka/izvod), a ne
  preračunavaju ručno.
- Storna i odobrenja iz ERP-a prepoznaju se i uredno razdužuju izvorne račune.

**Kontrola pristupa:** Cashflow profil čuva se **na razini baze** (row-level security po
ulozi — Director i Accounting), a ne samo u sučelju. Financije su zaštićene i kad bi
netko zaobišao aplikaciju.

**Talking point:** „Nismo izgradili još jedan računovodstveni program. Izgradili smo
sloj inteligencije iznad onoga koji računovođe već koriste."

---

### 5. Retail (razvoj zemljišta)

**U jednoj rečenici:** Zemljišni pandan Prodaji — parcele, faze razvoja i retail kupci.

Što modul radi:
- Development projekti koji prolaze faze: razvoj zemljišta → gradnja → prodaja; svaka
  faza s milestoneovima, statistikom i ugovorima.
- Evidencija zemljišnih čestica / parcela i njihove prodaje retail kupcima.
- Ugovori s dobavljačima po fazi razvoja, s automatskim roll-upom fakturiranog i
  plaćenog iznosa po ugovoru (iz ERP-sinkroniziranih računa).
- Zaseban registar retail kupaca i retail prodaja.

**Talking point:** stambene zgrade i parcelacija zemljišta različiti su poslovi s
različitim tokovima — Cognilion modelira oba nativno, umjesto da jedan ugurava u kalup
drugoga.

---

### 6. Financiranje (Funding)

**U jednoj rečenici:** Odakle dolazi novac — bankovni krediti, investitori i strukturirana kontrola troškova investicije.

Što modul radi:
- **Kreditne linije banaka s alokacijom na više projekata** — jedna kreditna partija
  može financirati nekoliko developmenta; alokacija i iskorištenost prate se po projektu
  (uključujući alokacije za opex i refinanciranje).
- **Isplate (povlačenja tranši)**, planovi otplate, obračun kamata i troškova po
  kreditu, otplate glavnice.
- **Obavijesti o plaćanju** i virmanska plaćanja: prema bankama, investitorima i
  podizvođačima — s pregledom rasporeda plaćanja prije potvrde.
- **Investitori:** odnosi s investitorima, equity ulozi, kreditni aranžmani, detaljne
  kartice po investitoru.
- **TIC (Troškovna Informatička Struktura)** — strukturirana razrada troškova
  investicije po projektu: planirana struktura troškova naspram stvarne potrošnje,
  stavku po stavku. Stvarna potrošnja puni se automatski iz ERP-sinkroniziranih računa.
- Bankovni računi i naknade vezani na kreditne linije — iskorištenost kredita uvijek je
  ažurna jer svaki bankovni račun iz ERP-a nosi vezu na svoju kreditnu partiju.

**Talking point:** u kapitalno intenzivnom biznisu ključno pitanje glasi: „koliko smo
povukli iz koje kreditne linije, na kojem projektu, i koliko nam je ostalo?" — ovaj
modul na to odgovara jednim ekranom.

---

## Uvid i izvještavanje

### 7. Dashboardi

**U jednoj rečenici:** Svaka uloga ima svoju početnu stranicu sa živim pokazateljima — direktor vidi cijelu firmu na jedan pogled.

- **Direktorski dashboard:** svi projekti s budžetom / potrošnjom / prihodom / profitnom
  maržom i postotkom dovršenosti; financijske metrike firme (dug, kapital, potraživanja,
  obveze); stanje prodaje i gradnje; izloženost po financiranju; te **automatski feed
  upozorenja** — milestoneovi koji se približavaju, dospijeća kredita, financijski i
  prodajni signali.
- **Računovodstveni dashboard:** PDV naplaćeni vs. plaćeni s mjesečnom razradom, novčani
  tok s usporedbom godina (YoY), mjesečni trendovi (stacked chart), top firme po saldu,
  praćenje mjesečnog budžeta.
- Namjenski dashboardi za profile Prodaja, Nadzor, Investicije i Retail — svaki sa
  svojim KPI-jevima (tjedni dnevnici rada, status podizvođača, prodajni trendovi,
  dospjeli računi…).
- Svi dashboardi su read-only agregacije nad živim podacima — ništa nije zastarjeli
  export.

**Talking point:** budući da računi i stanja računa stižu iz ERP-a automatski,
dashboardi odražavaju **knjigovodstvenu istinu** nekoliko minuta nakon što računovođa
proknjiži dokument. Menadžersko izvještavanje bez izvještajnog ciklusa.

### 8. Izvještaji

**U jednoj rečenici:** Izvještaji spremni za upravu i banku — PDF i Excel na zahtjev, izravno iz živih podataka.

- **Sveobuhvatni izvještaj firme** koji agregira 40+ tablica: executive summary,
  KPI-jevi portfelja (vrijednost portfelja, stopa prodaje, omjer duga i kapitala),
  prodajni rezultati, struktura financiranja, status gradnje, računovodstveni pregled,
  TIC kontrola troškova, procjena rizika i analiza novčanog toka.
- Domenski izvještaji: prodaja (po projektu i po kupcima, s distribucijom načina
  plaćanja), nadzor (iskorištenost budžeta, distribucija statusa ugovora, dnevnici
  rada), retail (projekti, dobavljači, kupci, sažetak računa).
- Generira se u pregledniku (jsPDF / xlsx) — bez servera za izvještaje, preuzimanje je
  trenutno.

---

## Suradnja i automatizacija

### 9. Dokumenti + AI sortiranje e-mailova

**U jednoj rečenici:** Proslijedite dokument na mailbox — AI ga pročita, klasificira i spremi uz pravi projekt, dobavljača i ugovor. Nula ručnih koraka.

- Zaposlenici prosljeđuju račune, ugovore, dozvole i izvode na namjensku e-mail adresu.
- Pipeline (Make.com → Supabase edge funkcija → **Claude API**) izvlači svaki privitak
  (PDF, slike, XML, DOCX, XLSX, CSV…), **čita njegov sadržaj** i pridružuje ga stvarnim
  projektima, dobavljačima, ugovorima i jedinicama koje dokument spominje.
- Detekcija duplikata; dokumenti niske pouzdanosti završavaju u redu „Nekategorizirano"
  za ljudsku provjeru — ništa se ne zagubi krivim spremanjem.
- Preglednik dokumenata sa stablom kategorija i vezama na entitete.

**Talking point:** ovo je pravi „wow" demo — proslijedite PDF račun uživo na pozornici i
gledajte kako se pojavljuje, kategoriziran i povezan, u modulu Dokumenti.

### 10. AI asistent (chat)

**U jednoj rečenici:** Ugrađeni AI analitičar — pitajte ga o projektima, ugovorima i računima običnim jezikom, odgovara na hrvatskom.

- Plutajući chat widget dostupan bilo gdje u aplikaciji, pogonjen Claudeom s kuriranim
  setom od 10 alata nad podacima (projekti, faze, ugovori, podizvođači, računi,
  plaćanja).
- Strogo **read-only** — smije odgovarati i analizirati, nikad mijenjati podatke.
- Rad prikazuje uživo (vidite koje podatke konzultira); odgovara **na hrvatskom bez
  obzira na jezik pitanja** — namjerno, jer su miješani lokalni zapisi brojeva u
  financijama opasni (zarez naspram točke mijenja iznos 100×).
- Na zahtjev generira dokumente za preuzimanje: PDF, Excel, Markdown.

**Talking point:** „Koliko smo do sada platili podizvođačima na projektu X?" —
odgovoreno u sekundama, s brojkama povučenim uživo iz baze.

### 11. Zadaci, Kalendar i Chat

**U jednoj rečenici:** Lagana ugrađena suradnja — posao oko projekta ostaje pored projekta.

- **Zadaci:** zajednička lista zadataka cijele organizacije, grupirana po projektima —
  jednostavne kvačice otvoreno/riješeno, dodijeljene osobe, rokovi, privici, komentari
  s @spominjanjem, privatni zadaci. (Namjerno pojednostavljeno nakon povratne
  informacije direktora — dobra priča o slušanju korisnika.)
- **Kalendar:** događaji s RSVP-om, pogledi mjesec/tjedan/dan/agenda, ponavljajući
  događaji, te osobni overlay rokova vlastitih zadataka.
- **Chat:** 1-na-1 i grupni razgovori s privicima i real-time oznakama nepročitanog.

### 12. Dnevnik aktivnosti (revizijski trag)

**U jednoj rečenici:** Svako kreiranje, izmjena, brisanje, uvoz i izvoz u sustavu je zabilježeno — tko, što, kada.

- Središnji revizijski trag kroz sve module, s razinama ozbiljnosti (financijske
  operacije i brisanja označena visokom).
- Pregled dostupan samo direktoru, s poveznicama natrag na promijenjene entitete.

**Talking point:** u poslu koji okreće milijune eura, „tko je promijenio ovu cijenu i
kada" ne smije biti misterij.

---

## ERP integracija — podatkovna kičma sustava

**Poanta za pozornicu:** računovodstvo knjiži **jednom, u ERP-u** — sustavu koji već
koriste i kojem vjeruju. Cognilion iz ERP-a automatski povlači financijsku istinu i
pretvara je u upravljačku inteligenciju. Nema dvostrukog unosa, nema prepisivanja.

Kako radi:

1. **Automatska sinkronizacija** — Cognilion inkrementalno povlači račune i plaćanja iz
   ERP API-ja (kursor `updated_since`, ciklus ~15 minuta; webhooci za gotovo trenutni
   prijenos). Storna i obrisani dokumenti sinkroniziraju se također — lokalna kopija
   nikad ne odstupa.
2. **Automatsko povezivanje bez ljudskog unosa:**
   - **Projekt** ← izveden iz **mjesta troška** koje računovodstvo ionako upisuje pri
     knjiženju (šifrarnik mapiranja MT → projekt održava se u Cognilionu).
   - **Kategorija troška** ← izvedena iz **konta** (kontni plan → interna kategorija).
   - **Firma i partner** ← upareni preko **OIB-a**.
3. **Čovjek samo tamo gdje dodaje vrijednost** — veze koje ERP ne poznaje (ugovor,
   situacija, stan, kreditna linija) dodjeljuju se u Cognilionu; unutar projekta
   izvedenog iz mjesta troška lista kandidata je kratka pa je to par klikova. Računi
   koje nije moguće automatski uparivati čekaju u redu **„nepovezani računi"**.
4. **Stanja žiro računa iz ERP-a** — umjesto ručnog preračunavanja, Cognilion prikazuje
   mjerodavno ERP/bančino stanje po računu i radi usklađenje.
5. **Sve nizvodno radi samo** — statusi računa, realizacija ugovora, napredak situacija,
   iskorištenost kredita i svi dashboardi izvode se database triggerima nad
   sinkroniziranim podacima. Cijela platforma vozi na knjigovodstvenoj istini,
   automatski.
6. **Hrvatske specifičnosti preživljavaju integraciju** — multi-PDV razrada (do 4
   stope), cesija (s OIB-om stvarnog platitelja) i kompenzacija (s brojem izjave)
   prvorazredni su pojmovi sync modela, a ne bilješke u opisu.

**Formulacije za pozornicu:**
- „Računovođa proknjiži račun u ERP-u. Petnaest minuta kasnije račun je u Cognilionu —
  već na pravom projektu i kategoriji troška — i svaki dashboard, ugovor i kreditna
  linija to odražavaju."
- „Mjesto troška i konto — podaci koje računovodstvo ionako unosi — postaju ključevi
  koji cijeli sustav slažu automatski."
- „Nismo izgradili još jedan računovodstveni program. Izgradili smo sloj inteligencije
  iznad onoga koji već imate."

---

## Prijedlog scenarija prezentacije

1. **Problem** — podaci development firme žive u Excelu, računovodstvenom programu i
   inboxima; nitko nema trenutnu sliku, a konsolidacija se radi ručno, jednom mjesečno,
   sa zakašnjenjem.
2. **Platforma** — jedan sustav, cijeli životni ciklus: zemljište → gradnja → prodaja →
   financiranje → izvještavanje. (Slajd „Platforma ukratko".)
3. **Pratite novac kroz jedan projekt** — projekt → ugovor s podizvođačem (Nadzor) →
   račun proknjižen u ERP-u pojavljuje se sam (Cashflow) → stan prodan (Prodaja) →
   tranša kredita povučena (Financiranje) → direktorski dashboard se ažurira. Jedna
   nit, pet modula, nula ručnih prijenosa.
4. **Građeno za Hrvatsku** — multi-PDV, cesija, kompenzacija, TIC, mjesta troška, OIB:
   domenska dubina koju generički alati nemaju.
5. **AI sloj** — pošaljite dokument e-mailom, sam se arhivira; pitajte asistenta,
   odgovara iz živih podataka. (Najbolji trenutak za live demo.)
6. **ERP integracija** — knjiži se jednom, u ERP-u; Cognilion knjigovodstvo automatski
   pretvara u upravljačku inteligenciju.
7. **Povjerenje** — prava po ulogama nametnuta u samoj bazi (RLS), potpuni revizijski
   trag, dashboardi po ulozi.

---

## Hrvatska domenska dubina (podsjetnik za pitanja iz publike)

| Pojam | Što je | Zašto je jak argument |
|---|---|---|
| Multi-PDV račun | Jedan račun, do 4 PDV stope (25/13/5/0 %) | Hrvatska zakonska stvarnost; generički alati to ne modeliraju |
| Cesija | Treća firma plaća dug u naše ime (ustup tražbine) | Prvorazredni tip plaćanja s vlastitom logikom, ne bilješka u opisu |
| Kompenzacija | Međusobni prijeboj dugovanja dviju firmi | Isto — modelirana s vlastitom trigger logikom stanja računa |
| Situacija | Privremena/okončana obračunska situacija u građenju | Realizacija ugovora s podizvođačem izvodi se automatski iz njih |
| TIC | Troškovna Informatička Struktura — razrada troškova investicije | Plan vs. stvarnost troškova, stavku po stavku, po projektu |
| Mjesto troška / konto | ERP-ove dimenzije knjiženja | Ključevi koji omogućuju automatsko vezanje računa na projekt i kategoriju |
| OIB | Osobni identifikacijski broj | Osnova automatskog uparivanja partnera i firmi u ERP sinkronizaciji |

---

## Uloge i profili (ako zatreba slajd o pristupu)

- **5 uloga** određuje što korisnik *smije*: Director, Accounting, Sales, Supervision,
  Investment. Financijski osjetljive tablice čuva row-level security u samoj bazi.
- **6 profila** određuje što korisnik *gleda*: General, Supervision, Sales, Funding,
  Cashflow, Retail — svaki profil ima vlastitu navigaciju i dashboard, a korisnik ih
  mijenja usred sesije. Profil ≠ uloga: ista osoba ujutro može raditi u prodajnom, a
  popodne u nadzornom okruženju.
