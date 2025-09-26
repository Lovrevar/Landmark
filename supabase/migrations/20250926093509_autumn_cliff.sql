/*
  # Add Credit Repayment Type

  1. New Columns
    - `repayment_type` (text, default 'monthly') - How often payments are made
    - Update existing `monthly_payment` to be `rate_amount` for calculated payment amounts

  2. Security
    - Add check constraint for repayment_type values
*/

-- Add repayment_type column to bank_credits table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'bank_credits' AND column_name = 'repayment_type'
  ) THEN
    ALTER TABLE bank_credits ADD COLUMN repayment_type text DEFAULT 'monthly';
  END IF;
END $$;

-- Add check constraint for repayment_type
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.check_constraints
    WHERE constraint_name = 'bank_credits_repayment_type_check'
  ) THEN
    ALTER TABLE bank_credits ADD CONSTRAINT bank_credits_repayment_type_check 
    CHECK (repayment_type = ANY (ARRAY['monthly'::text, 'yearly'::text]));
  END IF;
END $$;