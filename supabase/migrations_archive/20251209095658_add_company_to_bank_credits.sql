/*
  # Add Company to Bank Credits

  1. Changes
    - Add `company_id` column to `bank_credits` table
    - Link bank credits to accounting companies
    - Allow NULL for backwards compatibility with existing records

  2. Security
    - No changes to RLS policies needed
*/

-- Add company_id to bank_credits table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'bank_credits' AND column_name = 'company_id'
  ) THEN
    ALTER TABLE bank_credits ADD COLUMN company_id uuid REFERENCES accounting_companies(id) ON DELETE SET NULL;
    CREATE INDEX IF NOT EXISTS idx_bank_credits_company_id ON bank_credits(company_id);
  END IF;
END $$;