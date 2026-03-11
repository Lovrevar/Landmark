/*
  # Fix Bank Credits Outstanding Balance and Add Auto-Update Triggers

  1. Fix Outstanding Balance
    - Reset all outstanding_balance to 0 where there are no payments
    - Recalculate based on actual payments from accounting_payments

  2. Add Triggers
    - Auto-update outstanding_balance when payment is added via credit
    - Auto-update outstanding_balance when payment is deleted
    - Auto-update outstanding_balance when payment is updated

  3. Logic
    - outstanding_balance = SUM of all payments made via this credit_id
    - For line_of_credit: available = amount - outstanding_balance
*/

-- Function to update bank credit outstanding balance
CREATE OR REPLACE FUNCTION update_bank_credit_balance()
RETURNS TRIGGER AS $$
BEGIN
  -- When inserting or updating payment with credit_id
  IF (TG_OP = 'INSERT' OR TG_OP = 'UPDATE') AND NEW.credit_id IS NOT NULL THEN
    UPDATE bank_credits
    SET outstanding_balance = COALESCE((
      SELECT SUM(amount)
      FROM accounting_payments
      WHERE credit_id = NEW.credit_id
    ), 0)
    WHERE id = NEW.credit_id;
  END IF;

  -- When deleting payment or updating to different credit
  IF (TG_OP = 'DELETE' OR (TG_OP = 'UPDATE' AND OLD.credit_id IS NOT NULL AND OLD.credit_id != COALESCE(NEW.credit_id, uuid_nil()))) THEN
    UPDATE bank_credits
    SET outstanding_balance = COALESCE((
      SELECT SUM(amount)
      FROM accounting_payments
      WHERE credit_id = OLD.credit_id
    ), 0)
    WHERE id = OLD.credit_id;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing trigger if exists
DROP TRIGGER IF EXISTS trg_update_bank_credit_balance ON accounting_payments;

-- Create trigger on accounting_payments
CREATE TRIGGER trg_update_bank_credit_balance
  AFTER INSERT OR UPDATE OR DELETE ON accounting_payments
  FOR EACH ROW
  EXECUTE FUNCTION update_bank_credit_balance();

-- Recalculate all outstanding balances based on actual payments
UPDATE bank_credits bc
SET outstanding_balance = COALESCE((
  SELECT SUM(ap.amount)
  FROM accounting_payments ap
  WHERE ap.credit_id = bc.id
), 0);
