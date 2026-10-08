---
id: term-evm
title: EVM metrike: CPI, SPI, EAC, VAC
keywords: [EVM, CPI, SPI, EAC, VAC, earned value, kontrola proračuna, performanse, ostvarena vrijednost, prognoza]
routes: [/budget-control]
roles: [Director, Accounting, Investment]
---

**EVM** (Earned Value Management) je metodologija praćenja izvedbe projekta. Stranica [[budget-control]] prikazuje četiri glavne metrike za odabrani projekt (zbrojeno preko svih njegovih faza):

- **CPI** (indeks izvršenja troška) — ostvarena vrijednost radova podijeljena s plaćenim. **1,00 ili više** = troši se u okviru plana; **ispod 1,00** = radovi koštaju više od plana.
- **SPI** (indeks izvršenja rokova) — ostvarena vrijednost radova podijeljena s vrijednošću planiranom do danas. **1,00 ili više** = u skladu s planom; **ispod 1,00** = kasnimo.
- **EAC** (procjena ukupnog troška) — planirani proračun podijeljen s CPI-jem: koliko će projekt koštati ako se trošak nastavi kretati kao dosad.
- **VAC** (odstupanje na kraju projekta) — planirani proračun umanjen za EAC. Pozitivan iznos je očekivana ušteda, negativan očekivano prekoračenje.

Uz svaku od te četiri kartice nalazi se „?” s kratkim objašnjenjem metrike.

Ostvarena vrijednost računa se iz dovršenih prekretnica plaćanja na ugovorima; za ugovor bez prekretnica uzima se udio plaćenog u ugovorenom iznosu.

## Boje

Kartice CPI i SPI obojane su prema vrijednosti:

- **1,00 ili više** — zeleno (CPI: **Ispod proračuna ✓**, SPI: **U skladu s planom ✓**)
- **0,90–0,99** — žuto (**Malo iznad proračuna** / **Malo u zaostatku**)
- **ispod 0,90** — crveno (**Iznad proračuna ✗** / **U zaostatku ✗**)

Kartica VAC je zelena (**Ispod proračuna ✓**) kada je iznos nula ili pozitivan, a crvena (**Iznad proračuna ✗**) kada je negativan.

## Kada metrike nema

- Dok ništa nije plaćeno, CPI, EAC i VAC prikazuju „—” uz napomenu **Još nema plaćenih troškova**, jer još nema troška za usporedbu.
- Ako je CPI 0 (ima plaćanja, ali nema ostvarene vrijednosti), EAC i VAC prikazuju „—” uz napomenu **Nema prognoze: CPI je 0 (trošak bez ostvarene vrijednosti)**.
- SPI prikazuje „—” i napomenu **Nema faza s datumima početka i završetka** ako nijedna faza nema oba datuma. Računa se samo iz faza koje ih imaju.

## Grafikoni

Iznad EVM kartica su dva grafikona. Stupčasti grafikon **Kontrola proračuna** uspoređuje četiri iznosa projekta: **Planirano**, **Ugovoreno**, **Plaćeno** i **Prognoza (EAC)**. Grafikon **EVM indeksi performansi** prikazuje trenutni CPI i SPI projekta u odnosu na linije **Cilj (1.0)** i **Upozorenje (0.9)**.

Planirani iznosi dolaze iz TIC-a projekta — vidi [[term-budzet-iz-tic]].
