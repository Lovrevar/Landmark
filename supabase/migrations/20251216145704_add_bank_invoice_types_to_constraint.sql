/*
  # Add Bank Invoice Types to Constraint

  1. Problem
    - accounting_invoices table doesn't allow OUTGOING_BANK and INCOMING_BANK invoice types
    - These types are needed for bank credit repayments and bank deposits

  2. Solution
    - Add OUTGOING_BANK (credit repayments to bank)
    - Add INCOMING_BANK (deposits/withdrawals from bank)
    
  3. Changes
    - Update invoice_type CHECK constraint to include new types
*/

-- Drop the existing constraint
ALTER TABLE accounting_invoices 
DROP CONSTRAINT IF EXISTS accounting_invoices_invoice_type_check;

-- Add the constraint with bank types included
ALTER TABLE accounting_invoices
ADD CONSTRAINT accounting_invoices_invoice_type_check
CHECK (invoice_type IN (
  'INCOMING_SUPPLIER',
  'INCOMING_INVESTMENT',
  'INCOMING_OFFICE',
  'INCOMING_BANK',
  'OUTGOING_SUPPLIER',
  'OUTGOING_SALES',
  'OUTGOING_OFFICE',
  'OUTGOING_BANK'
));
