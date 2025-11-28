/*
  # Remove Calculate Amounts Trigger from UPDATE Operations

  Problem: z_calculate_invoice_amounts_trigger interferes with payment status updates
  
  Solution: Only run this trigger on INSERT, not on UPDATE
  - On INSERT: Calculate VAT, total, and set defaults
  - On UPDATE: Let the values be updated freely (other triggers handle payment fields)

  This allows update_invoice_payment_status to work correctly.
*/

-- Drop the existing trigger
DROP TRIGGER IF EXISTS z_calculate_invoice_amounts_trigger ON accounting_invoices;

-- Recreate trigger ONLY for INSERT
CREATE TRIGGER z_calculate_invoice_amounts_trigger
  BEFORE INSERT ON accounting_invoices
  FOR EACH ROW
  EXECUTE FUNCTION calculate_invoice_amounts();

-- Now manually fix all invoices with payments
UPDATE accounting_invoices ai
SET 
  paid_amount = subquery.total_paid,
  remaining_amount = ai.total_amount - subquery.total_paid,
  status = CASE
    WHEN subquery.total_paid = 0 THEN 'UNPAID'
    WHEN subquery.total_paid >= ai.total_amount THEN 'PAID'
    ELSE 'PARTIALLY_PAID'
  END,
  updated_at = NOW()
FROM (
  SELECT 
    invoice_id,
    COALESCE(SUM(amount), 0) as total_paid
  FROM accounting_payments
  GROUP BY invoice_id
) subquery
WHERE ai.id = subquery.invoice_id;
