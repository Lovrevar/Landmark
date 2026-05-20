---
id: role-cannot-see-cashflow
title: Zašto ne vidim Cashflow profil?
keywords: [ne vidim cashflow, no cashflow, pristup uskraćen, role gate]
routes: []
roles: [Sales, Supervision, Investment]
---

Profil **Cashflow** vidljiv je u dropdownu profila svim korisnicima koji ga mogu odabrati, ali stvarni pristup imaju samo uloge **Director** i **Accounting**.

Ako pokušate ući u Cashflow s drugom ulogom (Sales, Supervision, Investment), čak i s ispravnom lozinkom, sustav vas preusmjerava natrag na početnu stranicu. To nije bug — sadrži osjetljive financijske podatke (cijeli pregled računa, plaćanja, dugova, kredita) za koje vaša uloga nije ovlaštena.

Ako trebate vidjeti specifične financijske podatke u okviru svojih projekata:
- **Sales** — vidi prodajne uplate u [[sales-payments]]
- **Supervision** — vidi plaćanja podugovarateljima i neplaćene račune za vlastite projekte u [[supervision-payments]] i [[supervision-invoices]]
- **Investment** — vidi investicijske tokove u [[funding-payments]] i [[investment-projects]]

Za pristup punom Cashflow modulu potrebna je promjena uloge u administraciji.
