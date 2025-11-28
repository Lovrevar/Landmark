/*
  # Fix Contract Number Generation Function

  1. Problem
    - Trigger function has SQL syntax error
    - "column contract_count does not exist" error
    - Function is trying to use variable as column name

  2. Solution
    - Fix the SQL query syntax in the trigger function
    - Ensure proper variable usage in PL/pgSQL

  3. Changes
    - Rewrite the function with correct syntax
    - Use proper variable declarations and assignments
*/

-- Drop and recreate the function with proper syntax
DROP FUNCTION IF EXISTS generate_contract_number() CASCADE;

CREATE OR REPLACE FUNCTION generate_contract_number()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  contract_count INTEGER;
  new_contract_number TEXT;
  timestamp_suffix TEXT;
  current_year TEXT;
BEGIN
  -- Only generate if contract_number is NULL
  IF NEW.contract_number IS NULL THEN
    -- Get current count of contracts
    SELECT COUNT(*)::INTEGER INTO contract_count FROM contracts;
    
    -- Get current year
    current_year := EXTRACT(YEAR FROM NOW())::TEXT;
    
    -- Generate timestamp suffix (last 6 digits of current epoch timestamp)
    timestamp_suffix := LPAD((EXTRACT(EPOCH FROM NOW())::BIGINT % 1000000)::TEXT, 6, '0');
    
    -- Generate contract number
    new_contract_number := 'CNT-' || 
                          current_year || '-' ||
                          LPAD((contract_count + 1)::TEXT, 4, '0') || '-' ||
                          timestamp_suffix;
    
    NEW.contract_number := new_contract_number;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Recreate trigger
DROP TRIGGER IF EXISTS trigger_generate_contract_number ON contracts;

CREATE TRIGGER trigger_generate_contract_number
  BEFORE INSERT ON contracts
  FOR EACH ROW
  EXECUTE FUNCTION generate_contract_number();
