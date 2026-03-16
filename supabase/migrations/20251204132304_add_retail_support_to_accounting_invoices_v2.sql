/*
  # Add Retail Support to Accounting Invoices

  ## Purpose
  Enable accounting_invoices to track retail project invoices separately from standard investment projects.

  ## Changes
  1. Update invoice_category check constraint to include 'RETAIL'
  2. Add retail_project_id column (reference to retail_projects)
  3. Add retail_contract_id column (reference to retail_contracts)

  ## Notes
  - Retail invoices will use invoice_category = 'RETAIL'
  - retail_project_id links to retail_projects table
  - retail_contract_id links to retail_contracts table (phases)
  - Regular investment project invoices remain unchanged
*/

-- Drop old check constraint
ALTER TABLE accounting_invoices DROP CONSTRAINT IF EXISTS accounting_invoices_invoice_category_check;

-- Add new check constraint with RETAIL
ALTER TABLE accounting_invoices ADD CONSTRAINT accounting_invoices_invoice_category_check 
  CHECK (invoice_category = ANY (ARRAY[
    'SUBCONTRACTOR'::text, 
    'OFFICE'::text, 
    'APARTMENT'::text, 
    'CUSTOMER'::text, 
    'BANK_CREDIT'::text, 
    'INVESTOR'::text, 
    'MISCELLANEOUS'::text, 
    'GENERAL'::text,
    'RETAIL'::text
  ]));

-- Add retail_project_id column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'accounting_invoices' AND column_name = 'retail_project_id'
  ) THEN
    ALTER TABLE accounting_invoices ADD COLUMN retail_project_id uuid REFERENCES retail_projects(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Add retail_contract_id column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'accounting_invoices' AND column_name = 'retail_contract_id'
  ) THEN
    ALTER TABLE accounting_invoices ADD COLUMN retail_contract_id uuid REFERENCES retail_contracts(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Add indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_accounting_invoices_retail_project ON accounting_invoices(retail_project_id);
CREATE INDEX IF NOT EXISTS idx_accounting_invoices_retail_contract ON accounting_invoices(retail_contract_id);

-- Add comments
COMMENT ON COLUMN accounting_invoices.retail_project_id IS 'Reference to retail_projects for retail invoices';
COMMENT ON COLUMN accounting_invoices.retail_contract_id IS 'Reference to retail_contracts (phases) for retail invoices';
