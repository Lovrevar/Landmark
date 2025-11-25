/*
  # Fix Contract Budget to Use Base Amount (Without VAT)
  
  This migration fixes the trigger that updates contracts.budget_realized to use
  base_amount (without VAT) instead of the payment amount (with VAT).
  
  ## Changes
  
  1. Update the trigger function to calculate proportional base_amount from payments
  2. Recalculate all existing contract budget_realized values using base amounts
  
  ## Logic
  
  - For each payment, calculate what portion of the base_amount has been paid:
    - If invoice total_amount > 0: (payment.amount / invoice.total_amount) * invoice.base_amount
    - This gives us the base amount (without VAT) that was actually paid
  - Sum all base amounts for the contract
  - Update contracts.budget_realized with the sum of base amounts
*/

-- Drop existing function
DROP FUNCTION IF EXISTS update_contract_budget_realized() CASCADE;

-- Create new function that uses base_amount
CREATE OR REPLACE FUNCTION update_contract_budget_realized()
RETURNS TRIGGER AS $$
DECLARE
  v_contract_id UUID;
  v_total_paid_base NUMERIC;
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
    -- Calculate total paid (base amount) for this contract
    -- For each payment, calculate the proportional base amount
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
    WHERE ai.contract_id = v_contract_id;

    -- Update the contract's budget_realized with base amount
    UPDATE contracts
    SET budget_realized = v_total_paid_base
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

-- Recreate triggers
CREATE TRIGGER trigger_update_contract_budget_on_payment_insert
AFTER INSERT ON accounting_payments
FOR EACH ROW
EXECUTE FUNCTION update_contract_budget_realized();

CREATE TRIGGER trigger_update_contract_budget_on_payment_update
AFTER UPDATE ON accounting_payments
FOR EACH ROW
EXECUTE FUNCTION update_contract_budget_realized();

CREATE TRIGGER trigger_update_contract_budget_on_payment_delete
AFTER DELETE ON accounting_payments
FOR EACH ROW
EXECUTE FUNCTION update_contract_budget_realized();

-- One-time fix: Recalculate all existing contract budget_realized values using base amounts
UPDATE contracts c
SET budget_realized = (
  SELECT COALESCE(SUM(
    CASE 
      WHEN ai.total_amount > 0 THEN 
        (ap.amount / ai.total_amount) * ai.base_amount
      ELSE 
        0
    END
  ), 0)
  FROM accounting_payments ap
  INNER JOIN accounting_invoices ai ON ap.invoice_id = ai.id
  WHERE ai.contract_id = c.id
)
WHERE EXISTS (
  SELECT 1 
  FROM accounting_invoices ai 
  WHERE ai.contract_id = c.id
);
