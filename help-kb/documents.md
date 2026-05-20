---
id: documents
title: Dokumenti
keywords: [dokumenti, documents, učitaj, kategorija, projekt, filter dokumenata]
routes: [/documents]
roles: [Director, Accounting, Sales, Supervision, Investment]
---

**Dokumenti** je središnja stranica za upravljanje datotekama. Glavna akcija: **Učitaj** (gumb za upload).

Layout je dvodijelan:
- **Lijevo (bočna traka):** stablo kategorija s brojem dokumenata po kategoriji; opcija **Svi dokumenti** prikazuje ukupni broj. Odabrana kategorija je istaknuta plavom bojom.
- **Desno (glavni panel):** traka filtera i tablica.

Filtri:
- tekstualna pretraga po nazivu datoteke (s debounce)
- padajući izbornik projekta
- padajući izbornik podugovaratelja
- raspon datuma uploada (**Učitano od** / **Učitano do**)
- gumb **Očisti filtre** pojavljuje se kada je filter aktivan

Stupci tablice: naziv, kategorija, projekt, vrijeme uploada, akcije (otvori, obriši). Proširenjem retka vidite opis, povezane entitete (projekt/faza/ugovor/kredit) i veličinu datoteke. Paginacija: 100 stavki po stranici.
