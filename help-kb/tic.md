---
id: tic
title: TIC — Struktura troškova investicije
keywords: [TIC, Troškovna Informatička Struktura, struktura troškova, vlastita sredstva, kreditna sredstva, građenje, uvoz iz Excela, budžet projekta, klasifikacija troška, faze u TIC-u]
routes: [/tic]
roles: [Director, Accounting, Investment]
---

**TIC** (**Troškovna Informatička Struktura**) je matrica troškova investicije po projektu. Naslov stranice: **TIC - Struktura Troškova Investicije**.

Projekt se odabire iz padajućeg izbornika **Odaberite projekt**.

## Dvije kartice

Stranica ima dvije kartice koje odgovaraju dvama listovima standardne Excel tablice:

- **Investicija** — ravan popis kategorija troška (priprema projekta, zemljište, građenje, nadzor...)
- **Građenje** — hijerarhijska razrada troškova građenja po skupinama **A) Građevinski radovi**, **B) Obrtnički radovi**, **C) Instalaterski radovi**, sa stavkama označenim rimskim brojevima

Obje kartice imaju stupce: **Namjena**, **Klasifikacija troška**, **Vlastita sredstva** (EUR + %), **Kreditna sredstva** (EUR + %), **Ukupna investicija**, te po jedan stupac za svaku fazu koju TIC planira.

Retci **Ukupno** (po skupini) i **UKUPNO: / SVEUKUPNO:** izračunavaju se automatski i ne uređuju se ručno.

Kartice su međusobno neovisne — zbroj na kartici Građenje ne upisuje se automatski u redak *Građenje* na kartici Investicija.

## TIC je jedini izvor budžeta

**Budžet projekta i budžeti faza dolaze isključivo iz TIC-a.** Nigdje drugdje se ne upisuju — u
obrascu projekta, kod postavljanja faza i u prikazu budžeta po klasifikaciji iznosi su samo za
čitanje. Projekt koji nema TIC nema ni budžet i svugdje piše **„budžet nije postavljen”**, a ne 0.

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

Svaki redak ima stupac **Klasifikacija troška** — na što se taj novac troši (*Zemljište*,
*Priprema i razvoj*, *Izgradnja i uređenje*, *Opremanje*, *Kontrola*, *Financiranje i nadzor*,
*Nepredviđeni troškovi*). Šesnaest standardnih redaka dolazi s već postavljenom klasifikacijom,
ali je svaka promjenjiva: ako novi redak treba ići pod *Izgradnja i uređenje*, dovoljno ga je tamo
odabrati.

Redak bez klasifikacije prikazuje se kao **nemapiran** i ne ulazi ni u jedan budžet po
klasifikaciji — ispod tablice se vidi ukupan nemapiran iznos, u narančastom, da se ne izgubi.

Razliku između faze i klasifikacije objašnjava [[term-faza-vs-prekretnica]].

## Faze u TIC-u

TIC može planirati i **kada** se novac troši. Ako Excel tablica ima zaglavlja **FAZA 1**, **FAZA 2**
… , svaka faza dobiva svoj stupac, a ispod tablice se vidi zbroj po fazi.

Redak koji se troši jednom za cijeli projekt (npr. *Vrijednost zemljišta*) **ne pripada nijednoj
fazi** i u stupcima faza prikazuje se kao „—”. To nije propust: u izvornoj tablici takav redak
često ponavlja isti puni iznos u svakom stupcu faze, a zbrajanje bi izmislilo novac koji ne
postoji. Taj se iznos u [[site-management]] prikazuje kao **Nije fazirano**.

TIC bez ijednog faziranog retka opisuje projekt kao cjelinu i tada projekt ima jednu fazu.

## Uređivanje stavki

Svaki projekt ima svoj skup stavki; početne vrijednosti su samo predložak. Za svaki redak dostupno je:

- uređivanje naziva i iznosa izravno u tablici
- **strelice gore/dolje** za promjenu redoslijeda
- **koš za smeće** za uklanjanje retka
- **Dodaj stavku** / **Dodaj skupinu** za nove retke i skupine (samo na kartici Građenje)

Uklanjanje skupine briše i sve njezine stavke, pa se traži potvrda. Nijedna izmjena nije trajna dok se ne klikne **Spremi**.

## Akcije

- **Spremi** — pohrana izmjena
- **Uvoz iz Excela** — učitavanje strukture iz Excel datoteke (vidi niže)
- **Preuzmi Excel** — izvoz obje kartice u `.xlsx` datoteku s listovima INVESTICIJA i GRAĐENJE
- **Preuzmi PDF** — izvoz u PDF, po jedna stranica za svaku karticu

## Uvoz iz Excela

**Uvoz iz Excela** učitava `.xlsx` ili `.xls` datoteku i **zamjenjuje sve stavke u obje tablice**. Prikazuje se pregled — koji je list učitan u koju karticu i koliko je stavki pronađeno — prije nego se išta promijeni.

Datoteka treba imati listove **INVESTICIJA** i **GRAĐENJE** (ako nazivi ne odgovaraju, koristi se prvi i drugi list). Stupci se pronalaze automatski prema retku zaglavlja koji sadrži **NAMJENA** i **VLASTITA SREDSTVA**, pa razlika u rasporedu stupaca između dvaju listova nije problem. Prazni retci te retci *Ukupno* i *SVEUKUPNO* se preskaču.

Ako zaglavlje sadrži stupce **FAZA 1**, **FAZA 2** … , uvoz ih prepoznaje i raspoređuje iznose po
fazama. Redak čiji zbroj po fazama ne odgovara njegovu ukupnom iznosu tretira se kao nefaziran,
umjesto da se iznos nagađa.

Uvezeni retci zadržavaju klasifikaciju troška prema nazivu; retku s nepoznatim nazivom
klasifikaciju treba postaviti ručno.

Nakon uvoza podaci su samo prikazani — treba kliknuti **Spremi** da bi se trajno pohranili. Ako uvoz nije bio ispravan, dovoljno je promijeniti projekt bez spremanja. Tek **Spremi** prenosi budžete na projekt i faze.

Na dnu stranice nalazi se sekcija za potpis: **Ime investitora**, polje **Za investitora** (potpis) i **Datum**. Ako uvezena datoteka sadrži investitora i datum, ta se polja popunjavaju automatski.
