/*
  # Fix Milestone Status Without Payments
  
  This migration fixes milestone statuses that are marked as "paid" but have no
  corresponding wire_payment records.
  
  ## Changes
  
  1. Reset milestone status to 'completed' where status is 'paid' but no payment exists
  2. Clear paid_date for these milestones
  3. Create a trigger to automatically handle this in the future
  
  ## Business Logic
  
  - If a milestone is marked as 'paid' but has no wire_payment with matching milestone_id,
    it should be reset to 'completed' (or 'pending' if never completed)
  - This ensures data consistency between milestones and payments
*/

-- First, fix existing data - reset milestones marked as paid without actual payments
UPDATE subcontractor_milestones
SET 
  status = 'completed',
  paid_date = NULL
WHERE status = 'paid'
  AND id NOT IN (
    SELECT DISTINCT milestone_id 
    FROM wire_payments 
    WHERE milestone_id IS NOT NULL
  );

-- Create a function to validate milestone status
CREATE OR REPLACE FUNCTION validate_milestone_payment_status()
RETURNS TRIGGER AS $$
BEGIN
  -- If a wire_payment with this milestone_id is being deleted,
  -- check if there are any other payments for this milestone
  IF TG_OP = 'DELETE' AND OLD.milestone_id IS NOT NULL THEN
    -- Check if there are any other payments for this milestone
    IF NOT EXISTS (
      SELECT 1 FROM wire_payments 
      WHERE milestone_id = OLD.milestone_id 
      AND id != OLD.id
    ) THEN
      -- No other payments exist, reset milestone to completed
      UPDATE subcontractor_milestones
      SET status = 'completed', paid_date = NULL
      WHERE id = OLD.milestone_id;
    END IF;
  END IF;
  
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update milestone status when payment is deleted
DROP TRIGGER IF EXISTS trigger_validate_milestone_on_payment_delete ON wire_payments;
CREATE TRIGGER trigger_validate_milestone_on_payment_delete
  BEFORE DELETE ON wire_payments
  FOR EACH ROW
  EXECUTE FUNCTION validate_milestone_payment_status();

-- Add comment
COMMENT ON FUNCTION validate_milestone_payment_status() IS 
  'Automatically resets milestone status to completed when associated payment is deleted';
