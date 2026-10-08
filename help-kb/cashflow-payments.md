---
id: cashflow-payments
title: Plaćanja (Cashflow)
keywords: [plaćanja, accounting payments, cashflow, novo plaćanje, izvor plaćanja, cesija, kompenzacija, virman, gotovina, prihod, rashod]
routes: [/accounting-payments]
roles: [Director, Accounting]
---

Stranica **Plaćanja** u Cashflow profilu evidentira sva plaćanja po računima. Podnaslov: **Upravljanje plaćanjima**.

Glavne akcije: **Novo plaćanje** i **Polja** (vidljivost stupaca). Račun se može platiti i izravno sa stranice [[cashflow-invoices]].

Filtri: tekstualna pretraga, **Svi načini plaćanja** (Virman, Gotovina, Ček, Kartica), **Svi tipovi računa** (Ulazni / Izlazni) te raspon **Datum OD** / **Datum DO**. Gumb **Resetuj datume** pojavljuje se kad je datum postavljen.

Šest kartica iznad tablice odnosi se na filtrirana plaćanja: **Ukupno plaćanja**, **Ukupno Prihod**, **Ukupno Rashod**, **Neto**, **PDV Ulaz** i **PDV Izlaz**. Plaćanje ulaznog računa je rashod, a izlaznog prihod; u tablici to pokazuje stupac **Tip** (**RASHOD** crveno, **PRIHOD** zeleno) i boja iznosa. Iznimka su isplata kredita i otplata glavnice: one su financiranje, pa u stupcu **Tip** piše **ISPLATA KREDITA** odnosno **OTPLATA GLAVNICE** (plavo), a u karticama **Ukupno Prihod** i **Ukupno Rashod** i dalje se zbrajaju prema smjeru novca. Klik na redak otvara **Detalji plaćanja**, gdje je tip računa ispisan punim nazivom (vidi [[term-invoice-types]]).

U obrascu plaćanja polje **Izvor plaćanja** nudi **Bankovni račun**, **Kredit**, **Kompenzacija** i **Gotovina**, a o izvoru ovisi koji su načini plaćanja ponuđeni. Znak **?** pokraj polja objašnjava izvore. **Kompenzacija** je međusobni prijeboj bez kretanja novca — pogledajte [[term-kompenzacija]].

Cesija se unosi kvačicom **Ugovor o cesiji (plaćanje iz druge firme)**, uz koju je također znak **?**; u tablici se vidi kao **Cesija - {naziv firme}** u stupcu **Opis** — pogledajte [[term-cesija]].

Uz paginaciju se za filtrirana plaćanja prikazuje **Filtrirano:** s tri iznosa — **PRIHOD**, **RASHOD** i **Neto**.
