/*
  # ERP integration, phase 3 — classification and promotion

  Turns staged feed rows into `accounting_invoices` / `accounting_payments`.
  Two steps, deliberately separate:

    erp.resolve_invoices(run_id)   -- codes -> Cognilion ids, no writes to public
    erp.promote_invoices(run_id)   -- fully-resolved documents -> public

  Resolution is re-runnable and harmless, so a mapping can be fixed in the
  Šifrarnici screen and resolution re-run without re-importing the file.

  ## The VAT trigger had to be guarded

  `public.calculate_invoice_amounts()` is a BEFORE trigger that **hardcodes**
  the rates — slot 1 = 25%, 2 = 13%, 3 = 0%, 4 = 5% — and overwrites
  `vat_amount_n` with `base_amount_n * rate`, then recomputes `total_amount`.
  That is right for a hand-entered invoice, where the user types base amounts
  and expects the VAT to be worked out.

  It is wrong for an imported one. Verified against the real sample posting:
  4024.47 base at 13% with 438.53 VAT posted (partial deductibility) came back
  as 523.18 VAT and a 4547.65 total, against the ERP's 4463.00 — an 84.65
  discrepancy on a single invoice, which would then propagate into debt
  reporting and contract realization with nothing to flag it.

  So the trigger now returns early for `source = 'erp'`. Manual invoices behave
  exactly as before. See DECISIONS.md D8.

  ## VAT slots are fixed by rate

  Because the trigger hardcodes them, the four slots ARE 25 / 13 / 0 / 5 — they
  are not free columns. Promotion therefore assigns a line to a slot by its
  rate, and **a rate outside {0, 5, 13, 25} cannot be represented at all**;
  such a document is refused rather than rounded into a neighbouring slot.

  ## Idempotency

  Each document gets an `erp_content_hash` over its normalized lines. The
  upsert only updates when the hash differs, so re-importing an unchanged
  document issues no write and the ~20 triggers on these tables never fire.
*/

-- ===========================================================================
-- 1. Guard the amount trigger
-- ===========================================================================

CREATE OR REPLACE FUNCTION public.calculate_invoice_amounts() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
-- Imported invoices carry authoritative amounts from the ERP, including VAT
-- splits that legitimately differ from the nominal rate. Recomputing them here
-- would make Cognilion disagree with the ledger. See DECISIONS.md D8.
IF NEW.source = 'erp' THEN
  -- The legacy aggregate columns are still filled, because they are plain sums
  -- of what the ERP posted rather than a re-derivation of it. Reports and the
  -- invoice table read them, so leaving them at 0 would blank out every
  -- imported invoice's net and VAT.
  NEW.base_amount :=
    COALESCE(NEW.base_amount_1, 0) + COALESCE(NEW.base_amount_2, 0) +
    COALESCE(NEW.base_amount_3, 0) + COALESCE(NEW.base_amount_4, 0);
  NEW.vat_amount :=
    COALESCE(NEW.vat_amount_1, 0) + COALESCE(NEW.vat_amount_2, 0) +
    COALESCE(NEW.vat_amount_3, 0) + COALESCE(NEW.vat_amount_4, 0);
  -- total_amount is NOT touched: it is the ERP's figure, and the posted VAT
  -- split does not always reconcile to it exactly.
  NEW.remaining_amount := COALESCE(NEW.total_amount, 0) - COALESCE(NEW.paid_amount, 0);
  RETURN NEW;
END IF;

-- Calculate VAT amounts for each rate
NEW.vat_amount_1 := ROUND(COALESCE(NEW.base_amount_1, 0) * 0.25, 2);
NEW.vat_amount_2 := ROUND(COALESCE(NEW.base_amount_2, 0) * 0.13, 2);
NEW.vat_amount_3 := 0; -- 0% VAT is always 0
NEW.vat_amount_4 := ROUND(COALESCE(NEW.base_amount_4, 0) * 0.05, 2);

NEW.total_amount :=
(COALESCE(NEW.base_amount_1, 0) + COALESCE(NEW.vat_amount_1, 0)) +
(COALESCE(NEW.base_amount_2, 0) + COALESCE(NEW.vat_amount_2, 0)) +
(COALESCE(NEW.base_amount_3, 0) + COALESCE(NEW.vat_amount_3, 0)) +
(COALESCE(NEW.base_amount_4, 0) + COALESCE(NEW.vat_amount_4, 0));

NEW.base_amount :=
COALESCE(NEW.base_amount_1, 0) + COALESCE(NEW.base_amount_2, 0) +
COALESCE(NEW.base_amount_3, 0) + COALESCE(NEW.base_amount_4, 0);

NEW.vat_amount :=
COALESCE(NEW.vat_amount_1, 0) + COALESCE(NEW.vat_amount_2, 0) +
COALESCE(NEW.vat_amount_3, 0) + COALESCE(NEW.vat_amount_4, 0);

NEW.remaining_amount := COALESCE(NEW.total_amount, 0) - COALESCE(NEW.paid_amount, 0);

RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.calculate_invoice_amounts() IS
  'Derives amounts for hand-entered invoices from base_amount_1..4 at the fixed rates 25/13/0/5. Returns early for source = ''erp'': imported rows carry authoritative amounts and must not be recomputed.';

COMMENT ON COLUMN public.accounting_invoices.erp_document_key IS
  'The ERP document id (invoices feed erp_id). Null for manual rows.';

-- ===========================================================================
-- 2. Resolution columns
-- ===========================================================================

ALTER TABLE erp.staging_invoices
  ADD COLUMN IF NOT EXISTS resolved_company_id     uuid,
  ADD COLUMN IF NOT EXISTS resolved_partner_kind   text,
  ADD COLUMN IF NOT EXISTS resolved_partner_id     uuid,
  ADD COLUMN IF NOT EXISTS resolved_project_id     uuid,
  ADD COLUMN IF NOT EXISTS resolved_retail_project_id uuid,
  ADD COLUMN IF NOT EXISTS resolved_category_id    uuid,
  ADD COLUMN IF NOT EXISTS resolved_invoice_type   text,
  ADD COLUMN IF NOT EXISTS resolution_errors       text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS resolved_at             timestamptz;

ALTER TABLE erp.staging_payments
  ADD COLUMN IF NOT EXISTS resolved_invoice_id      uuid,
  ADD COLUMN IF NOT EXISTS resolved_bank_account_id uuid,
  ADD COLUMN IF NOT EXISTS resolved_cesija_company_id uuid,
  ADD COLUMN IF NOT EXISTS resolution_errors        text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS resolved_at              timestamptz;

CREATE INDEX IF NOT EXISTS idx_erp_staging_invoices_unresolved
  ON erp.staging_invoices (import_run_id)
  WHERE is_valid AND resolution_errors <> '{}';

-- ===========================================================================
-- 3. Resolve invoices
-- ===========================================================================

CREATE OR REPLACE FUNCTION erp.resolve_invoices(p_run_id uuid)
RETURNS TABLE (rows_resolved bigint, rows_unresolved bigint)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  UPDATE erp.staging_invoices s
     SET resolved_company_id        = c.id,
         resolved_partner_kind      = pm.entity_kind,
         resolved_partner_id        = pm.entity_id,
         resolved_project_id        = ccm.project_id,
         resolved_retail_project_id = ccm.retail_project_id,
         resolved_category_id       = am.invoice_category_id,
         resolved_invoice_type      = CASE
           WHEN s.direction = 'INCOMING' THEN CASE pm.entity_kind
             WHEN 'subcontractor'   THEN 'INCOMING_SUPPLIER'
             WHEN 'retail_supplier' THEN 'INCOMING_SUPPLIER'
             WHEN 'office_supplier' THEN 'INCOMING_OFFICE'
             WHEN 'investor'        THEN 'INCOMING_INVESTMENT'
             -- A bank invoice is a credit drawdown or a fee/interest charge,
             -- and only the account can tell them apart.
             WHEN 'bank' THEN CASE WHEN am.role = 'expense' THEN 'INCOMING_BANK_EXPENSES' ELSE 'INCOMING_BANK' END
             ELSE NULL END
           WHEN s.direction = 'OUTGOING' THEN CASE pm.entity_kind
             WHEN 'customer'        THEN 'OUTGOING_SALES'
             WHEN 'retail_customer' THEN 'OUTGOING_SALES'
             WHEN 'subcontractor'   THEN 'OUTGOING_SUPPLIER'
             WHEN 'retail_supplier' THEN 'OUTGOING_SUPPLIER'
             WHEN 'office_supplier' THEN 'OUTGOING_OFFICE'
             WHEN 'bank'            THEN 'OUTGOING_BANK'
             ELSE NULL END
           ELSE NULL END,
         resolution_errors = ARRAY_REMOVE(ARRAY[
           CASE WHEN c.id  IS NULL THEN 'no company with OIB ' || COALESCE(s.company_oib, '(none)') END,
           CASE WHEN pm.entity_id IS NULL THEN 'partner ' || COALESCE(s.partner_erp_id, '(none)') || ' is not mapped' END,
           CASE WHEN ccm.cost_center_code IS NULL THEN 'cost centre ' || COALESCE(s.cost_center_code, '(none)') || ' is not mapped' END,
           CASE WHEN am.account_code IS NULL THEN 'account ' || COALESCE(s.account_code, '(none)') || ' is not mapped' END,
           CASE WHEN am.role = 'unclassified' THEN 'account ' || s.account_code || ' has no role' END,
           CASE WHEN s.vat_rate IS NOT NULL AND s.vat_rate NOT IN (0, 5, 13, 25)
                THEN 'VAT rate ' || s.vat_rate || '% has no slot; only 0, 5, 13 and 25 can be stored' END,
           CASE WHEN pm.entity_kind IS NOT NULL AND s.direction = 'INCOMING'
                     AND pm.entity_kind IN ('customer', 'retail_customer')
                THEN 'an incoming invoice from a customer has no invoice_type' END,
           CASE WHEN pm.entity_kind IS NOT NULL AND s.direction = 'OUTGOING'
                     AND pm.entity_kind = 'investor'
                THEN 'an outgoing invoice to an investor has no invoice_type' END
         ], NULL),
         resolved_at = now()
    FROM erp.staging_invoices s2
    LEFT JOIN public.accounting_companies c ON c.oib = s2.company_oib
    LEFT JOIN erp.partner_map     pm  ON pm.erp_id = s2.partner_erp_id
    LEFT JOIN erp.cost_center_map ccm ON ccm.cost_center_code = s2.cost_center_code
    LEFT JOIN erp.account_map     am  ON am.account_code = s2.account_code
   WHERE s.id = s2.id
     AND s.import_run_id = p_run_id
     AND s.is_valid;

  RETURN QUERY
    SELECT COUNT(*) FILTER (WHERE resolution_errors = '{}'),
           COUNT(*) FILTER (WHERE resolution_errors <> '{}')
      FROM erp.staging_invoices
     WHERE import_run_id = p_run_id AND is_valid;
END;
$$;

COMMENT ON FUNCTION erp.resolve_invoices(uuid) IS
  'Maps ERP codes onto Cognilion ids and derives invoice_type. Writes nothing to public and is safe to re-run after fixing a mapping.';

-- ===========================================================================
-- 4. Promote invoices
-- ===========================================================================

CREATE OR REPLACE FUNCTION erp.promote_invoices(p_run_id uuid)
RETURNS TABLE (promoted bigint, skipped bigint, held bigint)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_promoted bigint := 0;
  v_skipped  bigint := 0;
  v_held     bigint := 0;
BEGIN
  -- One row per document, folded from its lines.
  CREATE TEMP TABLE _docs ON COMMIT DROP AS
  WITH held AS (
    -- A document is all-or-nothing. Promoting the resolvable lines of a
    -- partially-resolved document would silently drop the rest: the invoice
    -- would carry the ERP's declared total but only some of its base amounts,
    -- and nothing downstream would flag the difference.
    SELECT DISTINCT erp_id
      FROM erp.staging_invoices
     WHERE import_run_id = p_run_id
       AND (NOT is_valid OR resolution_errors <> '{}')
  ),
  lines AS (
    SELECT * FROM erp.staging_invoices
     WHERE import_run_id = p_run_id AND is_valid AND resolution_errors = '{}'
       AND erp_id NOT IN (SELECT erp_id FROM held)
  ),
  folded AS (
    SELECT
      l.erp_id,
      -- uuid has no MIN(), and these must agree across the document anyway —
      -- the check below refuses the document if they do not — so take the
      -- first line's value deterministically.
      (ARRAY_AGG(l.resolved_company_id        ORDER BY l.line_no))[1] AS company_id,
      (ARRAY_AGG(l.resolved_partner_kind      ORDER BY l.line_no))[1] AS partner_kind,
      (ARRAY_AGG(l.resolved_partner_id        ORDER BY l.line_no))[1] AS partner_id,
      (ARRAY_AGG(l.resolved_invoice_type      ORDER BY l.line_no))[1] AS invoice_type,
      (ARRAY_AGG(l.resolved_project_id        ORDER BY l.line_no))[1] AS project_id,
      (ARRAY_AGG(l.resolved_retail_project_id ORDER BY l.line_no))[1] AS retail_project_id,
      MIN(l.invoice_number)             AS invoice_number,
      MIN(l.reference_number)           AS reference_number,
      MIN(l.issue_date)                 AS issue_date,
      MIN(l.due_date)                   AS due_date,
      MIN(l.description)                AS description,
      MIN(l.invoice_total)              AS invoice_total,
      -- Slots are fixed by rate because calculate_invoice_amounts hardcodes
      -- them; see the header. Resolution has already refused any other rate.
      COALESCE(SUM(l.base_amount) FILTER (WHERE l.vat_rate = 25), 0) AS base_1,
      COALESCE(SUM(l.vat_amount)  FILTER (WHERE l.vat_rate = 25), 0) AS vat_1,
      COALESCE(SUM(l.base_amount) FILTER (WHERE l.vat_rate = 13), 0) AS base_2,
      COALESCE(SUM(l.vat_amount)  FILTER (WHERE l.vat_rate = 13), 0) AS vat_2,
      COALESCE(SUM(l.base_amount) FILTER (WHERE l.vat_rate = 0),  0) AS base_3,
      COALESCE(SUM(l.base_amount) FILTER (WHERE l.vat_rate = 5),  0) AS base_4,
      COALESCE(SUM(l.vat_amount)  FILTER (WHERE l.vat_rate = 5),  0) AS vat_4,
      -- Deterministic over the document's lines, so an unchanged re-import
      -- produces the same hash and is skipped before any write.
      MD5(STRING_AGG(
        CONCAT_WS('|', l.line_no, l.account_code, l.cost_center_code,
                  l.base_amount, l.vat_rate, l.vat_amount, l.line_total,
                  l.partner_erp_id, l.invoice_number, l.issue_date, l.due_date,
                  l.document_type, l.description),
        E'\n' ORDER BY l.line_no)) AS content_hash,
      -- Category name for the legacy free-text column: the first mapped one.
      MIN(cat.name) AS category_name
    FROM lines l
    LEFT JOIN public.invoice_categories cat ON cat.id = l.resolved_category_id
    GROUP BY l.erp_id
  )
  SELECT * FROM folded;

  -- Documents whose lines disagree about company, partner or type cannot be
  -- folded into one invoice. Refuse rather than silently taking MIN().
  UPDATE erp.staging_invoices s
     SET resolution_errors = s.resolution_errors ||
         ARRAY['document ' || s.erp_id || ': lines disagree on company, partner or invoice_type']
   WHERE s.import_run_id = p_run_id AND s.is_valid AND s.resolution_errors = '{}'
     AND s.erp_id IN (
       SELECT erp_id FROM erp.staging_invoices
        WHERE import_run_id = p_run_id AND is_valid AND resolution_errors = '{}'
        GROUP BY erp_id
       HAVING COUNT(DISTINCT resolved_company_id) > 1
           OR COUNT(DISTINCT resolved_partner_id) > 1
           OR COUNT(DISTINCT resolved_invoice_type) > 1
     );

  DELETE FROM pg_temp._docs d
   WHERE NOT EXISTS (
     SELECT 1 FROM erp.staging_invoices s
      WHERE s.import_run_id = p_run_id AND s.erp_id = d.erp_id AND s.resolution_errors = '{}');

  -- A document with no derivable invoice_type has no counterparty column to
  -- write, so the entity CHECK would reject it anyway.
  SELECT COUNT(*) INTO v_held FROM pg_temp._docs WHERE invoice_type IS NULL;
  DELETE FROM pg_temp._docs WHERE invoice_type IS NULL;

  WITH upserted AS (
    INSERT INTO public.accounting_invoices (
      source, erp_document_key, erp_content_hash, erp_synced_at,
      invoice_type, invoice_category, category,
      company_id, invoice_number, reference_number, issue_date, due_date,
      description, project_id, retail_project_id,
      supplier_id, retail_supplier_id, office_supplier_id,
      customer_id, retail_customer_id, bank_id, investor_id,
      base_amount_1, vat_rate_1, vat_amount_1,
      base_amount_2, vat_rate_2, vat_amount_2,
      base_amount_3, vat_rate_3, vat_amount_3,
      base_amount_4, vat_rate_4, vat_amount_4,
      total_amount, paid_amount, status
    )
    SELECT
      'erp', d.erp_id, d.content_hash, now(),
      d.invoice_type,
      CASE d.invoice_type
        WHEN 'INCOMING_SUPPLIER' THEN 'SUBCONTRACTOR'
        WHEN 'OUTGOING_SUPPLIER' THEN 'SUBCONTRACTOR'
        WHEN 'INCOMING_OFFICE'   THEN 'OFFICE'
        WHEN 'OUTGOING_OFFICE'   THEN 'OFFICE'
        WHEN 'INCOMING_INVESTMENT' THEN 'BANK_CREDIT'
        WHEN 'OUTGOING_SALES'    THEN 'CUSTOMER'
        ELSE 'BANK' END,
      COALESCE(d.category_name, 'ERP'),
      d.company_id, d.invoice_number, d.reference_number, d.issue_date, d.due_date,
      COALESCE(d.description, ''), d.project_id, d.retail_project_id,
      CASE WHEN d.partner_kind = 'subcontractor'   THEN d.partner_id END,
      CASE WHEN d.partner_kind = 'retail_supplier' THEN d.partner_id END,
      CASE WHEN d.partner_kind = 'office_supplier' THEN d.partner_id END,
      CASE WHEN d.partner_kind = 'customer'        THEN d.partner_id END,
      CASE WHEN d.partner_kind = 'retail_customer' THEN d.partner_id END,
      CASE WHEN d.partner_kind = 'bank'            THEN d.partner_id END,
      CASE WHEN d.partner_kind = 'investor'        THEN d.partner_id END,
      d.base_1, 25, d.vat_1,
      d.base_2, 13, d.vat_2,
      d.base_3, 0,  0,
      d.base_4, 5,  d.vat_4,
      d.invoice_total, 0, 'UNPAID'
    FROM pg_temp._docs d
    ON CONFLICT (erp_document_key) WHERE erp_document_key IS NOT NULL
    DO UPDATE SET
      erp_content_hash = EXCLUDED.erp_content_hash,
      erp_synced_at    = now(),
      invoice_type     = EXCLUDED.invoice_type,
      invoice_category = EXCLUDED.invoice_category,
      category         = EXCLUDED.category,
      company_id       = EXCLUDED.company_id,
      invoice_number   = EXCLUDED.invoice_number,
      reference_number = EXCLUDED.reference_number,
      issue_date       = EXCLUDED.issue_date,
      due_date         = EXCLUDED.due_date,
      description      = EXCLUDED.description,
      -- project comes from the cost centre, but contract/milestone/apartment
      -- are set by hand in Cognilion and must survive a re-import.
      project_id         = EXCLUDED.project_id,
      retail_project_id  = EXCLUDED.retail_project_id,
      supplier_id        = EXCLUDED.supplier_id,
      retail_supplier_id = EXCLUDED.retail_supplier_id,
      office_supplier_id = EXCLUDED.office_supplier_id,
      customer_id        = EXCLUDED.customer_id,
      retail_customer_id = EXCLUDED.retail_customer_id,
      bank_id            = EXCLUDED.bank_id,
      investor_id        = EXCLUDED.investor_id,
      base_amount_1 = EXCLUDED.base_amount_1, vat_amount_1 = EXCLUDED.vat_amount_1,
      base_amount_2 = EXCLUDED.base_amount_2, vat_amount_2 = EXCLUDED.vat_amount_2,
      base_amount_3 = EXCLUDED.base_amount_3, vat_amount_3 = EXCLUDED.vat_amount_3,
      base_amount_4 = EXCLUDED.base_amount_4, vat_amount_4 = EXCLUDED.vat_amount_4,
      total_amount  = EXCLUDED.total_amount,
      updated_at    = now()
    -- The whole point: an unchanged document issues no UPDATE, so none of the
    -- ~20 triggers on this table fire.
    WHERE public.accounting_invoices.erp_content_hash IS DISTINCT FROM EXCLUDED.erp_content_hash
    RETURNING 1
  )
  SELECT COUNT(*) INTO v_promoted FROM upserted;

  SELECT COUNT(*) - v_promoted INTO v_skipped FROM pg_temp._docs;

  UPDATE erp.import_runs
     SET rows_promoted = v_promoted,
         rows_skipped  = v_skipped,
         status        = 'completed',
         finished_at   = now()
   WHERE id = p_run_id;

  RETURN QUERY SELECT v_promoted, v_skipped, v_held;
END;
$$;

COMMENT ON FUNCTION erp.promote_invoices(uuid) IS
  'Folds resolved staging lines into accounting_invoices. Skips documents whose content hash is unchanged, so a repeat import fires no triggers.';

-- ===========================================================================
-- 5. Resolve and promote payments
-- ===========================================================================

CREATE OR REPLACE FUNCTION erp.resolve_payments(p_run_id uuid)
RETURNS TABLE (rows_resolved bigint, rows_unresolved bigint)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  UPDATE erp.staging_payments s
     SET resolved_invoice_id       = inv.id,
         resolved_bank_account_id  = cba.id,
         resolved_cesija_company_id = cc.id,
         resolution_errors = ARRAY_REMOVE(ARRAY[
           CASE WHEN inv.id IS NULL
                THEN 'invoice ' || COALESCE(s.invoice_erp_id, '(none)') || ' has not been imported' END,
           CASE WHEN s.settlement_type = 'BANK' AND cba.id IS NULL
                THEN 'no bank account with IBAN ' || COALESCE(s.company_iban, '(none)') END,
           CASE WHEN s.settlement_type = 'CESIJA' AND cc.id IS NULL
                THEN 'no company with OIB ' || COALESCE(s.cesija_payer_oib, '(none)') || ' to act as cesija payer' END
         ], NULL),
         resolved_at = now()
    FROM erp.staging_payments s2
    LEFT JOIN public.accounting_invoices inv
           ON inv.erp_document_key = s2.invoice_erp_id AND inv.source = 'erp'
    LEFT JOIN public.company_bank_accounts cba ON cba.account_number = s2.company_iban
    LEFT JOIN public.accounting_companies  cc  ON cc.oib = s2.cesija_payer_oib
   WHERE s.id = s2.id
     AND s.import_run_id = p_run_id
     AND s.is_valid;

  RETURN QUERY
    SELECT COUNT(*) FILTER (WHERE resolution_errors = '{}'),
           COUNT(*) FILTER (WHERE resolution_errors <> '{}')
      FROM erp.staging_payments
     WHERE import_run_id = p_run_id AND is_valid;
END;
$$;

CREATE OR REPLACE FUNCTION erp.promote_payments(p_run_id uuid)
RETURNS TABLE (promoted bigint, skipped bigint)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_promoted bigint := 0;
  v_total    bigint := 0;
BEGIN
  WITH allocs AS (
    SELECT s.*,
           MD5(CONCAT_WS('|', s.erp_id, s.allocation_no, s.invoice_erp_id,
                         s.allocated_amount, s.payment_date, s.payment_method,
                         s.settlement_type, s.company_iban, s.reference_number)) AS content_hash
      FROM erp.staging_payments s
     WHERE s.import_run_id = p_run_id AND s.is_valid AND s.resolution_errors = '{}'
  ),
  upserted AS (
    INSERT INTO public.accounting_payments (
      source, erp_document_key, erp_content_hash, erp_synced_at,
      invoice_id, amount, payment_date, payment_method, payment_source_type,
      company_bank_account_id, is_cesija, cesija_company_id,
      reference_number, description
    )
    SELECT
      'erp',
      a.erp_id || '#' || a.allocation_no,
      a.content_hash, now(),
      a.resolved_invoice_id, a.allocated_amount, a.payment_date, a.payment_method,
      CASE a.settlement_type
        WHEN 'BANK'          THEN 'bank_account'
        WHEN 'KOMPENZACIJA'  THEN 'kompenzacija'
        WHEN 'GOTOVINA'      THEN 'gotovina'
        WHEN 'CESIJA'        THEN 'bank_account'
        ELSE 'bank_account' END,
      a.resolved_bank_account_id,
      a.settlement_type = 'CESIJA',
      a.resolved_cesija_company_id,
      a.reference_number, a.description
    FROM allocs a
    ON CONFLICT (erp_document_key) WHERE erp_document_key IS NOT NULL
    DO UPDATE SET
      erp_content_hash        = EXCLUDED.erp_content_hash,
      erp_synced_at           = now(),
      invoice_id              = EXCLUDED.invoice_id,
      amount                  = EXCLUDED.amount,
      payment_date            = EXCLUDED.payment_date,
      payment_method          = EXCLUDED.payment_method,
      payment_source_type     = EXCLUDED.payment_source_type,
      company_bank_account_id = EXCLUDED.company_bank_account_id,
      is_cesija               = EXCLUDED.is_cesija,
      cesija_company_id       = EXCLUDED.cesija_company_id,
      reference_number        = EXCLUDED.reference_number,
      description             = EXCLUDED.description,
      updated_at              = now()
    WHERE public.accounting_payments.erp_content_hash IS DISTINCT FROM EXCLUDED.erp_content_hash
    RETURNING 1
  )
  SELECT COUNT(*) INTO v_promoted FROM upserted;

  SELECT COUNT(*) INTO v_total
    FROM erp.staging_payments
   WHERE import_run_id = p_run_id AND is_valid AND resolution_errors = '{}';

  UPDATE erp.import_runs
     SET rows_promoted = v_promoted,
         rows_skipped  = v_total - v_promoted,
         status        = 'completed',
         finished_at   = now()
   WHERE id = p_run_id;

  RETURN QUERY SELECT v_promoted, v_total - v_promoted;
END;
$$;

-- ===========================================================================
-- 6. Review queue
-- ===========================================================================
-- Everything that imported cleanly but could not be classified. One row per
-- document rather than per line: a person fixes a mapping, not a row.

CREATE OR REPLACE VIEW public.erp_review_queue WITH (security_invoker = true) AS
  SELECT
    s.import_run_id,
    'invoices'::text                       AS feed,
    s.erp_id                               AS document_ref,
    MIN(s.invoice_number)                  AS invoice_number,
    MIN(s.partner_name)                    AS partner_name,
    MIN(s.issue_date)                      AS issue_date,
    MIN(s.invoice_total)                   AS total_amount,
    MIN(s.partner_erp_id)                  AS partner_erp_id,
    MIN(s.cost_center_code)                AS cost_center_code,
    MIN(s.account_code)                    AS account_code,
    -- Unnest before aggregating: ARRAY_AGG over a mix of populated and empty
    -- arrays raises "cannot accumulate empty arrays", and most lines of a held
    -- document have none.
    (SELECT ARRAY_AGG(DISTINCT e)
       FROM erp.staging_invoices s2, UNNEST(s2.resolution_errors) AS e
      WHERE s2.import_run_id = s.import_run_id AND s2.erp_id = s.erp_id) AS problems,
    COUNT(*)                               AS line_count
  FROM erp.staging_invoices s
 WHERE s.is_valid
   AND s.erp_id IN (
     SELECT erp_id FROM erp.staging_invoices
      WHERE import_run_id = s.import_run_id AND resolution_errors <> '{}')
 GROUP BY s.import_run_id, s.erp_id;

COMMENT ON VIEW public.erp_review_queue IS
  'Documents that imported cleanly but could not be classified. Grouped per document because the fix is a mapping, not a row edit.';

GRANT SELECT ON public.erp_review_queue TO authenticated;
GRANT EXECUTE ON FUNCTION erp.resolve_invoices(uuid), erp.promote_invoices(uuid),
                          erp.resolve_payments(uuid), erp.promote_payments(uuid)
  TO service_role;
