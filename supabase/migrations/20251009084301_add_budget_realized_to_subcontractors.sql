/*
  # Add Budget Realized to Subcontractors

  1. Changes
    - Add `budget_realized` column to track actual costs paid to subcontractors
    - The `cost` column represents the contracted amount
    - The `budget_realized` column represents the actual amount paid/realized
    - The difference between these two shows cost overruns or savings

  2. Details
    - `budget_realized` (numeric) - Actual amount paid to the subcontractor
    - Default value is 0
    - NOT NULL constraint to ensure data consistency
*/

-- Add budget_realized column to subcontractors table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'subcontractors' AND column_name = 'budget_realized'
  ) THEN
    ALTER TABLE subcontractors ADD COLUMN budget_realized numeric(15,2) NOT NULL DEFAULT 0;
  END IF;
END $$;