/*
  # Fix Calculate Invoice Amounts to Handle Remaining Amount Properly

  1. Problem
    - Check constraint requires: remaining_amount = (total_amount - paid_amount)
    - BEFORE UPDATE trigger must ensure this constraint is satisfied
    - Currently trigger doesn't update remaining_amount when paid_amount changes

  2. Solution
    - Always ensure remaining_amount = total_amount - paid_amount
    - This satisfies the check constraint
    - Let AFTER trigger handle status updates

  3. Changes
    - Fix calculate_invoice_amounts to always maintain the constraint
*/

CREATE OR REPLACE FUNCTION calculate_invoice_amounts()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  -- Always calculate VAT and total
  NEW.vat_amount := NEW.base_amount * (NEW.vat_rate / 100);
  NEW.total_amount := NEW.base_amount + NEW.vat_amount;
  
  -- CRITICAL: Always ensure remaining_amount = total_amount - paid_amount
  -- This is required by check constraint
  NEW.remaining_amount := NEW.total_amount - COALESCE(NEW.paid_amount, 0);
  
  -- Only initialize payment fields on INSERT
  IF TG_OP = 'INSERT' THEN
    NEW.paid_amount := COALESCE(NEW.paid_amount, 0);
    NEW.status := COALESCE(NEW.status, 'UNPAID');
  END IF;
  
  RETURN NEW;
END;
$$;

-- Now fix the payment status trigger to work with this
CREATE OR REPLACE FUNCTION update_invoice_payment_status()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_invoice_id uuid;
  v_total_paid numeric;
  v_total numeric;
  v_new_status text;
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

  -- Calculate new status
  v_new_status := CASE
    WHEN v_total_paid = 0 THEN 'UNPAID'
    WHEN v_total_paid >= v_total THEN 'PAID'
    ELSE 'PARTIALLY_PAID'
  END;

  -- Update invoice (BEFORE trigger will handle remaining_amount)
  UPDATE accounting_invoices
  SET 
    paid_amount = v_total_paid,
    status = v_new_status
  WHERE id = v_invoice_id;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$;

-- Manually fix all existing invoices with wrong status
UPDATE accounting_invoices ai
SET 
  paid_amount = COALESCE((SELECT SUM(amount) FROM accounting_payments WHERE invoice_id = ai.id), 0),
  status = CASE
    WHEN COALESCE((SELECT SUM(amount) FROM accounting_payments WHERE invoice_id = ai.id), 0) = 0 THEN 'UNPAID'
    WHEN COALESCE((SELECT SUM(amount) FROM accounting_payments WHERE invoice_id = ai.id), 0) >= ai.total_amount THEN 'PAID'
    ELSE 'PARTIALLY_PAID'
  END
WHERE EXISTS (SELECT 1 FROM accounting_payments WHERE invoice_id = ai.id);
