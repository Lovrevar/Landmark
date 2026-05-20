---
id: term-status-casing
title: Statusi se razlikuju po tablicama
keywords: [status, casing, projekt status, ugovor status, račun status, planiranje, UNPAID]
routes: [/projects, /accounting-invoices]
roles: [Director, Accounting, Sales, Supervision, Investment]
---

Vrijednosti statusa u sustavu pišu se različito ovisno o tipu entiteta. Sučelje uvijek prikazuje hrvatske oznake, ali u sirovim podacima razlike postoje:

- **Projekti** — *Title Case*: `Planiranje`, `U tijeku`, `Završeno`, `Na čekanju`
- **Ugovori** — *lowercase*: `active`, `completed`, `pending`...
- **Računi (accounting_invoices)** — *SHOUTING_SNAKE_CASE*: `PAID`, `UNPAID`, `PARTIALLY_PAID`

U sučelju vidite konzistentne hrvatske značke (**Plaćeno**, **Neplaćeno**, **Djelomično**...). U izvozima (CSV) ili kroz AI asistenta možda vidite originalne vrijednosti.

Ovo je namjerno održano radi povijesne kompatibilnosti — ne ispravlja se. AI asistent ne normalizira ove vrijednosti i prosljeđuje ih onako kako stoje u bazi.
