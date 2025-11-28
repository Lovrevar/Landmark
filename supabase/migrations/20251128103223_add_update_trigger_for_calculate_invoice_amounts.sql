/*
  # Add UPDATE Trigger for Calculate Invoice Amounts

  1. Problem
    - calculate_invoice_amounts_trigger only fires on INSERT
    - No trigger fires on UPDATE to maintain check constraint
    - This causes constraint violations when updating paid_amount

  2. Solution
    - Drop and recreate trigger to include UPDATE events
    - Ensure trigger maintains remaining_amount = total_amount - paid_amount

  3. Changes
    - Recreate trigger with INSERT OR UPDATE
*/

-- Drop existing trigger
DROP TRIGGER IF EXISTS calculate_invoice_amounts_trigger ON accounting_invoices;

-- Recreate with UPDATE included
CREATE TRIGGER calculate_invoice_amounts_trigger
  BEFORE INSERT OR UPDATE ON accounting_invoices
  FOR EACH ROW
  EXECUTE FUNCTION calculate_invoice_amounts();

-- Now test by updating the invoice
UPDATE accounting_invoices
SET 
  paid_amount = 375000.00,
  status = 'PAID'
WHERE invoice_number = 'test';
