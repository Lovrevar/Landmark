/*
  # Fix Invoice Entity Type Constraint for Retail

  ## Purpose
  Update check_invoice_entity_type constraint to support both:
  - Regular invoices (supplier_id, customer_id)
  - Retail invoices (retail_supplier_id, retail_customer_id)

  ## Changes
  1. Drop old constraint
  2. Create new constraint that allows retail columns

  ## Logic
  - INCOMING_SUPPLIER: supplier_id OR retail_supplier_id must be set
  - OUTGOING_SUPPLIER: supplier_id OR retail_supplier_id must be set
  - OUTGOING_SALES: customer_id OR retail_customer_id must be set
  - Other types remain unchanged
*/

-- Drop the old constraint
ALTER TABLE accounting_invoices DROP CONSTRAINT IF EXISTS check_invoice_entity_type;

-- Create new constraint that supports both regular and retail entities
ALTER TABLE accounting_invoices ADD CONSTRAINT check_invoice_entity_type CHECK (
  (
    -- INCOMING_SUPPLIER: needs supplier_id OR retail_supplier_id
    invoice_type = 'INCOMING_SUPPLIER' 
    AND (supplier_id IS NOT NULL OR retail_supplier_id IS NOT NULL)
    AND customer_id IS NULL 
    AND retail_customer_id IS NULL
    AND office_supplier_id IS NULL 
    AND investor_id IS NULL 
    AND bank_id IS NULL
  ) OR (
    -- OUTGOING_SUPPLIER: needs supplier_id OR retail_supplier_id
    invoice_type = 'OUTGOING_SUPPLIER' 
    AND (supplier_id IS NOT NULL OR retail_supplier_id IS NOT NULL)
    AND customer_id IS NULL
    AND retail_customer_id IS NULL
    AND office_supplier_id IS NULL 
    AND investor_id IS NULL 
    AND bank_id IS NULL
  ) OR (
    -- OUTGOING_SALES: needs customer_id OR retail_customer_id
    invoice_type = 'OUTGOING_SALES' 
    AND (customer_id IS NOT NULL OR retail_customer_id IS NOT NULL)
    AND supplier_id IS NULL
    AND retail_supplier_id IS NULL
    AND office_supplier_id IS NULL 
    AND investor_id IS NULL 
    AND bank_id IS NULL
  ) OR (
    -- INCOMING_INVESTMENT: needs investor_id OR bank_id
    invoice_type = 'INCOMING_INVESTMENT' 
    AND (investor_id IS NOT NULL OR bank_id IS NOT NULL)
    AND supplier_id IS NULL
    AND retail_supplier_id IS NULL
    AND customer_id IS NULL
    AND retail_customer_id IS NULL
    AND office_supplier_id IS NULL
  ) OR (
    -- INCOMING_OFFICE: needs office_supplier_id
    invoice_type = 'INCOMING_OFFICE' 
    AND office_supplier_id IS NOT NULL
    AND supplier_id IS NULL
    AND retail_supplier_id IS NULL
    AND customer_id IS NULL
    AND retail_customer_id IS NULL
    AND investor_id IS NULL 
    AND bank_id IS NULL
  ) OR (
    -- OUTGOING_OFFICE: needs office_supplier_id
    invoice_type = 'OUTGOING_OFFICE' 
    AND office_supplier_id IS NOT NULL
    AND supplier_id IS NULL
    AND retail_supplier_id IS NULL
    AND customer_id IS NULL
    AND retail_customer_id IS NULL
    AND investor_id IS NULL 
    AND bank_id IS NULL
  )
);
