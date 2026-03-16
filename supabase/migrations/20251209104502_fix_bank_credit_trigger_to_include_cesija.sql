/*
  # Fix Bank Credit Trigger to Include Cesija (Assignment) Payments

  1. Problem
    - Current trigger only tracks payments via credit_id
    - Payments via cesija_credit_id are not tracked

  2. Solution
    - Update trigger to track both credit_id AND cesija_credit_id
    - outstanding_balance = SUM(credit_id payments) + SUM(cesija_credit_id payments)

  3. Logic
    - When paying directly: use credit_id (bank pays supplier directly)
    - When paying via cesija: use cesija_credit_id (bank pays to cesija holder)
    - Both should count toward outstanding_balance
*/

-- Drop existing trigger and function
DROP TRIGGER IF EXISTS trg_update_bank_credit_balance ON accounting_payments;
DROP FUNCTION IF EXISTS update_bank_credit_balance();

-- Updated function to handle both credit_id and cesija_credit_id
CREATE OR REPLACE FUNCTION update_bank_credit_balance()
RETURNS TRIGGER AS $$
BEGIN
  -- When inserting or updating payment with credit_id
  IF (TG_OP = 'INSERT' OR TG_OP = 'UPDATE') AND NEW.credit_id IS NOT NULL THEN
    UPDATE bank_credits
    SET outstanding_balance = COALESCE((
      SELECT SUM(amount)
      FROM accounting_payments
      WHERE credit_id = NEW.credit_id OR cesija_credit_id = NEW.credit_id
    ), 0)
    WHERE id = NEW.credit_id;
  END IF;

  -- When inserting or updating payment with cesija_credit_id
  IF (TG_OP = 'INSERT' OR TG_OP = 'UPDATE') AND NEW.cesija_credit_id IS NOT NULL THEN
    UPDATE bank_credits
    SET outstanding_balance = COALESCE((
      SELECT SUM(amount)
      FROM accounting_payments
      WHERE credit_id = NEW.cesija_credit_id OR cesija_credit_id = NEW.cesija_credit_id
    ), 0)
    WHERE id = NEW.cesija_credit_id;
  END IF;

  -- When deleting payment or updating to different credit_id
  IF (TG_OP = 'DELETE' OR (TG_OP = 'UPDATE' AND OLD.credit_id IS NOT NULL AND OLD.credit_id != COALESCE(NEW.credit_id, uuid_nil()))) THEN
    UPDATE bank_credits
    SET outstanding_balance = COALESCE((
      SELECT SUM(amount)
      FROM accounting_payments
      WHERE credit_id = OLD.credit_id OR cesija_credit_id = OLD.credit_id
    ), 0)
    WHERE id = OLD.credit_id;
  END IF;

  -- When deleting payment or updating to different cesija_credit_id
  IF (TG_OP = 'DELETE' OR (TG_OP = 'UPDATE' AND OLD.cesija_credit_id IS NOT NULL AND OLD.cesija_credit_id != COALESCE(NEW.cesija_credit_id, uuid_nil()))) THEN
    UPDATE bank_credits
    SET outstanding_balance = COALESCE((
      SELECT SUM(amount)
      FROM accounting_payments
      WHERE credit_id = OLD.cesija_credit_id OR cesija_credit_id = OLD.cesija_credit_id
    ), 0)
    WHERE id = OLD.cesija_credit_id;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger on accounting_payments
CREATE TRIGGER trg_update_bank_credit_balance
  AFTER INSERT OR UPDATE OR DELETE ON accounting_payments
  FOR EACH ROW
  EXECUTE FUNCTION update_bank_credit_balance();

-- Recalculate all outstanding balances to include both credit_id and cesija_credit_id
UPDATE bank_credits bc
SET outstanding_balance = COALESCE((
  SELECT SUM(ap.amount)
  FROM accounting_payments ap
  WHERE ap.credit_id = bc.id OR ap.cesija_credit_id = bc.id
), 0);
