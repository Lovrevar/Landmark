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

## 4. Feed: `invoices`

**We define this format; 4D Wand is configured to produce it.** The sample in
`docs/erp-samples/` is a general-ledger dump and was only ever illustrative —
it showed what the data looks like, not what the export has to be. Designing an
invoice-shaped feed instead removes the document-reconstruction step entirely,
which was the largest and riskiest piece of the importer.

The general-ledger shape and how an invoice decomposes into postings is
recorded in [LEDGER_NOTES.md](./LEDGER_NOTES.md), in case the export turns out
to be less configurable than expected and reconstruction has to come back.

### 4.1 One row per invoice line

Header-level would be simpler, but throws away two things we cannot recover:
an invoice booked across several cost centres (so charging several projects),
and the per-rate VAT breakdown. Lines keep both.

| Column | Req | Notes |
|---|---|---|
| `erp_id` | ● | **stable, immutable, never reused** — identity of the whole document. Everything hinges on it |
| `line_no` | ● | line ordinal within the document, 1-based |
| `direction` | ● | `INCOMING` \| `OUTGOING` |
| `document_type` | ● | `INVOICE` \| `CREDIT_NOTE` \| `ADVANCE` \| `STORNO` |
| `original_erp_id` | | the document being corrected, for credit notes and storna |
| `company_oib` | ● | **our** legal entity → `accounting_companies` |
| `partner_erp_id` | ● | counterparty's 4D Wand id — the **primary** join, via `erp.partner_map` |
| `partner_oib` | | counterparty OIB. Seeds the mapping and is the fallback join; not primary, because it can be absent for private individuals and foreign partners |
| `partner_name` | ● | as booked, so the review queue is readable without a resolved partner |
| `invoice_number` | ● | as printed on the document |
| `reference_number` | | *poziv na broj* |
| `issue_date` | ● | |
| `due_date` | ● | |
| `cost_center_code` | ● | *mjesto troška* → **project**, via `erp.cost_center_map` |
| `account_code` | ● | *konto* → **category**, via `erp.account_map` |
| `base_amount` | ● | line net |
| `vat_rate` | ● | line VAT rate as a percentage, e.g. `25` |
| `vat_amount` | ● | line VAT |
| `line_total` | ● | line gross |
| `invoice_total` | ● | **whole-document** gross, repeated on every line |
| `currency` | ● | `EUR` |
| `description` | | |
| `updated_at` | ● | last modification in the ERP |

`invoice_total` is repeated deliberately: it lets the importer check that the
lines it received sum to the document, and so detect a truncated or
partially-written file before anything is promoted.

### 4.2 Multi-VAT

Croatian invoices carry up to four VAT rates. The importer groups an
invoice's lines by distinct `vat_rate` and folds them into
`base_amount_1..4` / `vat_rate_1..4` / `vat_amount_1..4`.

**More than four distinct rates on one document is a hard error, not a
truncation** — silently dropping the fifth would corrupt the total.

`vat_amount` is taken as posted, never recomputed from `base_amount × vat_rate`.
The sample showed splits that do not match the nominal rate (6.77 against 0.81
on a 13% account), most likely partial input-VAT deductibility. A recomputed
figure would silently disagree with the ledger. See DECISIONS.md D8.

### 4.3 Storna and credit notes

Corrections arrive as their own documents with `document_type` of `STORNO` or
`CREDIT_NOTE`, negative amounts, and `original_erp_id` pointing at what they
correct. A document that is retracted outright instead disappears from the next
snapshot and is caught by the diff (§3.1).

## 5. Feed: `payments`

**One row per (payment, invoice) allocation.** One bank transfer settling six
invoices is six rows sharing an `erp_id`. This is the natural grain:
`accounting_payments.invoice_id` is a single non-null FK, so an allocation *is*
a Cognilion payment.

| Column | Req | Notes |
|---|---|---|
| `erp_id` | ● | stable id of the payment; repeated across its allocations |
| `allocation_no` | ● | ordinal within the payment, so (erp_id, allocation_no) is unique |
| `invoice_erp_id` | ● | the invoice being settled — must match an `invoices.erp_id` |
| `allocated_amount` | ● | amount against *this* invoice, not the transfer total |
| `payment_total` | ● | the whole transfer, repeated — same checksum role as `invoice_total` |
| `payment_date` | ● | |
| `payment_method` | ● | `WIRE` \| `CASH` \| `CHECK` \| `CARD` |
| `settlement_type` | ● | `BANK` \| `KOMPENZACIJA` \| `CESIJA` \| `GOTOVINA` |
| `company_iban` | | our account → `company_bank_accounts`; null for cash and kompenzacija |
| `counterparty_iban` | | |
| `cesija_payer_oib` | | the third party that paid on our behalf, when `settlement_type = CESIJA` |
| `kompenzacija_reference` | | offset statement number |
| `reference_number` | | |
| `description` | | |
| `updated_at` | ● | |

**`payment_method` and `settlement_type` are separate on purpose.**
`accounting_payments` constrains `payment_method` to `WIRE|CASH|CHECK|CARD`;
kompenzacija and cesija are not methods there — they are `payment_source_type`
(`bank_account|credit|kompenzacija|gotovina`) plus the `is_cesija` flag and the
`cesija_*` columns. One combined column would produce values that cannot be
stored.

Because the ERP supplies `invoice_erp_id` directly, there is no amount-matching
heuristic and no ambiguity — which is the single biggest benefit of designing
the feed rather than reading it out of the ledger.

## 6. Feeds: reference data

Imported before invoices on every run — invoice classification depends on them.

- **`chart_of_accounts`** — `account_code`, `name`, `active`. Drives category assignment.
- **`cost_centers`** — `code`, `name`, `active`. Drives project assignment. Accounting has confirmed cost centres will be booked going forward, so this is a live route rather than an aspiration.
- **`partners` (*komitenti*)** — `erp_id`, `oib`, `name`, `type`, `address`, `iban`, `email`, `phone`. **Required**: invoices join to partners by `partner_erp_id`, so without this feed nothing can be attributed to a supplier. OIB — which accounting has confirmed will be populated — seeds the initial mapping to `subcontractors` / `retail_suppliers` / `office_suppliers` / `customers` / `retail_customers`; `erp_id` stays the join key, since OIB can be absent for private individuals and foreign partners.
- **`companies`** — `oib`, `name`, `vat_id`. Our own entities → `accounting_companies`.
- **`bank_balances`** — `company_oib`, `iban`, `bank_name`, `currency`, `balance`, `balance_as_of`. Authoritative balances (§8).

## 7. Entity linking

| Cognilion entity | Derived from | How |
|---|---|---|
| Company (ours) | `company_oib` | automatic, by OIB |
| Supplier / customer | `partner_erp_id` | automatic, via `erp.partner_map`; unknown → review queue |
| **Project** | `cost_center_code` | automatic, via `erp.cost_center_map` |
| **Category** | `account_code` | automatic, via `erp.account_map`. Several lines ⇒ several categories on one invoice |
| Contract | — | **manual** |
| Milestone / situacija | — | **manual** |
| Apartment / unit | — | **manual** |
| Credit line / allocation | — | **manual** |

The mapping tables are user-maintained through a new *Cashflow ▸ Šifrarnici* screen. An account or partner with no mapping does not block the import — the invoice lands in the review queue instead.

Note that `erp` is not exposed through PostgREST (a query returns `PGRST106`), so the Šifrarnici UI needs either the schema added to the API's exposed list or `public` views over the mapping tables. Deliberate: staging data should not be reachable from the browser by default.

### 7.1 Deriving `invoice_type`

`accounting_invoices` has a `check_invoice_entity_type` CHECK constraint that makes `invoice_type` and the counterparty FK mutually determining: each type requires exactly one of `supplier_id` / `retail_supplier_id` / `customer_id` / `retail_customer_id` / `office_supplier_id` / `investor_id` / `bank_id` to be set and **all others to be NULL**. The importer must therefore decide the type and the counterparty together, or the insert is rejected.

Direction comes from the `direction` column, and the rest from `account_code` plus the resolved partner kind:

| Conditions | `invoice_type` |
|---|---|
| INCOMING, partner is a subcontractor/retail supplier | `INCOMING_SUPPLIER` |
| INCOMING, partner is an office supplier | `INCOMING_OFFICE` |
| INCOMING, partner is a bank, account = credit | `INCOMING_BANK` |
| INCOMING, partner is a bank, account = fees/interest | `INCOMING_BANK_EXPENSES` |
| INCOMING, partner is an investor | `INCOMING_INVESTMENT` |
| OUTGOING, partner is a customer | `OUTGOING_SALES` |
| OUTGOING, partner is a supplier | `OUTGOING_SUPPLIER` |
| OUTGOING, partner is an office supplier | `OUTGOING_OFFICE` |
| OUTGOING, partner is a bank | `OUTGOING_BANK` |

Anything the table does not resolve goes to the review queue. **The importer never guesses a type.**

Note that "is a bank", "is an investor" etc. are properties of *our* records, not of the ERP partner — so `erp.partner_map` must record which Cognilion entity kind each ERP partner id resolves to, and an id present in two kinds is a conflict to be resolved by a human, not by precedence.

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

**Settled:**

- **Cost centres will be booked**, and **OIBs will be populated** — accounting
  confirmed both. Automatic project and partner assignment are live routes.
- **We define the export format.** The sample was illustrative only, so the
  invoice-shaped feeds in §4 and §5 replace any reconstruction from the ledger.
  This removed the largest piece of risk in the importer.
- Line vs header booking, one-payment-many-invoices, storno visibility and
  payment status were all answered by the sample; see LEDGER_NOTES.md.

**Still needed from accounting:**

1. **Can 4D Wand emit exactly the columns in §4 and §5?** "Any format" is
   assumed to mean column choice and file type. If some column cannot be
   produced — `partner_erp_id`, `cost_center_code`, or `invoice_total` most
   critically — say so early, because each has a fallback and the fallbacks
   differ a lot in cost.
2. **How are kompenzacija and cesija recorded** — can they carry
   `settlement_type` and `cesija_payer_oib`? Both are first-class in Cognilion.
3. **Do bank fees and loan interest carry a credit-facility identifier?**
   Without one, the `bank_credits` link stays manual forever.
4. **Can the export carry a per-run control total** (§11)?
5. **Are advance invoices (`ADVANCE`) in scope for phase 1?** They have no
   contract or milestone and post to a receivable rather than a cost.
6. **Is the export a repeatable full snapshot of a rolling window** (§3.1),
   rather than a hand-picked date range?
7. **CSV rather than XLSX?** Both are supported by the importer, but CSV avoids
   Excel's date/timezone coercion — the sample's dates arrived shifted a day —
   and diffs cleanly for the snapshot comparison.

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
