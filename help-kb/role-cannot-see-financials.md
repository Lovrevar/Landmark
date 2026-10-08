---
id: role-cannot-see-financials
title: Zašto ne vidim financijske sažetke?
keywords: [financijski sažetak, payment status, invoice summary, nemam pristup, role gate]
routes: []
roles: [Sales, Supervision, Investment]
---

Globalne financijske informacije (ukupni dug, sažetak svih računa, povijest plaćanja po podugovaratelju) dostupne su samo ulogama **Director** i **Accounting**.

Konkretno, sljedeće podatke AI asistent daje samo ulogama Director i Accounting:
- ukupni status plaćanja podugovaratelja (zbroj svih ugovora i računa)
- detaljna povijest plaćanja podugovaratelja
- globalni sažetak računa (broj, ukupni iznos, dospjelo)
- ukupni financijski sažetak projekta s rollupom troškova i prihoda

Isto vrijedi za cijeli Cashflow profil ([[role-cannot-see-cashflow]]), a stranice **Izvještaji** u General profilu i **Dnevnik aktivnosti** vidi samo Director.

**Iznimka:** popis **neplaćenih računa** AI asistent daje i ulozi **Supervision**, ali samo za projekte na koje je korisnik dodijeljen (mogu se pojaviti i računi projekata kojima nije dodijeljen nijedan voditelj).

Što vidite kao Sales, Supervision ili Investment:
- **Sales** — prodajne uplate i kupce ([[customers]], [[sales-payments]])
- **Supervision** — neplaćene račune svojih projekata preko AI asistenta; plaćanja ne vidi
- **Investment** — investitore, investicije i projekte u Funding profilu ([[investment-projects]]); podatke o plaćanjima ne vidi
