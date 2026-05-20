---
id: terminology-dobavljac-vs-podugovaratelj
title: Dobavljač vs. podugovaratelj (terminološka razlika)
keywords: [dobavljač, podugovaratelj, supplier, subcontractor, supplier_id, terminologija]
routes: [/subcontractors, /accounting-suppliers, /office-suppliers]
roles: [Director, Accounting, Supervision]
---

U sučelju se koriste dva pojma za vendore — **podugovaratelj** i **dobavljač** — i mogu zbuniti jer označavaju isti zapis u sustavu.

- Stranica **[[subcontractors]]** (Supervision profil) zove ih **Podugovaratelji**.
- Stranica **[[cashflow-suppliers]]** (Cashflow profil) zove ih **Dobavljači**, ali prikazuje **iste zapise** iz tablice `subcontractors`. Ne postoji zasebna tablica dobavljača.
- Stranica **[[office-suppliers]]** (Cashflow profil) je **stvarno zasebna** — ovdje su uredski/back-office vendori u vlastitoj tablici, odvojeno od gradilišnih podugovaratelja.

Polje **supplier_id** na računima (`accounting_invoices.supplier_id`) zapravo upućuje na **podugovaratelja**, a ne na neki "supplier" entitet.

Pravilo: ako u dokumentaciji vidite "supplier" ili "dobavljač" u kontekstu gradilišta — riječ je o podugovaratelju.
