# Known issues

Defects and gaps in the merged ERP code (phases 0–3), and how later work on `development`
interacts with the integration. Found in the September 2026 code audit that produced
[`docs/DEFECT_BACKLOG.md`](../DEFECT_BACKLOG.md) (section 9 there mirrors the first part of this
file; the `ERP-n` ids are the same).

**Fix the ones marked "before resuming" before the parked migrations are applied anywhere** —
see step 3 of the checklist in [PROGRESS.md](./PROGRESS.md#resuming--checklist). Product
questions raised by the same audit are Q17–Q20 in [OPEN_QUESTIONS.md](./OPEN_QUESTIONS.md).

---

## 1. Defects in the merged code

### Before resuming

#### ERP-1 · Promoting a bank invoice fails the whole run
- **Where:** `supabase/parked-migrations/erp/20260831160000_erp_phase3_promotion.sql`, line 328 —
  the `invoice_category` CASE ends in `ELSE 'BANK'`.
- **Why it breaks:** `'BANK'` is not in `accounting_invoices_invoice_category_check`
  (`SUBCONTRACTOR, OFFICE, APARTMENT, CUSTOMER, BANK_CREDIT, INVESTOR, MISCELLANEOUS, GENERAL, RETAIL`).
  Any document whose partner maps to a bank (`*_BANK`, `INCOMING_BANK_EXPENSES`) violates the CHECK,
  and because promotion is one `INSERT … SELECT`, the whole run fails.
- **Fix:** `ELSE 'BANK_CREDIT'` — what the in-app bank invoice form writes.
- **Not caught because:** `npm run erp:smoke` has no bank-partner document.

#### ERP-2 · Negative documents fail the whole run
- **Where:** `promote_invoices` / `promote_payments` in the same migration.
- **Why it breaks:** `STORNO` and `CREDIT_NOTE` arrive with negative amounts (SPEC §4). They violate
  the `>= 0` CHECKs on `accounting_invoices` (`base_amount`, `vat_amount`, `total_amount`,
  `remaining_amount`) and `amount > 0` on `accounting_payments`, failing the run's single statement.
  `original_erp_id` is staged but nothing links a correction to the document it corrects.
- **Fix:** decide the model first (SPEC Q5 / OPEN_QUESTIONS Q8 cover advances; corrections need the
  same treatment): either store corrections as positive amounts with a sign-carrying type and an
  `original_erp_id` link, or relax the CHECKs for `source = 'erp'` rows and teach the payment-status
  trigger about negative totals. Until then, hold negative documents in the review queue instead of
  promoting them, so one storno cannot fail a run.
- **Not caught because:** the smoke test has no storno, credit note, kompenzacija, cesija or bank
  document.

#### ERP-3 · Šifrarnici's partner tab uses the old column name
- **Where:** `src/components/Cashflow/Sifrarnici/{index.tsx, types.ts, hooks/useSifrarnici.ts,
  services/sifrarniciService.ts}` and both locale files read and write `kom_id` (a number).
- **Why it breaks:** phase 2 renamed `erp.partners.kom_id` to `erp_id` (text), and the views and
  generated types follow. The Komitenti tab fails against a migrated database.
- **Fix:** rename to `erp_id: string` throughout.

#### ERP-4 · Investor targets read a moved table
- **Where:** `sifrarniciService.fetchPartnerTargets('investor')`.
- **Why it breaks:** it queries `public.investors`, moved to the `deprecated` schema by
  `20260518110000`. Investors are now rows in `banks` (Funding treats lenders and investors alike).
- **Fix:** drop the `investor` partner kind, or point it at `banks`; check `resolve_invoices` and
  `promote_invoices` still set a valid counterparty (`investor_id` points at the deprecated table).

#### ERP-5 · BANK payments cannot resolve their account
- **Where:** `erp.resolve_payments` matches `company_bank_accounts.account_number = company_iban`.
- **Why it breaks:** no screen ever writes `account_number` (DEFECT_BACKLOG CASH-13), so every
  `BANK` settlement is unresolved.
- **Fix:** see Q18 — create or match `company_bank_accounts` from the `bank_balances` feed by IBAN
  rather than adding an IBAN field to the company form.

### Fix before phase 4 (historical import)

#### ERP-6 · ERP cesija moves the wrong account
- In-app cesija nulls the invoice company's account and debits the payer's
  `cesija_bank_account_id` (the balance formula subtracts cesija on that column). `promote_payments`
  writes `CESIJA` with `company_bank_account_id` = the IBAN account and never sets
  `cesija_bank_account_id`, so the invoice company's account moves and the payer's does not.
- **Fix:** for `CESIJA`, put the resolved account in `cesija_bank_account_id` (when the IBAN belongs
  to the payer) and leave `company_bank_account_id` null.

#### ERP-7 · Retail invoices are not categorised `RETAIL`
- Retail supplier and retail customer documents get `SUBCONTRACTOR` / `CUSTOMER`, so they are
  invisible to the Retail role's RLS and the retail branch of Cashflow ▸ Approvals.
- **Fix:** `invoice_category = 'RETAIL'` when the partner kind is `retail_supplier` or
  `retail_customer`.

#### ERP-8 · Reference feed replacement is not atomic
- Already listed under phase 2/3 "Deliberately not done" in PROGRESS.md. Delete-then-upsert: a failure
  in between empties the register, and every later document fails to resolve.
- **Fix:** one transaction (an RPC) or upsert-then-delete-missing.

#### ERP-9 · No target for overhead costs
- Every invoice line needs a cost centre mapped to exactly one project or retail project
  (`num_nonnulls = 1`), so office overhead can only be imported by mapping its cost centre to some
  project. See Q20.

### Gaps against the design (not built yet)

#### ERP-10
- **Snapshot diff** for documents retracted from the ERP (D3 depends on it).
- **ERP bank balances** — `erp.bank_balances` is imported but nothing reads it: no display, no
  IBAN → account mapping, no drift column.
- **Partner matching by OIB** — `partner_oib` is staged and shown in Šifrarnici, but mapping is manual.
- **A payments review queue** — `erp_review_queue` covers invoices only; unresolved payments are
  visible only as counts.
- **`kompenzacija_reference`** is staged but not stored on the payment (DEFECT_BACKLOG CASH-11).

#### ERP-11 · Text that says promotion happens later
- The ERP import screen's i18n description and `docs/CASHFLOW.md` say nothing reaches
  `accounting_invoices` until a later phase. Since D17 the function promotes on upload.

#### ERP-12 · `calculate_invoice_amounts()` is replaced wholesale
- The phase 3 migration redefines the whole function with its 2026-08-31 body. Already step 2 of the
  resume checklist; listed so it is not missed.

#### Account roles beyond `expense`
- `erp.account_map.role` has ten values (liability, VAT, bank, …) designed for ledger
  reconstruction, which D11 abandoned. With invoice-shaped feeds only `expense` (bank fees) and
  `unclassified` (blocks) affect `resolve_invoices`; the VAT and bank roles are inert. Simplify the
  Šifrarnici UI or document that the other roles are informational.

---

## 2. Interaction with the `fix/defect-backlog` branch

That branch (2026-09-30) fixes the High and Medium audit findings outside the ERP. It adds five
migrations, `20260930100000` to `20260930100400`, which are **not applied anywhere yet**.

**No overlap with the parked SQL.** None of the branch's migrations redefines an object the parked
migrations create or replace; `calculate_invoice_amounts()` is untouched. When resuming, re-timestamp
the parked files after `20260930100400` (step 3 of the checklist).

**Things the branch changed that the integration relies on:**
- **One bank-balance formula.** `recalc_company_bank_account_balance()` is now the only code that
  computes a balance, and it includes credits disbursed to the account. The `company_loans` and
  `bank_credits` triggers call it. Phase 6's balance-drift check should compare the ERP balance with
  this function's result.
- **`public.app_user_role()`** returns the caller's role. The ERP policies still inline the
  `EXISTS (SELECT 1 FROM users …)` check; both work.
- **Tighter RLS** on `banks`, `customers`, `sales` and the sales inventory: writes are role-gated,
  reads are unchanged. Šifrarnici only reads these tables to offer mapping targets.
- **`get_invoice_statistics()`** now uses exactly the joins and search of `get_filtered_invoices()`.

**Remove in phase 5** (correct until then, redundant once the ERP writes invoices, payments and
balances):
- `reset_company_bank_account_balance()` and the balance and reset-date fields on the company form
  (DEFECT_BACKLOG CASH-1, CASH-16) — the ERP balance becomes authoritative.
- The invoice-edit change that keeps `approved` and `created_by` (CASH-3) — the form becomes a
  link-only editor.
- Hiding invoice delete for non-Directors (SEC-A7) — writes are locked to the service role.

**Open questions it surfaced:** double counting of in-app money records (Q17), bank accounts from
the ERP (Q18), what `INCOMING_INVESTMENT` means for cash flow (Q19), overhead cost centres (Q20).
