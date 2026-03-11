/*
  # Create Invoice Statistics Function

  1. Purpose
    - Returns invoice statistics in a single efficient query
    - Replaces 3 separate queries with one optimized call
    
  2. Returns
    - `filtered_count`: Number of filtered invoices
    - `filtered_unpaid_sum`: Sum of unpaid amounts from filtered invoices
    - `total_unpaid_sum`: Total unpaid amount across all invoices
    
  3. Parameters
    - `p_invoice_type`: Invoice type filter (ALL or specific type)
    - `p_status`: Status filter (ALL, UNPAID, PAID, PARTIALLY_PAID, UNPAID_AND_PARTIAL)
    - `p_company_id`: Company ID filter (NULL for all companies)
    - `p_search_term`: Search term for filtering invoices
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
BEGIN
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
    )
    SELECT
        t.filtered_count,
        t.filtered_unpaid_sum,
        a.total_unpaid_sum
    FROM totals t
    CROSS JOIN all_unpaid a;
END;
$$;