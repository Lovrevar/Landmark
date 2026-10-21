---
paths:
  - "supabase/parked-migrations/**"
  - "supabase/functions/import-erp/**"
  - "src/components/Cashflow/**"
  - "src/lib/featureFlags.ts"
  - "docs/erp-integration/**"
  - "scripts/erp-*"
---

# ERP Integration (⏸️ on hold)

> **On hold since 2026-09-14 — merged but switched off.** The screens are hidden behind
> `ERP_INTEGRATION_ENABLED` in `src/lib/featureFlags.ts`, the migrations are parked in
> `supabase/parked-migrations/erp/` (never apply them from there), and `import-erp` is not
> deployed anywhere. Resume only via the checklist in
> [`docs/erp-integration/PROGRESS.md`](../../docs/erp-integration/PROGRESS.md) → "On hold", and fix
> ERP-1 to ERP-5 in [`KNOWN_ISSUES.md`](../../docs/erp-integration/KNOWN_ISSUES.md) first.

The financial section is being rewritten so that **4D Wand** — the ERP the company adopted —
becomes the source of truth for invoices, payments and bank balances. Cognilion stops
authoring them and becomes a consumer that imports, classifies and links. Everything
downstream keeps reading `accounting_invoices` / `accounting_payments` unchanged; what is
changing is *who writes* those two tables.

- Phases 0–3 (foundation, reference data, ingestion, classification/promotion) are done;
  phase 4 (historical re-import) is next. **Phase 5 removes the in-app creation UI and locks
  writes to the service role** — do not build new invoice/payment authoring UI without
  checking the plan first
- Lives in the `erp` Postgres schema, surfaced through `security_invoker` views in `public`;
  the parked migrations also expose `erp` to PostgREST (decision D13). UI at `/sifrarnici`
  (mappings) and `/erp-import`
- Ingestion is the `import-erp` edge function; `npm run erp:smoke` exercises the chain
- Read [`docs/erp-integration/`](../../docs/erp-integration/README.md) before touching invoices,
  payments, or bank balances
- ERP items go in `docs/erp-integration/KNOWN_ISSUES.md` and `OPEN_QUESTIONS.md`, not in
  `docs/backlog/`
- While the integration is on hold no project has the `erp` schema, so `npm run db:types` drops
  the ERP types that `import-erp` needs — `/db-types` restores them
