/*
  # Fix retail_contracts.budget_realized to use actual payments with VAT

  ## Problem
  The existing trigger calculates budget_realized using a proportional base amount
  (without VAT): (paid / total_amount) * base_amount — which strips out VAT and causes
  a ~12.000 discrepancy vs actual cash received.

  ## Change
  Update the trigger function to sum the actual payment amounts directly from
  accounting_payments, including VAT, per retail contract.

  ## Affected table
  - retail_contracts.budget_realized: now reflects sum of actual payments (with VAT)

  ## Notes
  - All retail reports read from retail_contracts.budget_realized, so this single
    change fixes the displayed numbers everywhere (reports, project statistics, etc.)
  - A bulk recalculation UPDATE is run at the end to fix all existing rows
*/

CREATE OR REPLACE FUNCTION update_retail_contract_budget_realized()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_retail_contract_id UUID;
  v_total_paid NUMERIC := 0;
BEGIN
  IF TG_OP = 'DELETE' THEN
    SELECT retail_contract_id INTO v_retail_contract_id
    FROM accounting_invoices
    WHERE id = OLD.invoice_id;
  ELSE
    SELECT retail_contract_id INTO v_retail_contract_id
    FROM accounting_invoices
    WHERE id = NEW.invoice_id;
  END IF;

  IF v_retail_contract_id IS NOT NULL THEN
    SELECT COALESCE(SUM(ap.amount), 0) INTO v_total_paid
    FROM accounting_payments ap
    JOIN accounting_invoices ai ON ap.invoice_id = ai.id
    WHERE ai.retail_contract_id = v_retail_contract_id;

    UPDATE retail_contracts
    SET budget_realized = v_total_paid,
        updated_at = now()
    WHERE id = v_retail_contract_id;
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$;

UPDATE retail_contracts rc
SET budget_realized = (
  SELECT COALESCE(SUM(ap.amount), 0)
  FROM accounting_payments ap
  JOIN accounting_invoices ai ON ap.invoice_id = ai.id
  WHERE ai.retail_contract_id = rc.id
),
updated_at = now()
WHERE EXISTS (
  SELECT 1
  FROM accounting_invoices ai
  WHERE ai.retail_contract_id = rc.id
);
