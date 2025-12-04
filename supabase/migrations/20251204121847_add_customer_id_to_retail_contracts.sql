/*
  # Add Customer ID to Retail Contracts for Sales Phase

  ## Purpose
  Enable retail_contracts to link to customers for Phase 3 (Sales).
  Phase 1 (Acquisition) and Phase 2 (Development) use supplier_id.
  Phase 3 (Sales) uses customer_id.

  ## Changes
  1. Add customer_id column to retail_contracts
  2. Make supplier_id nullable
  3. Add foreign key constraint for customer_id
  4. Add check constraint to ensure either supplier_id OR customer_id is set

  ## Security
  - RLS policies remain the same (inherited from contract policies)
*/

-- Make supplier_id nullable
ALTER TABLE retail_contracts 
  ALTER COLUMN supplier_id DROP NOT NULL;

-- Add customer_id column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'retail_contracts' AND column_name = 'customer_id'
  ) THEN
    ALTER TABLE retail_contracts ADD COLUMN customer_id uuid REFERENCES retail_customers(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Add check constraint to ensure either supplier_id OR customer_id is set (but not both)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'retail_contracts_supplier_or_customer_check'
  ) THEN
    ALTER TABLE retail_contracts 
      ADD CONSTRAINT retail_contracts_supplier_or_customer_check 
      CHECK (
        (supplier_id IS NOT NULL AND customer_id IS NULL) OR
        (supplier_id IS NULL AND customer_id IS NOT NULL)
      );
  END IF;
END $$;

-- Create index for customer_id
CREATE INDEX IF NOT EXISTS idx_retail_contracts_customer_id 
  ON retail_contracts(customer_id);

-- Add comment
COMMENT ON COLUMN retail_contracts.customer_id IS 'Customer ID for sales phase contracts (Phase 3)';
