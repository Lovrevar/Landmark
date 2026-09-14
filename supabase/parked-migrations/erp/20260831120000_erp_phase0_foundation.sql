/*
  # ERP integration, phase 0 — foundation

  Groundwork for replacing in-app invoice/payment authorship with imports from
  4D Wand (see docs/ERP_INTEGRATION_SPEC.md). Purely additive: nothing here
  changes existing behaviour, drops a column, or touches a trigger. Every
  statement is idempotent.

  1. `erp` schema — home for staging, mappings and run bookkeeping, so ~15
     integration tables stay out of `public`. Resettable with
     `DROP SCHEMA erp CASCADE` during development.

  2. `erp.import_runs` — one row per ingested file, from either transport
     (on-prem agent or manual upload). The audit trail for what was imported
     when, and the anchor every staging row will reference.

  3. `erp.link_carry_forward` — the cutover safety net. Existing invoices carry
     manual links the ERP knows nothing about (contract, milestone, apartment,
     credit line). The historical re-import replaces those rows, so the links
     are snapshotted here first, keyed on natural identity, and re-applied
     afterwards. Without this the re-import silently zeroes every contract
     realization and milestone status in the app.

  4. Provenance columns on `accounting_invoices` / `accounting_payments`:
     - `source` — 'manual' (authored in-app) or 'erp' (imported). Existing rows
       default to 'manual', which is accurate: everything today was hand-entered.
     - `erp_document_key` — canonical identity of the source document.
     - `erp_content_hash` — hash of the normalized source fields, so a re-import
       of an unchanged document is skipped BEFORE any write and the ~20 triggers
       on these tables never fire. See spec §10.
     - `erp_synced_at` — when this row last matched its source.

  ## Why `erp_document_key` is a text document key, not a row id

  The 4D Wand export is a general-ledger journal (financijska knjiženja): one
  row per double-entry posting, not per invoice. A single incoming invoice is
  several postings — supplier liability, expense line(s), input VAT line(s) —
  tied together by (fiscal year, Nal., Dok., Lok. dok.). The per-row `ID`
  column identifies a posting, so it cannot key an invoice. The composite is
  therefore rendered as text, e.g. '2026/5/UFA/4'.

  ## RLS

  `erp` tables follow the same role gate as the cashflow tables tightened in
  20260526084700: Director and Accounting may read. No INSERT/UPDATE/DELETE
  policy is defined at all — the importer runs as the service role, which
  bypasses RLS, and nothing in the browser has any business writing here.
*/

CREATE SCHEMA IF NOT EXISTS erp;

COMMENT ON SCHEMA erp IS
  'ERP (4D Wand) integration: import staging, code mappings and run bookkeeping. See docs/ERP_INTEGRATION_SPEC.md.';

-- Lets PostgREST/authenticated roles resolve objects; per-table RLS still gates rows.
GRANT USAGE ON SCHEMA erp TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 1. Import runs
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS erp.import_runs (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  feed            text        NOT NULL,
  transport       text        NOT NULL CHECK (transport IN ('agent', 'manual')),
  file_name       text        NOT NULL,
  file_hash       text        NOT NULL,
  file_size_bytes bigint,
  status          text        NOT NULL DEFAULT 'received'
                    CHECK (status IN ('received', 'parsing', 'staged', 'promoting', 'completed', 'failed')),
  rows_total      integer     NOT NULL DEFAULT 0,
  rows_staged     integer     NOT NULL DEFAULT 0,
  rows_promoted   integer     NOT NULL DEFAULT 0,
  rows_skipped    integer     NOT NULL DEFAULT 0,
  rows_rejected   integer     NOT NULL DEFAULT 0,
  error_message   text,
  started_at      timestamptz NOT NULL DEFAULT now(),
  finished_at     timestamptz,
  uploaded_by     uuid REFERENCES public.users(id) ON DELETE SET NULL
);

COMMENT ON COLUMN erp.import_runs.file_hash IS
  'SHA-256 of the raw file. Re-uploading a byte-identical file is detectable without reparsing it.';
COMMENT ON COLUMN erp.import_runs.uploaded_by IS
  'Null for agent-pushed files; set for manual uploads.';

CREATE INDEX IF NOT EXISTS idx_erp_import_runs_feed_started
  ON erp.import_runs (feed, started_at DESC);

-- Drives the staleness alarm (spec §11): "has any feed succeeded recently?"
CREATE INDEX IF NOT EXISTS idx_erp_import_runs_status_started
  ON erp.import_runs (status, started_at DESC);

-- ---------------------------------------------------------------------------
-- 2. Link carry-forward
-- ---------------------------------------------------------------------------
-- Snapshot of every manual link on today's invoices, plus the natural key used
-- to find the invoice again after re-import. Amounts and dates are part of the
-- natural key because invoice_number alone is not unique across companies.

CREATE TABLE IF NOT EXISTS erp.link_carry_forward (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Where it came from, so a bad re-apply can be traced back.
  original_invoice_id   uuid        NOT NULL,

  -- Natural key.
  invoice_number        text        NOT NULL,
  company_id            uuid        NOT NULL,
  issue_date            date        NOT NULL,
  total_amount          numeric     NOT NULL,
  invoice_type          text        NOT NULL,

  -- The manual links themselves — everything the ERP cannot tell us.
  contract_id           uuid,
  milestone_id          uuid,
  apartment_id          uuid,
  bank_credit_id        uuid,
  credit_allocation_id  uuid,
  retail_contract_id    uuid,
  retail_milestone_id   uuid,
  retail_project_id     uuid,
  project_id            uuid,
  investment_id         uuid,
  investor_id           uuid,
  refund_id             bigint,

  -- Re-apply bookkeeping.
  reapplied_to_invoice_id uuid,
  reapplied_at            timestamptz,
  match_status            text NOT NULL DEFAULT 'pending'
                            CHECK (match_status IN ('pending', 'matched', 'ambiguous', 'unmatched')),
  match_note              text,

  captured_at           timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE erp.link_carry_forward IS
  'Pre-cutover snapshot of manual invoice links, re-applied after the historical re-import. Spec §9.';
COMMENT ON COLUMN erp.link_carry_forward.match_status IS
  'ambiguous = natural key hit several invoices; unmatched = hit none. Both need a human. The count of non-matched rows is the cutover acceptance gate.';

-- Deliberately NO foreign keys on the link columns: this table must survive the
-- re-import deleting the invoices it describes, which is the entire point.

CREATE INDEX IF NOT EXISTS idx_erp_lcf_natural_key
  ON erp.link_carry_forward (company_id, invoice_number, issue_date);

CREATE INDEX IF NOT EXISTS idx_erp_lcf_match_status
  ON erp.link_carry_forward (match_status) WHERE match_status <> 'matched';

-- ---------------------------------------------------------------------------
-- 3. Provenance columns on the two hub tables
-- ---------------------------------------------------------------------------

ALTER TABLE public.accounting_invoices
  ADD COLUMN IF NOT EXISTS source           text NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS erp_document_key text,
  ADD COLUMN IF NOT EXISTS erp_content_hash text,
  ADD COLUMN IF NOT EXISTS erp_synced_at    timestamptz;

ALTER TABLE public.accounting_payments
  ADD COLUMN IF NOT EXISTS source           text NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS erp_document_key text,
  ADD COLUMN IF NOT EXISTS erp_content_hash text,
  ADD COLUMN IF NOT EXISTS erp_synced_at    timestamptz;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'accounting_invoices_source_check'
  ) THEN
    ALTER TABLE public.accounting_invoices
      ADD CONSTRAINT accounting_invoices_source_check CHECK (source IN ('manual', 'erp'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'accounting_payments_source_check'
  ) THEN
    ALTER TABLE public.accounting_payments
      ADD CONSTRAINT accounting_payments_source_check CHECK (source IN ('manual', 'erp'));
  END IF;
END $$;

COMMENT ON COLUMN public.accounting_invoices.source IS
  'manual = authored in-app; erp = imported from 4D Wand. Existing rows are manual by definition.';
COMMENT ON COLUMN public.accounting_invoices.erp_document_key IS
  'Canonical source document identity, {fiscal_year}/{Nal.}/{Dok.}/{Lok. dok.}, e.g. 2026/5/UFA/4. Null for manual rows.';
COMMENT ON COLUMN public.accounting_invoices.erp_content_hash IS
  'Hash of the normalized source postings. Equal hash => nothing changed => skip the write so the triggers do not fire.';

-- One Cognilion invoice per ERP document. Partial, so the many manual rows with
-- a NULL key do not collide with each other.
CREATE UNIQUE INDEX IF NOT EXISTS uq_accounting_invoices_erp_document_key
  ON public.accounting_invoices (erp_document_key)
  WHERE erp_document_key IS NOT NULL;

-- Payments are per (bank posting, settled invoice) allocation, so the key
-- carries the posting id and is likewise unique.
CREATE UNIQUE INDEX IF NOT EXISTS uq_accounting_payments_erp_document_key
  ON public.accounting_payments (erp_document_key)
  WHERE erp_document_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_accounting_invoices_source
  ON public.accounting_invoices (source) WHERE source = 'erp';

-- ---------------------------------------------------------------------------
-- 4. RLS on the erp schema
-- ---------------------------------------------------------------------------
-- Read-only for Director/Accounting, mirroring 20260526084700_tighten_cashflow_rls.
-- No write policies: the importer is the service role and bypasses RLS.

ALTER TABLE erp.import_runs        ENABLE ROW LEVEL SECURITY;
ALTER TABLE erp.link_carry_forward ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Director and Accounting can view import runs" ON erp.import_runs;
CREATE POLICY "Director and Accounting can view import runs"
  ON erp.import_runs
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.users
    WHERE users.auth_user_id = auth.uid()
      AND users.role IN ('Director', 'Accounting')
  ));

DROP POLICY IF EXISTS "Director and Accounting can view link carry forward" ON erp.link_carry_forward;
CREATE POLICY "Director and Accounting can view link carry forward"
  ON erp.link_carry_forward
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.users
    WHERE users.auth_user_id = auth.uid()
      AND users.role IN ('Director', 'Accounting')
  ));

GRANT SELECT ON erp.import_runs, erp.link_carry_forward TO authenticated;
GRANT ALL    ON erp.import_runs, erp.link_carry_forward TO service_role;
