/*
  # Add Contract Reference to Accounting Invoices

  1. Changes
    - Add `contract_id` column to `accounting_invoices` table to link invoices directly to contracts
    - This enables tracking which specific subcontractor contract an invoice belongs to
    
  2. Why This is Needed
    - A subcontractor can have multiple contracts across different projects/phases
    - When creating an invoice/payment, we need to know which specific contract it's for
    - Enables cascading dropdowns: Supplier → Projects → Contracts
    
  3. Migration Details
    - Add nullable `contract_id` UUID column
    - Add foreign key constraint to `contracts` table
    - Create index for better query performance
*/

-- Add contract_id column to accounting_invoices
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'accounting_invoices' AND column_name = 'contract_id'
  ) THEN
    ALTER TABLE accounting_invoices 
    ADD COLUMN contract_id uuid REFERENCES contracts(id) ON DELETE SET NULL;
    
    CREATE INDEX IF NOT EXISTS idx_accounting_invoices_contract_id 
    ON accounting_invoices(contract_id);
  END IF;
END $$;
