/*
  # Add completed_at field to subcontractors

  1. Changes
    - Add `completed_at` (timestamptz) column to track when subcontractor completes work
    - This allows tracking when progress reaches 100% for weekly completion reports

  2. Notes
    - Field is nullable as existing subcontractors won't have this data
    - Should be set when progress is updated to 100
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'subcontractors' AND column_name = 'completed_at'
  ) THEN
    ALTER TABLE subcontractors ADD COLUMN completed_at timestamptz;
  END IF;
END $$;