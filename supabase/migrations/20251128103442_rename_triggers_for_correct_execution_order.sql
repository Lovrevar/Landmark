/*
  # Rename Triggers for Correct Execution Order

  1. Problem
    - BEFORE triggers execute alphabetically
    - reset_milestone executes AFTER calculate_invoice_amounts
    - This causes remaining_amount to not be recalculated

  2. Solution
    - Rename triggers so calculate_invoice_amounts runs LAST
    - This ensures remaining_amount is always correct

  3. Changes
    - Rename calculate_invoice_amounts_trigger to z_calculate_invoice_amounts_trigger
    - This makes it run after all other triggers alphabetically
*/

-- Drop and recreate calculate_invoice_amounts trigger with new name
DROP TRIGGER IF EXISTS calculate_invoice_amounts_trigger ON accounting_invoices;
DROP TRIGGER IF EXISTS z_calculate_invoice_amounts_trigger ON accounting_invoices;

CREATE TRIGGER z_calculate_invoice_amounts_trigger
  BEFORE INSERT OR UPDATE ON accounting_invoices
  FOR EACH ROW
  EXECUTE FUNCTION calculate_invoice_amounts();

-- Test the UPDATE now
UPDATE accounting_invoices
SET paid_amount = 375000.00, status = 'PAID'
WHERE invoice_number = 'test';
