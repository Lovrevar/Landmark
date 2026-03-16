/*
  # Create Office Suppliers and Office Invoices System
  
  This migration creates a complete system for managing office expenses (salaries, 
  car leasing, rent, utilities, etc.) separate from project-related expenses.
  
  ## New Tables
  
  ### 1. office_suppliers
    - `id` (uuid, primary key)
    - `name` (text) - supplier name
    - `contact` (text) - contact person or phone
    - `email` (text) - email address
    - `address` (text) - physical address
    - `tax_id` (text) - PIB/tax identification number
    - `vat_id` (text) - VAT number
    - `created_at` (timestamptz)
  
  ## Changes to Existing Tables
  
  ### accounting_invoices
    - Add `office_supplier_id` (uuid) - foreign key to office_suppliers
    - Add `invoice_category` (text) - categorize invoices (SUBCONTRACTOR, OFFICE, CUSTOMER, etc.)
    - Update CHECK constraints to allow office invoices without supplier_id
    - Add new invoice_type: 'INCOMING_OFFICE'
  
  ## Security
  
  - RLS enabled on office_suppliers table
  - Only Director and Accounting roles can access office suppliers
  - Office invoices follow same RLS rules as other accounting invoices
  
  ## Notes
  
  - Office invoices are NOT linked to projects, phases, or contracts
  - Office invoices use the same payment system (accounting_payments)
  - Office invoices use base_amount (without VAT) for all calculations
*/

-- ============ STEP 1: Create office_suppliers table ============

CREATE TABLE IF NOT EXISTS office_suppliers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  contact text,
  email text,
  address text,
  tax_id text,
  vat_id text,
  created_at timestamptz DEFAULT now()
);

-- Create index for faster searches
CREATE INDEX IF NOT EXISTS idx_office_suppliers_name ON office_suppliers(name);

-- ============ STEP 2: Add new columns to accounting_invoices ============

-- Add office_supplier_id column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'accounting_invoices' AND column_name = 'office_supplier_id'
  ) THEN
    ALTER TABLE accounting_invoices ADD COLUMN office_supplier_id uuid REFERENCES office_suppliers(id) ON DELETE RESTRICT;
  END IF;
END $$;

-- Add invoice_category column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'accounting_invoices' AND column_name = 'invoice_category'
  ) THEN
    ALTER TABLE accounting_invoices ADD COLUMN invoice_category text DEFAULT 'GENERAL';
  END IF;
END $$;

-- Create index for office_supplier_id
CREATE INDEX IF NOT EXISTS idx_accounting_invoices_office_supplier ON accounting_invoices(office_supplier_id);
CREATE INDEX IF NOT EXISTS idx_accounting_invoices_invoice_category ON accounting_invoices(invoice_category);

-- ============ STEP 3: Update CHECK constraints ============

-- Drop old constraint if exists
ALTER TABLE accounting_invoices DROP CONSTRAINT IF EXISTS check_supplier_or_customer;
ALTER TABLE accounting_invoices DROP CONSTRAINT IF EXISTS check_entity_type;

-- Update invoice_type constraint to include INCOMING_OFFICE
ALTER TABLE accounting_invoices DROP CONSTRAINT IF EXISTS accounting_invoices_invoice_type_check;
ALTER TABLE accounting_invoices ADD CONSTRAINT accounting_invoices_invoice_type_check 
  CHECK (invoice_type IN ('INCOMING_SUPPLIER', 'INCOMING_INVESTMENT', 'OUTGOING_SUPPLIER', 'OUTGOING_SALES', 'INCOMING_OFFICE'));

-- Add new constraint that handles all invoice types including office
ALTER TABLE accounting_invoices ADD CONSTRAINT check_invoice_entity_type CHECK (
  (invoice_type = 'INCOMING_SUPPLIER' AND supplier_id IS NOT NULL AND customer_id IS NULL AND office_supplier_id IS NULL AND investor_id IS NULL AND bank_id IS NULL) OR
  (invoice_type = 'OUTGOING_SUPPLIER' AND supplier_id IS NOT NULL AND customer_id IS NULL AND office_supplier_id IS NULL AND investor_id IS NULL AND bank_id IS NULL) OR
  (invoice_type = 'OUTGOING_SALES' AND customer_id IS NOT NULL AND supplier_id IS NULL AND office_supplier_id IS NULL AND investor_id IS NULL AND bank_id IS NULL) OR
  (invoice_type = 'INCOMING_INVESTMENT' AND (investor_id IS NOT NULL OR bank_id IS NOT NULL) AND supplier_id IS NULL AND customer_id IS NULL AND office_supplier_id IS NULL) OR
  (invoice_type = 'INCOMING_OFFICE' AND office_supplier_id IS NOT NULL AND supplier_id IS NULL AND customer_id IS NULL AND investor_id IS NULL AND bank_id IS NULL)
);

-- ============ STEP 4: RLS Policies for office_suppliers ============

ALTER TABLE office_suppliers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Director and Accounting can view all office suppliers"
  ON office_suppliers FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.auth_user_id = auth.uid()
      AND users.role IN ('Director', 'Accounting')
    )
  );

CREATE POLICY "Director and Accounting can insert office suppliers"
  ON office_suppliers FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.auth_user_id = auth.uid()
      AND users.role IN ('Director', 'Accounting')
    )
  );

CREATE POLICY "Director and Accounting can update office suppliers"
  ON office_suppliers FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.auth_user_id = auth.uid()
      AND users.role IN ('Director', 'Accounting')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.auth_user_id = auth.uid()
      AND users.role IN ('Director', 'Accounting')
    )
  );

CREATE POLICY "Director can delete office suppliers"
  ON office_suppliers FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.auth_user_id = auth.uid()
      AND users.role = 'Director'
    )
  );

-- ============ STEP 5: Update trigger to handle invoice_category ============

CREATE OR REPLACE FUNCTION set_invoice_category()
RETURNS TRIGGER AS $$
BEGIN
  -- Automatically set invoice_category based on invoice_type and entity
  IF NEW.invoice_type = 'INCOMING_OFFICE' THEN
    NEW.invoice_category := 'OFFICE';
  ELSIF NEW.invoice_type IN ('INCOMING_SUPPLIER', 'OUTGOING_SUPPLIER') THEN
    NEW.invoice_category := 'SUBCONTRACTOR';
  ELSIF NEW.invoice_type = 'OUTGOING_SALES' THEN
    NEW.invoice_category := 'CUSTOMER';
  ELSIF NEW.invoice_type = 'INCOMING_INVESTMENT' THEN
    IF NEW.investor_id IS NOT NULL THEN
      NEW.invoice_category := 'INVESTOR';
    ELSIF NEW.bank_id IS NOT NULL THEN
      NEW.invoice_category := 'BANK_CREDIT';
    ELSE
      NEW.invoice_category := 'GENERAL';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_set_invoice_category
  BEFORE INSERT OR UPDATE ON accounting_invoices
  FOR EACH ROW
  EXECUTE FUNCTION set_invoice_category();
