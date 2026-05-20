---
id: role-cannot-see-financials
title: Zašto ne vidim financijske sažetke?
keywords: [financijski sažetak, payment status, invoice summary, nemam pristup, role gate]
routes: []
roles: [Sales, Supervision, Investment]
---

Globalne financijske informacije (ukupni dug, sažetak svih računa, povijest plaćanja po podugovaratelju) dostupne su samo ulogama **Director** i **Accounting**.

Konkretno, alati AI asistenta i izvještaji koji daju sljedeće podatke vidljivi su samo Direktoru i Računovodstvu:
- ukupni status plaćanja podugovaratelja (zbroj svih ugovora i računa)
- detaljna povijest plaćanja podugovaratelja
- globalni sažetak računa (broj, ukupni iznos, dospjelo)
- ukupni financijski sažetak projekta s rollupom troškova i prihoda

**Iznimka:** alat **neplaćeni računi** dostupan je i ulozi **Supervision**, ali ograničen na njihove dodijeljene projekte.

Što vidite kao Sales, Supervision ili Investment:
- **Sales** — prodajne uplate i kupce ([[customers]], [[sales-payments]])
- **Supervision** — plaćanja i račune svojih projekata ([[supervision-payments]], [[supervision-invoices]])
- **Investment** — investicijske tokove ([[funding-payments]], [[investment-projects]])
