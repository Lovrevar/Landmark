---
id: term-faza-vs-prekretnica
title: Faza vs. prekretnica (milestone)
keywords: [faza, prekretnica, milestone, project_phases, project_milestones, razlika]
routes: [/projects/:id]
roles: [Director, Accounting, Sales, Supervision, Investment]
---

**Faza** i **prekretnica** (milestone) nisu isto — riječ je o dva različita pojma sa zasebnim tablicama (`project_phases` i `project_milestones`).

**Faza** je dio izvođenja projekta s vlastitim budžetom, ugovorima i podugovarateljima. Faze se prikazuju u tabu **Faze i ugovori** na [[project-details]]. Faza ima broj (`phase_number`), budžet i status.

**Prekretnica** je ključni datum/događaj u životnom vijeku projekta (npr. dobivanje građevinske dozvole, predaja kupcu). Prekretnice se prikazuju u tabu **Prekretnice** s polje **Datum dospijeća** i oznakom završenosti.

Kada netko kaže "faza 3 projekta X", uvijek misli na zapis iz `project_phases`. AI asistent posebno pazi na ovu razliku i nikada ne pomiješa pojmove u odgovorima.
