/*
  # Add OUTGOING_OFFICE Invoice Type Support
  
  This migration adds support for outgoing office invoices (OUTGOING_OFFICE),
  allowing the system to track payments made from office suppliers.
  
  ## Changes
  
  1. Update invoice_type constraint to include OUTGOING_OFFICE
  2. Update CHECK constraint for entity types to handle OUTGOING_OFFICE
  3. Update trigger function to set invoice_category for OUTGOING_OFFICE
  
  ## Notes
  
  - OUTGOING_OFFICE invoices work the same as INCOMING_OFFICE
  - Both use office_supplier_id instead of supplier_id
  - Both have invoice_category set to 'OFFICE'
*/

-- Drop and recreate invoice_type constraint with OUTGOING_OFFICE
ALTER TABLE accounting_invoices DROP CONSTRAINT IF EXISTS accounting_invoices_invoice_type_check;
ALTER TABLE accounting_invoices ADD CONSTRAINT accounting_invoices_invoice_type_check 
  CHECK (invoice_type IN ('INCOMING_SUPPLIER', 'INCOMING_INVESTMENT', 'OUTGOING_SUPPLIER', 'OUTGOING_SALES', 'INCOMING_OFFICE', 'OUTGOING_OFFICE'));

-- Drop and recreate entity type constraint to handle OUTGOING_OFFICE
ALTER TABLE accounting_invoices DROP CONSTRAINT IF EXISTS check_invoice_entity_type;
ALTER TABLE accounting_invoices ADD CONSTRAINT check_invoice_entity_type CHECK (
  (invoice_type = 'INCOMING_SUPPLIER' AND supplier_id IS NOT NULL AND customer_id IS NULL AND office_supplier_id IS NULL AND investor_id IS NULL AND bank_id IS NULL) OR
  (invoice_type = 'OUTGOING_SUPPLIER' AND supplier_id IS NOT NULL AND customer_id IS NULL AND office_supplier_id IS NULL AND investor_id IS NULL AND bank_id IS NULL) OR
  (invoice_type = 'OUTGOING_SALES' AND customer_id IS NOT NULL AND supplier_id IS NULL AND office_supplier_id IS NULL AND investor_id IS NULL AND bank_id IS NULL) OR
  (invoice_type = 'INCOMING_INVESTMENT' AND (investor_id IS NOT NULL OR bank_id IS NOT NULL) AND supplier_id IS NULL AND customer_id IS NULL AND office_supplier_id IS NULL) OR
  (invoice_type = 'INCOMING_OFFICE' AND office_supplier_id IS NOT NULL AND supplier_id IS NULL AND customer_id IS NULL AND investor_id IS NULL AND bank_id IS NULL) OR
  (invoice_type = 'OUTGOING_OFFICE' AND office_supplier_id IS NOT NULL AND supplier_id IS NULL AND customer_id IS NULL AND investor_id IS NULL AND bank_id IS NULL)
);

-- Update trigger function to handle OUTGOING_OFFICE
CREATE OR REPLACE FUNCTION set_invoice_category()
RETURNS TRIGGER AS $$
BEGIN
  -- Automatically set invoice_category based on invoice_type and entity
  IF NEW.invoice_type = 'INCOMING_OFFICE' OR NEW.invoice_type = 'OUTGOING_OFFICE' THEN
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
