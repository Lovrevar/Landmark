/*
  # Enhance get_filtered_invoices to return entity names

  1. Changes
    - Modifies `get_filtered_invoices` function to include entity names
    - Returns company_name, supplier_name, customer_name, investor_name, bank_name
    - Enables proper server-side filtering with pagination

  2. Purpose
    - Fix pagination issue where search was applied client-side after pagination
    - Count function already does server-side search, now data fetch does too
*/

DROP FUNCTION IF EXISTS get_filtered_invoices(text, text, uuid, text, integer, integer);

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
  company_name text,
  supplier_id uuid,
  supplier_name text,
  customer_id uuid,
  customer_name text,
  customer_surname text,
  investor_id uuid,
  investor_name text,
  bank_id uuid,
  bank_name text,
  project_id uuid,
  project_name text,
  contract_id uuid,
  contract_number text,
  contract_job_description text,
  office_supplier_id uuid,
  office_supplier_name text,
  retail_supplier_id uuid,
  retail_supplier_name text,
  retail_customer_id uuid,
  retail_customer_name text,
  invoice_category text,
  category text,
  description text,
  issue_date date,
  due_date date,
  base_amount numeric,
  base_amount_1 numeric,
  base_amount_2 numeric,
  base_amount_3 numeric,
  base_amount_4 numeric,
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
  apartment_id uuid,
  milestone_id uuid,
  created_at timestamptz,
  updated_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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
    c.name AS customer_name,
    c.surname AS customer_surname,
    ai.investor_id,
    inv.name AS investor_name,
    ai.bank_id,
    bk.name AS bank_name,
    ai.project_id,
    p.name AS project_name,
    ai.contract_id,
    co.contract_number,
    co.job_description AS contract_job_description,
    ai.office_supplier_id,
    os.name AS office_supplier_name,
    ai.retail_supplier_id,
    rs.name AS retail_supplier_name,
    ai.retail_customer_id,
    rc.name AS retail_customer_name,
    ai.invoice_category,
    ai.category,
    ai.description,
    ai.issue_date,
    ai.due_date,
    ai.base_amount,
    ai.base_amount_1,
    ai.base_amount_2,
    ai.base_amount_3,
    ai.base_amount_4,
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
    ai.apartment_id,
    ai.milestone_id,
    ai.created_at,
    ai.updated_at
  FROM accounting_invoices ai
  LEFT JOIN accounting_companies ac ON ai.company_id = ac.id
  LEFT JOIN subcontractors sub ON ai.supplier_id = sub.id
  LEFT JOIN customers c ON ai.customer_id = c.id
  LEFT JOIN investors inv ON ai.investor_id = inv.id
  LEFT JOIN banks bk ON ai.bank_id = bk.id
  LEFT JOIN projects p ON ai.project_id = p.id
  LEFT JOIN contracts co ON ai.contract_id = co.id
  LEFT JOIN office_suppliers os ON ai.office_supplier_id = os.id
  LEFT JOIN retail_suppliers rs ON ai.retail_supplier_id = rs.id
  LEFT JOIN retail_customers rc ON ai.retail_customer_id = rc.id
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
      OR sub.name ILIKE '%' || p_search_term || '%'
      OR c.name ILIKE '%' || p_search_term || '%'
      OR c.surname ILIKE '%' || p_search_term || '%'
      OR rc.name ILIKE '%' || p_search_term || '%'
      OR inv.name ILIKE '%' || p_search_term || '%'
      OR bk.name ILIKE '%' || p_search_term || '%'
      OR ac.name ILIKE '%' || p_search_term || '%'
    )
  ORDER BY ai.issue_date DESC, ai.id
  OFFSET p_offset
  LIMIT p_limit;
END;
$$;