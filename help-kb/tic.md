---
id: tic
title: TIC — Struktura troškova investicije
keywords: [TIC, Troškovna Informatička Struktura, struktura troškova, vlastita sredstva, kreditna sredstva, građenje, uvoz iz Excela, budžet projekta, klasifikacija troška, faze u TIC-u]
routes: [/tic]
roles: [Director, Accounting, Investment]
---

**TIC** (**Troškovna Informatička Struktura**) je matrica troškova investicije po projektu. Naslov stranice: **TIC - Struktura Troškova Investicije**.

Projekt se odabire iz padajućeg izbornika **Odaberi projekt:**. Svi iznosi su bez PDV-a.

## Dvije kartice

Stranica ima dvije kartice koje odgovaraju dvama listovima standardne Excel tablice:

- **Investicija** — ravan popis kategorija troška (priprema projekta, zemljište, građenje, nadzor...)
- **Građenje** — hijerarhijska razrada troškova građenja po skupinama **A) Građevinski radovi**, **B) Obrtnički radovi**, **C) Instalaterski radovi**, sa stavkama označenim rimskim brojevima

Obje kartice imaju stupce **NAMJENA**, **VLASTITA SREDSTVA** (EUR + %), **KREDITNA SREDSTVA** (EUR + %) i **UKUPNA INVESTICIJA**. Kartica Investicija ima još stupac **Klasifikacija troška** i po jedan stupac za svaku fazu koju TIC planira (**Faza 1**, **Faza 2** …).

Retci **Ukupno** (po skupini) i **UKUPNO: / SVEUKUPNO:** izračunavaju se automatski i ne uređuju se ručno.

Kartice su međusobno neovisne — zbroj na kartici Građenje ne upisuje se automatski u redak *Građenje* na kartici Investicija.

## TIC je jedini izvor budžeta

**Budžet projekta i budžeti faza dolaze isključivo iz TIC-a.** Nigdje drugdje se ne upisuju — u
obrascu projekta, kod postavljanja faza i u prikazu budžeta po klasifikaciji iznosi su samo za
čitanje. Projekt koji nema TIC nema ni budžet, pa na karticama i obrascima projekta piše
**Budžet nije postavljen**, a ne 0.

Kada spremite TIC, sustav sam izračunava:

- **budžet projekta** — zbroj kartice Investicija
- **faze projekta** — one faze koje TIC navodi
- **budžet svake faze** — njezin dio plana
- **budžet po (fazi × klasifikaciji)** — ono što se vidi na karticama faza u [[site-management]]

Dvije zaštite vrijedi znati:

- **Spremanje praznog TIC-a ništa ne mijenja.** Svaki projekt prikazuje predložak bez obzira je li
  išta uneseno, pa je prazan TIC lako spremiti nehotice; da nije te zaštite, budžet projekta bi se
  time obrisao.
- **Faza na kojoj postoje ugovori ili radni dnevnici nikada se ne briše**, čak ni kada je TIC
  prestane planirati — takvoj se fazi budžet postavi na 0.

Samo kartica **Investicija** ulazi u budžet. Kartica Građenje je razrada jednog retka
(*Građenje*), pa bi njezino zbrajanje udvostručilo najveću stavku plana.

## Klasifikacija troška po retku

Svaki redak na kartici Investicija ima stupac **Klasifikacija troška** — na što se taj novac troši (*Zemljište*,
*Priprema i razvoj*, *Izgradnja i uređenje*, *Opremanje*, *Kontrola*, *Financiranje i nadzor*,
*Nepredviđeni troškovi*). Šesnaest standardnih redaka dolazi s već postavljenom klasifikacijom,
ali je svaka promjenjiva: ako novi redak treba ići pod *Izgradnja i uređenje*, dovoljno ga je tamo
odabrati.

Redak bez klasifikacije ima odabrano **— nije klasificirano —** i ne ulazi ni u jedan budžet po
klasifikaciji. Ispod tablice, u odjeljku **Plan po klasifikaciji troška**, taj se iznos prikazuje
narančasto kao **Neraspoređeno u TIC-u**, da se ne izgubi.

Razliku između faze i klasifikacije objašnjava [[term-faza-vs-prekretnica]].

## Faze u TIC-u

TIC može planirati i **kada** se novac troši. Faze se dodaju gumbom **Dodaj fazu** ispod tablice
na kartici Investicija ili dolaze iz Excela (zaglavlja **FAZA 1**, **FAZA 2** …). Svaka faza dobiva
stupac **Faza n**, a zbroj po fazi vidi se u retku **UKUPNO:**. Uz gumb je „?” koji ukratko
objašnjava faze.

Klikom na ćeliju faze otvara se prozor **Raspodjela po fazama** za taj redak, s dvije mogućnosti:

- **Raspodjela po fazama** — upisuju se vlastita i kreditna sredstva retka za svaku fazu, ručno ili
  gumbom **Ravnomjerno raspodijeli**. Prozor prikazuje **Zbroj po fazama** i **Ukupno u retku**.
- **Trošak na razini projekta (nije fazirano)** — trošak nastaje jednom za cijeli projekt (npr.
  *Vrijednost zemljišta*), računa se jednom i **ne pripada nijednoj fazi**. U stupcima faza
  prikazuje se kao „—”.

„—” nije propust: u izvornoj tablici takav redak često ponavlja isti puni iznos u svakom stupcu
faze, a zbrajanje bi izmislilo novac koji ne postoji. Taj se iznos u [[site-management]] prikazuje
kao **Nije fazirano**.

Ako zbroj po fazama ne odgovara vlastitim ili kreditnim sredstvima retka, uz ukupni iznos retka
pojavljuje se žuti trokut upozorenja; klik na njega objašnjava što učiniti — uskladiti raspodjelu
klikom na ćeliju faze ili ispraviti iznos retka. Ništa se ne ispravlja automatski: raspodjela se
sprema kako je upisana.

Ikona koša u zaglavlju faze uklanja tu fazu iz svih redaka (uz potvrdu); faze nakon nje se
prenumeriraju.

TIC bez ijednog faziranog retka opisuje projekt kao cjelinu: cijeli budžet dobiva Faza 1 (stvara
se ako projekt nema faza), a ostale postojeće faze ostaju s budžetom 0.

## Uređivanje stavki

Svaki projekt ima svoj skup stavki; početne vrijednosti su samo predložak. Za svaki redak dostupno je:

- uređivanje naziva i iznosa izravno u tablici
- **strelice gore/dolje** za promjenu redoslijeda
- **koš za smeće** za uklanjanje retka
- **Dodaj stavku** za novi redak (na obje kartice) i **Dodaj skupinu** za novu skupinu (samo na kartici Građenje)

Uklanjanje skupine briše i sve njezine stavke, pa se traži potvrda. Nijedna izmjena nije trajna dok se ne klikne **Spremi**; dok ima nespremljenih izmjena, uz gumbe piše **Nespremljene promjene**.

## Akcije

- **Spremi** — pohrana izmjena
- **Uvoz iz Excela** — učitavanje strukture iz Excel datoteke (vidi niže)
- **Export Excel** — izvoz obje kartice u `.xlsx` datoteku s listovima INVESTICIJA i GRAĐENJE; ako TIC planira faze, list INVESTICIJA sadrži i stupce **FAZA n**, a zadnji stupac **KLASIFIKACIJA** nosi klasifikaciju troška svakog retka, pa se izvezena datoteka može ponovno uvesti bez gubitka podjele po fazama i klasifikacija
- **Export PDF** — izvoz u PDF, po jedna stranica za svaku karticu

Izvoz ne sadrži stupce faza — raspodjela po fazama ostaje samo u aplikaciji.

## Uvoz iz Excela

**Uvoz iz Excela** učitava `.xlsx` ili `.xls` datoteku (gumb **Učitaj datoteku**) i **zamjenjuje sve stavke** na karticama za koje je u datoteci pronađen odgovarajući list; kartica bez lista ostaje nepromijenjena. Prije nego se išta promijeni prikazuje se pregled — koji je list učitan u koju karticu, koliko je stavki i faza pronađeno te koji su listovi preskočeni — a uvoz se potvrđuje gumbom **Zamijeni podatke**.

Datoteka treba imati listove **INVESTICIJA** i **GRAĐENJE**. Listovi drugačijeg naziva prepoznaju se po obliku tablice (list građenja ima prvi stupac s oznakama A), B), C) i rimskim brojevima). Stupci se pronalaze automatski prema retku zaglavlja koji sadrži **NAMJENA** i **VLASTITA SREDSTVA**, pa razlika u rasporedu stupaca između dvaju listova nije problem. Prazni retci te retci *Ukupno* i *SVEUKUPNO* se preskaču.

Faze su neobavezne: ako list INVESTICIJA iznad skupine stupaca svake faze ima zaglavlje **FAZA 1**,
**FAZA 2** … (s istim rasporedom kao ukupni iznos: vlastita sredstva, %, kreditna sredstva), uvoz
ih prepoznaje i raspoređuje iznose po fazama.

- Redak u kojem svaka faza ponavlja puni iznos retka, ili su mu stupci faza prazni, uvozi se kao
  nefaziran — u pregledu pod **Nije fazirano:**.
- Redak čiji zbroj po fazama ne odgovara ukupnom iznosu uvozi se točno kako je napisan i navodi
  se u pregledu pod **Provjerite raspodjelu:** — treba ga ručno ispraviti (u tablici ima žuti
  trokut).

Uvezeni retci zadržavaju klasifikaciju troška prema nazivu; retku s nepoznatim nazivom
klasifikaciju treba postaviti ručno.

Nakon uvoza podaci su samo prikazani — treba kliknuti **Spremi** da bi se trajno pohranili. Ako uvoz nije bio ispravan, promijenite projekt ili napustite stranicu i u dijalogu **Nespremljene promjene** odaberite **Izađi bez spremanja**. Tek **Spremi** prenosi budžete na projekt i faze.

Na dnu stranice nalazi se sekcija za potpis: **INVESTITOR:**, **Za investitora:** (mjesto za potpis) i **Datum:**. Ako uvezena datoteka sadrži investitora i datum, ta se polja popunjavaju automatski.
