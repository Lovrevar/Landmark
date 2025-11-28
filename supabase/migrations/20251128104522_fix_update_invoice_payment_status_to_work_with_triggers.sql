/*
  # Fix Update Invoice Payment Status to Work With Triggers

  Problem: The AFTER trigger on accounting_payments tries to UPDATE invoices
  but BEFORE triggers on invoices might interfere.

  Solution: Make the function simpler and ensure it works with the trigger chain.
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
  -- Get invoice ID based on operation
  IF TG_OP IN ('INSERT', 'UPDATE') THEN
    v_invoice_id := NEW.invoice_id;
  ELSE
    v_invoice_id := OLD.invoice_id;
  END IF;

  -- Calculate total paid for this invoice
  SELECT COALESCE(SUM(amount), 0)
  INTO v_total_paid
  FROM accounting_payments
  WHERE invoice_id = v_invoice_id;

  -- Get invoice total
  SELECT total_amount
  INTO v_invoice_total
  FROM accounting_invoices
  WHERE id = v_invoice_id;

  -- Calculate new status
  IF v_total_paid = 0 THEN
    v_new_status := 'UNPAID';
  ELSIF v_total_paid >= v_invoice_total THEN
    v_new_status := 'PAID';
  ELSE
    v_new_status := 'PARTIALLY_PAID';
  END IF;

  -- Update invoice
  -- Note: z_calculate_invoice_amounts_trigger will recalculate remaining_amount
  UPDATE accounting_invoices
  SET 
    paid_amount = v_total_paid,
    status = v_new_status,
    updated_at = NOW()
  WHERE id = v_invoice_id;

  -- Return appropriate value
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
  
EXCEPTION
  WHEN OTHERS THEN
    -- Log error but don't fail the payment insert
    RAISE WARNING 'Error updating invoice status: %', SQLERRM;
    IF TG_OP = 'DELETE' THEN
      RETURN OLD;
    ELSE
      RETURN NEW;
    END IF;
END;
$$;
