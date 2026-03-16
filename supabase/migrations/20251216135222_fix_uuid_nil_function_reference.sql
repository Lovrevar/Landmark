/*
  # Fix uuid_nil() Function Reference

  1. Problem
    - Function `update_bank_credit_used_amount` uses `uuid_nil()` which doesn't exist
    - Causes error: "function uuid_nil() does not exist"

  2. Solution
    - Replace `uuid_nil()` with proper NULL UUID handling
    - Use simpler comparison logic that handles NULLs correctly
*/

-- Drop and recreate the function with correct logic
DROP FUNCTION IF EXISTS update_bank_credit_used_amount() CASCADE;

CREATE OR REPLACE FUNCTION update_bank_credit_used_amount()
RETURNS TRIGGER AS $$
BEGIN
  -- When inserting or updating payment with credit_id
  IF (TG_OP = 'INSERT' OR TG_OP = 'UPDATE') AND NEW.credit_id IS NOT NULL THEN
    UPDATE bank_credits
    SET used_amount = COALESCE((
      SELECT SUM(amount)
      FROM accounting_payments
      WHERE credit_id = NEW.credit_id OR cesija_credit_id = NEW.credit_id
    ), 0)
    WHERE id = NEW.credit_id;
  END IF;

  -- When inserting or updating payment with cesija_credit_id
  IF (TG_OP = 'INSERT' OR TG_OP = 'UPDATE') AND NEW.cesija_credit_id IS NOT NULL THEN
    UPDATE bank_credits
    SET used_amount = COALESCE((
      SELECT SUM(amount)
      FROM accounting_payments
      WHERE credit_id = NEW.cesija_credit_id OR cesija_credit_id = NEW.cesija_credit_id
    ), 0)
    WHERE id = NEW.cesija_credit_id;
  END IF;

  -- When deleting or updating away from old credit_id
  IF TG_OP = 'DELETE' THEN
    IF OLD.credit_id IS NOT NULL THEN
      UPDATE bank_credits
      SET used_amount = COALESCE((
        SELECT SUM(amount)
        FROM accounting_payments
        WHERE credit_id = OLD.credit_id OR cesija_credit_id = OLD.credit_id
      ), 0)
      WHERE id = OLD.credit_id;
    END IF;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF OLD.credit_id IS NOT NULL AND (NEW.credit_id IS NULL OR OLD.credit_id != NEW.credit_id) THEN
      UPDATE bank_credits
      SET used_amount = COALESCE((
        SELECT SUM(amount)
        FROM accounting_payments
        WHERE credit_id = OLD.credit_id OR cesija_credit_id = OLD.credit_id
      ), 0)
      WHERE id = OLD.credit_id;
    END IF;
  END IF;

  -- When deleting or updating away from old cesija_credit_id
  IF TG_OP = 'DELETE' THEN
    IF OLD.cesija_credit_id IS NOT NULL THEN
      UPDATE bank_credits
      SET used_amount = COALESCE((
        SELECT SUM(amount)
        FROM accounting_payments
        WHERE credit_id = OLD.cesija_credit_id OR cesija_credit_id = OLD.cesija_credit_id
      ), 0)
      WHERE id = OLD.cesija_credit_id;
    END IF;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF OLD.cesija_credit_id IS NOT NULL AND (NEW.cesija_credit_id IS NULL OR OLD.cesija_credit_id != NEW.cesija_credit_id) THEN
      UPDATE bank_credits
      SET used_amount = COALESCE((
        SELECT SUM(amount)
        FROM accounting_payments
        WHERE credit_id = OLD.cesija_credit_id OR cesija_credit_id = OLD.cesija_credit_id
      ), 0)
      WHERE id = OLD.cesija_credit_id;
    END IF;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public;

-- Recreate the trigger
DROP TRIGGER IF EXISTS trg_update_bank_credit_used_amount ON accounting_payments;
CREATE TRIGGER trg_update_bank_credit_used_amount
  AFTER INSERT OR UPDATE OR DELETE ON accounting_payments
  FOR EACH ROW
  EXECUTE FUNCTION update_bank_credit_used_amount();
