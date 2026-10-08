---
id: term-unit-types
title: Tipovi jedinica: stan, garaža, repozitorij
keywords: [tipovi jedinica, stan, garaža, repozitorij, storage, garage, povezivanje jedinica, poveži jedinice, paket]
routes: [/apartments, /sales-projects]
roles: [Director, Accounting, Sales, Investment]
---

U prodajnom modulu postoje tri tipa jedinica:

- **Stan** — stambena jedinica, glavni predmet prodaje
- **Garaža** — parkirno mjesto / garaža
- **Repozitorij** — pomoćna prostorija (spremište)

Garaže i repozitoriji mogu biti **povezani** sa stanom — prodaju se kupcu zajedno sa stanom, kao paket (zasebna prodaja garaže ili repozitorija nije moguća u [[sales-projects]]). Vezu uspostavlja akcija **Poveži jedinice** na kartici stana u [[apartments]] ili ikona lanca **Poveži garažu/repozitorij** na stanu u [[sales-projects]]. Uz stan s povezanim jedinicama prikazuje se i cijena **Ukupni paket**.

U [[sales-projects]] postoje zasebni tabovi **Stanovi**, **Garaže** i **Repozitoriji** — svaki tip ima masovno kreiranje i pojedinačno dodavanje. Uvoz iz Excela postoji za stanove (u prikazu zgrada) i garaže (tab **Garaže**); repozitoriji se uvoze zajedno sa stanovima.

Statusi su isti za sva tri tipa: **Dostupno** (bijela kartica, plava oznaka), **Rezervirano** (žuta), **Prodano** (zelena).
