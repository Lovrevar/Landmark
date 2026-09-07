---
id: site-management
title: Upravljanje gradilištem
keywords: [upravljanje gradilištem, site management, gradilište, nadzor, faze, plaćanja]
routes: [/site-management]
roles: [Director, Supervision]
---

**Upravljanje gradilištem** je glavna stranica nadzornika. Naslov: **Upravljanje gradilištem**, podnaslov **Pregled svih gradilišnih projekata**. Korisnici s ulogom **Supervision** automatski se preusmjeravaju na ovu stranicu pri prijavi.

Prikaz: mreža projektnih kartica. Klik na projekt otvara detaljni modal s harmonikom faza, popisom podugovaratelja po fazi, evidencijom plaćanja, prekretnicama i komentarima.

Ugovori su grupirani u tri razine: **faza** → **klasifikacija troška** → **kategorija ugovora** → kartice ugovora. Prekidačem gore desno možete zamijeniti prve dvije razine:

- **Po fazama** — projekt je podijeljen na Faza 1, Faza 2…, a unutar svake faze vidite stavke troškovnika.
- **Po klasifikaciji troška** — projekt je podijeljen po stavkama troškovnika (Zemljište, Priprema i razvoj…), a unutar svake vidite faze u kojima se taj trošak pojavljuje.

Oba prikaza sadrže iste ugovore i iste iznose, samo drugačije posloženo. Odabir prikaza se pamti.

Budžet faze možete raspodijeliti po klasifikacijama troška (gumb s ikonom novčanika na kartici faze). Iznos koji nije raspodijeljen prikazuje se kao **Neraspoređeno**.

Glavne akcije u modalu: postavljanje faza, uređivanje faza, uređivanje budžeta po klasifikaciji, upravljanje klasifikacijama troška, dodavanje i uređivanje podugovaratelja, povijest plaćanja. Gumbi za plaćanja prikazani su samo korisnicima koje funkcija `canManagePayments` smatra ovlaštenima (Director, Accounting, Investment).

Korisnici **Supervision** vide samo projekte na koje su dodijeljeni — RLS pravila ograničavaju vidljivost.
