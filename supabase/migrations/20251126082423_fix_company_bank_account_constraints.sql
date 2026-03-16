/*
  # Fix Company Bank Account Foreign Key Constraints

  1. Changes
    - Make company_bank_account_id nullable and set ON DELETE SET NULL
    - This allows deletion of bank accounts without breaking invoices
    - Allows deletion of companies and their bank accounts

  2. Notes
    - When a bank account is deleted, invoices will have NULL company_bank_account_id
    - When a company is deleted, all its bank accounts are deleted (CASCADE)
    - This is safer and more flexible for data management
*/

-- First, drop the existing foreign key constraint if it exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_name = 'accounting_invoices_company_bank_account_id_fkey'
    AND table_name = 'accounting_invoices'
  ) THEN
    ALTER TABLE accounting_invoices 
    DROP CONSTRAINT accounting_invoices_company_bank_account_id_fkey;
  END IF;
END $$;

-- Add the constraint back with ON DELETE SET NULL
ALTER TABLE accounting_invoices
ADD CONSTRAINT accounting_invoices_company_bank_account_id_fkey
FOREIGN KEY (company_bank_account_id)
REFERENCES company_bank_accounts(id)
ON DELETE SET NULL;