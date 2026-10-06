---
id: role-cannot-see-cashflow
title: Zašto ne vidim Cashflow profil?
keywords: [ne vidim cashflow, no cashflow, pristup uskraćen, role gate]
routes: []
roles: [Sales, Supervision, Investment]
---

Profil **Cashflow** u dropdownu profila vide samo uloge **Director** i **Accounting**. Ulogama **Sales** i **Investment** on se u popisu profila uopće ne nudi, a uloga **Supervision** nema ni dropdown profila.

To nije bug — Cashflow sadrži osjetljive financijske podatke (cijeli pregled računa, plaćanja, dugova, kredita) za koje vaša uloga nije ovlaštena. Ako Cashflow stranicu pokušate otvoriti izravnom adresom, sustav vas vraća na početnu stranicu.

Što od financijskih podataka vidite sa svojom ulogom:
- **Sales** — prodajne uplate u [[sales-payments]]
- **Supervision** — nema pristup plaćanjima; neplaćene račune svojih projekata može zatražiti od AI asistenta
- **Investment** — investitore, investicije i projekte u Funding profilu ([[investment-projects]]); popis plaćanja u [[funding-payments]] za ovu ulogu ostaje prazan

Za pristup Cashflow profilu potrebna je promjena uloge — obratite se administratoru.
