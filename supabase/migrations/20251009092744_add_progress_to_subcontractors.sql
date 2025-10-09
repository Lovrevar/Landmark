/*
  # Add Progress Field to Subcontractors

  1. Changes
    - Add `progress` column to subcontractors table as numeric (0-100)
    - Progress is independent of payment status
    - Default value is 0
    - Progress indicates work completion status, not payment status

  2. Notes
    - Progress can be 100% while budget_realized is 0 (work done, not paid)
    - This allows tracking work completion separately from financial transactions
*/

-- Add progress column to subcontractors table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'subcontractors' AND column_name = 'progress'
  ) THEN
    ALTER TABLE subcontractors ADD COLUMN progress numeric DEFAULT 0 NOT NULL;
  END IF;
END $$;
