---
id: sales-projects
title: Prodajni projekti
keywords: [prodajni projekti, sales projects, zgrade, jedinice, masovno kreiraj, uvezi excel]
routes: [/sales-projects]
roles: [Director, Accounting, Sales, Investment]
---

**Prodajni projekti** je trorazinska navigacija prodajnih projekata: **Projekti → Zgrade → Jedinice** (stanovi, garaže, repozitoriji).

U prikazu zgrada dostupne su akcije: **Uvezi stanove iz Excela**, **Masovno kreiraj zgrade**, **Dodaj jednu zgradu**.

U prikazu jedinica dostupne su sličnice akcije za odabrani tip (stanovi/garaže/repozitoriji): **Uvezi garaže iz Excela**, **Masovno kreiraj [jedinice]**, **Dodaj jednu [jedinicu]**. Tipovi jedinica nalaze se kao tabovi: **Stanovi**, **Garaže**, **Repozitoriji**.

Filtri statusa: **Dostupno / Rezervirano / Prodano**. Dostupne su i akcije **Povezivanje garaže/repozitorija sa stanom**, **Masovno usklađivanje cijena** (povećanje ili smanjenje po tipu jedinice) te **Završetak prodaje** s dodjelom kupca.

## Uvoz stanova iz Excela

Gumb **Uvezi iz Excela** u prikazu zgrada otvara prozor **Uvezi stanove iz Excela**. Gumb **Preuzmi predložak** u tom prozoru daje praznu tablicu s ispravnim redoslijedom stupaca i listom **Upute**.

Čita se samo prvi list; zaglavlje je u 1. retku, a podaci počinju od 2. retka. Važan je redoslijed stupaca, ne nazivi u zaglavlju:

- **Obavezno:** A – zgrada (naziv mora odgovarati postojećoj zgradi projekta), D – oznaka stana, J – stan m2 prodajno, L – cijena stana.
- **Neobavezno:** B – ulaz, C – kat, E – tip, F – sobnost, H – otvorena površina, I – otvorena površina s koeficijentom, K – cijena po m2.
- **M–O – parking** (oznaka, m2, cijena) i **P–R – repozitorij** (oznaka, m2, cijena): garaža ili repozitorij kreira se i povezuje sa stanom samo ako su sva tri polja popunjena.
- **T – datum potpisa predugovora** (DD.MM.GGGG) — jedini stupac s datumom.
- **U – kapara 10 %, V–Y – rate 1–4, Z – kredit etažiranje 90 %:** u sve te stupce upisuju se **iznosi u EUR, ne datumi**. Način plaćanja određuje se sam: rate ako je popunjen bilo koji od stupaca V–Y, inače kredit ako je popunjen Z. Redak u kojem je u nekom od tih stupaca upisan datum ne uvozi se; u pregledu se navodi redak i stupac.
- G – zatvorena površina i S – ukupna cijena ne uvoze se.

Stan koji već postoji (ista zgrada i oznaka) ažurira se umjesto da se doda ponovno, a status mu se ne mijenja. Prije uvoza prikazuje se pregled s brojem valjanih i nevaljanih redaka i razlogom za svaki nevaljani.
