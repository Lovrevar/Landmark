-- =============================================================================
-- C1 — Defense-in-depth role check inside get_invoice_statistics
-- =============================================================================
-- This RPC is SECURITY DEFINER (runs as the function owner, bypassing RLS).
-- The AI chatbot's `get_invoice_summary` tool calls it. selectAvailableTools()
-- on the edge function already filters this tool to FINANCE_ROLES (Director,
-- Accounting), but the RPC itself had no role enforcement — meaning any caller
-- with the RPC URL (any auth path, not just the AI) could read invoice stats.
--
-- Adding an explicit role check at the top of the function body. Keeps
-- SECURITY DEFINER (switching to INVOKER would require auditing every JOIN in
-- the body, since SELECTs assume superuser access to all the joined tables).
-- =============================================================================

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
  -- Defense-in-depth: even if a non-finance caller reaches this RPC by some
  -- path (direct REST call, future tool wiring, etc.), reject early.
  IF NOT EXISTS (
    SELECT 1 FROM public.users
    WHERE auth_user_id = auth.uid()
      AND role IN ('Director', 'Accounting')
  ) THEN
    RAISE EXCEPTION 'insufficient_privilege: get_invoice_statistics requires Director or Accounting role';
  END IF;

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
