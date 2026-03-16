/*
  # Add investor and bank references to accounting invoices

  1. Changes
    - Add `investor_id` column to link invoices directly to investors
    - Add `bank_id` column to link invoices directly to banks
    - Update `invoice_type` check constraint to support new types
    - Keep `invoice_category` for backwards compatibility with views
    
  2. New Invoice Types
    - INCOMING_SUPPLIER: Ulazni račun od dobavljača
    - INCOMING_INVESTMENT: Ulazni račun od investora/banaka
    - OUTGOING_SUPPLIER: Izlazni račun prema dobavljaču
    - OUTGOING_SALES: Izlazni račun prema kupcu
*/

-- Add investor_id and bank_id columns
ALTER TABLE accounting_invoices 
ADD COLUMN IF NOT EXISTS investor_id uuid REFERENCES investors(id),
ADD COLUMN IF NOT EXISTS bank_id uuid REFERENCES banks(id);

-- Drop old invoice_type constraint
ALTER TABLE accounting_invoices 
DROP CONSTRAINT IF EXISTS accounting_invoices_invoice_type_check;

-- Add new invoice_type constraint with 4 types
ALTER TABLE accounting_invoices 
ADD CONSTRAINT accounting_invoices_invoice_type_check 
CHECK (invoice_type IN ('INCOMING_SUPPLIER', 'INCOMING_INVESTMENT', 'OUTGOING_SUPPLIER', 'OUTGOING_SALES'));

-- Update invoice_category constraint to include new types
ALTER TABLE accounting_invoices 
DROP CONSTRAINT IF EXISTS accounting_invoices_invoice_category_check;

ALTER TABLE accounting_invoices 
ADD CONSTRAINT accounting_invoices_invoice_category_check 
CHECK (invoice_category IN ('SUBCONTRACTOR', 'APARTMENT', 'CUSTOMER', 'BANK_CREDIT', 'INVESTOR', 'MISCELLANEOUS', 'GENERAL'));

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_accounting_invoices_investor_id ON accounting_invoices(investor_id);
CREATE INDEX IF NOT EXISTS idx_accounting_invoices_bank_id ON accounting_invoices(bank_id);
