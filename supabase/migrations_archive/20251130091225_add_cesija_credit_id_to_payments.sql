/*
  # Add cesija_credit_id to accounting_payments

  1. Changes
    - Add `cesija_credit_id` column to accounting_payments table
    - This allows cesija payments to be made from credits, not just bank accounts
    
  2. Notes
    - Similar to cesija_bank_account_id, this tracks when a payment is made
      from another company's credit line via cesija (assignment) agreement
*/

-- Add cesija_credit_id column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'accounting_payments' AND column_name = 'cesija_credit_id'
  ) THEN
    ALTER TABLE accounting_payments 
    ADD COLUMN cesija_credit_id uuid REFERENCES company_credits(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_accounting_payments_cesija_credit_id ON accounting_payments(cesija_credit_id);