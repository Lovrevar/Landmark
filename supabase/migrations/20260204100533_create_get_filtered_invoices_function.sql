/*
  # Create function to get filtered invoices with search

  1. New Functions
    - `get_filtered_invoices` - Returns filtered invoices with all joins for pagination

  2. Purpose
    - Properly filter invoices when searching across supplier/customer names
    - Handles search across multiple supplier/customer tables
    - Returns paginated results with all necessary joins
*/

CREATE OR REPLACE FUNCTION get_filtered_invoices(
  p_invoice_type text DEFAULT 'ALL',
  p_status text DEFAULT 'ALL',
  p_company_id uuid DEFAULT NULL,
  p_search_term text DEFAULT NULL,
  p_offset integer DEFAULT 0,
  p_limit integer DEFAULT 100
)
RETURNS TABLE (
  id uuid,
  invoice_type text,
  invoice_number text,
  company_id uuid,
  supplier_id uuid,
  customer_id uuid,
  investor_id uuid,
  bank_id uuid,
  project_id uuid,
  contract_id uuid,
  office_supplier_id uuid,
  retail_supplier_id uuid,
  retail_customer_id uuid,
  invoice_category text,
  category text,
  description text,
  issue_date date,
  due_date date,
  base_amount numeric,
  vat_rate numeric,
  vat_amount numeric,
  total_amount numeric,
  paid_amount numeric,
  remaining_amount numeric,
  status text,
  payment_method text,
  bank_account_id uuid,
  credit_id uuid,
  retail_phase_id uuid,
  retail_milestone_id uuid,
  approved boolean,
  reference_number text,
  bank_iban text,
  created_at timestamptz,
  updated_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT DISTINCT
    ai.id,
    ai.invoice_type,
    ai.invoice_number,
    ai.company_id,
    ai.supplier_id,
    ai.customer_id,
    ai.investor_id,
    ai.bank_id,
    ai.project_id,
    ai.contract_id,
    ai.office_supplier_id,
    ai.retail_supplier_id,
    ai.retail_customer_id,
    ai.invoice_category,
    ai.category,
    ai.description,
    ai.issue_date,
    ai.due_date,
    ai.base_amount,
    ai.vat_rate,
    ai.vat_amount,
    ai.total_amount,
    ai.paid_amount,
    ai.remaining_amount,
    ai.status,
    ai.payment_method,
    ai.bank_account_id,
    ai.credit_id,
    ai.retail_phase_id,
    ai.retail_milestone_id,
    ai.approved,
    ai.reference_number,
    ai.bank_iban,
    ai.created_at,
    ai.updated_at
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
    )
  ORDER BY ai.issue_date DESC
  OFFSET p_offset
  LIMIT p_limit;
END;
$$;