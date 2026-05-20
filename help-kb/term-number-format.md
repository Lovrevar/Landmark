---
id: term-number-format
title: Hrvatski format brojeva, valute i datuma
keywords: [format brojeva, format datuma, EUR, valuta, decimalna oznaka, hrvatski format]
routes: []
roles: [Director, Accounting, Sales, Supervision, Investment]
---

Sustav koristi hrvatske konvencije za formatiranje:

- **Brojevi:** točka kao razdjelnik tisućica, zarez kao decimalna oznaka. Primjer: **1.234,56**.
- **Valuta:** iznos s nastavkom **EUR**. Primjer: **1.234,56 EUR**. Sustav koristi euro kao zadanu valutu.
- **Datumi:** **dd.MM.yyyy.** (s točkama, uključujući završnu). Primjer: **19.05.2026.**

AI asistent u svojim odgovorima primjenjuje ova pravila — i kad se izvorni podaci nalaze u ISO formatu (`2026-05-19`) ili kao "raw" brojevi (`1234.56`), prikazuje ih u hrvatskom formatu.

**Pažnja:** zarez i točka u broju imaju suprotno značenje od engleskog formata. **1.000** u sustavu znači **tisuću**, a ne "jedan zarez nula nula nula".
