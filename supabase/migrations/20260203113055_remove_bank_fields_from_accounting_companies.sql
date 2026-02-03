/*
  # Remove bank-related fields from accounting_companies

  1. Changes
    - Drop `is_bank` column from `accounting_companies` table
    - Drop `bank_id` column from `accounting_companies` table
    - Drop triggers and functions related to bank syncing
    
  2. Rationale
    - Banks should only exist in the `banks` table
    - `accounting_companies` represents only companies, not banks
    - Separation of concerns: banks are managed through Funding > Banks
    - Credits are linked directly to banks via `bank_credits.bank_id`
*/

-- Drop triggers first
DROP TRIGGER IF EXISTS trigger_sync_bank_to_accounting_companies ON banks;
DROP TRIGGER IF EXISTS trigger_sync_accounting_companies_to_banks ON accounting_companies;
DROP TRIGGER IF EXISTS sync_bank_to_accounting_companies_trigger ON banks;
DROP TRIGGER IF EXISTS sync_accounting_companies_to_banks_trigger ON accounting_companies;

-- Drop functions
DROP FUNCTION IF EXISTS sync_bank_to_accounting_companies() CASCADE;
DROP FUNCTION IF EXISTS sync_accounting_companies_to_banks() CASCADE;

-- Remove bank-related columns from accounting_companies
ALTER TABLE accounting_companies DROP COLUMN IF EXISTS is_bank CASCADE;
ALTER TABLE accounting_companies DROP COLUMN IF EXISTS bank_id CASCADE;
