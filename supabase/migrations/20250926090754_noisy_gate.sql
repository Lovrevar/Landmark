/*
  # Add credit seniority to investments and bank credits

  1. New Columns
    - `project_investments.credit_seniority` (text, default 'senior')
    - `bank_credits.credit_seniority` (text, default 'senior')
  
  2. Constraints
    - Check constraints to ensure only 'junior' or 'senior' values are allowed
*/

-- Add credit_seniority to project_investments table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'project_investments' AND column_name = 'credit_seniority'
  ) THEN
    ALTER TABLE project_investments ADD COLUMN credit_seniority text DEFAULT 'senior';
  END IF;
END $$;

-- Add credit_seniority to bank_credits table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'bank_credits' AND column_name = 'credit_seniority'
  ) THEN
    ALTER TABLE bank_credits ADD COLUMN credit_seniority text DEFAULT 'senior';
  END IF;
END $$;

-- Add check constraints
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.check_constraints
    WHERE constraint_name = 'project_investments_credit_seniority_check'
  ) THEN
    ALTER TABLE project_investments ADD CONSTRAINT project_investments_credit_seniority_check 
    CHECK (credit_seniority = ANY (ARRAY['junior'::text, 'senior'::text]));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.check_constraints
    WHERE constraint_name = 'bank_credits_credit_seniority_check'
  ) THEN
    ALTER TABLE bank_credits ADD CONSTRAINT bank_credits_credit_seniority_check 
    CHECK (credit_seniority = ANY (ARRAY['junior'::text, 'senior'::text]));
  END IF;
END $$;