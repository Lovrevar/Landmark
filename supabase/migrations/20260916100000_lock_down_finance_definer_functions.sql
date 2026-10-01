-- Closes direct access to finance data through SECURITY DEFINER functions.
--
-- THE LEAK
--
-- RLS on accounting_invoices grants a full SELECT only to Director and Accounting; Retail sees
-- retail invoices and Supervision sees invoices for projects it manages. But
-- get_filtered_invoices is SECURITY DEFINER — it runs as its owner and reads past RLS — and had
-- no role check of its own. Any authenticated user (a Sales user, say) could call it over
-- PostgREST and page through every invoice with supplier, customer, amounts and IBAN.
--
-- The app itself was never the hole: the only caller is the Cashflow invoice list, behind
-- CashflowRoute (Director/Accounting). The hole was the endpoint.
--
-- 1. ROLE CHECK IN get_filtered_invoices
--
-- The same guard get_invoice_statistics received in 20260526084701, raised before any row is
-- read. The function stays SECURITY DEFINER for the reason given there: switching to INVOKER
-- would mean re-auditing every join in the body against each role's RLS. Signature and body are
-- otherwise identical to 20260915120000_invoice_list_server_sort.sql, so CREATE OR REPLACE is
-- enough and existing grants are kept.
--
-- Caveat: auth.uid() is NULL for the service role, so a service-role caller (an edge function,
-- a script) is now rejected too. There are none today; one added later must query the table
-- directly or pass through a role-aware wrapper.
--
-- 2. EXECUTE REVOKED ON INTERNAL-ONLY FINANCE FUNCTIONS
--
-- These are SECURITY DEFINER, read or write finance tables, and were callable by every
-- authenticated user through PostgREST. Nothing in src/, supabase/functions/, scripts/ or e2e/
-- calls any of them (checked 2026-09-16):
--
--   get_apartment_payments(uuid)                read  accounting_payments, no role check
--   check_subcontractor_budget_integrity()      read  contracts vs payments, no role check
--   fix_subcontractor_budget_integrity()        write every contract's budget_realized
--   recalculate_bank_credit_fields(uuid)        write one bank credit's derived fields
--   recalculate_contract_budget_realized(uuid)  write one contract's budget_realized
--
-- The two recalculate_* functions are still needed, but only by other SECURITY DEFINER functions
-- (sync_bank_credit_on_invoice_change, sync_bank_credit_on_payment_change,
-- update_contract_budget_realized, sync_contract_budget_realized_from_invoice and
-- fix_subcontractor_budget_integrity). A SECURITY DEFINER function calls its callees as its
-- owner, so the triggers keep working with EXECUTE revoked from the calling roles.
--
-- Revoking from `public`, `anon` and `authenticated` leaves the owner (postgres, which is what the
-- SQL editor runs as) and `service_role` able to call them — so the integrity check and repair
-- remain available for maintenance. Precedent: dispatch_due_reminders in
-- 20260813092000_deadline_reminders.sql.

-- ------------------------------------------------------------ 1. get_filtered_invoices role check

CREATE OR REPLACE FUNCTION public.get_filtered_invoices(
  p_invoice_type text    DEFAULT 'ALL'::text,
  p_status       text    DEFAULT 'ALL'::text,
  p_company_id   uuid    DEFAULT NULL::uuid,
  p_search_term  text    DEFAULT NULL::text,
  p_offset       integer DEFAULT 0,
  p_limit        integer DEFAULT 100,
  p_sort_field   text    DEFAULT NULL::text,
  p_sort_dir     text    DEFAULT 'asc'::text
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
  -- Only Director and Accounting may list invoices. RLS on accounting_invoices already says so
  -- (Retail and Supervision get scoped rows only), but SECURITY DEFINER bypasses RLS, so the
  -- function has to say it too.
  IF NOT EXISTS (
    SELECT 1 FROM public.users
    WHERE auth_user_id = auth.uid()
      AND role IN ('Director', 'Accounting')
  ) THEN
    RAISE EXCEPTION 'insufficient_privilege: get_filtered_invoices requires Director or Accounting role';
  END IF;

  RETURN QUERY
  SELECT fi.*
  FROM (
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
  ) AS fi
  ORDER BY
    CASE WHEN p_sort_field = 'due_date' AND p_sort_dir = 'asc'
         THEN fi.due_date END ASC NULLS LAST,
    CASE WHEN p_sort_field = 'due_date' AND p_sort_dir = 'desc'
         THEN fi.due_date END DESC NULLS LAST,
    (CASE WHEN p_sort_field = 'invoice_number' AND p_sort_dir = 'asc'
          THEN fi.invoice_number END) COLLATE public.natural_numeric ASC NULLS LAST,
    (CASE WHEN p_sort_field = 'invoice_number' AND p_sort_dir = 'desc'
          THEN fi.invoice_number END) COLLATE public.natural_numeric DESC NULLS LAST,
    fi.issue_date DESC,
    fi.id
  OFFSET p_offset
  LIMIT  p_limit;
END;
$$;

-- --------------------------------------------------- 2. internal-only finance functions

REVOKE EXECUTE ON FUNCTION public.get_apartment_payments(uuid)                FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.check_subcontractor_budget_integrity()      FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.fix_subcontractor_budget_integrity()        FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.recalculate_bank_credit_fields(uuid)        FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.recalculate_contract_budget_realized(uuid)  FROM public, anon, authenticated;

-- Supabase normally grants service_role explicitly through default privileges, but the baseline
-- dump carries no grants, so a project whose access came only through PUBLIC would lose it above.
-- Restated so maintenance through the service role cannot silently break.
GRANT EXECUTE ON FUNCTION public.get_apartment_payments(uuid)                TO service_role;
GRANT EXECUTE ON FUNCTION public.check_subcontractor_budget_integrity()      TO service_role;
GRANT EXECUTE ON FUNCTION public.fix_subcontractor_budget_integrity()        TO service_role;
GRANT EXECUTE ON FUNCTION public.recalculate_bank_credit_fields(uuid)        TO service_role;
GRANT EXECUTE ON FUNCTION public.recalculate_contract_budget_realized(uuid)  TO service_role;
