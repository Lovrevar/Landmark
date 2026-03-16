/*
  # Update Contract Budget on Payment Changes
  
  This migration creates triggers to automatically update contracts.budget_realized
  when accounting payments are added, updated, or deleted.

  ## Changes
  
  1. Create function to recalculate contract budget_realized based on accounting_payments
  2. Create triggers on accounting_payments table to update contracts automatically
  
  ## Logic
  
  - When a payment is added/updated/deleted, find related invoice
  - If invoice has a contract_id, recalculate sum of all payments for that contract
  - Update contracts.budget_realized with the new sum
*/

-- Function to recalculate and update contract budget_realized
CREATE OR REPLACE FUNCTION update_contract_budget_realized()
RETURNS TRIGGER AS $$
DECLARE
  v_contract_id UUID;
  v_total_paid NUMERIC;
BEGIN
  -- Get contract_id from the invoice (works for INSERT, UPDATE, DELETE)
  IF TG_OP = 'DELETE' THEN
    SELECT contract_id INTO v_contract_id
    FROM accounting_invoices
    WHERE id = OLD.invoice_id;
  ELSE
    SELECT contract_id INTO v_contract_id
    FROM accounting_invoices
    WHERE id = NEW.invoice_id;
  END IF;

  -- Only proceed if invoice has a contract_id
  IF v_contract_id IS NOT NULL THEN
    -- Calculate total paid for this contract
    SELECT COALESCE(SUM(ap.amount), 0) INTO v_total_paid
    FROM accounting_payments ap
    INNER JOIN accounting_invoices ai ON ap.invoice_id = ai.id
    WHERE ai.contract_id = v_contract_id;

    -- Update the contract's budget_realized
    UPDATE contracts
    SET budget_realized = v_total_paid
    WHERE id = v_contract_id;
  END IF;

  -- Return appropriate row based on operation
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Drop existing triggers if they exist
DROP TRIGGER IF EXISTS trigger_update_contract_budget_on_payment_insert ON accounting_payments;
DROP TRIGGER IF EXISTS trigger_update_contract_budget_on_payment_update ON accounting_payments;
DROP TRIGGER IF EXISTS trigger_update_contract_budget_on_payment_delete ON accounting_payments;

-- Create trigger for INSERT
CREATE TRIGGER trigger_update_contract_budget_on_payment_insert
AFTER INSERT ON accounting_payments
FOR EACH ROW
EXECUTE FUNCTION update_contract_budget_realized();

-- Create trigger for UPDATE
CREATE TRIGGER trigger_update_contract_budget_on_payment_update
AFTER UPDATE ON accounting_payments
FOR EACH ROW
EXECUTE FUNCTION update_contract_budget_realized();

-- Create trigger for DELETE
CREATE TRIGGER trigger_update_contract_budget_on_payment_delete
AFTER DELETE ON accounting_payments
FOR EACH ROW
EXECUTE FUNCTION update_contract_budget_realized();

-- One-time fix: Recalculate all existing contract budget_realized values
UPDATE contracts c
SET budget_realized = (
  SELECT COALESCE(SUM(ap.amount), 0)
  FROM accounting_payments ap
  INNER JOIN accounting_invoices ai ON ap.invoice_id = ai.id
  WHERE ai.contract_id = c.id
)
WHERE EXISTS (
  SELECT 1 
  FROM accounting_invoices ai 
  WHERE ai.contract_id = c.id
);