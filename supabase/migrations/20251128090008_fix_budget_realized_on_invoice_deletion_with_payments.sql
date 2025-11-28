/*
  # Fix Budget Realized When Invoice is Deleted

  ## Problem
  When an accounting_invoice is deleted (which cascades to delete all its payments),
  the contract.budget_realized is not updated because the payment trigger runs AFTER
  the invoice is already deleted, so it can't find the contract_id.

  ## Solution
  Add a BEFORE DELETE trigger on accounting_invoices that stores the contract_id
  and recalculates budget_realized AFTER all payments are deleted.

  ## Changes
  - Create trigger on accounting_invoices BEFORE DELETE to capture contract_id
  - Update contract.budget_realized after invoice and its payments are deleted
*/

-- Function to update contract budget when invoice is deleted
CREATE OR REPLACE FUNCTION update_contract_budget_on_invoice_delete()
RETURNS TRIGGER AS $$
DECLARE
  v_contract_id UUID;
  v_total_paid_base NUMERIC;
BEGIN
  -- Capture contract_id from the invoice being deleted
  v_contract_id := OLD.contract_id;
  
  -- Only proceed if invoice has a contract_id
  IF v_contract_id IS NOT NULL THEN
    -- Recalculate total paid (base amount) for this contract
    -- This runs AFTER the invoice and its payments are deleted due to CASCADE
    SELECT COALESCE(SUM(
      CASE 
        WHEN ai.total_amount > 0 THEN 
          (ap.amount / ai.total_amount) * ai.base_amount
        ELSE 
          0
      END
    ), 0) INTO v_total_paid_base
    FROM accounting_payments ap
    INNER JOIN accounting_invoices ai ON ap.invoice_id = ai.id
    WHERE ai.contract_id = v_contract_id
      AND ai.id != OLD.id; -- Exclude the invoice being deleted
    
    -- Update the contract's budget_realized
    UPDATE contracts
    SET budget_realized = v_total_paid_base
    WHERE id = v_contract_id;
  END IF;
  
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- Create trigger on invoice deletion (runs AFTER DELETE due to CASCADE)
DROP TRIGGER IF EXISTS trigger_update_contract_budget_on_invoice_delete ON accounting_invoices;
CREATE TRIGGER trigger_update_contract_budget_on_invoice_delete
AFTER DELETE ON accounting_invoices
FOR EACH ROW
WHEN (OLD.contract_id IS NOT NULL)
EXECUTE FUNCTION update_contract_budget_on_invoice_delete();

COMMENT ON FUNCTION update_contract_budget_on_invoice_delete() IS 
  'Recalculates contract budget_realized when an invoice is deleted (including all its payments)';

-- One-time fix: Reset budget_realized for contracts with no payments
UPDATE contracts c
SET budget_realized = 0
WHERE budget_realized > 0
  AND NOT EXISTS (
    SELECT 1 
    FROM accounting_payments ap
    INNER JOIN accounting_invoices ai ON ap.invoice_id = ai.id
    WHERE ai.contract_id = c.id
  );
