# Cognilion: kako se računi broje u priljeve, odljeve, promet i dobit

**Za:** računovodstvo · **Datum:** 5. 10. 2026. · **Iznosi:** stvarni podaci iz produkcije na taj dan

Do sada je isti račun na jednom ekranu bio prihod, a na drugom trošak. To smo ujednačili: svaki
tip računa sada svugdje ima isti smjer novca i istu kategoriju. Prema vašem odgovoru, troškovi
kredita vode se kao trošak (točka 4). Molimo vas da još jednom pregledate tablicu u točki 1 i
iznose u točki 3. Izmjene još nisu puštene korisnicima.

## 1. Pravilo: smjer i kategorija za svaki tip računa

| Tip računa u aplikaciji | Što je to | Smjer novca | Kategorija |
|---|---|---|---|
| ULAZNI (DOB) | račun dobavljača | odljev | poslovanje |
| ULAZNI (URED) | uredski račun koji plaćamo | odljev | poslovanje |
| ULAZNI (INV) | račun financijera (banke) koji plaćamo | odljev | poslovanje |
| ULAZNI (BANKA) | otplata glavnice kredita | odljev | financiranje |
| ULAZNI (TROŠ.KRED) | troškovi kredita: kamate i naknade | odljev | poslovanje |
| IZLAZNI (PROD) | račun kupcu | priljev | poslovanje |
| IZLAZNI (URED) | uredski račun koji smo izdali | priljev | poslovanje |
| IZLAZNI (DOB) | račun koji smo izdali dobavljaču | priljev | poslovanje |
| IZLAZNI (BANKA) | isplata (povlačenje) kredita | priljev | financiranje |

Iz toga slijedi:

- **Smjer:** svaki ulazni račun je odljev kad se plati, svaki izlazni je priljev. Iznimaka nema.
  Stanje bankovnih računa oduvijek se računalo ovako; sada se tako računa i sve ostalo.
- **Kategorija:** financiranje je samo glavnica kredita i nije ni prihod ni trošak. Isplata
  kredita ne ulazi u promet, a otplata glavnice ne ulazi u troškove. Prikazuju se zasebno.
- **Trošak** (u dobiti/gubitku i u ukupnim troškovima) su svi računi poslovanja koje plaćamo:
  računi dobavljača, uredski računi, ULAZNI (INV) i troškovi kredita.

## 2. Što je bilo pogrešno

- **ULAZNI (INV)** se na nadzornoj ploči računovodstva, karticama firmi i u općem izvještaju
  brojio kao prihod, dok je stanje banke za isti iznos padalo. Sada je svugdje odljev i trošak.
  Takvih računa u bazi trenutno nema, pa se zbog ovoga nijedan postojeći iznos ne mijenja.
- **Isplate i otplate kredita** su se na karticama firmi brojile kao trošak, iako je isplata
  primljeni novac, a otplata povrat glavnice.
- **Troškovi kredita** nisu ulazili u mjesečne zbrojeve kalendara plaćanja, ni u ukupne troškove
  na nadzornoj ploči direktora i u općem izvještaju.
- **Opći izvještaj** u novčanom toku uopće nije prikazivao isplate, otplate ni troškove kredita.

## 3. Koji se iznosi mijenjaju

### Kartice firmi (Cashflow → Firme)

„Promet” i „Dobit/Gubitak” sada obuhvaćaju samo poslovanje. Prihodi se ne mijenjaju ni za jednu
firmu. Mijenjaju se troškovi triju firmi koje imaju kredite: iz njih izlaze isplate i otplata
glavnice, a troškovi kredita ostaju. Te firme ispod dobiti/gubitka dobivaju novi redak
„Financiranje (primljeno / otplaćeno)”.

| | B-Mark d.o.o. | Bio4you d.o.o. | Landmark group d.o.o. |
|---|---|---|---|
| Plaćeni troškovi, prije | 1.560.929,93 € | 686.416,60 € | 6.315.569,32 € |
| Plaćeni troškovi, poslije | 810.929,93 € | 86.416,60 € | 3.042.860,52 € |
| od toga troškovi kredita | 4.078,57 € | 86.416,60 € | 76.655,44 € |
| Neplaćeni troškovi, prije → poslije | 40.742,87 € (isto) | 20.288,15 € (isto) | 7.727.913,12 → 7.382.913,12 € |
| Dobit/Gubitak, prije | −1.560.929,93 € | −686.416,60 € | −6.315.569,32 € |
| Dobit/Gubitak, poslije | −810.929,93 € | −86.416,60 € | −3.042.860,52 € |
| Financiranje, primljeno | 750.000,00 € | 600.000,00 € | 3.172.708,80 € |
| Financiranje, otplaćeno | 0,00 € | 0,00 € | 100.000,00 € |

Svih 14 firmi zajedno:

| | Prije | Poslije |
|---|---|---|
| Promet (fakturirani prihodi) | 127.813,76 € | isto |
| Naplaćeni prihodi | 125.000,00 € | isto |
| Fakturirani troškovi | 17.180.426,61 € | 12.212.717,81 € |
| Plaćeni troškovi | 8.756.047,84 € | 4.133.339,04 € |
| Neplaćeni troškovi | 8.582.696,77 € | 8.237.696,77 € |
| Dobit/Gubitak | −8.631.047,84 € | −4.008.339,04 € |
| Financiranje, primljeno / otplaćeno | nije prikazano | 4.522.708,80 € / 100.000,00 € |

Razlika u plaćenim troškovima (4.622.708,80 €) su isplate kredita koje su se brojile kao trošak
(4.522.708,80 €) i jedna otplata glavnice (100.000,00 €).

### Nadzorna ploča direktora i opći izvještaj: ukupni troškovi i dobit

Troškovi kredita do sada ovdje nisu bili uključeni. Sada jesu.

| Do danas | Prije | Poslije |
|---|---|---|
| Ukupno plaćeni troškovi | 3.807.870,43 € | 3.975.021,04 € |

Dobit se smanjuje za isti iznos, 167.150,61 €. Troškovi po projektima se ne mijenjaju jer nijedan
od 40 računa troškova kredita nije vezan uz projekt.

### Kalendar plaćanja (Cashflow → Kalendar)

Troškovi kredita sada ulaze u mjesečne zbrojeve: 40 računa u 15 mjeseci, od siječnja 2025. do
listopada 2026.

| Svi mjeseci zajedno | Prije | Poslije |
|---|---|---|
| Ulazni računi (plaćeno) | 3.557.860,43 € | 3.719.627,48 € |
| Ulazni računi (neplaćeno) | 8.171.208,92 € | 8.237.696,77 € |

„NETO” i „Razlika od budžeta” u tim se mjesecima smanjuju za plaćeni iznos troškova kredita.

### Opći izvještaj, analiza novčanog toka

Tablica je podijeljena na „Poslovne aktivnosti” i „Financijske aktivnosti”, uz ukupni novčani tok.
Troškovi kredita su u poslovnim aktivnostima.

| Sva plaćanja do danas | Prije | Poslije |
|---|---|---|
| Poslovne aktivnosti: priljevi | 125.000,00 € | isto |
| Poslovne aktivnosti: odljevi | 3.807.870,43 € | 3.975.021,04 € |
| Financijske aktivnosti: priljevi (isplate kredita) | nije prikazano | 4.522.708,80 € |
| Financijske aktivnosti: odljevi (otplate glavnice) | nije prikazano | 100.000,00 € |
| Neto novčani tok | −3.682.870,43 € | +572.687,76 € |

## 4. Odluka o troškovima kredita

**Troškovi kredita (kamate i naknade, ULAZNI (TROŠ.KRED)) jesu trošak** i ulaze u „Dobit/Gubitak”
i u ukupne troškove. Financiranje je samo glavnica: isplata i otplata. Do danas je plaćeno
167.150,61 € troškova kredita, i taj je iznos uključen u sve iznose „poslije” u točki 3.

Otvorenih pitanja više nema. Ako u tablici u točki 1 ili u iznosima nešto ne odgovara vašoj
praksi, javite prije puštanja izmjena.
