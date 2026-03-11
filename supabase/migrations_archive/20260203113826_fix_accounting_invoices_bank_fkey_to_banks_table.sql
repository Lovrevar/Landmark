/*
  # Fix accounting_invoices bank_id foreign key to reference banks table

  1. Changes
    - Drop existing foreign key constraint that references accounting_companies
    - Create new foreign key constraint that references banks table
    
  2. Rationale
    - Banks are now managed in the banks table, not accounting_companies
    - accounting_invoices.bank_id should reference banks.id for bank-related invoices
*/

-- Drop the old foreign key constraint that references accounting_companies
ALTER TABLE accounting_invoices 
DROP CONSTRAINT IF EXISTS accounting_invoices_bank_id_fkey;

-- Create new foreign key constraint that references banks table
ALTER TABLE accounting_invoices 
ADD CONSTRAINT accounting_invoices_bank_id_fkey 
FOREIGN KEY (bank_id) 
REFERENCES banks(id) 
ON DELETE SET NULL;
