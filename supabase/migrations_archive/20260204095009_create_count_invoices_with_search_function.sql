/*
  # Create function to count invoices with proper search

  1. New Functions
    - `count_invoices_with_search` - Counts invoices with filters including search across supplier/customer names

  2. Purpose
    - Properly count invoices when filtering and searching
    - Handles search across multiple supplier/customer tables
    - Matches the display logic for accurate pagination
*/

CREATE OR REPLACE FUNCTION count_invoices_with_search(
  p_invoice_type text DEFAULT 'ALL',
  p_status text DEFAULT 'ALL',
  p_company_id uuid DEFAULT NULL,
  p_search_term text DEFAULT NULL
)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count bigint;
BEGIN
  SELECT COUNT(DISTINCT ai.id)
  INTO v_count
  FROM accounting_invoices ai
  LEFT JOIN retail_suppliers rs ON ai.retail_supplier_id = rs.id
  LEFT JOIN office_suppliers os ON ai.office_supplier_id = os.id
  LEFT JOIN contracts co ON ai.contract_id = co.id
  LEFT JOIN subcontractors s ON co.subcontractor_id = s.id
  LEFT JOIN customers c ON ai.customer_id = c.id
  LEFT JOIN retail_customers rc ON ai.retail_customer_id = rc.id
  LEFT JOIN investors inv ON ai.investor_id = inv.id
  LEFT JOIN banks b ON ai.bank_id = b.id
  WHERE
    (p_invoice_type = 'ALL' OR ai.invoice_type = p_invoice_type)
    AND (
      p_status = 'ALL'
      OR (p_status = 'UNPAID' AND ai.status = 'UNPAID')
      OR (p_status = 'PAID' AND ai.status = 'PAID')
      OR (p_status = 'PARTIALLY_PAID' AND ai.status = 'PARTIALLY_PAID')
      OR (p_status = 'UNPAID_AND_PARTIAL' AND ai.status IN ('UNPAID', 'PARTIALLY_PAID'))
    )
    AND (p_company_id IS NULL OR ai.company_id = p_company_id)
    AND (
      p_search_term IS NULL
      OR ai.invoice_number ILIKE '%' || p_search_term || '%'
      OR ai.category ILIKE '%' || p_search_term || '%'
      OR ai.description ILIKE '%' || p_search_term || '%'
      OR rs.name ILIKE '%' || p_search_term || '%'
      OR os.name ILIKE '%' || p_search_term || '%'
      OR s.name ILIKE '%' || p_search_term || '%'
      OR c.name ILIKE '%' || p_search_term || '%'
      OR c.surname ILIKE '%' || p_search_term || '%'
      OR rc.name ILIKE '%' || p_search_term || '%'
      OR inv.name ILIKE '%' || p_search_term || '%'
      OR b.name ILIKE '%' || p_search_term || '%'
    );

  RETURN v_count;
END;
$$;