---
id: role-supervision-restrictions
title: Ograničenja Supervision uloge
keywords: [supervision restrictions, nadzor pristup, dodijeljeni projekti, assigned projects, RLS]
routes: []
roles: [Supervision]
---

Korisnici uloge **Supervision** imaju nekoliko posebnosti:

- **Fiksni izbornik** — nema dropdowna za promjenu profila. Vide isključivo svoj Supervision izbornik: **Upravljanje gradilištem**, **Dnevnici radova**, **Plaćanja**, **Računi**, **Dokumenti**.
- **Automatsko preusmjeravanje** — prilikom prijave odlaze ravno na [[site-management]], ne na opću nadzornu ploču.
- **Vidljivost ograničena na dodijeljene projekte** — kroz RLS pravila vide samo projekte na koje su eksplicitno dodijeljeni (tablica `project_managers`). Ostali projekti uopće se ne pojavljuju u popisima, plaćanjima ili računima.
- **Bez pristupa Cashflow modulu** — pogledajte [[role-cannot-see-cashflow]].
- **Imaju pristup neplaćenim računima** svojih projekata (u **Računi** stranici), ali ne i globalnim financijskim sažecima.

Ako nedostaje projekt koji bi trebao biti vidljiv, kontaktirajte Director ili administratora da vas dodijeli na taj projekt.
