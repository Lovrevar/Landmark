/*
  # Fix Retail Contract Budget Trigger for Percentage-Based Milestones v2

  ## Purpose
  Update the trigger function to calculate budget_realized based on percentages instead of amounts.

  ## Changes
  1. Drop all existing triggers
  2. Drop old function with CASCADE
  3. Create new function that calculates based on percentage * contract_amount
  4. Create trigger
*/

-- Drop all existing triggers
DROP TRIGGER IF EXISTS update_contract_budget_on_milestone ON retail_contract_milestones;
DROP TRIGGER IF EXISTS trigger_update_retail_contract_budget_on_milestone_change ON retail_contract_milestones;

-- Drop old function with CASCADE to remove dependencies
DROP FUNCTION IF EXISTS update_retail_contract_budget_realized() CASCADE;

-- Create new function that uses percentages
CREATE OR REPLACE FUNCTION update_retail_contract_budget_realized()
RETURNS TRIGGER AS $$
DECLARE
  v_contract_id uuid;
  v_contract_amount numeric;
  v_total_paid numeric;
BEGIN
  -- Get contract_id (handle INSERT, UPDATE, DELETE)
  IF TG_OP = 'DELETE' THEN
    v_contract_id := OLD.contract_id;
  ELSE
    v_contract_id := NEW.contract_id;
  END IF;

  -- Get contract amount
  SELECT contract_amount INTO v_contract_amount
  FROM retail_contracts
  WHERE id = v_contract_id;

  -- Calculate total paid based on percentages
  SELECT COALESCE(SUM((percentage / 100.0) * v_contract_amount), 0) INTO v_total_paid
  FROM retail_contract_milestones
  WHERE contract_id = v_contract_id AND status = 'paid';

  -- Update budget_realized in retail_contracts
  UPDATE retail_contracts
  SET budget_realized = v_total_paid,
      updated_at = now()
  WHERE id = v_contract_id;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger
CREATE TRIGGER update_contract_budget_on_milestone
  AFTER INSERT OR UPDATE OR DELETE ON retail_contract_milestones
  FOR EACH ROW
  EXECUTE FUNCTION update_retail_contract_budget_realized();
