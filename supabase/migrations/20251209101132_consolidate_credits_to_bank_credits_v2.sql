/*
  # Consolidate All Credits into bank_credits Table (v2 - Fixed)
  
  1. Purpose
    - Unify all credit management into single bank_credits table
    - Migrate existing company_credits data to bank_credits
    - Update all foreign key references from company_credits to bank_credits
    
  2. Changes
    - Add credit_name column to bank_credits
    - Make bank_id nullable (some credits not tied to specific bank)
    - DROP foreign key constraints FIRST before migration
    - Migrate all company_credits data to bank_credits with proper mapping
    - Store old-to-new ID mappings for foreign key updates
    - Update accounting_payments credit references
    - Re-create foreign keys to point to bank_credits
    
  3. Data Mapping
    company_credits → bank_credits:
    - credit_name → credit_name (NEW)
    - initial_amount → amount
    - current_balance → outstanding_balance
    - end_date → maturity_date
    - grace_period_months → grace_period (convert months to days: months * 30)
    - interest_rate → interest_rate
    - company_id → company_id
    - project_id → project_id
    - bank_id → NULL (company_credits didn't have bank_id)
    - credit_type → 'line_of_credit' (default)
    - status → 'active' (default)
    - purpose → credit_name (same as name)
    - principal_repayment_type → principal_repayment_type
    - interest_repayment_type → interest_repayment_type
*/

-- Step 1: Add credit_name to bank_credits if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'bank_credits' AND column_name = 'credit_name'
  ) THEN
    ALTER TABLE bank_credits ADD COLUMN credit_name text NOT NULL DEFAULT '';

  END IF;

END $$;


-- Step 2: Make bank_id nullable
ALTER TABLE bank_credits ALTER COLUMN bank_id DROP NOT NULL;


-- Step 3: Drop foreign key constraints from accounting_payments FIRST
ALTER TABLE accounting_payments DROP CONSTRAINT IF EXISTS accounting_payments_credit_id_fkey;

ALTER TABLE accounting_payments DROP CONSTRAINT IF EXISTS accounting_payments_cesija_credit_id_fkey;


-- Step 4: Create temporary table to store ID mappings
CREATE TEMP TABLE credit_id_mappings (
  old_company_credit_id uuid PRIMARY KEY,
  new_bank_credit_id uuid NOT NULL
);


-- Step 5: Migrate data from company_credits to bank_credits
DO $$
DECLARE
  credit_record RECORD;

  new_credit_id uuid;

BEGIN
  FOR credit_record IN 
    SELECT * FROM company_credits
  LOOP
    -- Generate new UUID for bank_credits
    new_credit_id := gen_random_uuid();

    
    -- Insert into bank_credits
    INSERT INTO bank_credits (
      id,
      bank_id,
      company_id,
      project_id,
      credit_name,
      credit_type,
      amount,
      interest_rate,
      start_date,
      maturity_date,
      outstanding_balance,
      status,
      purpose,
      grace_period,
      principal_repayment_type,
      interest_repayment_type,
      created_at
    ) VALUES (
      new_credit_id,
      NULL, -- company_credits didn't have bank_id
      credit_record.company_id,
      credit_record.project_id,
      credit_record.credit_name,
      'line_of_credit', -- default type
      credit_record.initial_amount,
      credit_record.interest_rate,
      credit_record.start_date,
      credit_record.end_date,
      credit_record.current_balance,
      'active', -- default status
      credit_record.credit_name, -- use credit_name as purpose too
      COALESCE(credit_record.grace_period_months, 0) * 30, -- convert months to days
      COALESCE(credit_record.principal_repayment_type, 'yearly'),
      COALESCE(credit_record.interest_repayment_type, 'yearly'),
      credit_record.created_at
    );

    
    -- Store mapping
    INSERT INTO credit_id_mappings (old_company_credit_id, new_bank_credit_id)
    VALUES (credit_record.id, new_credit_id);

  END LOOP;

END $$;


-- Step 6: Update accounting_payments.credit_id references
UPDATE accounting_payments ap
SET credit_id = cim.new_bank_credit_id
FROM credit_id_mappings cim
WHERE ap.credit_id = cim.old_company_credit_id;


-- Step 7: Update accounting_payments.cesija_credit_id references  
UPDATE accounting_payments ap
SET cesija_credit_id = cim.new_bank_credit_id
FROM credit_id_mappings cim
WHERE ap.cesija_credit_id = cim.old_company_credit_id;


-- Step 8: Add new foreign key constraints to bank_credits
ALTER TABLE accounting_payments 
  ADD CONSTRAINT accounting_payments_credit_id_fkey 
  FOREIGN KEY (credit_id) REFERENCES bank_credits(id) ON DELETE SET NULL;


ALTER TABLE accounting_payments 
  ADD CONSTRAINT accounting_payments_cesija_credit_id_fkey 
  FOREIGN KEY (cesija_credit_id) REFERENCES bank_credits(id) ON DELETE SET NULL;


-- Step 9: Drop indexes for company_credits
DROP INDEX IF EXISTS idx_company_credits_company_id;


-- Step 10: Recreate indexes for bank_credits
CREATE INDEX IF NOT EXISTS idx_accounting_payments_credit_id ON accounting_payments(credit_id);

CREATE INDEX IF NOT EXISTS idx_accounting_payments_cesija_credit_id ON accounting_payments(cesija_credit_id);

CREATE INDEX IF NOT EXISTS idx_bank_credits_company_id ON bank_credits(company_id);


-- Step 11: Drop trigger and function for company_credits
DROP TRIGGER IF EXISTS update_credit_balance_trigger ON accounting_payments;

DROP FUNCTION IF EXISTS update_company_credit_balance();


-- Step 12: Drop company_credits table
DROP TABLE IF EXISTS company_credits CASCADE;


-- Step 13: Update company_statistics view to use bank_credits instead of company_credits
DROP VIEW IF EXISTS company_statistics CASCADE;


CREATE OR REPLACE VIEW company_statistics AS
SELECT
  c.id,
  c.name,
  c.oib,
  c.initial_balance,
  c.created_at,
  
  -- Bank accounts stats
  COALESCE(SUM(ba.current_balance), 0) as total_bank_balance,
  COUNT(DISTINCT ba.id) as bank_accounts_count,
  
  -- Credits stats (NOW FROM bank_credits)
  COALESCE(SUM(bc.amount - bc.outstanding_balance), 0) as total_credits_available,
  COUNT(DISTINCT bc.id) as credits_count,
  
  -- Income invoices (money coming in)
  COUNT(DISTINCT CASE 
    WHEN inv.invoice_type IN ('INCOMING_INVESTMENT', 'OUTGOING_SALES', 'OUTGOING_OFFICE') 
    THEN inv.id 
  END) as total_income_invoices,
  
  COALESCE(SUM(CASE 
    WHEN inv.invoice_type IN ('INCOMING_INVESTMENT', 'OUTGOING_SALES', 'OUTGOING_OFFICE') 
    THEN inv.total_amount 
    ELSE 0 
  END), 0) as total_income_amount,
  
  COALESCE(SUM(CASE 
    WHEN inv.invoice_type IN ('INCOMING_INVESTMENT', 'OUTGOING_SALES', 'OUTGOING_OFFICE') 
    THEN inv.paid_amount 
    ELSE 0 
  END), 0) as total_income_paid,
  
  COALESCE(SUM(CASE 
    WHEN inv.invoice_type IN ('INCOMING_INVESTMENT', 'OUTGOING_SALES', 'OUTGOING_OFFICE') 
    THEN inv.remaining_amount 
    ELSE 0 
  END), 0) as total_income_unpaid,
  
  -- Expense invoices (money going out)
  COUNT(DISTINCT CASE 
    WHEN inv.invoice_type IN ('INCOMING_SUPPLIER', 'OUTGOING_SUPPLIER', 'INCOMING_OFFICE') 
    THEN inv.id 
  END) as total_expense_invoices,
  
  COALESCE(SUM(CASE 
    WHEN inv.invoice_type IN ('INCOMING_SUPPLIER', 'OUTGOING_SUPPLIER', 'INCOMING_OFFICE') 
    THEN inv.total_amount 
    ELSE 0 
  END), 0) as total_expense_amount,
  
  COALESCE(SUM(CASE 
    WHEN inv.invoice_type IN ('INCOMING_SUPPLIER', 'OUTGOING_SUPPLIER', 'INCOMING_OFFICE') 
    THEN inv.paid_amount 
    ELSE 0 
  END), 0) as total_expense_paid,
  
  COALESCE(SUM(CASE 
    WHEN inv.invoice_type IN ('INCOMING_SUPPLIER', 'OUTGOING_SUPPLIER', 'INCOMING_OFFICE') 
    THEN inv.remaining_amount 
    ELSE 0 
  END), 0) as total_expense_unpaid
  
FROM accounting_companies c
LEFT JOIN company_bank_accounts ba ON ba.company_id = c.id
LEFT JOIN bank_credits bc ON bc.company_id = c.id
LEFT JOIN accounting_invoices inv ON inv.company_id = c.id
GROUP BY c.id, c.name, c.oib, c.initial_balance, c.created_at;


-- Grant access to authenticated users
GRANT SELECT ON company_statistics TO authenticated;
;