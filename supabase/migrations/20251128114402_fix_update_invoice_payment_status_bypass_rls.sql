/*
  # Fix update_invoice_payment_status to Bypass RLS

  ## Problem
  The trigger function `update_invoice_payment_status` is SECURITY DEFINER (runs as postgres)
  but RLS policies still block the UPDATE on accounting_invoices because:
  - RLS policy requires authenticated user to be Director/Accounting
  - Trigger runs in context of the payment insert, not as a privileged user
  
  This causes payments to be added but invoice status NOT updated!

  ## Solution
  Add `SECURITY DEFINER` and `SET search_path = public` to ensure the function
  bypasses RLS and runs with full postgres privileges.

  Also need to ensure the function explicitly sets the security context.

  ## Safety
  - Function only updates invoice payment fields (paid_amount, status)
  - Function is triggered by payment changes (INSERT/UPDATE/DELETE)
  - No user input is directly used, only calculated values
*/

-- Drop the existing function
DROP FUNCTION IF EXISTS update_invoice_payment_status() CASCADE;

-- Recreate with proper security settings
CREATE OR REPLACE FUNCTION update_invoice_payment_status()
RETURNS TRIGGER 
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  total_paid decimal(15,2);
  invoice_total decimal(15,2);
  new_status text;
  target_invoice_id uuid;
BEGIN
  -- Get the invoice ID from NEW or OLD
  target_invoice_id := COALESCE(NEW.invoice_id, OLD.invoice_id);
  
  -- Get total paid amount for the invoice
  SELECT COALESCE(SUM(amount), 0)
  INTO total_paid
  FROM accounting_payments
  WHERE invoice_id = target_invoice_id;

  -- Get invoice total amount
  SELECT total_amount
  INTO invoice_total
  FROM accounting_invoices
  WHERE id = target_invoice_id;

  -- Determine new status
  IF total_paid = 0 THEN
    new_status := 'UNPAID';
  ELSIF total_paid >= invoice_total THEN
    new_status := 'PAID';
  ELSE
    new_status := 'PARTIALLY_PAID';
  END IF;

  -- Update invoice with RLS bypass (SECURITY DEFINER as postgres)
  UPDATE accounting_invoices
  SET
    paid_amount = total_paid,
    remaining_amount = total_amount - total_paid,
    status = new_status,
    updated_at = now()
  WHERE id = target_invoice_id;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Recreate the trigger
DROP TRIGGER IF EXISTS trg_update_invoice_on_payment_change ON accounting_payments;
CREATE TRIGGER trg_update_invoice_on_payment_change
  AFTER INSERT OR UPDATE OR DELETE ON accounting_payments
  FOR EACH ROW
  EXECUTE FUNCTION update_invoice_payment_status();

-- Fix any existing invoices that have payments but wrong status
UPDATE accounting_invoices ai
SET 
  paid_amount = COALESCE((
    SELECT SUM(amount)
    FROM accounting_payments
    WHERE invoice_id = ai.id
  ), 0),
  remaining_amount = ai.total_amount - COALESCE((
    SELECT SUM(amount)
    FROM accounting_payments
    WHERE invoice_id = ai.id
  ), 0),
  status = CASE
    WHEN COALESCE((SELECT SUM(amount) FROM accounting_payments WHERE invoice_id = ai.id), 0) = 0
      THEN 'UNPAID'
    WHEN COALESCE((SELECT SUM(amount) FROM accounting_payments WHERE invoice_id = ai.id), 0) >= ai.total_amount
      THEN 'PAID'
    ELSE 'PARTIALLY_PAID'
  END,
  updated_at = now()
WHERE EXISTS (
  SELECT 1 FROM accounting_payments WHERE invoice_id = ai.id
);
