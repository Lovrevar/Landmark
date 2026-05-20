---
id: term-realised-budget
title: Realizirani budžet — odakle dolazi?
keywords: [realizirani budžet, budget_used, budget_realized, contracts, faza budžet, kontrola proračuna]
routes: [/budget-control, /projects/:id]
roles: [Director, Accounting, Investment]
---

Realiziran (potrošeni) budžet projekta i fazi računa se iz **ugovora** (tablica `contracts`, polje `budget_realized` koje se ažurira automatski).

**Važno:** polje **budget_used** na fazi (`project_phases.budget_used`) **nije pouzdano** — ne ažurira se kroz okidače i može biti zastarjelo. Ne koristite ga za financijske odluke.

Točan iznos potrošnje vidite na:
- [[budget-control]] — EVM prikaz s realiziranim budžetom po fazama
- [[project-details]] — tab **Pregled** s metrikama budžeta i napretka
- [[general-reports]] — sekcija **Status gradnje i nadzora**, polje **Realizirani budžet (%)**

AI asistent automatski usmjerava na alat `get_project_financial_summary` koji koristi `contracts.budget_realized` — ne `budget_used`. Za pojedinačne faze koristi `list_project_phases` koji namjerno izostavlja **budget_used**.
