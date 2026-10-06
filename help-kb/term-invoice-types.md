---
id: term-invoice-types
title: Tipovi računa (ULAZNI / IZLAZNI varijante)
keywords: [tipovi računa, tip računa, invoice types, ULAZNI, IZLAZNI, DOB, INV, URED, BANKA, PROD, TROŠ.KRED, kratice, crveno, zeleno]
routes: [/accounting-invoices]
roles: [Director, Accounting]
---

Svaki račun u Cashflow profilu ima tip: smjer (**ULAZNI** ili **IZLAZNI**) i kraticu u zagradi koja govori na što se račun odnosi. Pravilo je jednostavno: svaki ulazni račun mi plaćamo (novac izlazi), po svakom izlaznom novac primamo.

**ULAZNI** — računi koje smo primili i plaćamo:
- **ULAZNI (DOB)** — Ulazni (Dobavljač): račun dobavljača
- **ULAZNI (URED)** — Ulazni (Ured): uredski trošak
- **ULAZNI (INV)** — Ulazni (Investicije): račun financijera (banke) koji plaćamo; trošak
- **ULAZNI (BANKA)** — Ulazni (Banka): otplata glavnice kredita
- **ULAZNI (TROŠ.KRED)** — Ulazni (Troškovi kredita): kamate i naknade; trošak

**IZLAZNI** — računi koje smo izdali i po kojima primamo novac:
- **IZLAZNI (DOB)** — Izlazni (Dobavljač): izlazni račun izdan dobavljaču (dobavljač je kupac)
- **IZLAZNI (URED)** — Izlazni (Ured): uredski izlazni račun
- **IZLAZNI (PROD)** — Izlazni (Prodaja): račun kupcu
- **IZLAZNI (BANKA)** — Izlazni (Banka): isplata (povlačenje) kredita

Samo glavnica kredita je financiranje — isplata i otplata, tj. dva tipa **BANKA**. Svi ostali ulazni tipovi su trošak poslovanja, uključujući **ULAZNI (INV)** i **ULAZNI (TROŠ.KRED)**.

**Gdje se tip vidi.** Na stranici [[cashflow-invoices]] kratica je ispisana u stupcu **Tip**: crveno za račune koje plaćamo (svi ulazni), zeleno za račune po kojima novac primamo (svi izlazni). Znak **?** u zaglavlju stupca **Tip** (na mobitelu pokraj filtra tipa) otvara legendu svih devet kratica. U detaljima računa i plaćanja tip je ispisan punim nazivom, npr. **Ulazni (Dobavljač)**.

**Kako se tip bira.** Tip ovisi o gumbu kojim unosite račun:
- **Novi račun** — Ulazni (Dobavljač), Ulazni (Investicije), Izlazni (Dobavljač), Izlazni (Prodaja)
- **Novi Office Račun** — Ulazni ili Izlazni, tj. tipovi **URED**
- **Investicije** — **Odljev** daje ULAZNI (BANKA), **Priljev** daje IZLAZNI (BANKA), **Troškovi kredita** daje ULAZNI (TROŠ.KRED)

**Filtriranje.** Prekidač **Ulazni / Izlazni** bira smjer (uvijek je odabran jedan; zadano **Ulazni**), a padajući filter **Svi tipovi** zatim sužava popis na jednu kraticu tog smjera.

U Retail profilu ([[retail-invoices]]) koriste se značke **Ulazni - Dobavljač**, **Ulazni - Investicija**, **Izlazni - Prodaja** i **Izlazni - Dobavljač**.
