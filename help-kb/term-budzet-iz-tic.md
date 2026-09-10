---
id: term-budzet-iz-tic
title: Odakle dolazi budžet projekta?
keywords: [budžet nije postavljen, budget not set, odakle budžet, planirani budžet, budžet projekta, budžet faze, ne mogu upisati budžet, budžet je zaključan, iz TIC-a]
routes: [/projects, /site-management, /tic, /budget-control]
roles: [Director, Accounting, Sales, Supervision, Investment]
---

**Planirani budžet se nigdje ne upisuje ručno — izvodi se iz [[tic]] projekta.**

Zato su polja budžeta u obrascu projekta, kod postavljanja i uređivanja faza te u prikazu budžeta
po klasifikaciji samo za čitanje. Nije riječ o ovlastima: nitko ih ne uređuje, jer bi upisani
iznos vrijedio samo do sljedećeg spremanja TIC-a.

## „Budžet nije postavljen”

Ta poruka znači da projekt **nema TIC**, ili da su u njemu svi iznosi nula. Prikazuje se umjesto
iznosa — namjerno, jer bi 0 izgledala kao stvarna brojka. Vidjet ćete je na kartici projekta, u
zaglavlju projekta na [[site-management]] i u obrascu projekta.

Rješenje: otvorite [[tic]] u profilu Funding, odaberite projekt, unesite ili uvezite iznose i
kliknite **Spremi**. Time se odmah postavljaju:

- budžet projekta (zbroj kartice Investicija)
- faze projekta i budžet svake faze
- budžet po klasifikaciji troška unutar svake faze

## Što je i dalje moguće bez TIC-a

Projekt se može stvoriti, faze se mogu postaviti i preimenovati, a ugovori i podugovaratelji se
mogu dodavati normalno. Provjera „iznos ugovora premašuje raspoloživi budžet faze” primjenjuje se
samo kada budžet postoji, pa nedostatak plana ne blokira rad na gradilištu.

## Zašto se budžet ne može promijeniti izravno

Prije su isti iznos određivala četiri mjesta — obrazac projekta, postavljanje faza, budžeti po
klasifikaciji i TIC — i redovito su se razlikovali. Sada postoji jedan zapis plana, a sve ostalo
ga čita. Ako je iznos pogrešan, ispravlja se u TIC-u.

Za pojam vidi [[term-tic]]; za prikaz na gradilištu [[site-management]]; za razliku između faze i
klasifikacije troška [[term-faza-vs-prekretnica]].
