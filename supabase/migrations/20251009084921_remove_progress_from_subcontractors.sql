/*
  # Remove Progress Field from Subcontractors

  1. Changes
    - Remove the `progress` column from subcontractors table
    - Progress tracking is no longer needed as we track actual payments via budget_realized
    - Financial tracking is now based on contract cost vs realized cost

  2. Notes
    - This is a safe operation as progress was only used for UI display
    - All payment tracking now uses budget_realized field
*/

-- Remove progress column from subcontractors table
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'subcontractors' AND column_name = 'progress'
  ) THEN
    ALTER TABLE subcontractors DROP COLUMN progress;
  END IF;
END $$;