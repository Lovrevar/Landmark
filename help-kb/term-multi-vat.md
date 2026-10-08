---
id: term-multi-vat
title: Multi-VAT računi (više PDV stopa)
keywords: [PDV, VAT, multi-VAT, više stopa, hrvatsko računovodstvo, osnovica]
routes: [/accounting-invoices]
roles: [Director, Accounting]
---

U hrvatskom računovodstvu jedan račun može sadržavati **do četiri različite PDV stope**. Razlog: različite stavke (građevinski radovi, materijal, usluge) mogu biti oporezovane različitim stopama (25 %, 13 %, 5 %, 0 %).

Stranica [[cashflow-invoices]] (**Računi** u Cashflow profilu) podržava ovaj format. Kod unosa računa postoje četiri polja — **Osnovica PDV 25%**, **Osnovica PDV 13%**, **Osnovica PDV 5%** i **Osnovica PDV 0%**. Popunite ona koja se odnose na račun (barem jedno); PDV i ukupan iznos sustav izračuna sam i prikaže u dijelu **Pregled računa:** na dnu obrasca.

**Praktična posljedica:** ukupni PDV nije izračunljiv jednostavnim umnoškom **osnovica × jedna stopa**. Sustav razdvaja iznose po stopi i tako ih prikazuje u tablici računa: u stupcima **Osnovica** i **PDV** svaka stopa ima svoj red (npr. „25%: €…"), a isti je raspored i u detaljima računa. Stranica [[approvals]] prikazuje samo zbrojne iznose **Osnovica**, **PDV** i **Ukupno**.

Za izvještavanje porezne uprave svaka stopa ima svoj iznos osnovice i pripadni PDV iznos koji se sumiraju zasebno.
