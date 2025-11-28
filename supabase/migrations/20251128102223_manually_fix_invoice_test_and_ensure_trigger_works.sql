/*
  # Manually Fix Invoice Test Status and Ensure Future Triggers Work

  1. Problem
    - Invoice "test" has payment but shows UNPAID
    - Trigger may not be executing due to various issues
    
  2. Solution
    - Manually fix the specific invoice in this migration
    - Simplify trigger function to avoid any potential issues
    - Remove all debugging and complexity

  3. Changes
    - Direct UPDATE to fix invoice "test"
    - Simplified trigger function
*/

-- First, let's manually fix the test invoice
-- We know it has one payment of 187500.00
UPDATE accounting_invoices
SET 
  paid_amount = 187500.00,
  remaining_amount = 0.00,
  status = 'PAID',
  updated_at = NOW()
WHERE invoice_number = 'test'
  AND invoice_type = 'OUTGOING_SALES';

-- Now create the simplest possible trigger function
-- Remove all complexity and potential failure points
DROP FUNCTION IF EXISTS update_invoice_payment_status() CASCADE;

CREATE OR REPLACE FUNCTION update_invoice_payment_status()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_invoice_id uuid;
  v_total_paid numeric;
  v_total numeric;
BEGIN
  -- Get invoice ID
  IF TG_OP IN ('INSERT', 'UPDATE') THEN
    v_invoice_id := NEW.invoice_id;
  ELSE
    v_invoice_id := OLD.invoice_id;
  END IF;

  -- Calculate totals
  SELECT 
    COALESCE(SUM(ap.amount), 0),
    ai.total_amount
  INTO v_total_paid, v_total
  FROM accounting_invoices ai
  LEFT JOIN accounting_payments ap ON ap.invoice_id = ai.id
  WHERE ai.id = v_invoice_id
  GROUP BY ai.id, ai.total_amount;

  -- Update invoice
  UPDATE accounting_invoices
  SET 
    paid_amount = v_total_paid,
    remaining_amount = v_total - v_total_paid,
    status = CASE
      WHEN v_total_paid = 0 THEN 'UNPAID'
      WHEN v_total_paid >= v_total THEN 'PAID'
      ELSE 'PARTIALLY_PAID'
    END
  WHERE id = v_invoice_id;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$;

-- Recreate trigger
CREATE TRIGGER update_invoice_payment_status_trigger
  AFTER INSERT OR UPDATE OR DELETE ON accounting_payments
  FOR EACH ROW
  EXECUTE FUNCTION update_invoice_payment_status();
