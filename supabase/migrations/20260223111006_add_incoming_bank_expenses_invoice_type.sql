/*
  # Add INCOMING_BANK_EXPENSES Invoice Type

  ## Summary
  Adds a new invoice type 'INCOMING_BANK_EXPENSES' for tracking credit-related expenses
  (e.g. bank fees, interest payments) that are linked to a bank credit but should NOT
  affect the credit's outstanding balance calculation.

  ## Changes

  ### 1. invoice_type CHECK constraint
  - Drops the existing constraint on accounting_invoices.invoice_type
  - Recreates it with INCOMING_BANK_EXPENSES added to the allowed values

  ### 2. check_invoice_entity_type constraint
  - Drops the existing entity-type constraint
  - Recreates it with an additional rule for INCOMING_BANK_EXPENSES:
    bank_id must be NOT NULL (same as INCOMING_BANK / OUTGOING_BANK),
    all other entity foreign keys must be NULL

  ## Important Notes
  - The outstanding balance trigger (recalculate_bank_credit_outstanding_trigger) guards
    exclusively on invoice_type = 'INCOMING_BANK', so INCOMING_BANK_EXPENSES invoices
    will NEVER affect outstanding_balance calculations — no trigger changes needed.
  - Existing data is not touched; only the constraint definitions change.
*/

-- 1. Update the simple invoice_type check constraint
ALTER TABLE accounting_invoices
DROP CONSTRAINT IF EXISTS accounting_invoices_invoice_type_check;

ALTER TABLE accounting_invoices
ADD CONSTRAINT accounting_invoices_invoice_type_check
CHECK (invoice_type IN (
  'INCOMING_SUPPLIER',
  'INCOMING_INVESTMENT',
  'INCOMING_OFFICE',
  'INCOMING_BANK',
  'INCOMING_BANK_EXPENSES',
  'OUTGOING_SUPPLIER',
  'OUTGOING_SALES',
  'OUTGOING_OFFICE',
  'OUTGOING_BANK'
));

-- 2. Update the entity-type constraint to include INCOMING_BANK_EXPENSES
ALTER TABLE accounting_invoices
DROP CONSTRAINT IF EXISTS check_invoice_entity_type;

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
  OR
  -- INCOMING_BANK_EXPENSES: Bank credit expenses (fees, interest) — does NOT affect outstanding balance
  (invoice_type = 'INCOMING_BANK_EXPENSES'
    AND bank_id IS NOT NULL
    AND supplier_id IS NULL
    AND retail_supplier_id IS NULL
    AND customer_id IS NULL
    AND retail_customer_id IS NULL
    AND office_supplier_id IS NULL
    AND investor_id IS NULL)
);
