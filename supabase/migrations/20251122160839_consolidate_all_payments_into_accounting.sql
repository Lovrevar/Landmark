/*
  # Consolidate All Payments Into Accounting System
  
  ## Summary
  This migration consolidates all payment tracking into the unified accounting system.
  All payment types (apartments, subcontractors, banks, investors) will use 
  accounting_invoices and accounting_payments tables.

  ## Changes Made

  ### 1. Extend accounting_invoices table
  Add columns to support all entity types:
    - `apartment_id` (uuid) - link to apartments for customer payments
    - `bank_credit_id` (uuid) - link to bank credits
    - `investment_id` (uuid) - link to project investments (investor payments)
    - `milestone_id` (uuid) - link to subcontractor milestones
    - `invoice_category` (text) - SUBCONTRACTOR, APARTMENT, BANK_CREDIT, INVESTOR, MISCELLANEOUS

  ### 2. Drop old payment tables (fresh start)
  Remove all deprecated payment tables:
    - apartment_payments
    - bank_credit_payments  
    - investor_payments
    - subcontractor_payments (if exists)
    - payment_notifications

  ### 3. Add indexes for performance
  Create composite indexes for common query patterns

  ### 4. Update constraints
  Modify check constraints to support new entity types

  ## Important Notes
  - Fresh start - no data migration needed
  - All future payments tracked through accounting_invoices + accounting_payments
  - Each invoice must have ONE entity (supplier, customer, apartment, bank, investor)
  - invoice_category helps quickly filter by payment type
*/

-- ============ STEP 1: Drop old payment tables ============

DROP TABLE IF EXISTS payment_notifications CASCADE;
DROP TABLE IF EXISTS apartment_payments CASCADE;
DROP TABLE IF EXISTS bank_credit_payments CASCADE;
DROP TABLE IF EXISTS investor_payments CASCADE;
DROP TABLE IF EXISTS subcontractor_payments CASCADE;

-- ============ STEP 2: Extend accounting_invoices table ============

-- Add new columns for different entity types
ALTER TABLE accounting_invoices 
ADD COLUMN IF NOT EXISTS apartment_id uuid REFERENCES apartments(id) ON DELETE RESTRICT,
ADD COLUMN IF NOT EXISTS bank_credit_id uuid REFERENCES bank_credits(id) ON DELETE RESTRICT,
ADD COLUMN IF NOT EXISTS investment_id uuid REFERENCES project_investments(id) ON DELETE RESTRICT,
ADD COLUMN IF NOT EXISTS milestone_id uuid REFERENCES subcontractor_milestones(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS invoice_category text;

-- Set invoice_category based on existing data
UPDATE accounting_invoices 
SET invoice_category = CASE
  WHEN invoice_type = 'EXPENSE' AND supplier_id IS NOT NULL THEN 'SUBCONTRACTOR'
  WHEN invoice_type = 'INCOME' AND customer_id IS NOT NULL THEN 'CUSTOMER'
  ELSE 'MISCELLANEOUS'
END
WHERE invoice_category IS NULL;

-- Make invoice_category NOT NULL after setting defaults
ALTER TABLE accounting_invoices 
ALTER COLUMN invoice_category SET NOT NULL;

-- Add check constraint for invoice_category
ALTER TABLE accounting_invoices
ADD CONSTRAINT check_invoice_category 
CHECK (invoice_category IN ('SUBCONTRACTOR', 'APARTMENT', 'CUSTOMER', 'BANK_CREDIT', 'INVESTOR', 'MISCELLANEOUS'));

-- Drop old constraint and add new one that supports all entity types
ALTER TABLE accounting_invoices 
DROP CONSTRAINT IF EXISTS check_supplier_or_customer;

ALTER TABLE accounting_invoices
ADD CONSTRAINT check_entity_type CHECK (
  (invoice_type = 'EXPENSE' AND supplier_id IS NOT NULL AND customer_id IS NULL AND apartment_id IS NULL) OR
  (invoice_type = 'INCOME' AND customer_id IS NOT NULL AND supplier_id IS NULL AND apartment_id IS NULL) OR
  (invoice_type = 'INCOME' AND apartment_id IS NOT NULL AND supplier_id IS NULL AND customer_id IS NULL) OR
  (invoice_type = 'EXPENSE' AND bank_credit_id IS NOT NULL AND supplier_id IS NULL AND customer_id IS NULL AND apartment_id IS NULL) OR
  (invoice_type = 'EXPENSE' AND investment_id IS NOT NULL AND supplier_id IS NULL AND customer_id IS NULL AND apartment_id IS NULL)
);

-- ============ STEP 3: Create indexes for performance ============

CREATE INDEX IF NOT EXISTS idx_accounting_invoices_apartment_id ON accounting_invoices(apartment_id);
CREATE INDEX IF NOT EXISTS idx_accounting_invoices_bank_credit_id ON accounting_invoices(bank_credit_id);
CREATE INDEX IF NOT EXISTS idx_accounting_invoices_investment_id ON accounting_invoices(investment_id);
CREATE INDEX IF NOT EXISTS idx_accounting_invoices_milestone_id ON accounting_invoices(milestone_id);
CREATE INDEX IF NOT EXISTS idx_accounting_invoices_category ON accounting_invoices(invoice_category);

-- Composite indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_accounting_invoices_supplier_project 
ON accounting_invoices(supplier_id, project_id) 
WHERE supplier_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_accounting_invoices_customer_project 
ON accounting_invoices(customer_id, project_id) 
WHERE customer_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_accounting_invoices_apartment_category
ON accounting_invoices(apartment_id, invoice_category)
WHERE apartment_id IS NOT NULL;

-- ============ STEP 4: Create helper functions for quick lookups ============

-- Function to get subcontractor payments for a project
CREATE OR REPLACE FUNCTION get_subcontractor_payments(
  p_subcontractor_id uuid,
  p_project_id uuid DEFAULT NULL
)
RETURNS TABLE (
  invoice_id uuid,
  payment_id uuid,
  invoice_number text,
  invoice_date date,
  payment_date date,
  payment_amount numeric,
  payment_method text,
  reference_number text,
  description text,
  invoice_total numeric,
  invoice_status text
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ai.id as invoice_id,
    ap.id as payment_id,
    ai.invoice_number,
    ai.issue_date as invoice_date,
    ap.payment_date,
    ap.amount as payment_amount,
    ap.payment_method,
    ap.reference_number,
    ap.description,
    ai.total_amount as invoice_total,
    ai.status as invoice_status
  FROM accounting_invoices ai
  LEFT JOIN accounting_payments ap ON ap.invoice_id = ai.id
  WHERE ai.supplier_id = p_subcontractor_id
    AND ai.invoice_category = 'SUBCONTRACTOR'
    AND (p_project_id IS NULL OR ai.project_id = p_project_id)
  ORDER BY ai.issue_date DESC, ap.payment_date DESC;
END;
$$ LANGUAGE plpgsql STABLE;

-- Function to get apartment/customer payments
CREATE OR REPLACE FUNCTION get_apartment_payments(
  p_apartment_id uuid
)
RETURNS TABLE (
  invoice_id uuid,
  payment_id uuid,
  invoice_number text,
  invoice_date date,
  payment_date date,
  payment_amount numeric,
  payment_method text,
  reference_number text,
  description text,
  invoice_total numeric,
  invoice_status text
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ai.id as invoice_id,
    ap.id as payment_id,
    ai.invoice_number,
    ai.issue_date as invoice_date,
    ap.payment_date,
    ap.amount as payment_amount,
    ap.payment_method,
    ap.reference_number,
    ap.description,
    ai.total_amount as invoice_total,
    ai.status as invoice_status
  FROM accounting_invoices ai
  LEFT JOIN accounting_payments ap ON ap.invoice_id = ai.id
  WHERE ai.apartment_id = p_apartment_id
    AND ai.invoice_category = 'APARTMENT'
  ORDER BY ai.issue_date DESC, ap.payment_date DESC;
END;
$$ LANGUAGE plpgsql STABLE;

-- Function to get bank credit payments
CREATE OR REPLACE FUNCTION get_bank_credit_payments(
  p_bank_credit_id uuid
)
RETURNS TABLE (
  invoice_id uuid,
  payment_id uuid,
  invoice_number text,
  invoice_date date,
  payment_date date,
  payment_amount numeric,
  payment_method text,
  reference_number text,
  description text,
  invoice_total numeric,
  invoice_status text
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ai.id as invoice_id,
    ap.id as payment_id,
    ai.invoice_number,
    ai.issue_date as invoice_date,
    ap.payment_date,
    ap.amount as payment_amount,
    ap.payment_method,
    ap.reference_number,
    ap.description,
    ai.total_amount as invoice_total,
    ai.status as invoice_status
  FROM accounting_invoices ai
  LEFT JOIN accounting_payments ap ON ap.invoice_id = ai.id
  WHERE ai.bank_credit_id = p_bank_credit_id
    AND ai.invoice_category = 'BANK_CREDIT'
  ORDER BY ai.issue_date DESC, ap.payment_date DESC;
END;
$$ LANGUAGE plpgsql STABLE;

-- Function to get investor payments
CREATE OR REPLACE FUNCTION get_investor_payments(
  p_investment_id uuid
)
RETURNS TABLE (
  invoice_id uuid,
  payment_id uuid,
  invoice_number text,
  invoice_date date,
  payment_date date,
  payment_amount numeric,
  payment_method text,
  reference_number text,
  description text,
  invoice_total numeric,
  invoice_status text
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ai.id as invoice_id,
    ap.id as payment_id,
    ai.invoice_number,
    ai.issue_date as invoice_date,
    ap.payment_date,
    ap.amount as payment_amount,
    ap.payment_method,
    ap.reference_number,
    ap.description,
    ai.total_amount as invoice_total,
    ai.status as invoice_status
  FROM accounting_invoices ai
  LEFT JOIN accounting_payments ap ON ap.invoice_id = ai.id
  WHERE ai.investment_id = p_investment_id
    AND ai.invoice_category = 'INVESTOR'
  ORDER BY ai.issue_date DESC, ap.payment_date DESC;
END;
$$ LANGUAGE plpgsql STABLE;

-- ============ STEP 5: Create view for quick totals ============

CREATE OR REPLACE VIEW payment_totals_by_category AS
SELECT 
  invoice_category,
  invoice_type,
  project_id,
  COUNT(DISTINCT ai.id) as invoice_count,
  SUM(ai.total_amount) as total_invoiced,
  SUM(ai.paid_amount) as total_paid,
  SUM(ai.remaining_amount) as total_remaining
FROM accounting_invoices ai
GROUP BY invoice_category, invoice_type, project_id;
