/*
  # Add Credit Allocation to Payments

  1. Changes
    - Add `credit_allocation_id` to `accounting_payments` table
    - Add `cesija_credit_allocation_id` to `accounting_payments` table
    - Add foreign key constraints to `credit_allocations` table
    
  2. Purpose
    - Track which credit allocation is used when paying invoices with credits
    - Support cesija payments from credit allocations
*/

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'accounting_payments' AND column_name = 'credit_allocation_id'
  ) THEN
    ALTER TABLE accounting_payments 
    ADD COLUMN credit_allocation_id uuid REFERENCES credit_allocations(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'accounting_payments' AND column_name = 'cesija_credit_allocation_id'
  ) THEN
    ALTER TABLE accounting_payments 
    ADD COLUMN cesija_credit_allocation_id uuid REFERENCES credit_allocations(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_accounting_payments_credit_allocation_id ON accounting_payments(credit_allocation_id);
CREATE INDEX IF NOT EXISTS idx_accounting_payments_cesija_credit_allocation_id ON accounting_payments(cesija_credit_allocation_id);
