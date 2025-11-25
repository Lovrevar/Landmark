/*
  # Fix Invoice Category Constraint to Include OFFICE
  
  This migration fixes the invoice_category CHECK constraint to include
  the 'OFFICE' category which is used for office-related invoices.
  
  ## Changes
  
  1. Drop existing invoice_category constraint
  2. Add new constraint that includes 'OFFICE' category
  
  ## Notes
  
  - OFFICE category is automatically set by trigger for INCOMING_OFFICE and OUTGOING_OFFICE invoice types
  - This allows office invoices to be saved properly
*/

-- Drop existing constraint
ALTER TABLE accounting_invoices DROP CONSTRAINT IF EXISTS accounting_invoices_invoice_category_check;

-- Add new constraint with OFFICE category included
ALTER TABLE accounting_invoices ADD CONSTRAINT accounting_invoices_invoice_category_check 
  CHECK (invoice_category IN ('SUBCONTRACTOR', 'OFFICE', 'APARTMENT', 'CUSTOMER', 'BANK_CREDIT', 'INVESTOR', 'MISCELLANEOUS', 'GENERAL'));
