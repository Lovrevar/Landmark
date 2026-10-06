---
id: site-management
title: Upravljanje gradilištem
keywords: [upravljanje gradilištem, site management, gradilište, nadzor, faze, klasifikacija troška, ugovori, završeno, raskinuto, budžet nije postavljen, nije fazirano]
routes: [/site-management]
roles: [Director, Supervision]
---

**Upravljanje gradilištem** je glavna stranica nadzora. Podnaslov: **Pregled svih gradilišnih projekata**. Korisnici s ulogom **Supervision** dolaze ovamo odmah nakon prijave i vide samo projekte koji su im dodijeljeni; ako ih nema, piše **Nemate dodijeljenih projekata**.

Prikaz: mreža kartica projekata (faze, alokacija budžeta, budžet, podugovaratelji, vremenski okvir) i gumb **Osvježi**. Klik na karticu otvara stranicu projekta; povratak je **Natrag na projekte**.

## Stranica projekta

Gore desno su: prekidač prikaza **Po fazama** / **Po klasifikaciji troška**, gumb **Sakrij završene i raskinute** (kad takvih ugovora ima), **Klasifikacije troškova** te **Postavi faze** odnosno **Uredi faze**.

- **Po fazama** — projekt je podijeljen na faze, a unutar svake faze vidite klasifikacije troška.
- **Po klasifikaciji troška** — projekt je podijeljen po stavkama troškovnika, a unutar svake vidite faze u kojima se taj trošak pojavljuje.

Oba prikaza sadrže iste ugovore i iste iznose, samo drugačije posložene; odabir se pamti. Ugovori su unutar toga grupirani još po kategoriji ugovora. Projekt sa samo jednom fazom ne prikazuje razinu faze.

Ispod zaglavlja stoji **Sažetak projekta**: **Ugovoreni iznos (bruto)**, **Isplaćeno**, **Neplaćeni ugovori**, **Preostali budžet** i, kad dio plana ne pripada nijednoj fazi, **Nije fazirano** (npr. cijena zemljišta). Iste pločice ponavljaju se na svakoj fazi.

## Tko vidi plaćanja

Iznose koji proizlaze iz plaćanja — **Isplaćeno**, **Neplaćeni ugovori**, iskorištenost budžeta, status plaćenosti ugovora te gumbe **Plaćanja** i **Računi** na ugovoru — vide samo **Director**, **Accounting** i **Investment**. Uloga **Supervision** vidi ugovorene iznose i budžete, ali ne i plaćanja. Plaćanja se ovdje samo pregledavaju; unose se u profilu **Cashflow**.

## Ugovori

Na fazi gumb **Dodaj podugovaratelja** dodaje ugovor (novi ili postojeći podugovaratelj, klasifikacija troška, kategorija ugovora, iznosi). Kartica ugovora ima **Uredi** i **Detalji**; **Obriši** vidi samo **Director**, kao i brisanje faze.

U **Uredi** se ugovoru mijenja **Status**: **Aktivan**, **Završeno** ili **Raskinuto**. Završeni i raskinuti ugovori ostaju na gradilištu i dalje se zbrajaju; **Sakrij završene i raskinute** skriva samo njihove kartice. Ugovor bez pisanog ugovora nosi oznaku **BEZ UGOVORA** — vidi [[term-has-contract]].

**Detalji** prikazuju opis posla, podatke i dokumente ugovora, prekretnice plaćanja i **Komentare nadzora** (tip: **Napomena**, **Posao završen**, **Problem**).

## Budžeti dolaze iz TIC-a

**Budžet projekta i budžeti faza ne unose se ovdje.** Izračunavaju se iz [[tic]] projekta. U zaglavlju stoji zelena oznaka **iz TIC-a** kad plan postoji; ako ne postoji, piše narančasto **Budžet nije postavljen** i iznos se ne prikazuje — i na kartici projekta i na stranici projekta.

Zato postavljanje i uređivanje faza traže samo naziv i datume. **Budžet po klasifikaciji troška** na fazi pokazuje **TIC plan**, koliko su uzele **Druge faze** i koliko pripada ovoj fazi; iznos koji nije raspodijeljen prikazuje se kao **Neraspoređeno**.

Ako projekt nema TIC, ugovori se svejedno mogu dodavati — provjera da iznos ugovora ne premašuje raspoloživi budžet vrijedi samo kad budžet postoji.
