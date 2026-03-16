/*
  # Add Bank Flag to Accounting Companies

  1. Purpose
    - Allow banks to be tracked as companies in the accounting system
    - Enable invoices and payments to/from banks
    - Support repayment tracking for bank credits

  2. Changes
    - Add `is_bank` flag to accounting_companies
    - Add optional reference to bank_credits table
    
  3. Use Cases
    - Create invoices for bank fees, interest payments
    - Track repayments to banks
    - Link bank entities between finance and accounting modules
*/

-- Add is_bank flag to accounting_companies
ALTER TABLE accounting_companies
ADD COLUMN IF NOT EXISTS is_bank boolean DEFAULT false;

-- Add optional link to banks table
ALTER TABLE accounting_companies
ADD COLUMN IF NOT EXISTS bank_id uuid REFERENCES banks(id) ON DELETE SET NULL;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_accounting_companies_is_bank ON accounting_companies(is_bank) WHERE is_bank = true;
CREATE INDEX IF NOT EXISTS idx_accounting_companies_bank_id ON accounting_companies(bank_id);

-- Add comments
COMMENT ON COLUMN accounting_companies.is_bank IS 'Flag indicating this company is a bank/financial institution';
COMMENT ON COLUMN accounting_companies.bank_id IS 'Reference to banks table if this company represents a bank';
