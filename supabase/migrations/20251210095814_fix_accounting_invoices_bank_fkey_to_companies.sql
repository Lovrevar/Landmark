/*
  # Fix Bank Foreign Key to Point to Accounting Companies

  1. Changes
    - Drop old foreign key constraint that points to banks table
    - Add new foreign key constraint that points to accounting_companies table
    
  2. Reason
    - Banks are now stored in accounting_companies with is_bank flag
    - Invoices should reference accounting_companies.id instead of banks.id
*/

-- Drop old constraint pointing to banks table
ALTER TABLE accounting_invoices
DROP CONSTRAINT IF EXISTS accounting_invoices_bank_id_fkey;

-- Add new constraint pointing to accounting_companies table
ALTER TABLE accounting_invoices
ADD CONSTRAINT accounting_invoices_bank_id_fkey 
FOREIGN KEY (bank_id) 
REFERENCES accounting_companies(id) 
ON DELETE SET NULL;
