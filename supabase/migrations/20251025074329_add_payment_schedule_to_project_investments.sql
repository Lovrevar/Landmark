/*
  # Add payment_schedule column to project_investments table

  ## Summary
  This migration adds the missing `payment_schedule` column to the `project_investments` table
  which is required for editing investments in the Funding/Investors management section.

  ## Changes Made
  - Add `payment_schedule` column to `project_investments` table
    - Type: text (to allow 'monthly' or 'yearly' values)
    - Default: 'yearly'
    - This field tracks whether the investment returns are paid monthly or yearly

  ## Notes
  - This is a safe migration that only adds a new column with a default value
  - Existing data will not be affected, all existing records will default to 'yearly'
*/

-- Add payment_schedule column to project_investments table if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'project_investments' AND column_name = 'payment_schedule'
  ) THEN
    ALTER TABLE project_investments 
    ADD COLUMN payment_schedule text DEFAULT 'yearly';
  END IF;
END $$;