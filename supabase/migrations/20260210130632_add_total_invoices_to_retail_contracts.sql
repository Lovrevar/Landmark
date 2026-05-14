/*
  # Add Total Invoices Amount Tracking to Retail Contracts

  This migration adds automatic tracking of total invoices amount for retail contracts.

  ## Changes

  1. **New Column**
     - Add `total_invoices_amount` to retail_contracts table
     - Stores sum of all invoice total_amounts (with VAT) for the contract

  2. **Automatic Calculation**
     - Trigger updates total_invoices_amount when invoices are created/updated/deleted
     - Mirrors functionality from regular contracts

  ## Security

  - Function uses SECURITY DEFINER with proper search_path
  - No RLS changes needed
*/

-- Add total_invoices_amount column to retail_contracts
ALTER TABLE retail_contracts
ADD COLUMN IF NOT EXISTS total_invoices_amount numeric DEFAULT 0 NOT NULL;


-- Create function to update retail contract total invoices amount
CREATE OR REPLACE FUNCTION update_retail_contract_total_invoices()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_retail_contract_id uuid;

  v_total_invoices numeric;

BEGIN
  -- Get retail_contract_id from the invoice
  IF TG_OP = 'DELETE' THEN
    v_retail_contract_id := OLD.retail_contract_id;

  ELSE
    v_retail_contract_id := NEW.retail_contract_id;

  END IF;


  -- Only proceed if invoice has a retail_contract_id
  IF v_retail_contract_id IS NOT NULL THEN
    -- Calculate total invoices amount for this retail contract
    SELECT COALESCE(SUM(total_amount), 0) INTO v_total_invoices
    FROM accounting_invoices
    WHERE retail_contract_id = v_retail_contract_id;


    -- Update the retail contract's total_invoices_amount
    UPDATE retail_contracts
    SET total_invoices_amount = v_total_invoices
    WHERE id = v_retail_contract_id;

  END IF;


  -- Return appropriate row based on operation
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;

  ELSE
    RETURN NEW;

  END IF;

END;

$$ LANGUAGE plpgsql;


-- Create trigger for retail contracts
CREATE TRIGGER trg_update_retail_contract_total_invoices
  AFTER INSERT OR UPDATE OF total_amount, retail_contract_id OR DELETE ON accounting_invoices
  FOR EACH ROW
  EXECUTE FUNCTION update_retail_contract_total_invoices();


-- Calculate initial values for all existing retail contracts
UPDATE retail_contracts rc
SET total_invoices_amount = COALESCE((
  SELECT SUM(total_amount)
  FROM accounting_invoices ai
  WHERE ai.retail_contract_id = rc.id
), 0);
;