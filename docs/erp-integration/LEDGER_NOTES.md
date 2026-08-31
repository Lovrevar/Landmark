# Ledger notes — what the raw 4D Wand GL export looks like

**Status: reference only.** We define the export format ourselves (SPEC.md §4),
so the importer consumes invoice-shaped feeds and none of this is on the
critical path. It is kept because it is the only concrete look we have had at
the real data, and because if the export turns out to be less configurable than
expected, reconstruction comes back and this is the map.

Source: *Pretraživanje podataka financijskih knjiženja*, 76 rows, August 2026,
in `docs/erp-samples/` (gitignored — real supplier names and amounts).

## Shape

One row per double-entry posting. An invoice is several rows, tied together by
**(fiscal year, `Nal.`, `Dok.`, `Lok. dok.`)** — journal, document type,
document number:

```
2026/5/UFA/4          Duguje    Potražuje   Kom.   Vezni dok.
  2200   Dobavljači        0        10.00     6    534836-1-2/e računi   ← liability: partner, gross, invoice no.
  4101   Poštanski tr.  8.00            0     –    534836-1-2            ← expense: the classifying account
  140012 Pretporez 25%  2.00            0     –    4                     ← input VAT
```

Reconstruction, had we needed it:

| Cognilion field | From |
|---|---|
| `total_amount` | the liability line (konto 2200) |
| partner | `Kom.` on the liability line — expense and VAT lines carry none |
| `invoice_number` | `Vezni dok.` on the liability line |
| `base_amount_n` | each expense line |
| `vat_amount_n`, `vat_rate_n` | each input-VAT line |
| category | the **expense** line's `Konto`, not the liability line's |
| `paid_amount` | `total_amount` − `Otvoreno` on the liability line |

## Document types

| `Dok.` | Meaning |
|---|---|
| `UFA` | *Ulazna faktura* — incoming invoice |
| `UFB` | Advance/prepayment invoice (konto 1250/1251 + 140022/14010) |
| `IZV` | *Izvod* — bank statement, i.e. payments |
| `PDV` | Monthly VAT settlement (*Po obračunu*) — an internal journal, not a document |

No `IRA`/`IFA` (outgoing) rows appeared; the sample was supplier-side only.

## Things worth remembering even now

- **`Otvoreno`** (open amount) on the liability line gives payment status
  directly. If the designed feed can carry it, invoice status comes free rather
  than being derived from the payments feed.
- **The VAT rate is encoded in the account number** — `140011` = 13%,
  `140012` = 25%. There is no rate column in the ledger.
- **The base/VAT split does not always match the nominal rate**: 6.77 against
  0.81 on the 13% account (≈12.0%), 4024.47 against 438.53 (≈10.9%). Presumably
  partial deductibility. This is why DECISIONS.md D8 says store what is posted
  and never recompute — it applies to the designed feed too.
- **Balance is per journal (`Nal.`), not per document.** A batch payment books
  the bank line under one `Lok. dok.` and its allocations under another: 228.04
  and 7.50 under different document numbers summing to one 235.54 transfer. A
  per-document check reports false imbalances. See DECISIONS.md D9.
- **One payment settles several invoices** — confirmed here, which is why the
  payments feed is allocation-grained.
- **`0572 Ulaganja u građevine u izgradnji`** is capitalised construction cost.
  It is the account that most directly corresponds to project spend.
- Negative amounts are storna; `2026/5/UFA/12` is a complete negative reversal.

## Accounts seen

```
0572   Ulaganja u građevine u izgradnji      2130   Obveze prema povezanim društvima
1000   Transakcijski račun u banci ERSTE     2200   Dobavljači dobara
1250   Potraživanja za predujmljene usluge   24010  Obveza PDV-a po predujmu
1251   Potraživanja za predujmove bez PDV-a  4070   Trošak električne energije
1400   Potraživanja za predporez             4101   Poštanski troškovi
140011 Pretporez - 13%                       4172   Voda i odvodnja
140012 Pretporez - 25%                       4650   Troškovi platnog prometa
140022 Pretporez iz predujmova - 25%
14010  Pretporez od predujmova
```
