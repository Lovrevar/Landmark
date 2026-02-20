/*
  # Fix get_invoice_statistics to scope total_unpaid_sum by direction

  ## Problem
  The `total_unpaid_sum` was summing ALL unpaid/partially-paid invoices regardless
  of whether Ulazni (INCOMING) or Izlazni (OUTGOING) was selected.

  ## Fix
  Filter `total_unpaid_sum` (and rename logic) to only include invoices whose
  invoice_type matches the direction prefix derived from `p_invoice_type`.

  - If p_invoice_type starts with 'INCOMING' or equals 'INCOMING', only include INCOMING* invoices
  - If p_invoice_type starts with 'OUTGOING' or equals 'OUTGOING', only include OUTGOING* invoices
  - If p_invoice_type = 'ALL', keep original behaviour (all unpaid)
*/

CREATE OR REPLACE FUNCTION get_invoice_statistics(
    p_invoice_type TEXT DEFAULT 'ALL',
    p_status TEXT DEFAULT 'ALL',
    p_company_id UUID DEFAULT NULL,
    p_search_term TEXT DEFAULT NULL
)
RETURNS TABLE (
    filtered_count BIGINT,
    filtered_unpaid_sum NUMERIC,
    total_unpaid_sum NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_direction_prefix TEXT;
BEGIN
    -- Derive direction prefix from p_invoice_type
    IF p_invoice_type LIKE 'INCOMING%' THEN
        v_direction_prefix := 'INCOMING';
    ELSIF p_invoice_type LIKE 'OUTGOING%' THEN
        v_direction_prefix := 'OUTGOING';
    ELSE
        v_direction_prefix := 'ALL';
    END IF;

    RETURN QUERY
    WITH filtered AS (
        SELECT ai.*
        FROM accounting_invoices ai
        LEFT JOIN contracts c ON c.id = ai.contract_id 
        LEFT JOIN subcontractors sc ON c.subcontractor_id = sc.id
        LEFT JOIN customers cu ON cu.id = ai.customer_id
        LEFT JOIN office_suppliers os ON os.id = ai.office_supplier_id
        LEFT JOIN retail_suppliers rs ON rs.id = ai.retail_supplier_id
        LEFT JOIN retail_customers rc ON rc.id = ai.retail_customer_id
        LEFT JOIN investors i ON i.id = ai.investor_id
        LEFT JOIN banks b ON b.id = ai.bank_id
        LEFT JOIN accounting_companies co ON co.id = ai.company_id
        WHERE
            (p_invoice_type = 'ALL' OR ai.invoice_type = p_invoice_type)

            AND (
                p_status = 'ALL'
                OR (p_status = 'UNPAID' AND ai.status = 'UNPAID')
                OR (p_status = 'PAID' AND ai.status = 'PAID')
                OR (p_status = 'PARTIALLY_PAID' AND ai.status = 'PARTIALLY_PAID')
                OR (
                    p_status = 'UNPAID_AND_PARTIAL'
                    AND ai.status IN ('UNPAID', 'PARTIALLY_PAID')
                )
            )

            AND (p_company_id IS NULL OR ai.company_id = p_company_id)

            AND (
                p_search_term IS NULL
                OR p_search_term = ''
                OR (
                    LOWER(ai.invoice_number) LIKE '%' || LOWER(p_search_term) || '%'
                    OR LOWER(ai.category) LIKE '%' || LOWER(p_search_term) || '%'
                    OR LOWER(ai.description) LIKE '%' || LOWER(p_search_term) || '%'
                    OR LOWER(sc.name) LIKE '%' || LOWER(p_search_term) || '%'
                    OR LOWER(cu.name || ' ' || cu.surname) LIKE '%' || LOWER(p_search_term) || '%'
                    OR LOWER(os.name) LIKE '%' || LOWER(p_search_term) || '%'
                    OR LOWER(rs.name) LIKE '%' || LOWER(p_search_term) || '%'
                    OR LOWER(rc.name) LIKE '%' || LOWER(p_search_term) || '%'
                    OR LOWER(i.name) LIKE '%' || LOWER(p_search_term) || '%'
                    OR LOWER(b.name) LIKE '%' || LOWER(p_search_term) || '%'
                    OR LOWER(co.name) LIKE '%' || LOWER(p_search_term) || '%'
                )
            )
    ),
    totals AS (
        SELECT
            COUNT(*) AS filtered_count,
            COALESCE(
                SUM(remaining_amount)
                FILTER (WHERE status IN ('UNPAID', 'PARTIALLY_PAID')),
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
            v_direction_prefix = 'ALL'
            OR invoice_type LIKE v_direction_prefix || '%'
          )
    )
    SELECT
        t.filtered_count,
        t.filtered_unpaid_sum,
        a.total_unpaid_sum
    FROM totals t
    CROSS JOIN all_unpaid a;
END;
$$;
