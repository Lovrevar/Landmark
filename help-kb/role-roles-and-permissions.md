---
id: role-roles-and-permissions
title: Pet uloga i što one mogu
keywords: [uloge, roles, Director, Accounting, Sales, Supervision, Investment, permissions]
routes: []
roles: [Director, Accounting, Sales, Supervision, Investment]
---

U sustavu postoji **5 uloga**, svaka s različitim ovlastima:

- **Director** — vidi sve module, sve projekte i sve financijske podatke. Jedina uloga s pristupom stranicama **Dnevnik aktivnosti** i **Izvještaji** u General profilu.
- **Accounting** — vidi sve module i sve financije osim Dnevnika aktivnosti i General izvještaja; jedina osim Director uloge kojoj se nudi Cashflow profil.
- **Sales** — radi u prodajnom modulu (Stanovi, Sales projekti, Kupci, Plaćanja, Dokumenti, Izvještaji). Ima pristup pregledu svih projekata, ali ne i financijskim rollupima; od plaćanja vidi samo prodajne uplate.
- **Supervision** — vidi samo svoj fiksni izbornik (Upravljanje gradilištem, Dnevnici radova, Dokumenti), ograničen na dodijeljene projekte. Pogledajte [[role-supervision-restrictions]].
- **Investment** — vidi investicijski (Funding) modul, sve projekte i nadzornu ploču, ali ne i Cashflow ni podatke o plaćanjima.

Sve uloge osim Supervision mogu mijenjati profil ([[role-profile-vs-role]]); Cashflow se u popisu profila nudi samo ulogama Director i Accounting.

Cashflow stranice, General izvještaji i Dnevnik aktivnosti preusmjeravaju neovlaštene uloge na početnu stranicu; ostale stranice se otvore, ali prikazuju samo podatke koje vaša uloga smije vidjeti. Na stranici **Pomoć** prikazuju se samo upute namijenjene vašoj ulozi.
