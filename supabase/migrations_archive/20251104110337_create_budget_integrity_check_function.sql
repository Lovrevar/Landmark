/*
  # Create Budget Integrity Check Function
  
  This migration creates a database function to check for inconsistencies between
  subcontractor budget_realized values and the actual sum of wire_payments.
  
  ## Changes
  
  1. New Function
    - `check_subcontractor_budget_integrity()` - Returns all subcontractors with mismatched budget_realized values
    - Compares stored budget_realized with calculated sum from wire_payments table
    - Returns subcontractor details including the discrepancy amount
  
  2. Function Details
    - Returns TABLE with columns: id, name, cost, stored_budget, actual_payments, discrepancy
    - Only returns rows where discrepancy exists (stored != actual)
    - Ordered by absolute discrepancy value descending (worst first)
  
  ## Usage
  
  Call this function to audit data integrity:
  ```sql
  SELECT * FROM check_subcontractor_budget_integrity();
  ```
  
  This can be run periodically or after bulk operations to ensure data consistency.
*/

-- Create function to check budget integrity
CREATE OR REPLACE FUNCTION check_subcontractor_budget_integrity()
RETURNS TABLE (
  id UUID,
  name TEXT,
  cost NUMERIC,
  stored_budget NUMERIC,
  actual_payments NUMERIC,
  discrepancy NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    s.id,
    s.name,
    s.cost,
    s.budget_realized as stored_budget,
    COALESCE(SUM(wp.amount), 0) as actual_payments,
    s.budget_realized - COALESCE(SUM(wp.amount), 0) as discrepancy
  FROM subcontractors s
  LEFT JOIN wire_payments wp ON wp.subcontractor_id = s.id
  GROUP BY s.id, s.name, s.cost, s.budget_realized
  HAVING s.budget_realized != COALESCE(SUM(wp.amount), 0)
  ORDER BY ABS(s.budget_realized - COALESCE(SUM(wp.amount), 0)) DESC;
END;
$$ LANGUAGE plpgsql;

-- Create function to fix budget integrity automatically
CREATE OR REPLACE FUNCTION fix_subcontractor_budget_integrity()
RETURNS TABLE (
  id UUID,
  name TEXT,
  old_budget NUMERIC,
  new_budget NUMERIC,
  discrepancy NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  WITH payment_totals AS (
    SELECT 
      s.id as subcontractor_id,
      s.name,
      s.budget_realized as old_budget,
      COALESCE(SUM(wp.amount), 0) as calculated_budget,
      s.budget_realized - COALESCE(SUM(wp.amount), 0) as disc
    FROM subcontractors s
    LEFT JOIN wire_payments wp ON wp.subcontractor_id = s.id
    GROUP BY s.id, s.name, s.budget_realized
    HAVING s.budget_realized != COALESCE(SUM(wp.amount), 0)
  ),
  updated AS (
    UPDATE subcontractors s
    SET budget_realized = pt.calculated_budget
    FROM payment_totals pt
    WHERE s.id = pt.subcontractor_id
    RETURNING s.id, pt.name, pt.old_budget, s.budget_realized as new_budget, pt.disc
  )
  SELECT * FROM updated;
  
  -- Also update contracts
  UPDATE contracts c
  SET budget_realized = (
    SELECT COALESCE(SUM(wp.amount), 0)
    FROM wire_payments wp
    WHERE wp.contract_id = c.id
  )
  WHERE c.budget_realized != (
    SELECT COALESCE(SUM(wp.amount), 0)
    FROM wire_payments wp
    WHERE wp.contract_id = c.id
  );
END;
$$ LANGUAGE plpgsql;

-- Add comment explaining the functions
COMMENT ON FUNCTION check_subcontractor_budget_integrity() IS 'Checks for inconsistencies between stored budget_realized and actual wire payment totals';
COMMENT ON FUNCTION fix_subcontractor_budget_integrity() IS 'Automatically fixes budget_realized inconsistencies by recalculating from wire_payments table';
