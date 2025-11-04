/*
  # Create Budget Integrity Check Function and Trigger
  
  This migration creates a function and trigger to automatically maintain
  budget_realized accuracy when wire_payments are inserted or deleted.
  
  ## Changes
  
  1. Create function to recalculate budget_realized based on actual payments
  2. Create trigger to automatically update budget_realized on payment changes
  3. Ensure data integrity between wire_payments and subcontractor budget_realized
  
  ## Business Logic
  
  - When a wire_payment is inserted, automatically recalculate subcontractor's budget_realized
  - When a wire_payment is deleted, automatically recalculate subcontractor's budget_realized
  - Budget_realized should always equal the sum of all wire_payments for that subcontractor
*/

-- Create function to recalculate budget_realized for a subcontractor
CREATE OR REPLACE FUNCTION recalculate_subcontractor_budget_realized()
RETURNS TRIGGER AS $$
DECLARE
  v_subcontractor_id UUID;
  v_total_paid NUMERIC;
BEGIN
  -- Determine which subcontractor_id to update
  IF TG_OP = 'DELETE' THEN
    v_subcontractor_id := OLD.subcontractor_id;
  ELSE
    v_subcontractor_id := NEW.subcontractor_id;
  END IF;
  
  -- Calculate total paid amount for this subcontractor
  SELECT COALESCE(SUM(amount), 0)
  INTO v_total_paid
  FROM wire_payments
  WHERE subcontractor_id = v_subcontractor_id;
  
  -- Update subcontractor's budget_realized
  UPDATE subcontractors
  SET budget_realized = v_total_paid
  WHERE id = v_subcontractor_id;
  
  -- Return appropriate record
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for INSERT operations
DROP TRIGGER IF EXISTS trigger_recalculate_budget_on_payment_insert ON wire_payments;
CREATE TRIGGER trigger_recalculate_budget_on_payment_insert
  AFTER INSERT ON wire_payments
  FOR EACH ROW
  EXECUTE FUNCTION recalculate_subcontractor_budget_realized();

-- Create trigger for DELETE operations
DROP TRIGGER IF EXISTS trigger_recalculate_budget_on_payment_delete ON wire_payments;
CREATE TRIGGER trigger_recalculate_budget_on_payment_delete
  AFTER DELETE ON wire_payments
  FOR EACH ROW
  EXECUTE FUNCTION recalculate_subcontractor_budget_realized();

-- Add comment
COMMENT ON FUNCTION recalculate_subcontractor_budget_realized() IS 
  'Automatically recalculates and updates subcontractor budget_realized based on actual wire_payments';
