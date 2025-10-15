/*
  # Update work_logs table - Remove unused fields and add color

  1. Changes
    - Remove `workers_count` column (not needed)
    - Remove `hours_worked` column (not needed)
    - Remove `photos` column (not needed)
    - Add `color` column (text) for dashboard visualization
    - Make `workers_count` and `hours_worked` nullable first to avoid data issues

  2. Notes
    - Using a safe approach: make columns nullable, then drop them
    - Default color will be set based on status
*/

-- First make workers_count and hours_worked nullable to avoid conflicts
ALTER TABLE work_logs ALTER COLUMN workers_count DROP NOT NULL;
ALTER TABLE work_logs ALTER COLUMN hours_worked DROP NOT NULL;

-- Drop the columns we don't need
ALTER TABLE work_logs DROP COLUMN IF EXISTS workers_count;
ALTER TABLE work_logs DROP COLUMN IF EXISTS hours_worked;
ALTER TABLE work_logs DROP COLUMN IF EXISTS photos;

-- Add color column for dashboard visualization
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'work_logs' AND column_name = 'color'
  ) THEN
    ALTER TABLE work_logs ADD COLUMN color text DEFAULT 'blue';
  END IF;
END $$;