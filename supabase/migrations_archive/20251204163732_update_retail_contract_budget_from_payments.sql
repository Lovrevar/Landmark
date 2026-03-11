/*
  # Update Retail Contract Budget from Accounting Payments

  ## Purpose
  Create triggers to automatically update retail_contracts.budget_realized
  when accounting payments are added, updated, or deleted for retail invoices.

  ## Changes
  1. Create function to recalculate retail contract budget_realized based on accounting_payments
  2. Create triggers on accounting_payments table to update retail_contracts automatically
  3. One-time fix to recalculate all existing retail contract budget_realized values

  ## Logic
  - When a payment is added/updated/deleted, find related invoice
  - If invoice has a retail_contract_id, recalculate sum of all payments for that retail contract
  - Update retail_contracts.budget_realized with the new sum
*/

-- Function to recalculate and update retail contract budget_realized
CREATE OR REPLACE FUNCTION update_retail_contract_budget_realized_from_payments()
RETURNS TRIGGER AS $$
DECLARE
  v_retail_contract_id UUID;
  v_total_paid NUMERIC;
BEGIN
  -- Get retail_contract_id from the invoice (works for INSERT, UPDATE, DELETE)
  IF TG_OP = 'DELETE' THEN
    SELECT retail_contract_id INTO v_retail_contract_id
    FROM accounting_invoices
    WHERE id = OLD.invoice_id;
  ELSE
    SELECT retail_contract_id INTO v_retail_contract_id
    FROM accounting_invoices
    WHERE id = NEW.invoice_id;
  END IF;

  -- Only proceed if invoice has a retail_contract_id
  IF v_retail_contract_id IS NOT NULL THEN
    -- Calculate total paid for this retail contract
    SELECT COALESCE(SUM(ap.amount), 0) INTO v_total_paid
    FROM accounting_payments ap
    INNER JOIN accounting_invoices ai ON ap.invoice_id = ai.id
    WHERE ai.retail_contract_id = v_retail_contract_id;

    -- Update the retail contract's budget_realized
    UPDATE retail_contracts
    SET budget_realized = v_total_paid,
        updated_at = now()
    WHERE id = v_retail_contract_id;
  END IF;

  -- Return appropriate row based on operation
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing triggers if they exist
DROP TRIGGER IF EXISTS trigger_update_retail_contract_budget_on_payment_insert ON accounting_payments;
DROP TRIGGER IF EXISTS trigger_update_retail_contract_budget_on_payment_update ON accounting_payments;
DROP TRIGGER IF EXISTS trigger_update_retail_contract_budget_on_payment_delete ON accounting_payments;

-- Create trigger for INSERT
CREATE TRIGGER trigger_update_retail_contract_budget_on_payment_insert
AFTER INSERT ON accounting_payments
FOR EACH ROW
EXECUTE FUNCTION update_retail_contract_budget_realized_from_payments();

-- Create trigger for UPDATE
CREATE TRIGGER trigger_update_retail_contract_budget_on_payment_update
AFTER UPDATE ON accounting_payments
FOR EACH ROW
EXECUTE FUNCTION update_retail_contract_budget_realized_from_payments();

-- Create trigger for DELETE
CREATE TRIGGER trigger_update_retail_contract_budget_on_payment_delete
AFTER DELETE ON accounting_payments
FOR EACH ROW
EXECUTE FUNCTION update_retail_contract_budget_realized_from_payments();

-- One-time fix: Recalculate all existing retail contract budget_realized values
UPDATE retail_contracts rc
SET budget_realized = (
  SELECT COALESCE(SUM(ap.amount), 0)
  FROM accounting_payments ap
  INNER JOIN accounting_invoices ai ON ap.invoice_id = ai.id
  WHERE ai.retail_contract_id = rc.id
),
updated_at = now()
WHERE EXISTS (
  SELECT 1 
  FROM accounting_invoices ai 
  WHERE ai.retail_contract_id = rc.id
);
