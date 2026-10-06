---
id: tasks
title: Zadaci
keywords: [zadaci, tasks, todo, u tijeku, gotovo, due date, dodijeljeni meni]
routes: [/tasks]
roles: [Director, Accounting, Sales, Supervision, Investment]
---

**Zadaci** je modul za praćenje zadataka među korisnicima. Naslov stranice: **Zadaci**.

Tabovi: **Dodijeljeni meni**, **Kreirani od mene**, **Privatni**.

Glavna akcija: **Dodaj zadatak** (+ gumb).

Statusi: **todo** (Za napraviti), **in_progress** (U tijeku), **done** (Gotovo).

Sortiranje: po datumu dospijeća, datumu kreiranja ili nazivu. Grupiranje: bez grupiranja, po projektu, statusu ili datumu dospijeća. Prekidač **Prikaži/sakrij završene** kontrolira vidljivost gotovih zadataka.

Filtri: tekstualna pretraga (s debounce), multi-select statusa, padajući izbornik projekta, multi-select dodjelitelja.

Zadaci su grupirani u kategorije po datumu: **Overdue**, **Today**, **Tomorrow**, **This week**, **Later**, **No due date**. Detaljni modal sadrži opis, privitke, dodijeljene osobe i vrijeme dospijeća.

Ikona zvona u gornjoj navigaciji pokazuje broj nepročitanih obavijesti o zadacima.
