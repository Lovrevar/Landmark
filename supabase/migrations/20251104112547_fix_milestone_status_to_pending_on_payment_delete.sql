/*
  # Fix Milestone Status to Pending on Payment Delete
  
  This migration updates the trigger logic to set milestone status to 'pending'
  instead of 'completed' when a payment is deleted.
  
  ## Changes
  
  1. Update existing milestones that should be 'pending' instead of 'completed'
  2. Modify the trigger function to set status to 'pending' when payment is deleted
  
  ## Business Logic
  
  - When a payment linked to a milestone is deleted, the milestone should revert to 'pending'
  - This makes sense because if the payment is deleted, the milestone is no longer paid
    and should be treated as if it hasn't been paid yet (pending payment)
*/

-- Update the trigger function to set status to 'pending' instead of 'completed'
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
      -- No other payments exist, reset milestone to pending
      UPDATE subcontractor_milestones
      SET status = 'pending', paid_date = NULL
      WHERE id = OLD.milestone_id;
    END IF;
  END IF;
  
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- Update existing milestones that are 'completed' but have no payments to 'pending'
-- (These should be pending since they're not paid)
UPDATE subcontractor_milestones
SET status = 'pending'
WHERE status = 'completed'
  AND id NOT IN (
    SELECT DISTINCT milestone_id 
    FROM wire_payments 
    WHERE milestone_id IS NOT NULL
  )
  AND completed_date IS NULL;

-- Update comment
COMMENT ON FUNCTION validate_milestone_payment_status() IS 
  'Automatically resets milestone status to pending when associated payment is deleted';
