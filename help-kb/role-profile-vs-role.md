---
id: role-profile-vs-role
title: Profil vs. uloga — u čemu je razlika?
keywords: [profil, uloga, role, profile, switcher, dropdown, pristup]
routes: []
roles: [Director, Accounting, Sales, Supervision, Investment]
---

**Uloga** i **profil** su dva različita pojma:

- **Uloga (role)** je trajna oznaka korisničkog računa. Postoji 5 uloga: **Director**, **Accounting**, **Sales**, **Supervision**, **Investment**. Određuje što korisnik *smije vidjeti i raditi* — kontrolira RLS pravila i dostupnost tablica.

- **Profil (profile)** je trenutni izborni "view" sučelja. Postoji 6 profila: **General**, **Supervision**, **Sales**, **Funding**, **Cashflow** (lozinka), **Retail**. Određuje koji *meni i koja nadzorna ploča* su trenutno aktivni. Profili se mijenjaju u dropdownu pored imena korisnika.

Profil mijenjati može svaki korisnik osim **Supervision** uloge (koja vidi samo svoj fiksni izbornik). Promjena profila ne mijenja prava — vidite samo one stranice na kojima vaša uloga ima pristup. Pogledajte [[switch-profile]] i [[cashflow-unlock]].
