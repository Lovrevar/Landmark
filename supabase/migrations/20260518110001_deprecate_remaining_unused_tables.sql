-- Phase 2 of the deprecated-table cleanup.
--
-- The companion migration (20260518110000_move_unused_tables_to_deprecated_schema.sql)
-- moved 5 tables that had no DB-side dependencies. This one handles the 3
-- remaining tables (`investors`, `project_investments`, `funding_payments`)
-- by first severing the PL/pgSQL references that still touch them:
--
--   1. Rewrite the two LIVE invoice RPCs (`get_filtered_invoices`,
--      `get_invoice_statistics`) to drop the `investors` LEFT JOIN.
--   2. Drop the dead RPC wrappers that reference any of the three tables.
--   3. Drop the dormant triggers + trigger functions on
--      project_investments / funding_payments.
--   4. Move the three tables to the `deprecated` schema.
--
-- Pre-flight assumption: the `deprecated` schema already exists from the
-- companion migration. CREATE SCHEMA IF NOT EXISTS makes this idempotent if
-- this migration is ever applied alone.

CREATE SCHEMA IF NOT EXISTS deprecated;
REVOKE ALL ON SCHEMA deprecated FROM anon, authenticated;
GRANT  USAGE ON SCHEMA deprecated TO postgres, service_role;

-- ---------------------------------------------------------------------------
-- 1. Rewrite live RPCs to remove the `investors` join.
--
-- Signature is unchanged so the existing TypeScript types and client callers
-- keep working. `investor_id` is still returned from the base table column;
-- `investor_name` is hard-coded to NULL because the lookup table is going
-- away and no row currently relies on it for display.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.get_filtered_invoices(
  p_invoice_type text    DEFAULT 'ALL'::text,
  p_status       text    DEFAULT 'ALL'::text,
  p_company_id   uuid    DEFAULT NULL::uuid,
  p_search_term  text    DEFAULT NULL::text,
  p_offset       integer DEFAULT 0,
  p_limit        integer DEFAULT 100
) RETURNS TABLE(
  id uuid, invoice_type text, invoice_number text,
  company_id uuid, company_name text,
  supplier_id uuid, supplier_name text,
  customer_id uuid, customer_name text, customer_surname text,
  investor_id uuid, investor_name text,
  bank_id uuid, bank_name text,
  project_id uuid, project_name text,
  contract_id uuid, contract_number text, contract_job_description text,
  office_supplier_id uuid, office_supplier_name text,
  retail_supplier_id uuid, retail_supplier_name text,
  retail_customer_id uuid, retail_customer_name text,
  retail_project_id uuid, retail_project_name text,
  retail_contract_id uuid, retail_contract_number text,
  invoice_category text, category text, description text,
  issue_date date, due_date date,
  base_amount numeric, base_amount_1 numeric, base_amount_2 numeric,
  base_amount_3 numeric, base_amount_4 numeric,
  vat_rate numeric, vat_rate_1 numeric, vat_rate_2 numeric,
  vat_rate_3 numeric, vat_rate_4 numeric,
  vat_amount numeric, vat_amount_1 numeric, vat_amount_2 numeric,
  vat_amount_3 numeric, vat_amount_4 numeric,
  total_amount numeric, paid_amount numeric, remaining_amount numeric,
  status text, company_bank_account_id uuid, bank_credit_id uuid,
  retail_milestone_id uuid, approved boolean, reference_number text, iban text,
  apartment_id uuid, milestone_id uuid, refund_id bigint, refund_name text,
  created_at timestamp with time zone, updated_at timestamp with time zone
)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT DISTINCT ON (ai.issue_date, ai.id)
    ai.id,
    ai.invoice_type,
    ai.invoice_number,
    ai.company_id,
    ac.name AS company_name,
    ai.supplier_id,
    sub.name AS supplier_name,
    ai.customer_id,
    c.name    AS customer_name,
    c.surname AS customer_surname,
    ai.investor_id,
    NULL::text AS investor_name,  -- investors table moved to `deprecated`
    ai.bank_id,
    bk.name AS bank_name,
    ai.project_id,
    p.name  AS project_name,
    ai.contract_id,
    co.contract_number,
    co.job_description AS contract_job_description,
    ai.office_supplier_id,
    os.name AS office_supplier_name,
    ai.retail_supplier_id,
    rs.name AS retail_supplier_name,
    ai.retail_customer_id,
    rc.name AS retail_customer_name,
    ai.retail_project_id,
    rp.name AS retail_project_name,
    ai.retail_contract_id,
    rco.contract_number AS retail_contract_number,
    ai.invoice_category,
    ai.category,
    ai.description,
    ai.issue_date,
    ai.due_date,
    ai.base_amount, ai.base_amount_1, ai.base_amount_2, ai.base_amount_3, ai.base_amount_4,
    ai.vat_rate,    ai.vat_rate_1,    ai.vat_rate_2,    ai.vat_rate_3,    ai.vat_rate_4,
    ai.vat_amount,  ai.vat_amount_1,  ai.vat_amount_2,  ai.vat_amount_3,  ai.vat_amount_4,
    ai.total_amount, ai.paid_amount, ai.remaining_amount,
    ai.status,
    ai.company_bank_account_id,
    ai.bank_credit_id,
    ai.retail_milestone_id,
    ai.approved,
    ai.reference_number,
    ai.iban,
    ai.apartment_id,
    ai.milestone_id,
    ai.refund_id,
    ref.name AS refund_name,
    ai.created_at,
    ai.updated_at
  FROM accounting_invoices ai
  LEFT JOIN accounting_companies      ac  ON ai.company_id          = ac.id
  LEFT JOIN subcontractors            sub ON ai.supplier_id         = sub.id
  LEFT JOIN customers                 c   ON ai.customer_id         = c.id
  LEFT JOIN banks                     bk  ON ai.bank_id             = bk.id
  LEFT JOIN projects                  p   ON ai.project_id          = p.id
  LEFT JOIN contracts                 co  ON ai.contract_id         = co.id
  LEFT JOIN office_suppliers          os  ON ai.office_supplier_id  = os.id
  LEFT JOIN retail_suppliers          rs  ON ai.retail_supplier_id  = rs.id
  LEFT JOIN retail_customers          rc  ON ai.retail_customer_id  = rc.id
  LEFT JOIN retail_projects           rp  ON ai.retail_project_id   = rp.id
  LEFT JOIN retail_contracts          rco ON ai.retail_contract_id  = rco.id
  LEFT JOIN accounting_invoices_refund ref ON ai.refund_id          = ref.id
  WHERE
    (
      p_invoice_type = 'ALL'
      OR ai.invoice_type = p_invoice_type
      OR (p_invoice_type IN ('INCOMING', 'OUTGOING') AND ai.invoice_type LIKE p_invoice_type || '_%')
    )
    AND (
      p_status = 'ALL'
      OR (p_status = 'UNPAID'             AND ai.status = 'UNPAID')
      OR (p_status = 'PAID'               AND ai.status = 'PAID')
      OR (p_status = 'PARTIALLY_PAID'     AND ai.status = 'PARTIALLY_PAID')
      OR (p_status = 'UNPAID_AND_PARTIAL' AND ai.status IN ('UNPAID', 'PARTIALLY_PAID'))
    )
    AND (p_company_id IS NULL OR ai.company_id = p_company_id)
    AND (
      p_search_term IS NULL
      OR ai.invoice_number ILIKE '%' || p_search_term || '%'
      OR ai.category       ILIKE '%' || p_search_term || '%'
      OR ai.description    ILIKE '%' || p_search_term || '%'
      OR rs.name           ILIKE '%' || p_search_term || '%'
      OR os.name           ILIKE '%' || p_search_term || '%'
      OR sub.name          ILIKE '%' || p_search_term || '%'
      OR c.name            ILIKE '%' || p_search_term || '%'
      OR c.surname         ILIKE '%' || p_search_term || '%'
      OR rc.name           ILIKE '%' || p_search_term || '%'
      OR bk.name           ILIKE '%' || p_search_term || '%'
      OR ac.name           ILIKE '%' || p_search_term || '%'
      OR ref.name          ILIKE '%' || p_search_term || '%'
      OR rp.name           ILIKE '%' || p_search_term || '%'
    )
  ORDER BY ai.issue_date DESC, ai.id
  OFFSET p_offset
  LIMIT  p_limit;
END;
$$;


CREATE OR REPLACE FUNCTION public.get_invoice_statistics(
  p_invoice_type text DEFAULT 'ALL'::text,
  p_status       text DEFAULT 'ALL'::text,
  p_company_id   uuid DEFAULT NULL::uuid,
  p_search_term  text DEFAULT NULL::text
) RETURNS TABLE(
  filtered_count      bigint,
  filtered_unpaid_sum numeric,
  total_unpaid_sum    numeric
)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  WITH filtered AS (
    SELECT ai.*
    FROM accounting_invoices ai
    LEFT JOIN contracts            co ON co.id = ai.contract_id
    LEFT JOIN subcontractors       sc ON sc.id = co.subcontractor_id
    LEFT JOIN customers            cu ON cu.id = ai.customer_id
    LEFT JOIN office_suppliers     os ON os.id = ai.office_supplier_id
    LEFT JOIN retail_suppliers     rs ON rs.id = ai.retail_supplier_id
    LEFT JOIN retail_customers     rc ON rc.id = ai.retail_customer_id
    LEFT JOIN banks                b  ON b.id  = ai.bank_id
    LEFT JOIN accounting_companies c  ON c.id  = ai.company_id
    WHERE
      (
        p_invoice_type = 'ALL'
        OR ai.invoice_type = p_invoice_type
        OR (p_invoice_type IN ('INCOMING', 'OUTGOING') AND ai.invoice_type LIKE p_invoice_type || '_%')
      )
      AND (
        p_status = 'ALL'
        OR (p_status = 'UNPAID'             AND ai.status = 'UNPAID')
        OR (p_status = 'PAID'               AND ai.status = 'PAID')
        OR (p_status = 'PARTIALLY_PAID'     AND ai.status = 'PARTIALLY_PAID')
        OR (p_status = 'UNPAID_AND_PARTIAL' AND ai.status IN ('UNPAID', 'PARTIALLY_PAID'))
      )
      AND (p_company_id IS NULL OR ai.company_id = p_company_id)
      AND (
        p_search_term IS NULL
        OR p_search_term = ''
        OR (
             LOWER(ai.invoice_number)            LIKE '%' || LOWER(p_search_term) || '%'
          OR LOWER(ai.category)                  LIKE '%' || LOWER(p_search_term) || '%'
          OR LOWER(ai.description)               LIKE '%' || LOWER(p_search_term) || '%'
          OR LOWER(sc.name)                      LIKE '%' || LOWER(p_search_term) || '%'
          OR LOWER(cu.name || ' ' || cu.surname) LIKE '%' || LOWER(p_search_term) || '%'
          OR LOWER(os.name)                      LIKE '%' || LOWER(p_search_term) || '%'
          OR LOWER(rs.name)                      LIKE '%' || LOWER(p_search_term) || '%'
          OR LOWER(rc.name)                      LIKE '%' || LOWER(p_search_term) || '%'
          OR LOWER(b.name)                       LIKE '%' || LOWER(p_search_term) || '%'
          OR LOWER(c.name)                       LIKE '%' || LOWER(p_search_term) || '%'
        )
      )
  ),
  totals AS (
    SELECT
      COUNT(*) AS filtered_count,
      COALESCE(
        SUM(remaining_amount) FILTER (WHERE status IN ('UNPAID', 'PARTIALLY_PAID')),
        0
      ) AS filtered_unpaid_sum
    FROM filtered
  ),
  all_unpaid AS (
    SELECT
      COALESCE(SUM(remaining_amount), 0) AS total_unpaid_sum
    FROM accounting_invoices
    WHERE status IN ('UNPAID', 'PARTIALLY_PAID')
      AND (
        p_invoice_type = 'ALL'
        OR (p_invoice_type = 'INCOMING' AND invoice_type LIKE 'INCOMING_%')
        OR (p_invoice_type = 'OUTGOING' AND invoice_type LIKE 'OUTGOING_%')
        OR (p_invoice_type NOT IN ('ALL', 'INCOMING', 'OUTGOING')
            AND invoice_type LIKE split_part(p_invoice_type, '_', 1) || '_%')
      )
  )
  SELECT t.filtered_count,
         t.filtered_unpaid_sum,
         a.total_unpaid_sum
  FROM totals t
  CROSS JOIN all_unpaid a;
END;
$$;

-- ---------------------------------------------------------------------------
-- 2. Drop dormant triggers FIRST so the trigger functions can be dropped
--    cleanly. Triggers move with their table on SET SCHEMA, but they'd then
--    reference a dropped function — better to remove them entirely.
-- ---------------------------------------------------------------------------

DROP TRIGGER IF EXISTS trigger_generate_payment_schedule_trigger ON public.project_investments;
DROP TRIGGER IF EXISTS trigger_update_payment_schedule_trigger   ON public.project_investments;
DROP TRIGGER IF EXISTS update_bank_balance_for_investment_trigger ON public.project_investments;
DROP TRIGGER IF EXISTS trigger_mark_notification_completed_trigger ON public.funding_payments;

-- ---------------------------------------------------------------------------
-- 3. Drop the trigger functions and dead RPCs.
--    `generate_payment_schedule` must be dropped AFTER its trigger wrappers,
--    since they PERFORM it inside their bodies.
-- ---------------------------------------------------------------------------

DROP FUNCTION IF EXISTS public.trigger_generate_payment_schedule();
DROP FUNCTION IF EXISTS public.trigger_update_payment_schedule();
DROP FUNCTION IF EXISTS public.update_bank_balance_for_investment();
DROP FUNCTION IF EXISTS public.trigger_mark_notification_completed();

DROP FUNCTION IF EXISTS public.generate_payment_schedule(uuid);
DROP FUNCTION IF EXISTS public.get_bank_credit_payments(uuid);
DROP FUNCTION IF EXISTS public.get_investor_payments(uuid);
DROP FUNCTION IF EXISTS public.count_invoices_with_search(text, text, uuid, text);

-- ---------------------------------------------------------------------------
-- 4. Move the three remaining tables.
--    Cross-schema FKs from active tables (e.g. accounting_invoices.investor_id
--    -> deprecated.investors) remain valid; PostgREST simply stops exposing
--    the moved tables since `deprecated` is not in db.schemas.
-- ---------------------------------------------------------------------------

ALTER TABLE IF EXISTS public.investors           SET SCHEMA deprecated;
ALTER TABLE IF EXISTS public.project_investments SET SCHEMA deprecated;
ALTER TABLE IF EXISTS public.funding_payments    SET SCHEMA deprecated;

REVOKE ALL ON TABLE
  deprecated.investors,
  deprecated.project_investments,
  deprecated.funding_payments
FROM anon, authenticated;
