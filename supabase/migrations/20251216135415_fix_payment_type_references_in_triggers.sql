/*
  # Fix Payment Type References in Triggers

  1. Problem
    - Function `update_contract_budget_realized` tries to access `NEW.contract_id` from `accounting_payments`
    - `accounting_payments` table doesn't have `contract_id` field
    - `contract_id` is in the related `accounting_invoices` table

  2. Solution
    - Rewrite function to get `contract_id` from the related invoice
    - Handle both INSERT/UPDATE and DELETE cases correctly
*/

-- Drop and recreate the function with correct logic
DROP FUNCTION IF EXISTS update_contract_budget_realized() CASCADE;

CREATE OR REPLACE FUNCTION update_contract_budget_realized()
RETURNS TRIGGER AS $$
DECLARE
  v_contract_id uuid;
  v_old_contract_id uuid;
BEGIN
  -- For INSERT/UPDATE: get contract_id from the new invoice
  IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
    SELECT ai.contract_id INTO v_contract_id
    FROM accounting_invoices ai
    WHERE ai.id = NEW.invoice_id;
    
    IF v_contract_id IS NOT NULL THEN
      UPDATE contracts
      SET budget_realized = (
        SELECT COALESCE(SUM(ap.base_amount), 0)
        FROM accounting_payments ap
        INNER JOIN accounting_invoices ai ON ap.invoice_id = ai.id
        WHERE ai.contract_id = v_contract_id
          AND ai.invoice_type = 'outgoing_subcontractor'
      )
      WHERE id = v_contract_id;
    END IF;
  END IF;

  -- For DELETE or UPDATE: handle old invoice's contract
  IF TG_OP = 'DELETE' OR (TG_OP = 'UPDATE' AND OLD.invoice_id != NEW.invoice_id) THEN
    SELECT ai.contract_id INTO v_old_contract_id
    FROM accounting_invoices ai
    WHERE ai.id = OLD.invoice_id;
    
    IF v_old_contract_id IS NOT NULL THEN
      UPDATE contracts
      SET budget_realized = (
        SELECT COALESCE(SUM(ap.base_amount), 0)
        FROM accounting_payments ap
        INNER JOIN accounting_invoices ai ON ap.invoice_id = ai.id
        WHERE ai.contract_id = v_old_contract_id
          AND ai.invoice_type = 'outgoing_subcontractor'
      )
      WHERE id = v_old_contract_id;
    END IF;
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp;

-- Recreate the trigger
DROP TRIGGER IF EXISTS trg_update_contract_budget_realized ON accounting_payments;
CREATE TRIGGER trg_update_contract_budget_realized
  AFTER INSERT OR UPDATE OR DELETE ON accounting_payments
  FOR EACH ROW
  EXECUTE FUNCTION update_contract_budget_realized();
