# ERP Integration — 4D Wand via scheduled CSV export

**Status:** design spec, not yet implemented. Branch `feat/erp-csv-integration`.
**Audience:** internal (development). We have no contact channel with the ERP vendor — **we design the export format ourselves** using 4D Wand's own export facilities.

> **History.** An earlier revision of this file specified a pull REST API for a different ERP that was not selected. The company chose [4D Wand](https://www.4d.hr/) (4th Dimension d.o.o.), which offers no API for our purposes. The entity-linking model (§7) and the accounting questions (§13) carried over; the transport, sync mechanics and change-detection design are new.

---

## 1. What this changes

**4D Wand becomes the source of truth for invoices, payments and bank balances.** Cognilion stops creating and modifying them and becomes a consumer that classifies, links and reports on imported financial data.

Everything downstream keeps working unchanged: dashboards, debt status, contract realization, milestone progress, Sales buyer tracking, Funding credit utilization. They all read `public.accounting_invoices` / `public.accounting_payments`, and the existing database triggers keep those derivations consistent — we are changing *who writes* those two tables, not what hangs off them.

| | Before | After |
|---|---|---|
| Invoice creation | 4 modals in Cashflow | removed — imported from 4D Wand |
| Invoice editing | full edit incl. amounts | classification/link fields only |
| Payment recording | Payments module | removed — imported |
| Bank balances | derived client-side from payments | authoritative from ERP statements |
| Project / category assignment | manual on the form | automatic via cost centre / account mappings |
| Contract, milestone, apartment, credit line | manual on the form | **still manual** — ERP does not know these |

## 2. Integration model

```
4D Wand ──scheduled export──▶ company file server ──┐
                                                     ├──▶ Edge Function `import-erp-csv`
                    manual upload (Cashflow ▸ Import)─┘         │
                                                                ▼
                                                    erp.import_runs + erp.staging_*
                                                                │
                                              auto-classify via erp.* mapping tables
                                                                │
                                          ┌─────────────────────┴──────────────────┐
                                          ▼                                        ▼
                                    fully classified                     unresolved → review queue
                                          │                                        │
                                          └────────── promote ─────────────────────┘
                                                                │
                                                                ▼
                                        public.accounting_invoices / accounting_payments
                                                                │
                                              existing triggers derive everything else
```

Two ingestion paths, one pipeline. **Only the promotion step writes to `public`** — parsers and classifiers never touch it.

### 2.1 Transport

**Primary — on-prem agent.** A scheduled script on the company file server (the same server that will host documents) watches the export directory and POSTs each new file to `import-erp-csv`, authenticated by a shared secret header. This mirrors the existing `sort-document` function, which already authenticates a machine caller this way (`x-doc-sort-secret`, `verify_jwt = false` in `supabase/config.toml`) — reuse that shape.

Supabase Edge Functions cannot reach an on-prem SMB share, so the push direction is not optional: the server must initiate.

**Secondary — manual upload.** A *Cashflow ▸ Import* screen accepting the same files. This is not merely a fallback: it is how we develop and test before the agent exists, how accounting replays a failed run, and how the initial historical import (§9) is performed.

Both paths converge on the same parser and the same `erp.import_runs` audit record, distinguished by a `source` field (`agent` | `manual`).

## 3. CSV conventions

Since we author the exports, these are requirements on us, not requests to a vendor. Every feed obeys them.

| Aspect | Rule |
|---|---|
| Encoding | UTF-8. The agent must detect and transcode CP1250 if 4D Wand cannot emit UTF-8 — never guess downstream |
| Delimiter | `;` (semicolon) |
| Quoting | RFC 4180 — quote any field containing `;`, `"` or a newline; escape `"` as `""` |
| Decimal separator | `.` (point). **Not** comma — with `;` as delimiter a comma decimal is parseable, but the ambiguity is not worth it |
| Thousands separator | none |
| Dates | ISO 8601 `YYYY-MM-DD` |
| Timestamps | ISO 8601 with offset, e.g. `2026-08-31T14:05:00+02:00` |
| Currency | explicit ISO code column, `EUR` |
| Header row | required, exact column names as specified below |
| Empty vs zero | empty field = unknown/not applicable; `0` = genuinely zero |
| Filename | `<feed>_<YYYYMMDD>_<HHMMSS>.csv`, e.g. `invoices_20260831_060000.csv` |

### 3.1 Snapshot, not delta

**Every export is a full snapshot of a rolling window** — all documents with a document date in the current and previous fiscal year — not a delta since last run.

This is the most important design decision in the spec. CSV has no way to express "this record was deleted", and Croatian accounting corrects documents by storno and reissue. With a delta feed, a storno that removes a document from the ledger is simply absent from every subsequent file and we would never learn it vanished — the invoice would linger in Cognilion forever, inflating debt and contract realization.

With a full snapshot we diff each run against the previous one for that window and detect disappearance directly. Storna that appear as their own negative documents are imported normally; storna that retract a document are caught by the diff.

The cost is file size, which for this volume is trivial.

## 4. What 4D Wand actually exports

A sample export (*Pretraživanje podataka financijskih knjiženja*, 76 rows, Aug 2026) is in `docs/erp-samples/` — gitignored, it holds real supplier names and amounts. **It changed several assumptions in this spec and should be read before implementing anything.**

### 4.1 It is a general ledger, not an invoice book

The export is one row per **double-entry posting**, not per invoice. A single incoming invoice is several rows:

```
2026/5/UFA/4          Duguje    Potražuje   Kom.   Vezni dok.
  2200   Dobavljači        0        10.00     6    534836-1-2/e računi   ← liability: partner, gross, invoice no.
  4101   Poštanski tr.  8.00            0     –    534836-1-2            ← expense: the classifying account
  140012 Pretporez 25%  2.00            0     –    4                     ← input VAT
```

Documents are keyed by **(fiscal year, `Nal.`, `Dok.`, `Lok. dok.`)** — journal, document type, document number — and each is internally balanced. To build one Cognilion invoice the importer groups postings by that key and reads:

| Cognilion field | From |
|---|---|
| `total_amount` | the liability line (konto 2200) |
| partner | `Kom.` on the liability line — the expense and VAT lines carry no partner |
| `invoice_number` | `Vezni dok.` on the liability line |
| `base_amount_n` | each expense line |
| `vat_amount_n`, `vat_rate_n` | each input-VAT line |
| **category** | the **expense** line's `Konto` — *not* the liability line's |
| `paid_amount` | `total_amount` − `Otvoreno` on the liability line |

`Otvoreno` (open amount) means **payment status comes free with the invoice feed** — we do not have to derive it from payments.

Reconstruction is the importer's job and the riskiest part of it. 4D Wand may also be able to export the URA/IRA books (*knjiga ulaznih/izlaznih računa*) directly, which are already invoice-shaped; **that is worth asking accounting for before building the reconstructor** (§13 q11).

### 4.2 Document types

| `Dok.` | Meaning | Handling |
|---|---|---|
| `UFA` | *Ulazna faktura* — incoming invoice | → `accounting_invoices`, INCOMING |
| `UFB` | Advance/prepayment invoice (konto 1250/1251 + 140022/14010) | → invoice, but advances have no contract or milestone |
| `IZV` | *Izvod* — bank statement | → `accounting_payments` (§5) |
| `PDV` | Monthly VAT settlement (*Po obračunu*) | **excluded** — an internal journal, not a document |
| `IFA`/`IRA` | Outgoing invoice | **absent from the sample** — see §13 q12 |

Negative amounts are storna: `2026/5/UFA/12` is a complete negative reversal of an electricity invoice. They import as ordinary documents with negative amounts.

### 4.3 The VAT rate is in the account number

There is no VAT-rate column. The rate is encoded in the account: `140011` = *Pretporez 13%*, `140012` = *Pretporez 25%*, `140022` = advance VAT 25%. So `vat_rate_n` is derived from `erp.account_category_map`, not read.

**Do not recompute the base/VAT split from a nominal rate.** In the sample it frequently does not reconcile — a water invoice posts 6.77 base against 0.81 VAT on the 13% account (≈12.0%), and 4024.47 against 438.53 (≈10.9%), most likely partial input-VAT deductibility. Store what is posted; a recomputed figure would silently disagree with the ledger. §13 q13.

### 4.4 Column reference

Of 43 columns, these carry signal (fill rates from the sample):

| Column | Fill | Meaning |
|---|---|---|
| `ID` | 100% | **stable posting id**, unique per row — the row key, not the document key |
| `Nal.`, `Dok.`, `Lok. dok.`, `St.` | 100% | journal / type / document no. / line no. |
| `Datum knjiž.`, `Dat.posl.dog.`, `Datum dok.` | 100% | posting, business-event and document dates |
| `Dosp.do dana` | 100% | due date |
| `Konto`, `Naziv konta` | 100% | account and name |
| `Duguje`, `Potražuje`, `Otvoreno` | 100% | debit, credit, outstanding |
| `Kom.`, `Naziv komitenta` | 43% | partner — **liability lines only** |
| `Vezni dok.` | 95% | supplier's invoice number on the liability line; internal doc no. elsewhere |
| `Opis knjiženja` | 100% | description |
| `Dev.`, `Tečaj` | 100% | currency and rate — uniformly 1 (EUR) in the sample |
| `MjTr`, `Naziv MjTr` | **0%** | cost centre — see below |
| `D1`–`D3`, `Osoba`, `Str.konto` | 0% | unused |

### 4.5 ⚠️ Cost centre is empty

`MjTr` is **null in all 76 rows**, as are the `D1`–`D3` analytical dimensions.

This breaks the central assumption of this document. Automatic project assignment was to come from the cost centre; with the field unused, **every imported invoice would land in the review queue with no project**, and manual classification becomes the normal path rather than the exception — for every invoice, forever.

Three ways out, in order of preference:

1. **Accounting starts booking cost centres**, one per project. Much the best outcome, and cheap if adopted before the ledger grows — but it is a change to their daily routine and cannot be imposed from here.
2. **Derive the project from the account**, where the chart is project-specific. `0572 Ulaganja u građevine u izgradnji` (capitalised construction cost) suggests the chart may already be subdivided per project; the sample is too small to tell.
3. **Manual project assignment** in the review queue, permanently.

Until this is settled, the value of the whole integration is capped: invoices import, but they do not reach projects on their own. **This is the first thing to resolve with accounting.**

### 4.6 There is no OIB

Partners appear as an internal numeric `Kom.` id plus a name (`ELEKTRONIČKI RAČUNI d.o.o.`, `VODOVOD-OSIJEK d.o.o.`, …). This spec's partner matching was OIB-based throughout; **the GL export cannot support it**.

So a separate *komitenti* export carrying `Kom.` → OIB is required (§6), and `erp.partner_link_map` is keyed on the 4D Wand partner id, with OIB used only to seed the mapping.

## 5. Feed: payments (`IZV`)

Bank statements are ordinary journal rows: a bank-account line (konto `1000`) against one or more supplier lines (konto `2200`), the supplier line's `Kom.` identifying who was paid.

```
2026/7/IZV/…          Duguje    Potražuje   Kom.
  1000  Transakcijski račun     0     235.54    –     ← one transfer out
  2200  Dobavljači           5.01          0    5     ← ...settling six invoices
  2200  Dobavljači           5.01          0    5
  2200  Dobavljači           8.02          0    5
  2200  Dobavljači          10.00          0    6
  2200  Dobavljači         200.00          0    7
  2200  Dobavljači           7.50          0    4
```

**One payment can settle several invoices — confirmed from the data**, which answers a question this spec previously had to ask. Each supplier line is one `accounting_payments` row, so an allocation is the natural grain and `accounting_payments.invoice_id` stays single-valued.

Note the allocations balance against the bank line **across `Lok. dok.` values** — 228.04 under one document number and 7.50 under another sum to the single 235.54 transfer. **Balance must therefore be checked per journal (`Nal.`), not per document.** A naive per-document check reports false imbalances.

The hard part is **matching an allocation to its invoice**: the payment line carries `Kom.` and an amount but no invoice document key. Matching runs on (partner, amount, open balance) against invoices with `Otvoreno > 0`. It will be ambiguous when a supplier has two invoices for the same amount — VODOVOD-OSIJEK has two 5.01 lines in this sample alone. Ambiguous matches go to the review queue; **the importer must never guess an allocation.**

`payment_method` and `settlement_type` stay separate columns. `accounting_payments` constrains `payment_method` to `WIRE|CASH|CHECK|CARD`; kompenzacija and cesija are not methods there — they are `payment_source_type` (`bank_account|credit|kompenzacija|gotovina`) plus the `is_cesija` flag and the `cesija_*` columns. Collapsing both into one column would produce unstorable values. Neither appears in the sample (§13 q4).

## 6. Feeds: reference data

Imported before invoices on every run — invoice classification depends on them.

- **`chart_of_accounts`** — `account_code`, `name`, `active`. Drives category assignment.
- **`cost_centers`** — `code`, `name`, `active`. Drives project assignment — **but see §4.5: the field is currently unused in postings, so this feed is inert until accounting starts booking it.**
- **`partners` (*komitenti*)** — `kom_id` (the numeric id the GL uses), `oib`, `name`, `type`, `address`, `iban`, `email`, `phone`. **Required**: the GL export identifies partners only by `kom_id`, so without this feed no invoice can be attributed to a supplier at all (§4.6). OIB seeds the initial mapping to `subcontractors` / `retail_suppliers` / `office_suppliers` / `customers` / `retail_customers`; thereafter `kom_id` is the join key.
- **`companies`** — `oib`, `name`, `vat_id`. Our own entities → `accounting_companies`.
- **`bank_balances`** — `company_oib`, `iban`, `bank_name`, `currency`, `balance`, `balance_as_of`. Authoritative balances (§8).

## 7. Entity linking

| Cognilion entity | Derived from | How |
|---|---|---|
| Company (ours) | the exporting 4D Wand company | automatic — one export per legal entity |
| Supplier / customer | `Kom.` on the liability line | automatic, via `erp.partner_link_map`; unknown → review queue |
| **Project** | `MjTr` cost centre | ⚠️ **not currently possible** — the field is empty in every posting (§4.5). Manual until resolved |
| **Category** | `Konto` on the **expense** line | automatic, via `erp.account_category_map`. Several expense lines ⇒ several categories on one invoice |
| Contract | — | **manual** |
| Milestone / situacija | — | **manual** |
| Apartment / unit | — | **manual** |
| Credit line / allocation | — | **manual** |

The mapping tables are user-maintained through a new *Cashflow ▸ Šifrarnici* screen. An account or partner with no mapping does not block the import — the invoice lands in the review queue instead.

Note that `erp` is not exposed through PostgREST (a query returns `PGRST106`), so the Šifrarnici UI needs either the schema added to the API's exposed list or `public` views over the mapping tables. Deliberate: staging data should not be reachable from the browser by default.

### 7.1 Deriving `invoice_type`

`accounting_invoices` has a `check_invoice_entity_type` CHECK constraint that makes `invoice_type` and the counterparty FK mutually determining: each type requires exactly one of `supplier_id` / `retail_supplier_id` / `customer_id` / `retail_customer_id` / `office_supplier_id` / `investor_id` / `bank_id` to be set and **all others to be NULL**. The importer must therefore decide the type and the counterparty together, or the insert is rejected.

Direction comes from the document type (`UFA`/`UFB` incoming, `IRA`/`IFA` outgoing), and the rest from the expense account plus the resolved partner kind:

| Conditions | `invoice_type` |
|---|---|
| INCOMING, partner is a subcontractor/retail supplier | `INCOMING_SUPPLIER` |
| INCOMING, partner is an office supplier | `INCOMING_OFFICE` |
| INCOMING, partner is a bank, expense account = credit | `INCOMING_BANK` |
| INCOMING, partner is a bank, expense account = fees/interest (e.g. `4650`) | `INCOMING_BANK_EXPENSES` |
| INCOMING, partner is an investor | `INCOMING_INVESTMENT` |
| OUTGOING, partner is a customer | `OUTGOING_SALES` |
| OUTGOING, partner is a supplier | `OUTGOING_SUPPLIER` |
| OUTGOING, partner is an office supplier | `OUTGOING_OFFICE` |
| OUTGOING, partner is a bank | `OUTGOING_BANK` |

Anything the table does not resolve goes to the review queue. **The importer never guesses a type.**

Note that "is a bank", "is an investor" etc. are properties of *our* records, not of the ERP partner — so `erp.partner_link_map` must record which Cognilion entity kind each `Kom.` id resolves to, and an id present in two kinds is a conflict to be resolved by a human, not by precedence.

## 8. Bank balances

Today `company_bank_accounts.current_balance` is maintained two ways: the `update_company_bank_account_balance` trigger on every payment change, and `recalculateBankAccountBalance()` in `src/components/Cashflow/Companies/services/companyService.ts`, which recomputes from `initial_balance` plus payments, loans and cesija using a hardcoded `invoice_type` list.

With ERP as source of truth both are wrong, and keeping either alongside an authoritative feed guarantees silent divergence. Plan:

1. Import ERP balances into `erp.bank_balances`.
2. Show the ERP balance in the UI as authoritative.
3. Keep the trigger-derived value in a separate column purely as a **drift check** (§11), then drop it once the feed is trusted.
4. Remove `recalculateBankAccountBalance()` and its UI entry point.

## 9. Migration: full re-import with link carry-forward

Existing invoices were created in-app and carry manual links the ERP knows nothing about — `contract_id`, `milestone_id`, `apartment_id`, `bank_credit_id`, `credit_allocation_id`, `retail_contract_id`, `retail_milestone_id`. A naive wipe-and-reimport would zero every one of them, and the triggers would obediently recalculate every contract realization and milestone status to zero.

So the cutover is:

1. **Snapshot links.** Copy `(invoice_number, company_oib, partner_oib, total_amount, issue_date) → {all manual FK columns}` into `erp.link_carry_forward`.
2. **Full historical export** from 4D Wand for all years in scope.
3. **Import into staging**, classify, resolve partners and cost centres.
4. **Promote**, replacing the existing rows.
5. **Re-apply links** by matching the carry-forward snapshot on the natural key.
6. **Report** every carry-forward row that matched nothing, and every promoted invoice that received no link but whose predecessor had one. This report is the acceptance gate for the cutover — it is not optional and not advisory.
7. **Verify** contract realized amounts and milestone statuses against a pre-cutover snapshot.

Steps 1–7 run end to end on LandmarkDev, repeatedly, until step 6 is clean. The natural-key match will not be perfect; the point of the report is to make the residue visible and small enough to fix by hand.

## 10. Idempotency

Re-importing an unchanged file must be a complete no-op. Roughly 20 triggers fire on `accounting_invoices` and `accounting_payments` — cascading into contract budgets, milestone statuses, credit allocations and bank balances — so a careless re-upsert is both a correctness and a performance problem.

Every staging row therefore carries a `content_hash` over its normalized field values. Promotion compares the hash against the stored one and **skips unchanged rows before issuing any write**, so the triggers never fire. The `documents` table's `content_hash` column (migration `20260521130000_documents_content_hash.sql`) is the precedent.

Runs are transactional per feed: a file either promotes wholly or not at all, and `erp.import_runs` records the outcome, counts and errors.

## 11. Reconciliation

With no API we cannot re-query the ERP to check ourselves, so reconciliation is the only safety net and must ship with phase 1, not after it:

- **Snapshot diff** — documents present in the previous snapshot and absent from this one, flagged for review rather than auto-deleted.
- **Monthly totals** — per company and direction, imported totals vs. ERP-reported control sums. Add a `control_totals` feed for this.
- **Balance drift** — ERP balance vs. trigger-derived balance per account (§8).
- **Staleness alarm** — no successful run in N hours raises an alert. A silently dead import is worse than a failed one, because the data merely looks old rather than wrong.

## 12. Removals and enforcement

Delete, in `src/components/Cashflow/`:

- `Invoices/forms/InvoiceFormModal.tsx`, `RetailInvoiceFormModal.tsx`, `LandPurchaseFormModal.tsx`, and `Banks/forms/BankInvoiceFormModal.tsx`, with their hooks and form-data services
- `Payments/forms/PaymentFormModal.tsx`, `AccountingPaymentFormModal.tsx`
- create/update/delete in `Invoices/services/invoiceService.ts`, `landPurchaseService.ts`, `Payments/services/paymentService.ts`
- `recalculateBankAccountBalance()` in `Companies/services/companyService.ts`

All four invoice modals are mounted from `Invoices/index.tsx`, which keeps the UI removal contained.

**Keep:** `toggleInvoiceApproval` (Supervision), `toggleRetailInvoiceApproval` (Retail), and `detachInvoicesFromCredits` (Funding). These write to `accounting_invoices` but only touch `approved` and a FK — they are not document authorship.

**Enforce in the database, not the UI.** RLS on `accounting_invoices` and `accounting_payments` restricts INSERT/DELETE and amount-column UPDATE to the service role, so the importer can write and the client cannot — regardless of what the bundle contains. UI removal alone is not a boundary; this is the same reasoning that makes `VITE_CASHFLOW_PASSWORD` a speedbump rather than security.

E2E factories use the service-role client (`e2e/support/supabase-admin.ts`), so `createApprovedRetailInvoice` continues to work against the new policies.

## 13. Open questions

**Answered by the sample — no longer open:**

- ~~Header or line-level booking?~~ **Line level**, and more than that: a full general ledger (§4.1).
- ~~Can one payment settle several invoices?~~ **Yes** — confirmed by a 235.54 transfer settling six (§5).
- ~~Does 4D Wand expose bank statements?~~ **Yes**, as `IZV` journals.
- ~~Are storna identifiable?~~ **Yes**, as negative postings.

**For accounting — blocking:**

1. **⚠️ Will cost centres (`MjTr`) start being booked?** Empty in every sampled posting. Without them there is no automatic project assignment and manual classification becomes permanent, not exceptional (§4.5). **The single most important question in this document.**
2. **Can we get a *komitenti* export** mapping `Kom.` → OIB, name, IBAN? Without it no invoice can be attributed to a supplier (§4.6).
3. **Is the chart of accounts subdivided per project?** `0572 Ulaganja u građevine u izgradnji` hints at it. If so it is a fallback route to project assignment (§4.5 option 2).
4. **How are kompenzacija and cesija posted** — as `IZV` lines, or as separate journals? Neither appears in the sample, and both are first-class in Cognilion.
5. **Are bank fees and loan interest posted with a credit-facility identifier?** `4650 Troškovi platnog prometa` appears, but nothing ties it to a facility. Without one, the `bank_credits` link stays manual forever.
6. **Which journal (`Nal.`) numbers mean what**, and are they stable across periods? The sample has 5 (UFA), 6 (UFB), 7 (IZV), 8 (PDV) — if that is a convention rather than a coincidence it is a cheap routing signal.
7. **Can the export carry a control total per run** (§11)?
8. **Advance invoices (`UFB`)** — how should they surface? They have no contract or milestone, and konto 1250/1251 is a receivable, not a cost.

**On the export mechanics:**

9. **The sample is `.xlsx`, this spec assumes CSV.** We can choose; CSV is preferable — no cell-type coercion, no Excel date/timezone drift (the sample's dates arrive as `2026-08-20T22:00:00Z`, i.e. shifted a day by the local offset), and trivially diffable for the snapshot comparison in §3.1. Confirm 4D Wand can emit CSV with the §3 conventions.
10. **Is the export windowed and repeatable?** §3.1 needs a full snapshot of a rolling window, not a hand-picked date range.
11. **Can 4D Wand export the URA/IRA books directly** instead of the GL? They are already invoice-shaped and would remove the reconstruction logic in §4.1 — the single largest simplification available.
12. **Where are outgoing invoices?** No `IRA`/`IFA` rows in the sample. Sales invoices must come from ERP, so we need this feed and confirmation that apartment buyers appear as partners.
13. **Why does the base/VAT split not match the nominal rate?** 6.77 against 0.81 on the 13% account (§4.3). Presumably partial deductibility — needs confirming, because it determines whether we can validate imported VAT at all.

**For us — product decisions:**

8. **Do buyer payments for apartments come from ERP too?** Outgoing sales invoices will. If payments follow, `sales.total_paid` and `remaining_amount` become derived and the Sales payments UI goes read-only — consistent, but it widens the rewrite into the Sales module. If they do not, the same money is recorded twice, in Sales and in accounting, and they will drift. **This decision is not yet made** and it materially changes the scope of the Sales work.
9. **What is the export cadence?** Drives the staleness alarm threshold and how fresh dashboards actually are.
10. **How far back does the historical import go?** Determines the §9 cutover window.

## 14. Rollout

| Phase | Contents |
|---|---|
| 0 | ✅ **done** — `erp` schema, `erp.import_runs`, `erp.link_carry_forward`, and `source` / `erp_document_key` / `erp_content_hash` / `erp_synced_at` on both hub tables. Migration `20260831120000_erp_phase0_foundation.sql`, applied to LandmarkDev |
| 1 | Reference-data feeds + mapping tables + Šifrarnici UI |
| 2 | Parser, staging, `import-erp-csv` function, manual upload screen |
| 3 | Classification, review queue, promotion |
| 4 | Historical re-import with link carry-forward (§9) on LandmarkDev |
| 5 | Remove creation/editing UI, apply RLS (§12) |
| 6 | Reconciliation reports and staleness alarm (§11) |
| 7 | On-prem agent; cut over production |

Phases 1–3 are additive and can ship behind a flag while the current UI still works. Phase 5 is the irreversible one and should follow a clean phase 4 rehearsal.
