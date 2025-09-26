/*
  # Add Usage Expiration Date and Grace Period fields

  1. New Columns for bank_credits table
    - `usage_expiration_date` (date) - When the credit facility expires
    - `grace_period` (integer) - Grace period in days

  2. New Columns for project_investments table  
    - `usage_expiration_date` (date) - When the investment expires
    - `grace_period` (integer) - Grace period in days

  3. Security
    - No RLS changes needed as existing policies cover new columns
*/

-- Add fields to bank_credits table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'bank_credits' AND column_name = 'usage_expiration_date'
  ) THEN
    ALTER TABLE bank_credits ADD COLUMN usage_expiration_date date;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'bank_credits' AND column_name = 'grace_period'
  ) THEN
    ALTER TABLE bank_credits ADD COLUMN grace_period integer DEFAULT 0;
  END IF;
END $$;

-- Add fields to project_investments table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'project_investments' AND column_name = 'usage_expiration_date'
  ) THEN
    ALTER TABLE project_investments ADD COLUMN usage_expiration_date date;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'project_investments' AND column_name = 'grace_period'
  ) THEN
    ALTER TABLE project_investments ADD COLUMN grace_period integer DEFAULT 0;
  END IF;
END $$;