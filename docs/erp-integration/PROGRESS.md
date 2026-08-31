# Progress

Phases as defined in [SPEC.md](./SPEC.md) §14. Update this file as work lands.

| Phase | Status | Contents |
|---|---|---|
| 0 — Foundation | ✅ done | `erp` schema, `import_runs`, `link_carry_forward`, provenance columns |
| 1 — Reference data & mappings | ✅ done | Code lists, mapping tables, Šifrarnici UI |
| 2 — Ingestion | ⬜ not started | Parser, staging, `import-erp-csv` function, manual upload |
| 3 — Classification & promotion | ⬜ not started | Auto-classify, review queue, promote to `public` |
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

## Notes for whoever picks this up

- **`erp` is not reachable from the browser.** PostgREST does not expose the
  schema. Phase 1 adds `public` views for the mapping tables; staging tables
  stay unreachable on purpose.
- **Dev has zero invoice rows.** There is nothing on LandmarkDev to rehearse the
  phase 4 re-import against yet. That needs seeding before phase 4 means
  anything.
- **Never write to `public` from a parser.** Staging first, always; only the
  promotion step touches `accounting_invoices` / `accounting_payments`.
- **Re-import of an unchanged document must be a no-op.** Around 20 triggers
  hang off those two tables. Compare `erp_content_hash` and skip before issuing
  any write, or the cascades fire for nothing.
