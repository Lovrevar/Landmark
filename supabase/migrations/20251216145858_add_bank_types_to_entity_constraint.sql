/*
  # Add Bank Invoice Types to Entity Type Constraint

  1. Problem
    - check_invoice_entity_type constraint doesn't include OUTGOING_BANK and INCOMING_BANK
    - These invoice types need bank_id to be set and other entity IDs to be NULL

  2. Solution
    - Drop old constraint
    - Add new constraint that includes bank invoice types
    
  3. Logic for Bank Types
    - OUTGOING_BANK: bank_id NOT NULL (repayment to bank), all others NULL
    - INCOMING_BANK: bank_id NOT NULL (receipt from bank), all others NULL
*/

-- Drop the old constraint
ALTER TABLE accounting_invoices
DROP CONSTRAINT IF EXISTS check_invoice_entity_type;

-- Add new constraint with bank types
ALTER TABLE accounting_invoices
ADD CONSTRAINT check_invoice_entity_type CHECK (
  -- INCOMING_SUPPLIER: From supplier to us
  (invoice_type = 'INCOMING_SUPPLIER' 
    AND (supplier_id IS NOT NULL OR retail_supplier_id IS NOT NULL)
    AND customer_id IS NULL 
    AND retail_customer_id IS NULL
    AND office_supplier_id IS NULL
    AND investor_id IS NULL
    AND bank_id IS NULL)
  OR
  -- OUTGOING_SUPPLIER: To supplier from us (we pay them)
  (invoice_type = 'OUTGOING_SUPPLIER' 
    AND (supplier_id IS NOT NULL OR retail_supplier_id IS NOT NULL OR bank_id IS NOT NULL)
    AND customer_id IS NULL 
    AND retail_customer_id IS NULL
    AND office_supplier_id IS NULL
    AND investor_id IS NULL)
  OR
  -- OUTGOING_SALES: To customer (they pay us)
  (invoice_type = 'OUTGOING_SALES' 
    AND (customer_id IS NOT NULL OR retail_customer_id IS NOT NULL)
    AND supplier_id IS NULL
    AND retail_supplier_id IS NULL
    AND office_supplier_id IS NULL
    AND investor_id IS NULL
    AND bank_id IS NULL)
  OR
  -- INCOMING_INVESTMENT: From investor/bank to us (funding)
  (invoice_type = 'INCOMING_INVESTMENT' 
    AND (investor_id IS NOT NULL OR bank_id IS NOT NULL)
    AND supplier_id IS NULL
    AND retail_supplier_id IS NULL
    AND customer_id IS NULL
    AND retail_customer_id IS NULL
    AND office_supplier_id IS NULL)
  OR
  -- INCOMING_OFFICE: From office supplier to us
  (invoice_type = 'INCOMING_OFFICE' 
    AND office_supplier_id IS NOT NULL
    AND supplier_id IS NULL
    AND retail_supplier_id IS NULL
    AND customer_id IS NULL
    AND retail_customer_id IS NULL
    AND investor_id IS NULL
    AND bank_id IS NULL)
  OR
  -- OUTGOING_OFFICE: To office supplier (we pay them)
  (invoice_type = 'OUTGOING_OFFICE' 
    AND office_supplier_id IS NOT NULL
    AND supplier_id IS NULL
    AND retail_supplier_id IS NULL
    AND customer_id IS NULL
    AND retail_customer_id IS NULL
    AND investor_id IS NULL
    AND bank_id IS NULL)
  OR
  -- OUTGOING_BANK: To bank (credit repayment)
  (invoice_type = 'OUTGOING_BANK'
    AND bank_id IS NOT NULL
    AND supplier_id IS NULL
    AND retail_supplier_id IS NULL
    AND customer_id IS NULL
    AND retail_customer_id IS NULL
    AND office_supplier_id IS NULL
    AND investor_id IS NULL)
  OR
  -- INCOMING_BANK: From bank (withdrawal/deposit)
  (invoice_type = 'INCOMING_BANK'
    AND bank_id IS NOT NULL
    AND supplier_id IS NULL
    AND retail_supplier_id IS NULL
    AND customer_id IS NULL
    AND retail_customer_id IS NULL
    AND office_supplier_id IS NULL
    AND investor_id IS NULL)
);
