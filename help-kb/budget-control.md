---
id: budget-control
title: Kontrola proračuna (EVM)
keywords: [kontrola proračuna, budget control, EVM, CPI, SPI, EAC, VAC, performanse projekta, planirani proračun, ugovoreno, plaćeno, dovršenost]
routes: [/budget-control]
roles: [Director, Accounting, Investment]
---

**Kontrola proračuna** prikazuje EVM (Earned Value Management) pregled performansi odabranog projekta, zbrojeno preko svih njegovih faza. Projekt birate iz padajućeg izbornika **Projekt** u gornjem desnom kutu.

## Gornji red kartica

- **TIC** — ukupni investicijski trošak iz TIC-a projekta
- **Planirani proračun** — zbroj budžeta faza. Može biti manji od TIC-a kada TIC sadrži troškove koji nisu fazirani (npr. zemljište)
- **Ugovoreno** — zbroj iznosa ugovora projekta, s postotkom od proračuna
- **Plaćeno** — zbroj plaćenih iznosa po tim ugovorima, s postotkom od ugovorenog
- **Prognoza (EAC)** — procijenjeni konačni trošak, uz oznaku **Ispod proračuna** ili **Iznad proračuna**

## Grafikoni

Između dva reda kartica nalaze se stupčasti grafikon **Kontrola proračuna** (**Planirano**, **Ugovoreno**, **Plaćeno**, **Prognoza (EAC)**) i grafikon **EVM indeksi performansi** s trenutnim CPI-jem i SPI-jem projekta te linijama **Cilj (1.0)** i **Upozorenje (0.9)**.

## EVM metrike performansi

Na dnu su kartice **CPI** i **SPI** (obojane prema statusu), **EAC**, **VAC** i **Dovršenost** — udio plaćenog u ugovorenom. Uz CPI, SPI, EAC i VAC nalazi se „?” koji objašnjava metriku; značenje i boje opisuje [[term-evm]].

- Ako nijedna faza nema oba datuma (početak i završetak), kartica SPI prikazuje „—” i napomenu **Nema faza s datumima početka i završetka**. To ne znači da je projekt u roku.
- Dok ništa nije plaćeno, CPI i prognoza (EAC, VAC) prikazuju „—” uz napomenu **Još nema plaćenih troškova**.
- Ako je CPI 0, EAC i VAC prikazuju „—” jer prognoze nema.

## Projekt bez budžeta

Ako faze projekta nemaju budžet (projekt nema TIC), umjesto kartica i grafikona prikazuje se poruka **Nema podataka o proračunu za ovaj projekt**. Budžet se ne upisuje ovdje: postavlja se spremanjem [[tic]] projekta — vidi [[term-budzet-iz-tic]].

Odakle dolazi iznos **Plaćeno** objašnjava [[term-realised-budget]].
