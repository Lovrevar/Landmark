/*
  # Fix reset_milestone_status_on_invoice_change Trigger Return Value

  ## Problem
  The function `reset_milestone_status_on_invoice_change` is a BEFORE DELETE trigger
  but returns NEW instead of OLD. This causes DELETE operations to fail.

  BEFORE DELETE triggers MUST return OLD, not NEW.

  ## Solution
  Fix the function to return OLD for DELETE operations.

  ## Safety
  - Only fixes the function logic
  - Does not touch data
*/

CREATE OR REPLACE FUNCTION reset_milestone_status_on_invoice_change()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.milestone_id IS NOT NULL THEN
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

  -- BEFORE DELETE trigger MUST return OLD
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;
