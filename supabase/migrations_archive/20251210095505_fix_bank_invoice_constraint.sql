/*
  # Fix Invoice Entity Type Constraint for Bank Invoices

  1. Changes
    - Update check_invoice_entity_type constraint to allow bank_id for OUTGOING_SUPPLIER type
    - This enables proper tracking of bank credit repayments (ulazni računi)
    
  2. Logic
    - INCOMING_SUPPLIER: requires supplier_id or retail_supplier_id
    - OUTGOING_SUPPLIER: requires supplier_id or retail_supplier_id OR bank_id (for credit repayments)
    - OUTGOING_SALES: requires customer_id or retail_customer_id
    - INCOMING_INVESTMENT: requires investor_id or bank_id (for credit drawdowns)
    - INCOMING_OFFICE: requires office_supplier_id
    - OUTGOING_OFFICE: requires office_supplier_id
*/

-- Drop the old constraint
ALTER TABLE accounting_invoices 
DROP CONSTRAINT IF EXISTS check_invoice_entity_type;

-- Add updated constraint that allows bank_id for OUTGOING_SUPPLIER
ALTER TABLE accounting_invoices
ADD CONSTRAINT check_invoice_entity_type CHECK (
  (
    -- INCOMING_SUPPLIER: from subcontractor or retail supplier
    invoice_type = 'INCOMING_SUPPLIER' 
    AND (supplier_id IS NOT NULL OR retail_supplier_id IS NOT NULL)
    AND customer_id IS NULL 
    AND retail_customer_id IS NULL
    AND office_supplier_id IS NULL
    AND investor_id IS NULL
    AND bank_id IS NULL
  ) OR (
    -- OUTGOING_SUPPLIER: to subcontractor, retail supplier, or bank (credit repayment)
    invoice_type = 'OUTGOING_SUPPLIER' 
    AND (supplier_id IS NOT NULL OR retail_supplier_id IS NOT NULL OR bank_id IS NOT NULL)
    AND customer_id IS NULL 
    AND retail_customer_id IS NULL
    AND office_supplier_id IS NULL
    AND investor_id IS NULL
  ) OR (
    -- OUTGOING_SALES: to customer or retail customer
    invoice_type = 'OUTGOING_SALES' 
    AND (customer_id IS NOT NULL OR retail_customer_id IS NOT NULL)
    AND supplier_id IS NULL 
    AND retail_supplier_id IS NULL
    AND office_supplier_id IS NULL
    AND investor_id IS NULL
    AND bank_id IS NULL
  ) OR (
    -- INCOMING_INVESTMENT: from investor or bank (credit drawdown)
    invoice_type = 'INCOMING_INVESTMENT' 
    AND (investor_id IS NOT NULL OR bank_id IS NOT NULL)
    AND supplier_id IS NULL 
    AND retail_supplier_id IS NULL
    AND customer_id IS NULL 
    AND retail_customer_id IS NULL
    AND office_supplier_id IS NULL
  ) OR (
    -- INCOMING_OFFICE: from office supplier
    invoice_type = 'INCOMING_OFFICE' 
    AND office_supplier_id IS NOT NULL
    AND supplier_id IS NULL 
    AND retail_supplier_id IS NULL
    AND customer_id IS NULL 
    AND retail_customer_id IS NULL
    AND investor_id IS NULL
    AND bank_id IS NULL
  ) OR (
    -- OUTGOING_OFFICE: to office supplier
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
