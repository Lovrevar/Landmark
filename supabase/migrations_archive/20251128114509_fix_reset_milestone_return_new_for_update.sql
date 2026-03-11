/*
  # Fix reset_milestone_status_on_invoice_change to Return NEW for UPDATE

  ## Problem
  The trigger `reset_milestone_status_on_invoice_change` is defined as:
  - BEFORE DELETE OR UPDATE OF status
  
  The function currently returns OLD for ALL operations, which is correct for DELETE
  but WRONG for UPDATE! When returning OLD on UPDATE, it cancels the status change!

  This is why invoice status never updates - the trigger cancels the change!

  ## Solution
  Fix the function to:
  - Return OLD for DELETE operations
  - Return NEW for UPDATE operations

  ## Safety
  - Only fixes trigger logic
  - Allows status updates to proceed
*/

CREATE OR REPLACE FUNCTION reset_milestone_status_on_invoice_change()
RETURNS TRIGGER AS $$
BEGIN
  -- Only process if this invoice had a milestone
  IF OLD.milestone_id IS NOT NULL THEN
    -- Reset milestone to pending if no other paid invoices exist for it
    UPDATE subcontractor_milestones
    SET status = 'pending',
        paid_date = NULL
    WHERE id = OLD.milestone_id
    AND NOT EXISTS (
      SELECT 1 
      FROM accounting_invoices 
      WHERE milestone_id = OLD.milestone_id 
      AND status = 'PAID'
      AND id != OLD.id
    );
  END IF;

  -- Return correct value based on operation
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    -- For UPDATE, return NEW to allow the update to proceed
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- No need to recreate trigger, function is updated
