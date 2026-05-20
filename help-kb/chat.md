---
id: chat
title: Chat (poruke između korisnika)
keywords: [chat, poruke, konverzacija, 1 na 1, grupni chat, attachment]
routes: [/chat]
roles: [Director, Accounting, Sales, Supervision, Investment]
---

**Chat** je modul za komunikaciju između korisnika sustava (ljudski-na-ljudski), zaseban od AI asistenta. Stranica nema klasičan naslov — prikazuje konverzacijski layout.

Layout: lijeva bočna traka s popisom konverzacija, desni panel s porukama.

Glavna akcija: **Nova konverzacija** u popisu konverzacija. Podržane su:
- **1 na 1** — naslov pokazuje ime sugovornika
- **Grupne konverzacije** — naslov je naziv grupe ili popis sudionika

Polje za unos poruke nalazi se na dnu panela; podržano je dodavanje privitaka (file picker).

Ikona zvona u gornjoj navigaciji (ikona poruke s crvenim brojem) pokazuje broj nepročitanih poruka. Floating AI asistent (chat widget) NIJE vidljiv na ovoj stranici — sakriven je dok ste u **/chat** da bi se izbjegao vizualni sukob.
