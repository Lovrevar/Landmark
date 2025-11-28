/*
  # Make contract_number nullable with auto-generation

  1. Problem
    - Frontend tries to insert contracts but contract_number is NULL
    - This breaks the insert for Supervision users
    
  2. Solution
    - Make contract_number nullable temporarily
    - Add a trigger to auto-generate contract_number if not provided
    - This ensures backwards compatibility and fixes the immediate issue
    
  3. Implementation
    - Alter column to allow NULL
    - Create function to generate contract number
    - Create trigger to auto-populate contract_number on insert
*/

-- Make contract_number nullable
ALTER TABLE contracts 
ALTER COLUMN contract_number DROP NOT NULL;

-- Create function to generate contract number
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
BEGIN
  -- Only generate if contract_number is NULL
  IF NEW.contract_number IS NULL THEN
    -- Get current count of contracts
    SELECT COUNT(*) INTO contract_count FROM contracts;
    
    -- Generate timestamp suffix (last 6 digits of current timestamp)
    timestamp_suffix := RIGHT(EXTRACT(EPOCH FROM NOW())::TEXT, 6);
    
    -- Generate contract number
    new_contract_number := 'CNT-' || 
                          EXTRACT(YEAR FROM NOW())::TEXT || '-' ||
                          LPAD((contract_count + 1)::TEXT, 4, '0') || '-' ||
                          timestamp_suffix;
    
    NEW.contract_number := new_contract_number;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger to auto-generate contract_number
DROP TRIGGER IF EXISTS trigger_generate_contract_number ON contracts;

CREATE TRIGGER trigger_generate_contract_number
  BEFORE INSERT ON contracts
  FOR EACH ROW
  EXECUTE FUNCTION generate_contract_number();
