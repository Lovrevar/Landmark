/*
  # Fix Subcontractor Contract Count Function

  1. Problem
    - Function tries to update non-existent column "contract_count"
    - Correct column name is "active_contracts_count"

  2. Solution
    - Update function to use correct column name
    - Maintain same logic but with correct column reference
*/

-- Drop and recreate the function with correct column name
CREATE OR REPLACE FUNCTION update_subcontractor_contract_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE subcontractors
    SET active_contracts_count = COALESCE(active_contracts_count, 0) + 1
    WHERE id = NEW.subcontractor_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE subcontractors
    SET active_contracts_count = GREATEST(0, COALESCE(active_contracts_count, 0) - 1)
    WHERE id = OLD.subcontractor_id;
  END IF;
  
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$;
