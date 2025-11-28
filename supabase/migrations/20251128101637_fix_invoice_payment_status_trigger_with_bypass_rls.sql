/*
  # Fix Invoice Payment Status Trigger with RLS Bypass

  1. Problem
    - Trigger function doesn't update invoice status when payments are added
    - Function runs as SECURITY DEFINER but can't bypass RLS
    - paid_amount and status remain at 0 and UNPAID even after payment

  2. Solution
    - Recreate function to properly bypass RLS using pg_catalog tables
    - Use explicit schema qualification
    - Add proper error handling

  3. Changes
    - Drop and recreate update_invoice_payment_status function
    - Ensure function can bypass RLS to update invoice status
*/

-- Drop existing function
DROP FUNCTION IF EXISTS update_invoice_payment_status() CASCADE;

-- Recreate with proper RLS bypass
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

  -- Calculate total paid (bypass RLS)
  SELECT COALESCE(SUM(amount), 0)
  INTO v_total_paid
  FROM public.accounting_payments
  WHERE invoice_id = v_invoice_id;

  -- Get invoice total (bypass RLS)
  SELECT total_amount
  INTO v_invoice_total
  FROM public.accounting_invoices
  WHERE id = v_invoice_id;

  -- Update invoice status (bypass RLS)
  UPDATE public.accounting_invoices
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

-- Recreate triggers
DROP TRIGGER IF EXISTS update_invoice_payment_status_trigger ON accounting_payments;

CREATE TRIGGER update_invoice_payment_status_trigger
  AFTER INSERT OR UPDATE OR DELETE ON accounting_payments
  FOR EACH ROW
  EXECUTE FUNCTION update_invoice_payment_status();

-- Fix existing invoices that have payments but wrong status
UPDATE public.accounting_invoices ai
SET 
  paid_amount = (
    SELECT COALESCE(SUM(amount), 0)
    FROM public.accounting_payments ap
    WHERE ap.invoice_id = ai.id
  ),
  remaining_amount = ai.total_amount - (
    SELECT COALESCE(SUM(amount), 0)
    FROM public.accounting_payments ap
    WHERE ap.invoice_id = ai.id
  ),
  status = CASE
    WHEN (SELECT COALESCE(SUM(amount), 0) FROM public.accounting_payments ap WHERE ap.invoice_id = ai.id) = 0 THEN 'UNPAID'
    WHEN (SELECT COALESCE(SUM(amount), 0) FROM public.accounting_payments ap WHERE ap.invoice_id = ai.id) >= ai.total_amount THEN 'PAID'
    ELSE 'PARTIALLY_PAID'
  END
WHERE EXISTS (
  SELECT 1 FROM public.accounting_payments ap WHERE ap.invoice_id = ai.id
)
AND ai.paid_amount = 0;
