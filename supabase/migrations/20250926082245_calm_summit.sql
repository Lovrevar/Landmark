/*
  # Add mortgages and notes fields to project investments

  1. New Columns
    - `mortgages_insurance` (numeric) - Amount of mortgages/insurance put out to secure investment
    - `notes` (text) - Additional notes about the investment

  2. Changes
    - Add mortgages_insurance column with default 0
    - Add notes column with default empty string
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'project_investments' AND column_name = 'mortgages_insurance'
  ) THEN
    ALTER TABLE project_investments ADD COLUMN mortgages_insurance numeric(15,2) DEFAULT 0;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'project_investments' AND column_name = 'notes'
  ) THEN
    ALTER TABLE project_investments ADD COLUMN notes text DEFAULT '';
  END IF;
END $$;