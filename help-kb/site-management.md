---
id: site-management
title: Upravljanje gradilištem
keywords: [upravljanje gradilištem, site management, gradilište, nadzor, faze, plaćanja]
routes: [/site-management]
roles: [Director, Supervision]
---

**Upravljanje gradilištem** je glavna stranica nadzornika. Naslov: **Upravljanje gradilištem**, podnaslov **Pregled svih gradilišnih projekata**. Korisnici s ulogom **Supervision** automatski se preusmjeravaju na ovu stranicu pri prijavi.

Prikaz: mreža projektnih kartica. Klik na projekt otvara detaljni modal s harmonikom faza, popisom podugovaratelja po fazi, evidencijom plaćanja, prekretnicama i komentarima.

Glavne akcije u modalu: postavljanje faza, uređivanje faza, dodavanje i uređivanje podugovaratelja, povijest plaćanja. Gumbi za plaćanja prikazani su samo korisnicima koje funkcija `canManagePayments` smatra ovlaštenima (Director, Accounting, Investment).

Korisnici **Supervision** vide samo projekte na koje su dodijeljeni — RLS pravila ograničavaju vidljivost.
