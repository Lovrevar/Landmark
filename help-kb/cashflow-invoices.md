---
id: cashflow-invoices
title: Računi (Cashflow)
keywords: [računi, accounting invoices, cashflow, ulazni, izlazni, novi račun, office račun, investicije, PDV, multi-VAT, neplaćeno, priljev]
routes: [/accounting-invoices]
roles: [Director, Accounting]
---

**Računi** u Cashflow profilu je središnja knjiga ulaznih i izlaznih računa. Podnaslov: **Upravljanje ulaznim i izlaznim računima**.

U zaglavlju je pet zasebnih gumba za unos: **Kupoprodaja Zemljišta**, **Novi Office Račun**, **Novi Retail Račun**, **Investicije** (račun banke ili kredita — otvara obrazac **Novi Račun Banka**) i **Novi račun**. Gumb **Polja** uključuje i isključuje stupce tablice.

Filtri: tekstualna pretraga (**Pretraži račune...**), **Svi tipovi** (kratice odabranog smjera), **Svi statusi** (Plaćeno, Neplaćeno, Djelomično, Neplaćeno + Djelomično), **Sve firme** te prekidač **Ulazni / Izlazni**. Prekidač uvijek ima odabran jedan smjer (zadano **Ulazni**), pa tablica nikad ne prikazuje oba smjera zajedno. Gumb **Očisti** pojavljuje se kad je neki filter aktivan.

Kartice statistike prate odabrani smjer: **Ukupno računa**, zatim za ulazne **Neplaćeno** (prema filtrima) i **Ukupno Neplaćeno**, a za izlazne **Priljev** i **Ukupni Priljev**.

U tablici je tip računa ispisan kraticom u stupcu **Tip** — crveno za račune koje plaćamo (svi ulazni), zeleno za račune po kojima novac primamo (svi izlazni). Znak **?** u zaglavlju tog stupca otvara legendu kratica; sve je objašnjeno u [[term-invoice-types]]. Račun kojem je prošlo dospijeće, a nije plaćen, ima crveno označen redak. Tablica se može poredati po stupcima **Broj računa** i **Dospijeće**.

Akcije u retku: pregled detalja, plaćanje (dok račun nije u cijelosti plaćen — vidi [[cashflow-payments]]), uređivanje i brisanje. Brisanje vidi samo uloga Director.

Računi podržavaju do četiri PDV stope po dokumentu; u stupcima **Osnovica** i **PDV** svaka stopa ima svoj red (vidi [[term-multi-vat]]).
