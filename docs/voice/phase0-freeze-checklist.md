# Phase 0 — freeze checklist

Prepared 2026-09-24 on `feature/voice-assistant`, for the freeze of the phase 0 script in
[`tools/phase0/`](../../tools/phase0/). **Nothing here is frozen.** Every row of the five script CSVs is
still `review_status=draft`, so `record.html` will not start a real session yet. What this pass did:

1. Replaced the 20 placeholder entities with real names from the dev database (`nxvbglegqcgxlxvyfuht`,
   read-only SELECTs, names and activity counts only).
2. Set `accepted_alternates` for every fragile target, applying one rule: an alternate is a plausible
   **spelling of a correct hearing**, never a rescue of a misrecognition.
3. Re-read all five CSVs for Croatian that nobody would say on a call, and fixed it.

`python3 assign.py --check` and `python3 selftest.py` (105 checks) both pass. The assignment did not move,
because it depends on item ids only.

> **Before this pass**, the working tree held uncommitted `draft → frozen` flips on all 160 rows. There
> were no text edits, and the entities were still placeholders. That contradicts "leave everything draft",
> so it was **stashed, not discarded**: `git stash list` shows it as
> *"uncommitted review_status draft->frozen flips found before freeze-prep"*. Drop it with
> `git stash drop` once you've confirmed it was a test.

## 1. The 20 entities

The source is the dev project's `projects` and `subcontractors` tables. Activity counts are **from dev**,
which may lag production; check them against what you know. The `name` column keeps the database name
exactly. `target_form` is what a caller says, and it is what gets scored.

### Projects (10 of 10)

There are only 10 real projects; the other rows in the table are test data (`TEST`, `E2E Anchor Project`,
`aaaaaaaaa`, `e2e-…`). So all 10 are used, and none could be chosen for being more active.

| Id | Database row (`projects.name`) | Status | Contracts | Invoices | Last invoice | Spoken target |
|---|---|---|---|---|---|---|
| e01 | `Tar` (Tar) | In Progress | 32 | 70 | 2026-02-16 | **Tar** |
| e02 | `Precko Zapad` (Precko, Zagreb) | In Progress | 28 | 102 | 2026-02-23 | **Prečko Zapad** |
| e03 | `Zona 31` (Osijek) | In Progress | 12 | 8 | 2026-04-22 | **Zona 31** |
| e04 | `Zabok` (Zabok) | In Progress | 7 | 5 | 2026-02-23 | **Zabok** |
| e05 | `Samobor` (Samobor) | Planning | 5 | 10 | 2026-02-19 | **Samobor** |
| e06 | `Funtana` (Funtana Istra) | In Progress | 5 | 0 | — | **Funtana** |
| e07 | `Mala Savska Opatovina` (Savska Opatovina) | In Progress | 3 | 1 | 2026-01-29 | **Mala Savska Opatovina** |
| e08 | `Nin-retail` (Nin) | Planning | 49 | 0 | — | **Nin** |
| e09 | `Jastrebarsko - Retail` (Jastrebarsko) | Planning | 2 | 0 | — | **Jastrebarsko** |
| e10 | `Srebrenjak` (Srebrenjak, Zagreb) | In Progress | 0 | 0 | — | **Srebrenjak** |

- **Nin** and **Jastrebarsko**: the `-retail` / `- Retail` suffix is an internal naming convention. Nobody
  says it on a call, so the spoken target is the bare name.
- **Prečko Zapad**: the database spells it without the č, but it is said with one. Relaxed scoring folds
  diacritics, so either spelling from the recogniser counts.
- **Zona 31** is said "Zona trideset jedan", so that form is an alternate.

### Subcontractors (10 of 136)

Chosen by frequency (invoice count) and contract size, then balanced for the mix below.

| Id | Database row (`subcontractors.name`) | Contracts | Invoices | Last invoice | Projects | Spoken target |
|---|---|---|---|---|---|---|
| e11 | `GEO-INFORMATIČKI STUDIO d.o.o.` | 1 | 29 | 2026-02-23 | Precko Zapad | **Geo-informatički studio d.o.o.** |
| e12 | `ŠPINA d.o.o.` | 1 | 10 | 2025-09-22 | Tar | **Špina d.o.o.** |
| e13 | `HEP ELEKTRA d.o.o.` | 3 | 6 | 2026-02-12 | Jastrebarsko - Retail, Tar | **HEP Elektra** |
| e14 | `EL ROY d.o.o.` | 2 | 1 | 2025-07-17 | Tar, Zona 31 | **El Roy d.o.o.** |
| e15 | `ACO GRAĐEVINSKI ELEMENTI d.o.o.` | 1 | 5 | 2025-08-28 | Tar | **ACO Građevinski elementi** |
| e16 | `GEOENERGETIKA SOLUTIONS d.o.o.` | 3 | 2 | 2026-01-29 | Funtana, Mala Savska Opatovina, Zabok | **Geoenergetika Solutions d.o.o.** |
| e17 | `DRUGI FORMAT d.o.o.` | 2 | 0 | — | Funtana, Mala Savska Opatovina | **Drugi format d.o.o.** |
| e18 | `TRUTANIĆ d.o.o.` | 1 | 2 | 2026-02-16 | Tar | **Trutanić d.o.o.** |
| e19 | `KERAMIKA FRIŠČIĆ d.o.o.` | 1 | 2 | 2025-07-11 | Tar | **Keramika Friščić d.o.o.** |
| e20 | `CERAMICA KOREN j.d.o.o.` | 1 | 1 | 2025-06-30 | Tar | **Ceramica Koren j.d.o.o.** |

**Deliberately excluded:**

- **Named natural persons.** Notaries ("JB …"), a lawyer, and the many individual land sellers on Nin
  (for example the owners listed against Nin-retail). Their names are personal data, and `entities.csv`
  is committed to git. No `obrt` (sole trader, also a natural person) was chosen for the same reason.
- **Public bodies and institutions**, which are not subcontractors a caller asks about by trade: FINA, the
  commercial court, the tax office, Grad Zabok, Krapinsko-zagorska županija, insurers, banks.
- **Test rows**: `TEST`, `E2E Anchor Subcontractor`.

On spoken forms: **HEP Elektra** and **ACO Građevinski elementi** are said without "d.o.o.", as people
actually say them. The other 8 keep the legal form in the sentence, so the recogniser still has to handle
"d.o.o." / "j.d.o.o.". Scoring treats a trailing legal form as optional either way.

### The frozen mix

| Criterion | Required | Met by | Status |
|---|---|---|---|
| Legal form in the name | ≥ 5 | all 10 subcontractors (8 said aloud with it) | ✅ |
| Contains a surname | ≥ 3 | Trutanić d.o.o., Keramika Friščić d.o.o., Ceramica Koren j.d.o.o. | ✅ exactly 3, by my reading of these as surnames: please confirm |
| č / ć / đ / š / ž | ≥ 3 | Geo-informatički studio, Špina, ACO Građevinski elementi, Trutanić, Keramika Friščić (+ Prečko Zapad as spoken) | ✅ |
| Foreign origin | ≥ 2 | El Roy, ACO (German brand), Geoenergetika *Solutions*, *Ceramica* Koren | ✅ |
| 10 projects + 10 subcontractors | — | as above | ✅ |

No criterion is unmet. The surname count sits exactly at the minimum. If you'd rather have a margin,
the only more-surnamed candidates are natural persons, which were excluded above.

## 2. Accepted alternates

The rule: *would a human who understood the speaker plausibly write this?* If yes, it is an alternate. A
misrecognition is a miss, and the alternates must never rescue it. Alternates count under both strict and
relaxed scoring. Punctuation is deleted before matching, so `pdv-a` and `pdva` are one form. Both are
listed anyway, so the file reads as a spec.

### Terms (`sentences.csv`)

| Row | Target | Alternates | Rationale |
|---|---|---|---|
| t16_c1 | `PDV` | `pe de ve|p d v` | PDV is spelled out ("pe-de-ve"): letter-spaced and syllable forms, plus the suffix written attached, detached or joined. |
| t16_c2 | `PDV-a` | `pdv-a|pdva|pdv a|pe de ve a|p d v a` | PDV is spelled out ("pe-de-ve"): letter-spaced and syllable forms, plus the suffix written attached, detached or joined. |
| t16_c3 | `PDV` | `pe de ve|p d v` | PDV is spelled out ("pe-de-ve"): letter-spaced and syllable forms, plus the suffix written attached, detached or joined. |
| t17_c1 | `R1 račun` | `er jedan račun|r jedan račun|r 1 račun` | R1 is said "er jedan" or "r jedan": both, plus the digit written apart from the R. |
| t17_c2 | `R1 računa` | `er jedan računa|r jedan računa|r 1 računa` | R1 is said "er jedan" or "r jedan": both, plus the digit written apart from the R. |
| t17_c3 | `R1 račun` | `er jedan račun|r jedan račun|r 1 račun` | R1 is said "er jedan" or "r jedan": both, plus the digit written apart from the R. |
| t23_c1 | `OIB` | `o i b|o i be` | OIB is spelled out ("o-i-be"): letter-spaced forms, plus the suffix attached, detached or joined. |
| t23_c2 | `OIB-a` | `oib-a|oiba|oib a|o i b a|o i be a` | OIB is spelled out ("o-i-be"): letter-spaced forms, plus the suffix attached, detached or joined. |
| t23_c3 | `OIB` | `o i b|o i be` | OIB is spelled out ("o-i-be"): letter-spaced forms, plus the suffix attached, detached or joined. |
| t24_c1 | `IBAN` | `i b a n` | IBAN is spelled out: the letter-spaced form, plus the suffix attached, detached or joined. |
| t24_c2 | `IBAN-a` | `iban-a|ibana|iban a|i b a n a` | IBAN is spelled out: the letter-spaced form, plus the suffix attached, detached or joined. |
| t24_c3 | `IBAN` | `i b a n` | IBAN is spelled out: the letter-spaced form, plus the suffix attached, detached or joined. |
| t25_c1 | `TIC` | `tic|tik|tić` | TIC is one syllable with a Croatian c (/ts/), never spelled out: the tic / tik / tić spellings in each case form. |
| t25_c2 | `TIC-u` | `ticu|tic-u|tiku|tik-u|tiću` | TIC is one syllable with a Croatian c (/ts/), never spelled out: the tic / tik / tić spellings in each case form. |
| t25_c3 | `TIC-a` | `tica|tic-a|tika|tik-a|tića` | TIC is one syllable with a Croatian c (/ts/), never spelled out: the tic / tik / tić spellings in each case form. |

Compared with the previous draft, these were **removed**:

- TIC `t i c | te i ce`: TIC is not spelled out, so nobody who heard "tic" would write letters.
- IBAN `i ban`: not a spelling anyone would use for either pronunciation.
- OIB `oi be`: replaced by the properly letter-spaced `o i be`.

These were **added**:

- the `tić`-class forms for TIC;
- letter-spaced forms for PDV-a, OIB-a and IBAN (`p d v a`, `o i b a`, `i b a n`);
- `er jedan` / `r jedan` for R1 in every carrier.

### Entities (`entities.csv`)

| Entity | Target | Alternates | Rationale |
|---|---|---|---|
| e03 | `Zona 31` | `zona trideset jedan|zona trideset i jedan` | The number is said, not read as digits: the recogniser may write it in words. |
| e11 | `Geo-informatički studio d.o.o.` | `geo informatički studio|geoinformatički studio` | The hyphen is often written as a space, or dropped. |
| e14 | `El Roy d.o.o.` | `el roj|elroy|elroj` | An English name said "el roj": the Croatian sound-spelling, and the joined form. |
| e16 | `Geoenergetika Solutions d.o.o.` | `geo energetika solutions` | The compound is often split: "geo energetika". |
| e20 | `Ceramica Koren j.d.o.o.` | `čeramika koren|ceramika koren` | Italian "ceramica", said "čeramika": the Croatian sound-spellings. |

No alternates for the rest: case and diacritics are already handled by normalisation and relaxed
scoring, and the legal form is optional. **Not added on purpose:** `keramika koren` for Ceramica Koren. It
is a real word, but it's not how anyone who heard "čeramika" would spell it, so it would rescue a
misrecognition. The self-test also checks that no entity alternate is another entity's name.

## 3. Sentences changed

### Terms, amounts, questions

| Row | Before | After | Why |
|---|---|---|---|
| t03_c1 | Koji izvođač radi fasadu na projektu Kopko? | Koji izvođač radi fasadu na projektu Tar? | "Kopko" is a real **subcontractor** (Kopko d.o.o.), not a project; nobody would say "projekt Kopko". |
| t04_c2 | Račun podizvođača stigao je bez potpisa voditelja. | Račun podizvođača stigao je bez potpisa voditelja gradilišta. | "potpis voditelja" on its own is unclear; it's the site manager's signature. |
| t10_c3 | Molim te provjeri sve ugovorne rokove. | Molim te, provjeri sve ugovorne rokove. | Comma after the address "Molim te", so the sentence is read with natural phrasing. |
| t11_c3 | Ugovor za fasadu nema definiran rok izvođenja. | U ugovoru za fasadu nije definiran rok izvođenja. | "nema definiran rok" is accusative after negation; the natural construction keeps the term last. |
| t17_c3 | Molim dobavljača da nam pošalje R1 račun. | Dobavljač nam još nije poslao R1 račun. | "Molim dobavljača da…" is not something anyone says to an assistant; the new sentence is a status statement. |
| t23_c1 | Koji je OIB tvrtke Građevinar? | Koji je OIB tog izvođača? | "tvrtke Građevinar" was a made-up company from the test fixtures. |
| t25_c1 | Je li TIC za projekt Kopko već unesen? | Je li TIC za projekt Zabok već unesen? | Kopko is a subcontractor, not a project (see t03_c1). |
| a10 | Mjesečna najamnina skele je devetsto devedeset devet eura i devedeset devet centi. | Mjesečni najam skele je devetsto devedeset devet eura i devedeset devet centi. | "najamnina skele" is not what people say; it's "najam skele". |
| q02 | Jesmo li još uvijek u okviru proračuna za Kopko? | Jesmo li još uvijek u okviru proračuna za Tar? | Kopko is a subcontractor; the budget question is about a project. |
| q08 | Jesu li svi aneksi ugovora za Kopko potpisani? | Jesu li svi aneksi ugovora za Samobor potpisani? | Same reason; the replacement keeps the question numeral-free (so not "Zona 31"). |

Checked and left alone:

- Funtana, Osijek (where Zona 31 is) and Zagreb in the carriers are consistent with the real data.
- The nominative / genitive mix in `dates.csv` ("je petnaesti listopada", "do trećeg svibnja") is deliberate.
- "išla je preko proračuna" (t13_c3) is colloquial, but it is what people say.

### Entities (all 40 rows, placeholder → real)

Every row was rewritten for its real name. C1 has the name as the subject of a question; C2 has it after an
oblique-case word, mid-sentence.

| Row | Before (placeholder) | After |
|---|---|---|
| e01_c1 | Kako napreduje Stambena zgrada Lipa? | Je li Tar još u izgradnji? |
| e01_c2 | Na projektu Stambena zgrada Lipa kasni fasada. | Na projektu Tar kasne radovi na fasadi. |
| e02_c1 | Je li Vila Maslina već u prodaji? | Kada se završava Prečko Zapad? |
| e02_c2 | Za projekt Vila Maslina još nemamo uporabnu dozvolu. | Troškovnik projekta Prečko Zapad treba ažurirati. |
| e03_c1 | Kada se završava Poslovni centar Zapad? | Je li Zona 31 dobila građevinsku dozvolu? |
| e03_c2 | Troškovnik projekta Poslovni centar Zapad treba ažurirati. | Za projekt Zona 31 potpisali smo novi ugovor. |
| e04_c1 | Koliko stanova ima Kvart Sunčana obala? | Je li Zabok još u okviru proračuna? |
| e04_c2 | U projektu Kvart Sunčana obala prodano je pola stanova. | Na projektu Zabok radi pet izvođača. |
| e05_c1 | Je li Residence Marina završena? | Je li Samobor već dobio građevinsku dozvolu? |
| e05_c2 | Za Residence Marina tražimo novog izvođača. | Za projekt Samobor još nemamo glavnog izvođača. |
| e06_c1 | Je li Park Jadran dobio građevinsku dozvolu? | Je li Funtana spremna za primopredaju? |
| e06_c2 | Financijski pregled projekta Park Jadran pošalji direktoru. | Financijski pregled projekta Funtana pošalji direktoru. |
| e07_c1 | Jesu li Garaže Čakovec u proračunu? | Koliko košta Mala Savska Opatovina? |
| e07_c2 | Gradnja projekta Garaže Čakovec počinje u proljeće. | Na projektu Mala Savska Opatovina kasni fasada. |
| e08_c1 | Je li Loft Tvornica spreman za primopredaju? | Je li Nin još u fazi planiranja? |
| e08_c2 | Na projektu Loft Tvornica radi pet izvođača. | Za projekt Nin kupili smo još jednu parcelu. |
| e09_c1 | Koliko košta Naselje Đurđevac? | Ima li Jastrebarsko već troškovnik? |
| e09_c2 | Za projekt Naselje Đurđevac potpisali smo aneks ugovora. | Ugovore za projekt Jastrebarsko potpisujemo idući tjedan. |
| e10_c1 | Je li Rezidencija Kaštel u drugoj fazi? | Je li Srebrenjak već u izgradnji? |
| e10_c2 | Izvođači na projektu Rezidencija Kaštel traže avans. | Izvođači na projektu Srebrenjak traže avans. |
| e11_c1 | Je li Horvat gradnja d.o.o. poslao situaciju? | Je li Geo-informatički studio d.o.o. poslao novi račun? |
| e11_c2 | Koliko još dugujemo tvrtki Horvat gradnja d.o.o. za fasadu? | Račune od tvrtke Geo-informatički studio d.o.o. plaćamo svaki mjesec. |
| e12_c1 | Radi li Kovačević i sinovi j.d.o.o. još na Funtani? | Je li Špina d.o.o. dostavila ponudu? |
| e12_c2 | Ugovor s tvrtkom Kovačević i sinovi j.d.o.o. ističe u lipnju. | S tvrtkom Špina d.o.o. imamo ugovor za vodoinstalacije. |
| e13_c1 | Je li Elektro Babić obrt završio instalacije? | Je li HEP Elektra spojila struju na gradilištu? |
| e13_c2 | Račun od izvođača Elektro Babić obrt stigao je jučer. | Račun od tvrtke HEP Elektra stigao je jučer. |
| e14_c1 | Koje ugovore ima Novak inženjering d.o.o.? | Je li El Roy d.o.o. potpisao ugovor za Tar? |
| e14_c2 | S tvrtkom Novak inženjering d.o.o. imamo tri ugovora. | S izvođačem El Roy d.o.o. imamo najveći ugovor na projektu. |
| e15_c1 | Kada Stolarija Jurić obrt montira prozore? | Je li ACO Građevinski elementi isporučio kanalice? |
| e15_c2 | Ponudu od izvođača Stolarija Jurić obrt treba odobriti. | Narudžbu od tvrtke ACO Građevinski elementi još nismo potvrdili. |
| e16_c1 | Je li Hidro Šimić d.o.o. dostavio jamstvo? | Je li Geoenergetika Solutions d.o.o. predala elaborat? |
| e16_c2 | Tvrtki Hidro Šimić d.o.o. isplatili smo avans. | Plaćanja prema tvrtki Geoenergetika Solutions d.o.o. kasne dva tjedna. |
| e17_c1 | Ima li Schneider Bau GmbH otvorenih računa? | Radi li Drugi format d.o.o. još na Funtani? |
| e17_c2 | S tvrtkom Schneider Bau GmbH potpisali smo ugovor za fasadu. | Ugovor s tvrtkom Drugi format d.o.o. ističe u lipnju. |
| e18_c1 | Je li Tehnoplan d.o.o. predao troškovnik? | Je li Trutanić d.o.o. dostavio jamstvo? |
| e18_c2 | Plaćanja prema tvrtki Tehnoplan d.o.o. kasne dva tjedna. | Tvrtki Trutanić d.o.o. isplatili smo avans. |
| e19_c1 | Je li Petrović krovovi obrt popravio krov? | Kada Keramika Friščić d.o.o. dolazi postavljati pločice? |
| e19_c2 | Izvođaču Petrović krovovi obrt treba poslati nacrt ugovora. | Ponudu od tvrtke Keramika Friščić d.o.o. treba odobriti. |
| e20_c1 | Kada Adriatic Steel d.o.o. isporučuje armaturu? | Je li Ceramica Koren j.d.o.o. poslala račun za pločice? |
| e20_c2 | Narudžbu od tvrtke Adriatic Steel d.o.o. još nismo potvrdili. | Pločice od tvrtke Ceramica Koren j.d.o.o. stižu u petak. |

## 4. What only you can do

Work through these in order. The script is frozen only after the last one.

- [ ] **Read-aloud pass (you, reviewer 1).**
  - Read every sentence in all five CSVs aloud at phone pace.
  - Mark anything that doesn't come out naturally, especially the 40 new entity carriers.
  - Check the real names are **said the way the table says**: HEP Elektra without "d.o.o."; ACO as "aco";
    El Roy as "el roj"; Ceramica as "čeramika"; Nin and Jastrebarsko without "retail".
  - If a name is said differently in the office, change `target_form` and the sentence together, in both
    carrier rows.
- [ ] **Confirm the entity choices.** Check the activity is right for production, not just dev, and that the three
      surname names read as surnames to you. Swapping a name means keeping the mix, and editing both rows.
- [ ] **Empirical fragile-take recording.**
  - One or two speakers, in `record.html?dryrun=1`, record just the fragile rows:
    - terms: t16, t17, t23, t24, t25;
    - entities: e03, e11, e14, e16, e20, and the one-syllable project names Tar and Nin.
  - Run `run_stt.py` on those takes.
  - Add any recurring spelling that passes the *correct-hearing* test to `accepted_alternates`, **before**
    freezing and never after seeing real scores.
  - Then delete the dry-run takes from `clean/`.
- [ ] **Reviewer 2.** An independent native speaker confirms all five CSVs.
- [ ] **Flip to frozen.** Set `review_status=frozen` on every row of the five CSVs (placeholder is already `n`).
  - Run `python3 assign.py --check` and `python3 selftest.py`, and commit.
  - The recorder then starts without `?dryrun=1`.
  - `selftest.py` has a check that everything is still draft. Delete that one check in the freeze commit;
    it is there to stop an accidental flip.
- [ ] **Deal with the stash** (see the note at the top): drop it, or apply it if the flip was intended.

