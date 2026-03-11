/*
  # Fix Contract Budget Realized to Include VAT

  This migration fixes the contract budget tracking to include VAT in the total paid amount.

  ## Changes

  1. **Update Trigger Function**
     - Modified `update_contract_budget_realized()` to sum actual payment amounts (with VAT)
     - Previously calculated only base_amount (without VAT)
     - Now uses direct SUM(ap.amount) which includes VAT

  2. **Recalculate Existing Data**
     - Updates all existing contracts to reflect actual paid amounts with VAT
     - Ensures historical data is corrected

  ## Impact

  - Site Management will now show correct "Total Paid" including VAT
  - Example: V-SOLUTION contract will show €500 instead of €400
  - All payment tracking will reflect actual money paid (base + VAT)

  ## Security

  - Function uses SECURITY DEFINER with proper search_path
  - No changes to RLS policies required
*/

-- Drop existing trigger first, then function
DROP TRIGGER IF EXISTS trg_update_contract_budget_realized ON accounting_payments;
DROP FUNCTION IF EXISTS update_contract_budget_realized();

-- Create improved function that includes VAT in budget_realized
CREATE OR REPLACE FUNCTION update_contract_budget_realized()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_contract_id uuid;
  v_total_paid numeric;
BEGIN
  -- Get contract_id from the invoice
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
    -- Calculate total paid for this contract using actual payment amounts (with VAT)
    -- This gives us the real amount paid, including VAT
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

-- Recreate the trigger
CREATE TRIGGER trg_update_contract_budget_realized
  AFTER INSERT OR UPDATE OR DELETE ON accounting_payments
  FOR EACH ROW
  EXECUTE FUNCTION update_contract_budget_realized();

-- Recalculate budget_realized for all existing contracts
-- This updates all contracts to show actual paid amounts with VAT
UPDATE contracts c
SET budget_realized = COALESCE((
  SELECT SUM(ap.amount)
  FROM accounting_payments ap
  INNER JOIN accounting_invoices ai ON ap.invoice_id = ai.id
  WHERE ai.contract_id = c.id
), 0)
WHERE EXISTS (
  SELECT 1
  FROM accounting_invoices ai
  WHERE ai.contract_id = c.id
);