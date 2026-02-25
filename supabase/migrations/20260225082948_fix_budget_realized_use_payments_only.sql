/*
  # Fix budget_realized to use actual payments only

  ## Problem
  Two triggers were writing to `contracts.budget_realized`:
  1. `recalculate_subcontractor_budget_realized_trigger` on `accounting_invoices` - was summing invoice base_amount (no VAT, even unpaid invoices) - WRONG
  2. `update_contract_budget_on_invoice_delete_trigger` on `accounting_invoices` DELETE - same wrong logic
  3. `trg_update_contract_budget_realized` on `accounting_payments` - correctly sums actual payments - CORRECT

  The invoice-based triggers were overwriting the correct payment-based value.

  ## Changes
  1. Drop the two incorrect invoice-based triggers and their functions
  2. Keep and ensure the payment-based trigger (`trg_update_contract_budget_realized`) is correct
  3. Retroactively recalculate all contracts.budget_realized from actual accounting_payments

  ## Result
  - `budget_realized` = SUM of accounting_payments.amount (includes VAT) for all payments
    linked to invoices belonging to that contract
  - If no payments exist, budget_realized = 0 (even if invoices exist)
*/

-- Drop the incorrect invoice-based triggers
DROP TRIGGER IF EXISTS recalculate_subcontractor_budget_realized_trigger ON accounting_invoices;
DROP TRIGGER IF EXISTS update_contract_budget_on_invoice_delete_trigger ON accounting_invoices;

-- Drop their functions
DROP FUNCTION IF EXISTS recalculate_subcontractor_budget_realized();
DROP FUNCTION IF EXISTS update_contract_budget_on_invoice_delete();

-- Ensure the correct payment-based function exists and is up to date
CREATE OR REPLACE FUNCTION update_contract_budget_realized()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_contract_id uuid;
  v_total_paid numeric;
BEGIN
  IF TG_OP = 'DELETE' THEN
    SELECT contract_id INTO v_contract_id
    FROM accounting_invoices
    WHERE id = OLD.invoice_id;
  ELSE
    SELECT contract_id INTO v_contract_id
    FROM accounting_invoices
    WHERE id = NEW.invoice_id;
  END IF;

  IF v_contract_id IS NOT NULL THEN
    SELECT COALESCE(SUM(ap.amount), 0) INTO v_total_paid
    FROM accounting_payments ap
    INNER JOIN accounting_invoices ai ON ap.invoice_id = ai.id
    WHERE ai.contract_id = v_contract_id;

    UPDATE contracts
    SET budget_realized = v_total_paid
    WHERE id = v_contract_id;
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Ensure the trigger on accounting_payments exists
DROP TRIGGER IF EXISTS trg_update_contract_budget_realized ON accounting_payments;
CREATE TRIGGER trg_update_contract_budget_realized
  AFTER INSERT OR UPDATE OR DELETE ON accounting_payments
  FOR EACH ROW
  EXECUTE FUNCTION update_contract_budget_realized();

-- Retroactively recalculate ALL contracts.budget_realized from actual payments
UPDATE contracts c
SET budget_realized = COALESCE((
  SELECT SUM(ap.amount)
  FROM accounting_payments ap
  INNER JOIN accounting_invoices ai ON ap.invoice_id = ai.id
  WHERE ai.contract_id = c.id
), 0);
