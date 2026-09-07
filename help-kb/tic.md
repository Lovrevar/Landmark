---
id: tic
title: TIC — Struktura troškova investicije
keywords: [TIC, Troškovna Informatička Struktura, struktura troškova, vlastita sredstva, kreditna sredstva, građenje, uvoz iz Excela]
routes: [/tic]
roles: [Director, Accounting, Investment]
---

**TIC** (**Troškovna Informatička Struktura**) je matrica troškova investicije po projektu. Naslov stranice: **TIC - Struktura Troškova Investicije**.

Projekt se odabire iz padajućeg izbornika **Odaberite projekt**.

## Dvije kartice

Stranica ima dvije kartice koje odgovaraju dvama listovima standardne Excel tablice:

- **Investicija** — ravan popis kategorija troška (priprema projekta, zemljište, građenje, nadzor...)
- **Građenje** — hijerarhijska razrada troškova građenja po skupinama **A) Građevinski radovi**, **B) Obrtnički radovi**, **C) Instalaterski radovi**, sa stavkama označenim rimskim brojevima

Obje kartice imaju stupce: **Namjena**, **Vlastita sredstva** (EUR + %), **Kreditna sredstva** (EUR + %), **Ukupna investicija**.

Retci **Ukupno** (po skupini) i **UKUPNO: / SVEUKUPNO:** izračunavaju se automatski i ne uređuju se ručno.

Kartice su međusobno neovisne — zbroj na kartici Građenje ne upisuje se automatski u redak *Građenje* na kartici Investicija.

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

Nakon uvoza podaci su samo prikazani — treba kliknuti **Spremi** da bi se trajno pohranili. Ako uvoz nije bio ispravan, dovoljno je promijeniti projekt bez spremanja.

Na dnu stranice nalazi se sekcija za potpis: **Ime investitora**, polje **Za investitora** (potpis) i **Datum**. Ako uvezena datoteka sadrži investitora i datum, ta se polja popunjavaju automatski.
