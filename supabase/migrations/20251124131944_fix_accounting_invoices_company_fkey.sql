/*
  # Fix accounting_invoices company_id foreign key
  
  This migration updates the foreign key constraint on accounting_invoices.company_id
  to point to accounting_companies table instead of the old companies table.

  ## Changes
  
  1. Drop old foreign key constraint pointing to companies table
  2. Create new foreign key constraint pointing to accounting_companies table
*/

-- Drop old foreign key constraint
ALTER TABLE accounting_invoices 
DROP CONSTRAINT IF EXISTS accounting_invoices_company_id_fkey;

-- Add new foreign key constraint pointing to accounting_companies
ALTER TABLE accounting_invoices 
ADD CONSTRAINT accounting_invoices_company_id_fkey 
FOREIGN KEY (company_id) 
REFERENCES accounting_companies(id) 
ON DELETE SET NULL;