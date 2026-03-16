/*
  # Fix Contract Budget Realized to Use Base Amount (No VAT)

  ## Problem
  
  Currently contracts.budget_realized is calculated from accounting_payments.amount
  which includes VAT. For Site Management and supervision tracking, we need to show
  amounts WITHOUT VAT (base_amount only). VAT should only be visible in Accounting module.

  ## Solution
  
  Update the trigger to calculate budget_realized using base_amount from invoices
  proportionally to the payment amount, instead of using the full payment amount.
  
  Since payments can be partial, we need to calculate:
  - payment_percentage = payment.amount / invoice.total_amount
  - realized_amount = invoice.base_amount * payment_percentage

  ## Changes
  
  1. Update update_contract_budget_realized() function to use base_amount
  2. Recalculate all existing contract budget_realized values
*/

-- Drop existing triggers
DROP TRIGGER IF EXISTS trigger_update_contract_budget_on_payment_insert ON accounting_payments;
DROP TRIGGER IF EXISTS trigger_update_contract_budget_on_payment_update ON accounting_payments;
DROP TRIGGER IF EXISTS trigger_update_contract_budget_on_payment_delete ON accounting_payments;

-- Updated function to calculate budget_realized using base_amount (without VAT)
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
    -- Calculate total paid for this contract using base_amount (without VAT)
    -- Formula: For each payment, calculate what portion was paid and apply it to base_amount
    SELECT COALESCE(SUM(
      CASE 
        WHEN ai.total_amount > 0 THEN 
          ai.base_amount * (ap.amount / ai.total_amount)
        ELSE 
          0
      END
    ), 0) INTO v_total_paid
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

-- Recalculate all existing contract budget_realized values using base_amount
UPDATE contracts c
SET budget_realized = (
  SELECT COALESCE(SUM(
    CASE 
      WHEN ai.total_amount > 0 THEN 
        ai.base_amount * (ap.amount / ai.total_amount)
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
