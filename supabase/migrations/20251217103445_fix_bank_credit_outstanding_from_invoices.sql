/*
  # Fix Bank Credit Outstanding Balance Tracking
  
  1. Changes
    - Drop old trigger that tracked outstanding_balance via used_amount - repaid_amount
    - Create new trigger that calculates outstanding_balance from unpaid INCOMING_BANK invoices
    - Outstanding balance = SUM of remaining_amount from all INCOMING_BANK invoices with status UNPAID or PARTIALLY_PAID
    
  2. Behavior
    - Trigger fires when INCOMING_BANK invoice is created, updated, or deleted
    - Automatically updates bank_credits.outstanding_balance
*/

-- Drop old trigger if exists
DROP TRIGGER IF EXISTS update_bank_credit_balance_trigger ON accounting_payments;
DROP FUNCTION IF EXISTS update_bank_credit_balance();

-- Create function to recalculate outstanding balance from invoices
CREATE OR REPLACE FUNCTION recalculate_bank_credit_outstanding()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_credit_id uuid;
  v_outstanding numeric;
  v_invoice_type text;
BEGIN
  -- Determine which credit_id to update and invoice type
  IF TG_OP = 'DELETE' THEN
    v_credit_id := OLD.bank_credit_id;
    v_invoice_type := OLD.invoice_type;
  ELSE
    v_credit_id := NEW.bank_credit_id;
    v_invoice_type := NEW.invoice_type;
  END IF;
  
  -- Only process INCOMING_BANK invoices with linked credits
  IF v_invoice_type != 'INCOMING_BANK' OR v_credit_id IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;
  
  -- Calculate outstanding balance from unpaid invoices
  SELECT COALESCE(SUM(remaining_amount), 0)
  INTO v_outstanding
  FROM accounting_invoices
  WHERE invoice_type = 'INCOMING_BANK'
    AND bank_credit_id = v_credit_id
    AND status IN ('UNPAID', 'PARTIALLY_PAID');
  
  -- Update the credit
  UPDATE bank_credits
  SET outstanding_balance = v_outstanding
  WHERE id = v_credit_id;
  
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Create trigger on accounting_invoices for INCOMING_BANK invoices
CREATE TRIGGER recalculate_bank_credit_outstanding_trigger
AFTER INSERT OR UPDATE OF remaining_amount, status, bank_credit_id OR DELETE
ON accounting_invoices
FOR EACH ROW
EXECUTE FUNCTION recalculate_bank_credit_outstanding();

-- Recalculate all existing outstanding balances
UPDATE bank_credits bc
SET outstanding_balance = (
  SELECT COALESCE(SUM(ai.remaining_amount), 0)
  FROM accounting_invoices ai
  WHERE ai.invoice_type = 'INCOMING_BANK'
    AND ai.bank_credit_id = bc.id
    AND ai.status IN ('UNPAID', 'PARTIALLY_PAID')
);

-- Update column comment
COMMENT ON COLUMN bank_credits.outstanding_balance IS 'Automatically calculated: sum of remaining_amount from unpaid INCOMING_BANK invoices';