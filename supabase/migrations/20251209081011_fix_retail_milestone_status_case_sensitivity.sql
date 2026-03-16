/*
  # Fix retail milestone status trigger case sensitivity

  1. Problem
    - Trigger checks for status = 'paid' (lowercase)
    - But accounting_invoices.status uses 'PAID' (uppercase)
    - This causes milestones to never update to paid status

  2. Solution
    - Update trigger to check for uppercase 'PAID' status
    - Also handle 'UNPAID' and 'PARTIALLY_PAID' cases

  3. Security
    - No RLS changes needed
*/

-- Drop and recreate trigger function with correct case
DROP FUNCTION IF EXISTS update_retail_milestone_status_on_payment() CASCADE;

CREATE OR REPLACE FUNCTION update_retail_milestone_status_on_payment()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- If invoice is paid and has a retail milestone
  IF NEW.status = 'PAID' AND NEW.retail_milestone_id IS NOT NULL THEN
    UPDATE retail_contract_milestones
    SET 
      status = 'paid',
      completed_date = CURRENT_DATE,
      updated_at = now()
    WHERE id = NEW.retail_milestone_id;
  END IF;
  
  -- If invoice was paid but is now unpaid/partial
  IF (OLD.status = 'PAID' AND NEW.status != 'PAID') 
     AND NEW.retail_milestone_id IS NOT NULL THEN
    UPDATE retail_contract_milestones
    SET 
      status = 'pending',
      completed_date = NULL,
      updated_at = now()
    WHERE id = NEW.retail_milestone_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Recreate trigger
DROP TRIGGER IF EXISTS trigger_update_retail_milestone_status ON accounting_invoices;
CREATE TRIGGER trigger_update_retail_milestone_status
AFTER UPDATE OF status ON accounting_invoices
FOR EACH ROW
EXECUTE FUNCTION update_retail_milestone_status_on_payment();

-- Also fix the delete trigger to use uppercase
DROP FUNCTION IF EXISTS reset_retail_milestone_on_invoice_delete() CASCADE;

CREATE OR REPLACE FUNCTION reset_retail_milestone_on_invoice_delete()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Reset milestone to pending if invoice is deleted and it was paid
  IF OLD.retail_milestone_id IS NOT NULL AND OLD.status = 'PAID' THEN
    UPDATE retail_contract_milestones
    SET 
      status = 'pending',
      completed_date = NULL,
      updated_at = now()
    WHERE id = OLD.retail_milestone_id;
  END IF;
  
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- Recreate delete trigger
DROP TRIGGER IF EXISTS trigger_reset_retail_milestone_on_delete ON accounting_invoices;
CREATE TRIGGER trigger_reset_retail_milestone_on_delete
BEFORE DELETE ON accounting_invoices
FOR EACH ROW
EXECUTE FUNCTION reset_retail_milestone_on_invoice_delete();

-- Fix any existing milestones that should be marked as paid
UPDATE retail_contract_milestones rcm
SET 
  status = 'paid',
  completed_date = CURRENT_DATE,
  updated_at = now()
WHERE rcm.status != 'paid'
  AND EXISTS (
    SELECT 1 
    FROM accounting_invoices ai
    WHERE ai.retail_milestone_id = rcm.id
      AND ai.status = 'PAID'
  );
