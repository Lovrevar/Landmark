---
id: budget-control
title: Kontrola proračuna (EVM)
keywords: [kontrola proračuna, budget control, EVM, CPI, SPI, EAC, VAC, performanse projekta]
routes: [/budget-control]
roles: [Director, Accounting, Investment]
---

**Kontrola proračuna** prikazuje EVM (Earned Value Management) pregled performansi po fazama jednog projekta. Projekt birate iz padajućeg izbornika u gornjem desnom kutu.

Prikazuje se pet ključnih pokazatelja:
- **CPI** (indeks troškovne učinkovitosti) sa značkom statusa
- **SPI** (indeks vremenske učinkovitosti) sa značkom statusa
- **EAC** (procjena konačnog troška)
- **VAC** (varijanca konačnog troška)
- iskorištenost budžeta u postotcima

Ispod kartica nalazi se stupčasti grafikon (Planirano, Ugovoreno, Plaćeno, Prognoza) i raspršeni grafikon CPI/SPI po fazama.

Napomena: SPI (indeks izvršenja rasporeda) računa se samo ako faza ima upisan početni i završni datum. Ako nijedna faza projekta nema datume, SPI nema osnovu za usporedbu i ne treba ga čitati kao "u roku". CPI (indeks izvršenja troška) računa se uvijek.

Realizirani budžet računa se iz ugovora (`contracts`), ne iz polja `budget_used` na fazi — to polje nije pouzdano.
