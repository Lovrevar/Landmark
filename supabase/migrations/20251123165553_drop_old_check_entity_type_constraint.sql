/*
  # Drop old check_entity_type constraint

  1. Changes
    - Drop the old check_entity_type constraint that uses EXPENSE/INCOME
    - Drop the duplicate check_invoice_category constraint
    
  2. Reasoning
    - The old constraint was blocking new invoice types (INCOMING_SUPPLIER, etc.)
    - We already have invoice_type_check and invoice_category_check constraints
*/

-- Drop old check_entity_type constraint
ALTER TABLE accounting_invoices 
DROP CONSTRAINT IF EXISTS check_entity_type;

-- Drop duplicate check_invoice_category constraint
ALTER TABLE accounting_invoices 
DROP CONSTRAINT IF EXISTS check_invoice_category;
