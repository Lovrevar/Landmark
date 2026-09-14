/*
  # ERP integration, phase 2 — import staging

  Landing zone for parsed feed rows. Nothing here writes to `public`: the
  importer parses, validates and stages, and only phase 3's promotion step
  touches `accounting_invoices` / `accounting_payments`. See
  docs/erp-integration/SPEC.md §§4–5 for the feed contracts.

  ## Partner ids become text

  Phase 1 modelled the 4D Wand partner id as `kom_id integer`, taken from the
  sample ledger's `Kom.` column. We now define the export format ourselves, so
  the id is whatever we ask for — and a text key costs nothing while surviving
  any ERP id scheme (prefixes, leading zeros, non-numeric codes). Both tables
  are empty, so this is a rename and a retype rather than a migration of data.

  ## Reference feeds are not staged

  `partners`, `accounts`, `cost_centers` and `bank_balances` are simple mirrors
  replaced wholesale on import, so they go straight into their `erp` tables.
  Only `invoices` and `payments` — the high-volume feeds that need validation,
  cross-row checks and a promotion decision — get staging tables.

  ## Validation lives in the row

  A staged row carries `is_valid` and `validation_errors` rather than being
  rejected outright. A file with twenty bad rows should stage the other nine
  hundred and eighty and show what failed, not vanish. Promotion only ever
  considers valid rows.
*/

-- ===========================================================================
-- 1. Partner id: integer -> text
-- ===========================================================================

DROP VIEW IF EXISTS public.erp_partner_map;
DROP VIEW IF EXISTS public.erp_partners;
DROP VIEW IF EXISTS public.erp_unmapped_codes;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'erp' AND table_name = 'partners' AND column_name = 'kom_id'
  ) THEN
    ALTER TABLE erp.partners     RENAME COLUMN kom_id TO erp_id;
    ALTER TABLE erp.partner_map  RENAME COLUMN kom_id TO erp_id;
    ALTER TABLE erp.partners     ALTER COLUMN erp_id TYPE text USING erp_id::text;
    ALTER TABLE erp.partner_map  ALTER COLUMN erp_id TYPE text USING erp_id::text;
  END IF;
END $$;

-- ===========================================================================
-- 2. Bank balances (reference feed, authoritative per SPEC §8)
-- ===========================================================================

CREATE TABLE IF NOT EXISTS erp.bank_balances (
  company_oib    text        NOT NULL,
  iban           text        NOT NULL,
  bank_name      text,
  currency       text        NOT NULL DEFAULT 'EUR',
  balance        numeric     NOT NULL,
  balance_as_of  date        NOT NULL,
  import_run_id  uuid REFERENCES erp.import_runs(id) ON DELETE SET NULL,
  imported_at    timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (iban, balance_as_of)
);

COMMENT ON TABLE erp.bank_balances IS
  'Authoritative balances from the ERP. Replaces the trigger-derived value in company_bank_accounts once trusted; kept alongside it as a drift check first. SPEC.md §8.';

-- ===========================================================================
-- 3. Staging: invoices
-- ===========================================================================
-- One row per invoice LINE, exactly as the feed delivers it (SPEC §4.1).

CREATE TABLE IF NOT EXISTS erp.staging_invoices (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  import_run_id     uuid        NOT NULL REFERENCES erp.import_runs(id) ON DELETE CASCADE,
  row_number        integer     NOT NULL,

  erp_id            text,
  line_no           integer,
  direction         text,
  document_type     text,
  original_erp_id   text,
  company_oib       text,
  partner_erp_id    text,
  partner_oib       text,
  partner_name      text,
  invoice_number    text,
  reference_number  text,
  issue_date        date,
  due_date          date,
  cost_center_code  text,
  account_code      text,
  base_amount       numeric,
  vat_rate          numeric,
  vat_amount        numeric,
  line_total        numeric,
  invoice_total     numeric,
  currency          text,
  description       text,
  source_updated_at timestamptz,

  -- Verbatim parsed row, so a mapping bug can be diagnosed without the file.
  raw               jsonb       NOT NULL DEFAULT '{}'::jsonb,
  is_valid          boolean     NOT NULL DEFAULT false,
  validation_errors text[]      NOT NULL DEFAULT '{}',
  created_at        timestamptz NOT NULL DEFAULT now(),

  UNIQUE (import_run_id, row_number)
);

CREATE INDEX IF NOT EXISTS idx_erp_staging_invoices_run  ON erp.staging_invoices (import_run_id);
CREATE INDEX IF NOT EXISTS idx_erp_staging_invoices_doc  ON erp.staging_invoices (erp_id);
CREATE INDEX IF NOT EXISTS idx_erp_staging_invoices_bad
  ON erp.staging_invoices (import_run_id) WHERE NOT is_valid;

-- ===========================================================================
-- 4. Staging: payments
-- ===========================================================================
-- One row per (payment, invoice) allocation (SPEC §5).

CREATE TABLE IF NOT EXISTS erp.staging_payments (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  import_run_id          uuid        NOT NULL REFERENCES erp.import_runs(id) ON DELETE CASCADE,
  row_number             integer     NOT NULL,

  erp_id                 text,
  allocation_no          integer,
  invoice_erp_id         text,
  allocated_amount       numeric,
  payment_total          numeric,
  payment_date           date,
  payment_method         text,
  settlement_type        text,
  company_iban           text,
  counterparty_iban      text,
  cesija_payer_oib       text,
  kompenzacija_reference text,
  reference_number       text,
  description            text,
  source_updated_at      timestamptz,

  raw                    jsonb       NOT NULL DEFAULT '{}'::jsonb,
  is_valid               boolean     NOT NULL DEFAULT false,
  validation_errors      text[]      NOT NULL DEFAULT '{}',
  created_at             timestamptz NOT NULL DEFAULT now(),

  UNIQUE (import_run_id, row_number)
);

CREATE INDEX IF NOT EXISTS idx_erp_staging_payments_run     ON erp.staging_payments (import_run_id);
CREATE INDEX IF NOT EXISTS idx_erp_staging_payments_invoice ON erp.staging_payments (invoice_erp_id);
CREATE INDEX IF NOT EXISTS idx_erp_staging_payments_bad
  ON erp.staging_payments (import_run_id) WHERE NOT is_valid;

-- ===========================================================================
-- 5. RLS
-- ===========================================================================
-- Read-only for Director/Accounting so the import screen can show what landed
-- and what failed. No write policies — the importer is the service role.

ALTER TABLE erp.bank_balances     ENABLE ROW LEVEL SECURITY;
ALTER TABLE erp.staging_invoices  ENABLE ROW LEVEL SECURITY;
ALTER TABLE erp.staging_payments  ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  t text;
  gate constant text :=
    'EXISTS (SELECT 1 FROM public.users WHERE users.auth_user_id = auth.uid() AND users.role IN (''Director'', ''Accounting''))';
BEGIN
  FOREACH t IN ARRAY ARRAY['bank_balances', 'staging_invoices', 'staging_payments'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS "Director and Accounting can read %1$s" ON erp.%1$I', t);
    EXECUTE format(
      'CREATE POLICY "Director and Accounting can read %1$s" ON erp.%1$I FOR SELECT TO authenticated USING (%2$s)',
      t, gate);
  END LOOP;
END $$;

GRANT SELECT ON erp.bank_balances, erp.staging_invoices, erp.staging_payments TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA erp TO service_role;

-- ===========================================================================
-- 6. Views rebuilt for the renamed column, plus import visibility
-- ===========================================================================

CREATE OR REPLACE VIEW public.erp_partners WITH (security_invoker = true) AS
  SELECT erp_id, name, oib, partner_type, address, iban, email, phone, active, imported_at
    FROM erp.partners;

CREATE OR REPLACE VIEW public.erp_partner_map WITH (security_invoker = true) AS
  SELECT erp_id, entity_kind, entity_id, notes, updated_by, updated_at, created_at
    FROM erp.partner_map;

CREATE OR REPLACE VIEW public.erp_unmapped_codes WITH (security_invoker = true) AS
  SELECT 'account'::text AS kind, coa.account_code AS code, coa.name, coa.active
    FROM erp.chart_of_accounts coa
    LEFT JOIN erp.account_map m ON m.account_code = coa.account_code
   WHERE m.account_code IS NULL OR m.role = 'unclassified'
  UNION ALL
  SELECT 'cost_center', cc.code, cc.name, cc.active
    FROM erp.cost_centers cc
    LEFT JOIN erp.cost_center_map m ON m.cost_center_code = cc.code
   WHERE m.cost_center_code IS NULL
  UNION ALL
  SELECT 'partner', p.erp_id, p.name, p.active
    FROM erp.partners p
    LEFT JOIN erp.partner_map m ON m.erp_id = p.erp_id
   WHERE m.erp_id IS NULL;

-- Import history for the screen: runs plus how many rows failed validation.
CREATE OR REPLACE VIEW public.erp_import_runs WITH (security_invoker = true) AS
  SELECT r.id, r.feed, r.transport, r.file_name, r.file_size_bytes, r.status,
         r.rows_total, r.rows_staged, r.rows_promoted, r.rows_skipped, r.rows_rejected,
         r.error_message, r.started_at, r.finished_at, r.uploaded_by
    FROM erp.import_runs r;

-- Rows that failed validation, so the screen can say exactly what was wrong.
CREATE OR REPLACE VIEW public.erp_staging_problems WITH (security_invoker = true) AS
  SELECT import_run_id, 'invoices'::text AS feed, row_number,
         COALESCE(erp_id, '(no id)') AS document_ref, validation_errors
    FROM erp.staging_invoices WHERE NOT is_valid
  UNION ALL
  SELECT import_run_id, 'payments', row_number,
         COALESCE(erp_id, '(no id)'), validation_errors
    FROM erp.staging_payments WHERE NOT is_valid;

GRANT SELECT ON public.erp_partners, public.erp_unmapped_codes,
                public.erp_import_runs, public.erp_staging_problems TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.erp_partner_map TO authenticated;
