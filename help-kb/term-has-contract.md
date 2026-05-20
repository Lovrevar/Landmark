---
id: term-has-contract
title: Usmeni dogovor (has_contract = false)
keywords: [has_contract, usmeni dogovor, bez ugovora, verbal agreement, contract_amount]
routes: [/subcontractors, /projects/:id]
roles: [Director, Accounting, Supervision]
---

Polje **has_contract** na ugovoru označava postoji li potpisani pisani ugovor. Ako je vrijednost **false**, riječ je o usmenom dogovoru — radnja je formalno evidentirana u sustavu, ali bez papirnatog ugovora.

**Posljedica:** iznos u polju **contract_amount** može biti potcijenjen ili nepotpun, jer usmeni dogovori često rastu kroz vrijeme bez aneksa. Ne računajte ovu vrijednost kao garantiranu obvezu.

U sučelju će se na ugovorima bez pisanog ugovora pojaviti oznaka **Bez ugovora**. AI asistent posebno ističe ovu informaciju kada se pojavi u rezultatima.

Realiziran iznos (stvarno ispostavljeni i plaćeni računi) precizniji je pokazatelj — koristite ga umjesto **contract_amount** za usmene dogovore.
