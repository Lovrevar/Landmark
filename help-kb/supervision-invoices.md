---
id: supervision-invoices
title: Računi projekata (Supervision)
keywords: [računi, invoices, projekti računi, odobreno, dobavljač, izvezi CSV]
routes: [/invoices]
roles: [Director, Accounting, Supervision]
---

Stranica **Projekti - Računi** prikazuje račune dobavljača i nadzora po svim projektima. Podnaslov: **Pregled i upravljanje računima dobavljača i nadzora za sve projekte**.

Kartice statistike: **Ukupno računa**, **Ukupno iznosa (€)**, **Računi ovog mjeseca**, **Iznos ovog mjeseca (€)**.

Filtri: tražilica **Pretraži račune...**, status (**Svi računi**, **Svi statusi**, **Odobreno**, **Nije odobreno**) i raspon datuma. Gumb **Izvezi CSV** preuzima filtrirani prikaz.

Stupci: **Odob.** (kvačica), **Broj računa**, **Kategorija**, **Datum**, **Dobavljač**, **Projekt**, **Faza**, **Firma**, **Iznos**, **Status**. Klikom na kvačicu prebacujete status odobrenja.

Supervision korisnici vide samo račune svojih projekata. Računi prema dobavljačima zapravo se vežu na zapise iz tablice `subcontractors` — pogledajte [[terminology-dobavljac-vs-podugovaratelj]].
