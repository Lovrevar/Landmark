/*
  # Add Retail Supplier and Customer References to Accounting Invoices

  ## Purpose
  Allow accounting_invoices to reference retail_suppliers and retail_customers
  separately from regular subcontractors and customers.

  ## Changes
  1. Add retail_supplier_id column (references retail_suppliers)
  2. Add retail_customer_id column (references retail_customers)
  3. Add indexes for performance

  ## Notes
  - Retail invoices use retail_supplier_id/retail_customer_id
  - Regular invoices continue using supplier_id/customer_id
  - Both sets can coexist in the same table
*/

-- Add retail_supplier_id column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'accounting_invoices' AND column_name = 'retail_supplier_id'
  ) THEN
    ALTER TABLE accounting_invoices 
    ADD COLUMN retail_supplier_id uuid REFERENCES retail_suppliers(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Add retail_customer_id column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'accounting_invoices' AND column_name = 'retail_customer_id'
  ) THEN
    ALTER TABLE accounting_invoices 
    ADD COLUMN retail_customer_id uuid REFERENCES retail_customers(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Add indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_accounting_invoices_retail_supplier ON accounting_invoices(retail_supplier_id);
CREATE INDEX IF NOT EXISTS idx_accounting_invoices_retail_customer ON accounting_invoices(retail_customer_id);

-- Add comments
COMMENT ON COLUMN accounting_invoices.retail_supplier_id IS 'Reference to retail_suppliers for retail project invoices';
COMMENT ON COLUMN accounting_invoices.retail_customer_id IS 'Reference to retail_customers for retail project invoices';
