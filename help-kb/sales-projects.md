---
id: sales-projects
title: Sales projekti (zgrade i jedinice)
keywords: [sales projekti, prodajni projekti, sales projects, zgrade, jedinice, kreiraj zgrade, masovno kreiranje, uvezi iz excela, preuzmi predložak, postavi cijenu, rezerviraj, prodaj]
routes: [/sales-projects]
roles: [Director, Accounting, Sales, Investment]
---

Stranica **Sales projekti** (naslov na stranici: **Projekti**) je trorazinska navigacija: **Projekti → Zgrade → Jedinice** (stanovi, garaže, repozitoriji). Projekti su podijeljeni u tabove **Stambeno** i **Retail**; natrag se vraćate gumbima **Natrag na projekte** i **Natrag na zgrade**.

## Zgrade

U prikazu zgrada dostupni su gumbi:

- **Uvezi iz Excela** — uvoz stanova za cijeli projekt (vidi niže)
- **Kreiraj zgrade** — više zgrada odjednom (1–20); dobivaju nazive **Zgrada 1**, **Zgrada 2** …
- **Dodaj zgradu** — jedna zgrada s nazivom, opisom i brojem katova

## Jedinice

Tipovi jedinica su tabovi **Stanovi**, **Garaže** i **Repozitoriji** — vidi [[term-unit-types]]. Za odabrani tab dostupni su gumbi **Masovno kreiranje** i **Dodaj jednu** (uz naziv tipa); na tabu **Garaže** dodatno i **Uvezi garaže iz Excela**.

Filtar statusa: **Svi / Dostupno / Rezervirano / Prodano**.

Na kartici jedinice su gumbi **Rezerviraj** (dostupna jedinica) odnosno **Dostupno** (rezervirana), a na stanovima i **Prodaj**, koji otvara prozor **Završi prodaju** s odabirom postojećeg ili unosom novog kupca. Ikona lanca **Poveži garažu/repozitorij** na stanu povezuje ga s dostupnom garažom ili repozitorijem iz iste zgrade. Garaže i repozitoriji prodaju se uz stan: prodajom stana prodanima postaju i povezane jedinice.

Za promjenu cijena označite jedinice (kvadratić na kartici ili **Odaberi sve**) i kliknite **Postavi cijenu** — otvara se **Masovno ažuriranje cijena** (**Povećaj cijenu** / **Smanji cijenu** za iznos po m²). Prodane jedinice se preskaču.

## Uvoz stanova iz Excela

Gumb **Uvezi iz Excela** u prikazu zgrada otvara prozor **Uvezi stanove iz Excela**. Gumb **Preuzmi predložak** u tom prozoru daje praznu tablicu s ispravnim redoslijedom stupaca i listom **Upute**.

Datoteka se učitava gumbom **Analiziraj datoteku**. Čita se samo prvi list; zaglavlje je u 1. retku, a podaci počinju od 2. retka. Važan je redoslijed stupaca, ne nazivi u zaglavlju:

- **Obavezno:** A – zgrada (naziv mora odgovarati postojećoj zgradi projekta), D – oznaka stana, J – stan m2 prodajno, L – cijena stana.
- **Neobavezno:** B – ulaz, C – kat, E – tip, F – sobnost, H – otvorena površina, I – otvorena površina s koeficijentom, K – cijena po m2.
- **M–O – parking** (oznaka, m2, cijena) i **P–R – repozitorij** (oznaka, m2, cijena): garaža ili repozitorij kreira se i povezuje sa stanom samo ako su sva tri polja popunjena.
- **T – datum potpisa predugovora** (DD.MM.GGGG) — jedini stupac s datumom.
- **U – kapara 10 %, V–Y – rate 1–4, Z – kredit etažiranje 90 %:** u sve te stupce upisuju se **iznosi u EUR, ne datumi**. Način plaćanja određuje se sam: rate ako je popunjen bilo koji od stupaca V–Y, inače kredit ako je popunjen Z. Redak u kojem je u nekom od tih stupaca upisan datum ne uvozi se; u pregledu se navodi redak i stupac.
- G – zatvorena površina i S – ukupna cijena ne uvoze se.

Stan koji već postoji (ista zgrada i oznaka) ažurira se umjesto da se doda ponovno, a status mu se ne mijenja. Prije uvoza prikazuje se pregled s brojem valjanih i nevaljanih redaka i razlogom za svaki nevaljani.

## Tko što može

Zgrade i jedinice dodaju, uređuju, povezuju, rezerviraju i prodaju uloge **Director**, **Sales** i **Accounting**; brisati mogu samo **Director** i **Sales**. Ostale uloge stranicu samo pregledavaju i te gumbe ne vide.

## Uvoz garaža iz Excela

Gumb **Uvezi garaže iz Excela** na tabu **Garaže** uvozi garaže u otvorenu zgradu. Zaglavlje je u 1. retku, podaci od 2. retka: A – oznaka garaže, B – površina u m², C – cijena u EUR. Gumb **Preuzmi predložak** u prozoru uvoza preuzima praznu tablicu s tim zaglavljima. Postojeća garaža s istim brojem se ažurira. Repozitoriji nemaju zaseban uvoz — dolaze uz stanove (stupci P–R).
