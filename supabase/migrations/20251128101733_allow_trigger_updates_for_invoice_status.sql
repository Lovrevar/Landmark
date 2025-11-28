/*
  # Allow Trigger Functions to Update Invoice Status

  1. Problem
    - RLS policies block UPDATE from trigger functions
    - Trigger functions run as SECURITY DEFINER without auth.uid()
    - Invoice status cannot be updated even by triggers

  2. Solution
    - Modify trigger function to use SECURITY DEFINER with elevated privileges
    - Grant necessary permissions to the function owner (postgres role)
    - OR disable RLS checks within the trigger function context

  3. Changes
    - Recreate trigger function with proper RLS bypass using set_config
    - Allow the function to temporarily disable RLS for its operations
*/

-- Drop existing function
DROP FUNCTION IF EXISTS update_invoice_payment_status() CASCADE;

-- Recreate with RLS bypass capability
CREATE OR REPLACE FUNCTION update_invoice_payment_status()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_invoice_id uuid;
  v_total_paid numeric;
  v_invoice_total numeric;
  v_old_rls_setting text;
BEGIN
  -- Save current RLS setting and disable it for this function
  v_old_rls_setting := current_setting('row_security', true);
  PERFORM set_config('row_security', 'off', true);

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

  -- Update invoice status
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

  -- Restore RLS setting
  IF v_old_rls_setting IS NOT NULL THEN
    PERFORM set_config('row_security', v_old_rls_setting, true);
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    -- Restore RLS setting even on error
    IF v_old_rls_setting IS NOT NULL THEN
      PERFORM set_config('row_security', v_old_rls_setting, true);
    END IF;
    RAISE;
END;
$$;

-- Recreate trigger
DROP TRIGGER IF EXISTS update_invoice_payment_status_trigger ON accounting_payments;

CREATE TRIGGER update_invoice_payment_status_trigger
  AFTER INSERT OR UPDATE OR DELETE ON accounting_payments
  FOR EACH ROW
  EXECUTE FUNCTION update_invoice_payment_status();

-- Fix all existing invoices with payments but wrong status
DO $$
DECLARE
  v_invoice record;
  v_total_paid numeric;
BEGIN
  -- Disable RLS for this block
  PERFORM set_config('row_security', 'off', true);
  
  FOR v_invoice IN 
    SELECT DISTINCT ai.id, ai.total_amount
    FROM accounting_invoices ai
    INNER JOIN accounting_payments ap ON ap.invoice_id = ai.id
    WHERE ai.paid_amount = 0 OR ai.status = 'UNPAID'
  LOOP
    -- Calculate total paid for this invoice
    SELECT COALESCE(SUM(amount), 0)
    INTO v_total_paid
    FROM accounting_payments
    WHERE invoice_id = v_invoice.id;
    
    -- Update invoice
    UPDATE accounting_invoices
    SET 
      paid_amount = v_total_paid,
      remaining_amount = v_invoice.total_amount - v_total_paid,
      status = CASE
        WHEN v_total_paid = 0 THEN 'UNPAID'
        WHEN v_total_paid >= v_invoice.total_amount THEN 'PAID'
        ELSE 'PARTIALLY_PAID'
      END,
      updated_at = NOW()
    WHERE id = v_invoice.id;
  END LOOP;
  
  -- Re-enable RLS
  PERFORM set_config('row_security', 'on', true);
END $$;
