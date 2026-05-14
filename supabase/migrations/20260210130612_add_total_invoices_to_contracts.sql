/*
  # Add Total Invoices Amount Tracking to Contracts

  This migration adds automatic tracking of total invoices amount for each contract.

  ## Changes

  1. **New Column**
     - Add `total_invoices_amount` to contracts table
     - Stores sum of all invoice total_amounts (with VAT) for the contract

  2. **Automatic Calculation**
     - Trigger updates total_invoices_amount when invoices are created/updated/deleted
     - Works for both regular and retail contracts

  3. **Benefits**
     - Correct "Remaining" calculation: total_invoices_amount - budget_realized
     - Shows actual debt (total invoiced - total paid)
     - Replaces unreliable contract_amount field

  ## Security

  - Function uses SECURITY DEFINER with proper search_path
  - No RLS changes needed
*/

-- Add total_invoices_amount column to contracts
ALTER TABLE contracts
ADD COLUMN IF NOT EXISTS total_invoices_amount numeric DEFAULT 0 NOT NULL;


-- Create function to update total invoices amount
CREATE OR REPLACE FUNCTION update_contract_total_invoices()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_contract_id uuid;

  v_total_invoices numeric;

BEGIN
  -- Get contract_id from the invoice
  IF TG_OP = 'DELETE' THEN
    v_contract_id := OLD.contract_id;

  ELSE
    v_contract_id := NEW.contract_id;

  END IF;


  -- Only proceed if invoice has a contract_id
  IF v_contract_id IS NOT NULL THEN
    -- Calculate total invoices amount for this contract (sum of all invoice total_amounts with VAT)
    SELECT COALESCE(SUM(total_amount), 0) INTO v_total_invoices
    FROM accounting_invoices
    WHERE contract_id = v_contract_id;


    -- Update the contract's total_invoices_amount
    UPDATE contracts
    SET total_invoices_amount = v_total_invoices
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


-- Create trigger for accounting_invoices
CREATE TRIGGER trg_update_contract_total_invoices
  AFTER INSERT OR UPDATE OF total_amount, contract_id OR DELETE ON accounting_invoices
  FOR EACH ROW
  EXECUTE FUNCTION update_contract_total_invoices();


-- Calculate initial values for all existing contracts
UPDATE contracts c
SET total_invoices_amount = COALESCE((
  SELECT SUM(total_amount)
  FROM accounting_invoices ai
  WHERE ai.contract_id = c.id
), 0);
;