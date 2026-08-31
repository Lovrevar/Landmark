# Progress

Phases as defined in [SPEC.md](./SPEC.md) §14. Update this file as work lands.

| Phase | Status | Contents |
|---|---|---|
| 0 — Foundation | ✅ done | `erp` schema, `import_runs`, `link_carry_forward`, provenance columns |
| 1 — Reference data & mappings | ✅ done | Code lists, mapping tables, Šifrarnici UI |
| 2 — Ingestion | ✅ done | Parser, staging, `import-erp` function, manual upload |
| 3 — Classification & promotion | ✅ done | Auto-classify, review queue, promote to `public` |
| 4 — Historical re-import | ⬜ not started | Full re-import with link carry-forward, rehearsed on dev |
| 5 — Removals & RLS | ⬜ not started | Delete creation UI, lock writes to service role |
| 6 — Reconciliation | ⬜ not started | Drift reports, staleness alarm |
| 7 — Production cutover | ⬜ not started | On-prem agent, cut over prod |

Phases 1–3 are additive and can ship behind a flag while the current UI still
works. **Phase 5 is the irreversible one** and should follow a clean phase 4
rehearsal.

---

## Phase 0 — Foundation ✅

Migration `20260831120000_erp_phase0_foundation.sql`, applied to LandmarkDev.
Commit `1f65b36`.

- [x] `erp` schema, with usage granted to `authenticated` and `service_role`
- [x] `erp.import_runs` — one row per ingested file, either transport
- [x] `erp.link_carry_forward` — pre-cutover snapshot of manual invoice links
- [x] `source`, `erp_document_key`, `erp_content_hash`, `erp_synced_at` on
      `accounting_invoices` and `accounting_payments`
- [x] Partial unique indexes on `erp_document_key`
- [x] Read-only RLS for Director/Accounting; no write policy (importer is
      service role)
- [x] Types regenerated; typecheck clean; 108 unit tests pass
- [x] e2e verified unaffected — the change is additive and `source` defaults,
      so the service-role factory insert still works

## Phase 1 — Reference data & mappings ✅

Migration `20260831130000_erp_phase1_reference_and_mappings.sql`, applied to
LandmarkDev.

- [x] `erp.chart_of_accounts`, `erp.cost_centers`, `erp.partners` — imported
      code lists, replaced wholesale on import, never hand-edited
- [x] `erp.account_map` — account → category, plus **`role`**, which is what
      lets the importer tell a gross liability line from a net expense line when
      rebuilding an invoice out of ledger rows. Without it every reconstructed
      total is wrong, so it is the column phase 3 leans on hardest
- [x] `erp.cost_center_map` — cost centre → project or retail project, exactly
      one of the two (inert until accounting books cost centres)
- [x] `erp.partner_map` — 4D Wand `Kom.` id → Cognilion entity, recording which
      of the seven kinds it resolves to
- [x] CHECK constraints: VAT roles require a rate, bank roles require a bank,
      a cost centre maps to exactly one project
- [x] `public` views, since `erp` is not exposed through PostgREST (`PGRST106`).
      Mapping views are deliberately **plain** — a join would make them
      non-auto-updatable and silently turn the screen read-only
- [x] `security_invoker` on every view, so the role gate is not bypassed
- [x] Šifrarnici UI at `/sifrarnici`, three tabs, inline editing, unmapped filter
- [x] i18n keys in both locale files; Croatian domain terms (Šifrarnici, konta,
      mjesta troška, komitenti, pretporez) left untranslated in both
- [x] Activity logging on every mapping write; entities registered in
      `ENTITY_ROUTE_MAP`
- [x] `/sifrarnici` added to the e2e Cashflow permissions matrix

Verified: 27/27 e2e, 108/108 unit, typecheck and build clean, lint 0 errors.
Confirmed against the live dev DB that the mapping views accept writes, that
the CHECK constraints hold *through* the views, and that anon is refused
(`42501`).

### Known gaps, deliberately left to phase 2

- **The code lists are empty**, so every tab shows an empty state. They fill
  when the reference-data feeds land. The empty states say so rather than
  showing a bare table.
- **No bulk mapping.** Fine for a few dozen accounts; revisit if the imported
  chart turns out to be large.

## Phase 2 — Ingestion ✅

Migrations `20260831140000_erp_phase2_staging.sql` and
`20260831150000_erp_expose_schema.sql`, applied to LandmarkDev. Edge function
`import-erp` deployed there.

- [x] `erp.staging_invoices` / `erp.staging_payments` — typed staging, one row
      per invoice line and per payment allocation, with `raw` jsonb kept so a
      mapping bug can be diagnosed without the original file
- [x] `erp.bank_balances` — a time series keyed by (iban, date), so it
      accumulates rather than being replaced
- [x] Partner ids moved from `integer` to `text` — we define the export now, so
      the key should survive any ERP id scheme
- [x] `import-erp` edge function: one parser for both transports, shared-secret
      auth for the agent and JWT + role re-check for the browser
- [x] CSV (RFC 4180, delimiter sniffed, BOM stripped, CP1250 fallback) and
      XLSX/XLS, read as displayed text to dodge Excel's timezone coercion
- [x] Per-row validation plus cross-row checks: lines must sum to
      `invoice_total`, no more than 4 distinct VAT rates, no duplicate
      `line_no`, allocations may not exceed `payment_total`
- [x] Invalid rows are staged **with** their errors rather than dropped, so a
      file with 20 bad rows still lands the other 980
- [x] Reference feeds replace their register outright, so a code deleted in the
      ERP disappears here too
- [x] `Cashflow ▸ ERP import` screen at `/erp-import`, doubling as the run log
      for agent-pushed files
- [x] `public.erp_import_runs` and `public.erp_staging_problems` views
- [x] 38 Deno tests; `/erp-import` added to the e2e permissions matrix
- [x] Agent contract written up in [AGENT.md](./AGENT.md)

Verified end-to-end against the live dev function: reference and document feeds
import; comma and dot decimals both parse (`4024,47` → `4024.47`); `31.08.2026`
→ `2026-08-31` with no timezone drift; Croatian diacritics survive an XLSX
round-trip; invalid rows are retained with per-row errors; a wrong or missing
secret gives 401 and an unknown feed 400. Test data was cleaned off dev
afterwards.

### Deliberately not done

- **No promotion.** Nothing reaches `accounting_invoices` yet; that is phase 3.
- **Reference replacement is not atomic** — delete and insert are separate
  statements, so a failure between them leaves the register empty until the
  next run. Noted in the function; move it into an RPC if it ever bites.
- **No on-prem agent.** AGENT.md specifies it; the upload screen covers
  development and manual replay in the meantime.

## Phase 3 — Classification & promotion ✅

Migrations `20260831160000_erp_phase3_promotion.sql` and
`20260831170000_erp_reclassify_rpc.sql`, applied to LandmarkDev.

- [x] `erp.resolve_invoices(run_id)` — maps codes onto Cognilion ids and derives
      `invoice_type`. Writes nothing to `public`, so it is free to re-run after
      a mapping is fixed
- [x] `erp.promote_invoices(run_id)` — folds a document's lines into one
      `accounting_invoices` row, assigning VAT to slots by rate
- [x] `erp.resolve_payments` / `erp.promote_payments` — allocations become
      `accounting_payments` rows, with `settlement_type` mapped onto
      `payment_source_type` / `is_cesija` / `cesija_company_id`
- [x] **Promotion is all-or-nothing per document** (DECISIONS.md D15)
- [x] **`calculate_invoice_amounts()` bypassed for `source = 'erp'`**
      (DECISIONS.md D16) — it would otherwise have overwritten every imported
      VAT figure and total
- [x] Content-hash skip: an unchanged document issues no write, so none of the
      ~20 triggers fire
- [x] `public.erp_review_queue` — held documents, one row per document, with
      every reason listed
- [x] `public.erp_reclassify(run_id)` — role-gated wrapper so a person can
      re-run classification after mapping a code
- [x] `import-erp` classifies as part of the upload, so the agent is unattended
- [x] Review-queue section on the ERP import screen with a re-run action
- [x] `npm run erp:smoke` — end-to-end smoke test, 25 checks

Verified by `npm run erp:smoke` against the live dev function and database:
the two-rate fold, the ERP total surviving the trigger, the 438.53 VAT that
would have become 523.18, the all-or-nothing hold, the fix-mapping-then-reclassify
loop, the unchanged-file skip, a 10% rate held for want of a slot, and a payment
settling its invoice through the existing triggers.

### Bugs the smoke test caught, worth knowing about

1. **Partial promotion.** A two-line invoice with one unmapped account was
   promoted from its other line, carrying the declared 225.00 total with only
   100.00 of base amount. Fixed by D15. This is the one to remember: unit tests
   could not have found it, because the defect was in the SQL's interaction with
   the data, not in any single function.
2. **`MIN(uuid)` does not exist** in Postgres. The fold used it for the resolved
   id columns.
3. **`ARRAY_AGG` over empty arrays** raises `cannot accumulate empty arrays` —
   most lines of a held document have no errors, so the review queue view broke
   the moment anything was actually held.

### Deliberately not done

- **No manual link editing yet.** Contract, milestone, apartment and credit line
  are still unset on imported invoices. Promotion preserves them on re-import,
  but nothing assigns them; that is the repurposed invoice form, still to come.
- **Reference replacement is still not atomic** (carried over from phase 2).

## Notes for whoever picks this up

- **`erp` is now exposed to PostgREST** (`20260831150000`). It had to be: the
  restriction is in the API layer, so `.schema('erp')` failed with `PGRST106`
  even for the service role. Every table there has RLS with SELECT-only
  policies for Director/Accounting and no write policy, so exposure gives the
  import screen its reads without opening a write path. **On production, also
  set it in the dashboard** (Settings ▸ API ▸ Exposed schemas) or an
  infrastructure change can silently revert it and every import starts failing.
- **Dev has zero invoice rows.** There is nothing on LandmarkDev to rehearse the
  phase 4 re-import against yet. That needs seeding before phase 4 means
  anything.
- **Never write to `public` from a parser.** Staging first, always; only the
  promotion step touches `accounting_invoices` / `accounting_payments`.
- **The VAT slots are fixed at 25 / 13 / 0 / 5** because
  `calculate_invoice_amounts()` hardcodes them. They are not free columns. Any
  other rate has nowhere to go and is held for review.
- **Run `npm run erp:smoke` after touching the SQL.** It needs
  `ERP_IMPORT_SECRET` and refuses to run against production.
- **Re-import of an unchanged document must be a no-op.** Around 20 triggers
  hang off those two tables. Compare `erp_content_hash` and skip before issuing
  any write, or the cascades fire for nothing.
