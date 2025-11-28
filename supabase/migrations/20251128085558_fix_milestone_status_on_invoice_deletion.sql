/*
  # Fix Milestone Status on Invoice/Payment Deletion

  ## Problem
  When an accounting invoice or payment is deleted, the linked milestone remains marked as 'paid'
  even though there are no payments left. This creates data inconsistency.

  ## Solution
  1. Create trigger to reset milestone status when invoice is deleted
  2. Create trigger to reset milestone status when invoice status changes from PAID to something else
  3. Create trigger to reset milestone status when payment is deleted (if no other payments exist)

  ## Changes
  - Add trigger on accounting_invoices DELETE
  - Add trigger on accounting_invoices UPDATE (when status changes from PAID)
  - Add trigger on accounting_payments DELETE
*/

-- Function to reset milestone status when invoice is deleted or unpaid
CREATE OR REPLACE FUNCTION reset_milestone_status_on_invoice_change()
RETURNS TRIGGER AS $$
DECLARE
  v_milestone_id uuid;
  v_has_other_paid_invoices boolean;
BEGIN
  -- Get milestone_id from OLD record (for DELETE and UPDATE)
  v_milestone_id := OLD.milestone_id;
  
  -- Only process if milestone_id exists
  IF v_milestone_id IS NOT NULL THEN
    -- Check if there are other PAID invoices linked to this milestone
    SELECT EXISTS (
      SELECT 1 
      FROM accounting_invoices 
      WHERE milestone_id = v_milestone_id 
        AND status = 'PAID'
        AND id != OLD.id
    ) INTO v_has_other_paid_invoices;
    
    -- If no other paid invoices exist, reset milestone to pending
    IF NOT v_has_other_paid_invoices THEN
      UPDATE subcontractor_milestones
      SET 
        status = 'pending',
        paid_date = NULL
      WHERE id = v_milestone_id;
    END IF;
  END IF;
  
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- Trigger when invoice is DELETED
DROP TRIGGER IF EXISTS trigger_reset_milestone_on_invoice_delete ON accounting_invoices;
CREATE TRIGGER trigger_reset_milestone_on_invoice_delete
AFTER DELETE ON accounting_invoices
FOR EACH ROW
WHEN (OLD.milestone_id IS NOT NULL)
EXECUTE FUNCTION reset_milestone_status_on_invoice_change();

-- Trigger when invoice status changes from PAID to something else
DROP TRIGGER IF EXISTS trigger_reset_milestone_on_invoice_unpaid ON accounting_invoices;
CREATE TRIGGER trigger_reset_milestone_on_invoice_unpaid
AFTER UPDATE OF status ON accounting_invoices
FOR EACH ROW
WHEN (OLD.milestone_id IS NOT NULL AND OLD.status = 'PAID' AND NEW.status != 'PAID')
EXECUTE FUNCTION reset_milestone_status_on_invoice_change();

-- Function to reset milestone when payment is deleted
CREATE OR REPLACE FUNCTION reset_milestone_on_payment_delete()
RETURNS TRIGGER AS $$
DECLARE
  v_milestone_id uuid;
  v_invoice_still_paid boolean;
BEGIN
  -- Get milestone_id from the invoice
  SELECT milestone_id INTO v_milestone_id
  FROM accounting_invoices
  WHERE id = OLD.invoice_id;
  
  -- Only process if milestone_id exists
  IF v_milestone_id IS NOT NULL THEN
    -- Check if invoice is still marked as PAID after this payment deletion
    SELECT status = 'PAID' INTO v_invoice_still_paid
    FROM accounting_invoices
    WHERE id = OLD.invoice_id;
    
    -- If invoice is no longer PAID, reset milestone
    IF NOT v_invoice_still_paid THEN
      -- Check if there are other PAID invoices for this milestone
      IF NOT EXISTS (
        SELECT 1 
        FROM accounting_invoices 
        WHERE milestone_id = v_milestone_id 
          AND status = 'PAID'
          AND id != OLD.invoice_id
      ) THEN
        UPDATE subcontractor_milestones
        SET 
          status = 'pending',
          paid_date = NULL
        WHERE id = v_milestone_id;
      END IF;
    END IF;
  END IF;
  
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- Trigger when payment is deleted
DROP TRIGGER IF EXISTS trigger_reset_milestone_on_payment_delete ON accounting_payments;
CREATE TRIGGER trigger_reset_milestone_on_payment_delete
AFTER DELETE ON accounting_payments
FOR EACH ROW
EXECUTE FUNCTION reset_milestone_on_payment_delete();

COMMENT ON FUNCTION reset_milestone_status_on_invoice_change() IS 'Resets milestone status to pending when invoice is deleted or unpaid';
COMMENT ON FUNCTION reset_milestone_on_payment_delete() IS 'Resets milestone status when payment is deleted and invoice becomes unpaid';
