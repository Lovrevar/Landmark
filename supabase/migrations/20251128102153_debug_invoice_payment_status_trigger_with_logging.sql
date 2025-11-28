/*
  # Debug Invoice Payment Status Trigger with Logging

  1. Add logging to see if trigger actually executes
  2. Check for any errors that might be silently failing
  3. Ensure proper error handling and reporting
*/

CREATE OR REPLACE FUNCTION update_invoice_payment_status()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_invoice_id uuid;
  v_total_paid numeric;
  v_invoice_total numeric;
  v_new_status text;
BEGIN
  RAISE NOTICE 'Trigger started: TG_OP=%', TG_OP;
  
  -- Determine which invoice to update
  IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
    v_invoice_id := NEW.invoice_id;
    RAISE NOTICE 'Processing invoice_id: %', v_invoice_id;
  ELSIF TG_OP = 'DELETE' THEN
    v_invoice_id := OLD.invoice_id;
    RAISE NOTICE 'Processing invoice_id (DELETE): %', v_invoice_id;
  END IF;

  -- Calculate total paid
  SELECT COALESCE(SUM(amount), 0)
  INTO v_total_paid
  FROM accounting_payments
  WHERE invoice_id = v_invoice_id;
  
  RAISE NOTICE 'Total paid calculated: %', v_total_paid;

  -- Get invoice total
  SELECT total_amount
  INTO v_invoice_total
  FROM accounting_invoices
  WHERE id = v_invoice_id;
  
  RAISE NOTICE 'Invoice total: %', v_invoice_total;
  
  -- Calculate new status
  v_new_status := CASE
    WHEN v_total_paid = 0 THEN 'UNPAID'
    WHEN v_total_paid >= v_invoice_total THEN 'PAID'
    ELSE 'PARTIALLY_PAID'
  END;
  
  RAISE NOTICE 'New status should be: %', v_new_status;

  -- Update invoice status
  UPDATE accounting_invoices
  SET 
    paid_amount = v_total_paid,
    remaining_amount = v_invoice_total - v_total_paid,
    status = v_new_status,
    updated_at = NOW()
  WHERE id = v_invoice_id;
  
  RAISE NOTICE 'UPDATE executed for invoice_id: %', v_invoice_id;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'ERROR in trigger: % %', SQLERRM, SQLSTATE;
    RAISE;
END;
$$;
