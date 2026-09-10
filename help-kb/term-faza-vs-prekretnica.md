---
id: term-faza-vs-prekretnica
title: Faza vs. prekretnica (milestone)
keywords: [faza, prekretnica, milestone, project_phases, project_milestones, razlika]
routes: [/projects/:id]
roles: [Director, Accounting, Sales, Supervision, Investment]
---

**Faza** i **prekretnica** (milestone) nisu isto — riječ je o dva različita pojma sa zasebnim tablicama (`project_phases` i `project_milestones`).

**Faza** je vremenski dio izvođenja projekta s vlastitim budžetom, ugovorima i podugovarateljima. Faze se prikazuju u tabu **Faze i ugovori** na [[project-details]]. Faza ima broj (`phase_number`), budžet i status, i zove se jednostavno "Faza 1", "Faza 2" i tako dalje.

**Klasifikacija troška** je treći, zaseban pojam: stavka troškovnika ("Zemljište", "Priprema i razvoj", "Izgradnja i uređenje", "Opremanje", "Kontrola", "Financiranje i nadzor", "Nepredviđeni troškovi"). Klasifikacija se bira na ugovoru i govori **na što** je trošak potrošen, dok faza govori **kada**. Unutar jedne faze može biti više klasifikacija, a svaka može imati svoj dio budžeta faze.

Ranije su se ta dva pojma miješala — nazivi faza su se koristili kao stavke troškovnika, pa je projekt mogao imati samo jednu stvarnu fazu. Sada su razdvojeni: na [[site-management]] možete prebacivati prikaz između **Po fazama** i **Po klasifikaciji troška**.

Obje osi planira [[tic]] projekta: TIC kaže koliko se troši na svaku klasifikaciju i, ako ima
stupce **FAZA 1**, **FAZA 2** …, u kojoj fazi. Faze projekta i njihovi budžeti izvode se iz toga,
pa se ne unose ručno. Trošak koji se troši jednom za cijeli projekt ne pripada nijednoj fazi i
prikazuje se kao **Nije fazirano**.

**Prekretnica** je ključni datum/događaj u životnom vijeku projekta (npr. dobivanje građevinske dozvole, predaja kupcu). Prekretnice se prikazuju u tabu **Prekretnice** s polje **Datum dospijeća** i oznakom završenosti.

Kada netko kaže "faza 3 projekta X", uvijek misli na zapis iz `project_phases`. Kada pita "koliko smo potrošili na zemljište", misli na **klasifikaciju troška**, ne na fazu. AI asistent posebno pazi na obje razlike i nikada ne pomiješa pojmove u odgovorima.
