---
id: term-multi-vat
title: Multi-VAT računi (više PDV stopa)
keywords: [PDV, VAT, multi-VAT, više stopa, hrvatsko računovodstvo, osnovica]
routes: [/accounting-invoices]
roles: [Director, Accounting]
---

U hrvatskom računovodstvu jedan račun može sadržavati **do četiri različite PDV stope**. Razlog: različite stavke (građevinski radovi, materijal, usluge) mogu biti oporezovane različitim stopama (0 %, 5 %, 13 %, 25 %).

Stranica [[cashflow-invoices]] (**Računi** u Cashflow profilu) podržava ovaj format — kod unosa novog računa moguće je rasporediti osnovicu po više stopa u istom dokumentu.

**Praktična posljedica:** ukupni PDV nije izračunljiv jednostavnim umnoškom **osnovica × jedna stopa**. Sustav razdvaja iznose po stopi i tako ih i prikazuje na stranici [[approvals]] (stupci **Osnovica**, **PDV**, **Ukupno**).

Za izvještavanje porezne uprave svaka stopa ima svoj iznos osnovice i pripadni PDV iznos koji se sumiraju zasebno.
