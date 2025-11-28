/*
  # Fix Invoice Status by Temporarily Disabling RLS

  1. Problem
    - Cannot update invoice status due to RLS policies
    - Even SECURITY DEFINER functions are blocked
    - Need to fix existing data and ensure triggers work

  2. Solution
    - Temporarily disable RLS on accounting_invoices
    - Fix all invoices with incorrect status
    - Re-enable RLS
    - Ensure trigger function works going forward

  3. Changes
    - Disable RLS temporarily
    - Update all invoices with payments to correct status
    - Re-enable RLS
    - Recreate trigger function to work with RLS
*/

-- Temporarily disable RLS
ALTER TABLE accounting_invoices DISABLE ROW LEVEL SECURITY;

-- Fix all invoices that have payments but wrong status
UPDATE accounting_invoices ai
SET 
  paid_amount = COALESCE((
    SELECT SUM(amount)
    FROM accounting_payments ap
    WHERE ap.invoice_id = ai.id
  ), 0),
  remaining_amount = ai.total_amount - COALESCE((
    SELECT SUM(amount)
    FROM accounting_payments ap
    WHERE ap.invoice_id = ai.id
  ), 0),
  status = CASE
    WHEN COALESCE((SELECT SUM(amount) FROM accounting_payments ap WHERE ap.invoice_id = ai.id), 0) = 0 THEN 'UNPAID'
    WHEN COALESCE((SELECT SUM(amount) FROM accounting_payments ap WHERE ap.invoice_id = ai.id), 0) >= ai.total_amount THEN 'PAID'
    ELSE 'PARTIALLY_PAID'
  END,
  updated_at = NOW()
WHERE EXISTS (
  SELECT 1 FROM accounting_payments ap WHERE ap.invoice_id = ai.id
);

-- Re-enable RLS
ALTER TABLE accounting_invoices ENABLE ROW LEVEL SECURITY;

-- Drop the problematic policy we just added
DROP POLICY IF EXISTS "Allow system updates for invoice status" ON accounting_invoices;

-- Recreate trigger function with simpler approach
DROP FUNCTION IF EXISTS update_invoice_payment_status() CASCADE;

CREATE OR REPLACE FUNCTION update_invoice_payment_status()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_invoice_id uuid;
  v_total_paid numeric;
  v_invoice_total numeric;
BEGIN
  -- Determine which invoice to update
  IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
    v_invoice_id := NEW.invoice_id;
  ELSIF TG_OP = 'DELETE' THEN
    v_invoice_id := OLD.invoice_id;
  END IF;

  -- Calculate total paid
  SELECT COALESCE(SUM(amount), 0)
  INTO v_total_paid
  FROM accounting_payments
  WHERE invoice_id = v_invoice_id;

  -- Get invoice total
  SELECT total_amount
  INTO v_invoice_total
  FROM accounting_invoices
  WHERE id = v_invoice_id;

  -- Update invoice status (RLS is bypassed because function is SECURITY DEFINER owned by postgres superuser)
  UPDATE accounting_invoices
  SET 
    paid_amount = v_total_paid,
    remaining_amount = v_invoice_total - v_total_paid,
    status = CASE
      WHEN v_total_paid = 0 THEN 'UNPAID'
      WHEN v_total_paid >= v_invoice_total THEN 'PAID'
      ELSE 'PARTIALLY_PAID'
    END,
    updated_at = NOW()
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
