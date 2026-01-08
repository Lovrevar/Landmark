/*
  # Sync Banks to Accounting Companies v3
  
  This migration ensures that all banks from the `banks` table are properly
  represented in the `accounting_companies` table for accounting and credit tracking.

  1. Changes
    - Migrate all existing banks from `banks` table to `accounting_companies`
    - Set `is_bank = true` and link via `bank_id`
    - Generate placeholder OIB using bank ID (first 11 chars)
    - Create trigger to automatically sync new banks when inserted into `banks` table
    
  2. Security
    - No RLS changes needed (inherits existing policies)
*/

-- First, insert all existing banks from banks table into accounting_companies
INSERT INTO accounting_companies (name, oib, is_bank, bank_id)
SELECT 
  b.name,
  'BANK-' || substring(b.id::text, 1, 6),  -- Generate unique placeholder OIB
  true,
  b.id
FROM banks b
WHERE NOT EXISTS (
  SELECT 1 FROM accounting_companies ac 
  WHERE ac.bank_id = b.id
);

-- Create a function to automatically create accounting_companies entry when a bank is created
CREATE OR REPLACE FUNCTION sync_bank_to_accounting_companies()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO accounting_companies (name, oib, is_bank, bank_id)
  VALUES (NEW.name, 'BANK-' || substring(NEW.id::text, 1, 6), true, NEW.id);
  
  RETURN NEW;
END;
$$;

-- Create trigger on banks table
DROP TRIGGER IF EXISTS trigger_sync_bank_to_accounting_companies ON banks;

CREATE TRIGGER trigger_sync_bank_to_accounting_companies
  AFTER INSERT ON banks
  FOR EACH ROW
  EXECUTE FUNCTION sync_bank_to_accounting_companies();

-- Also handle updates to bank name
CREATE OR REPLACE FUNCTION update_bank_in_accounting_companies()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE accounting_companies
  SET name = NEW.name
  WHERE bank_id = NEW.id;
  
  RETURN NEW;
END;
$$;

-- Create trigger for bank updates
DROP TRIGGER IF EXISTS trigger_update_bank_in_accounting_companies ON banks;

CREATE TRIGGER trigger_update_bank_in_accounting_companies
  AFTER UPDATE ON banks
  FOR EACH ROW
  WHEN (OLD.name IS DISTINCT FROM NEW.name)
  EXECUTE FUNCTION update_bank_in_accounting_companies();
