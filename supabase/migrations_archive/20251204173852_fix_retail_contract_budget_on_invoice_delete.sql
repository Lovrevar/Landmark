/*
  # Fix Retail Contract Budget on Invoice Delete
  
  1. Problem
    - When accounting_invoices are deleted, retail_contracts.budget_realized 
      doesn't get updated to reflect the removed payments
    - User sees old payment data on retail contract cards even after all invoices are deleted
  
  2. Solution
    - Add trigger on accounting_invoices DELETE to recalculate retail contract budget
    - Add one-time fix to reset budget_realized for contracts with no payments
  
  3. Changes
    - Create trigger function to update retail contract budget when invoice is deleted
    - Create DELETE trigger on accounting_invoices table
    - Reset budget_realized to 0 for all retail contracts with no payments
*/

-- Function to update retail contract budget when invoice is deleted
CREATE OR REPLACE FUNCTION update_retail_contract_budget_on_invoice_delete()
RETURNS TRIGGER AS $$
BEGIN
  -- Only proceed if deleted invoice had a retail_contract_id
  IF OLD.retail_contract_id IS NOT NULL THEN
    -- Recalculate total paid for this retail contract
    -- (payments will be cascade deleted, but we want to update before that happens)
    UPDATE retail_contracts
    SET budget_realized = (
      SELECT COALESCE(SUM(ap.amount), 0)
      FROM accounting_payments ap
      INNER JOIN accounting_invoices ai ON ap.invoice_id = ai.id
      WHERE ai.retail_contract_id = OLD.retail_contract_id
        AND ai.id != OLD.id  -- Exclude the invoice being deleted
    ),
    updated_at = now()
    WHERE id = OLD.retail_contract_id;
  END IF;
  
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS trigger_update_retail_contract_budget_on_invoice_delete ON accounting_invoices;

-- Create trigger for DELETE on accounting_invoices
CREATE TRIGGER trigger_update_retail_contract_budget_on_invoice_delete
BEFORE DELETE ON accounting_invoices
FOR EACH ROW
EXECUTE FUNCTION update_retail_contract_budget_on_invoice_delete();

-- One-time fix: Reset budget_realized to 0 for all retail contracts that have no payments
UPDATE retail_contracts
SET budget_realized = 0,
    updated_at = now()
WHERE id NOT IN (
  SELECT DISTINCT ai.retail_contract_id
  FROM accounting_invoices ai
  INNER JOIN accounting_payments ap ON ap.invoice_id = ai.id
  WHERE ai.retail_contract_id IS NOT NULL
)
AND budget_realized != 0;