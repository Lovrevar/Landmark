---
id: site-management
title: Upravljanje gradilištem
keywords: [upravljanje gradilištem, site management, gradilište, nadzor, faze, plaćanja, budžet nije postavljen, budžet projekta, nije fazirano]
routes: [/site-management]
roles: [Director, Supervision]
---

**Upravljanje gradilištem** je glavna stranica nadzornika. Naslov: **Upravljanje gradilištem**, podnaslov **Pregled svih gradilišnih projekata**. Korisnici s ulogom **Supervision** automatski se preusmjeravaju na ovu stranicu pri prijavi.

Prikaz: mreža projektnih kartica. Klik na projekt otvara detaljni modal s harmonikom faza, popisom podugovaratelja po fazi, evidencijom plaćanja, prekretnicama i komentarima.

Ugovori su grupirani u tri razine: **faza** → **klasifikacija troška** → **kategorija ugovora** → kartice ugovora. Prekidačem gore desno možete zamijeniti prve dvije razine:

- **Po fazama** — projekt je podijeljen na Faza 1, Faza 2…, a unutar svake faze vidite stavke troškovnika.
- **Po klasifikaciji troška** — projekt je podijeljen po stavkama troškovnika (Zemljište, Priprema i razvoj…), a unutar svake vidite faze u kojima se taj trošak pojavljuje.

Oba prikaza sadrže iste ugovore i iste iznose, samo drugačije posloženo. Odabir prikaza se pamti.

Odmah ispod naslova projekta stoji **sažetak cijelog projekta** — ugovoreno, isplaćeno,
neplaćeno, preostalo i, kod faziranog TIC-a, **Nije fazirano**. Iste pločice ponavljaju se na
svakoj kartici faze, pa je zbroj kartica jednak sažetku iznad njih. Projekt koji ima samo jednu
fazu ne prikazuje razinu faze — klasifikacije troška stoje odmah ispod sažetka.

Pločica **Nije fazirano** je novac koji pripada projektu, ali nijednoj pojedinoj fazi (npr. cijena
zemljišta). Ona objašnjava zašto zbroj budžeta faza može biti manji od budžeta projekta.

## Budžeti dolaze iz TIC-a

**Budžet projekta i budžeti faza ne unose se ovdje.** Izračunavaju se iz [[tic]] projekta kad se
TIC spremi. U zaglavlju projekta stoji zelena oznaka **iz TIC-a** kad plan postoji; ako ne
postoji, piše narančasto **budžet nije postavljen** i iznos se ne prikazuje — i na kartici
projekta u mreži i u detaljima.

Zato su iznosi u obrascima samo za čitanje: postavljanje i uređivanje faze traže naziv i datume,
a prikaz budžeta po klasifikaciji pokazuje što TIC planira, koliko su druge faze već uzele i
koliko pripada ovoj fazi. Iznos koji nije raspodijeljen prikazuje se kao **Neraspoređeno**.

Ako projekt nema TIC, ugovori se svejedno mogu dodavati — provjera „iznos ugovora premašuje
budžet faze” vrijedi samo kada budžet postoji.

Glavne akcije u modalu: postavljanje faza, uređivanje faza, pregled budžeta po klasifikaciji, upravljanje klasifikacijama troška, dodavanje i uređivanje podugovaratelja, povijest plaćanja. Gumbi za plaćanja prikazani su samo korisnicima koje funkcija `canManagePayments` smatra ovlaštenima (Director, Accounting, Investment).

Korisnici **Supervision** vide samo projekte na koje su dodijeljeni — RLS pravila ograničavaju vidljivost.
