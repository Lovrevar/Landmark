/*
  # Separate Drawn and Repaid Tracking for Bank Credits

  1. Problem
    - Current system uses `outstanding_balance` for both drawn and repaid amounts
    - Cannot distinguish between:
      - How much credit has been used (drawn for payments)
      - How much has been repaid to the bank
      - True outstanding debt to bank

  2. New Structure
    - `amount`: Total credit limit (e.g., €20M)
    - `used_amount`: How much has been drawn/spent paying invoices (e.g., €25K)
    - `repaid_amount`: How much has been repaid to the bank (e.g., €0)
    - `outstanding_balance`: Debt to bank = amount - repaid_amount (e.g., €20M)
    - Available to use = amount - used_amount (calculated, e.g., €19,975M)

  3. Credit Types
    - **Line of Credit**: Draw incrementally as needed, repay incrementally
    - **Term Loan/Junior Credit**: Full amount disbursed upfront, use gradually, repay over time

  4. Changes
    - Add `used_amount` and `repaid_amount` columns
    - Update triggers to track usage separately from repayment
    - Migrate existing data (outstanding_balance → used_amount)
*/

-- Add new columns
ALTER TABLE bank_credits
ADD COLUMN IF NOT EXISTS used_amount decimal(15,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS repaid_amount decimal(15,2) DEFAULT 0;

-- Migrate existing data: current outstanding_balance represents used_amount
UPDATE bank_credits
SET used_amount = outstanding_balance,
    repaid_amount = 0
WHERE used_amount = 0;

-- Update outstanding_balance to represent true debt to bank
-- For now, outstanding = amount (assuming full credit is active and nothing repaid yet)
-- This will be corrected when repayments are tracked
UPDATE bank_credits
SET outstanding_balance = amount - repaid_amount;

-- Drop existing trigger
DROP TRIGGER IF EXISTS trg_update_bank_credit_balance ON accounting_payments;
DROP FUNCTION IF EXISTS update_bank_credit_balance();

-- New function: Track USED amount when paying invoices via credit
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

  -- When deleting payment or updating to different credit_id
  IF (TG_OP = 'DELETE' OR (TG_OP = 'UPDATE' AND OLD.credit_id IS NOT NULL AND OLD.credit_id != COALESCE(NEW.credit_id, uuid_nil()))) THEN
    UPDATE bank_credits
    SET used_amount = COALESCE((
      SELECT SUM(amount)
      FROM accounting_payments
      WHERE credit_id = OLD.credit_id OR cesija_credit_id = OLD.credit_id
    ), 0)
    WHERE id = OLD.credit_id;
  END IF;

  -- When deleting payment or updating to different cesija_credit_id
  IF (TG_OP = 'DELETE' OR (TG_OP = 'UPDATE' AND OLD.cesija_credit_id IS NOT NULL AND OLD.cesija_credit_id != COALESCE(NEW.cesija_credit_id, uuid_nil()))) THEN
    UPDATE bank_credits
    SET used_amount = COALESCE((
      SELECT SUM(amount)
      FROM accounting_payments
      WHERE credit_id = OLD.cesija_credit_id OR cesija_credit_id = OLD.cesija_credit_id
    ), 0)
    WHERE id = OLD.cesija_credit_id;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to track used amount
CREATE TRIGGER trg_update_bank_credit_used_amount
  AFTER INSERT OR UPDATE OR DELETE ON accounting_payments
  FOR EACH ROW
  EXECUTE FUNCTION update_bank_credit_used_amount();

-- Recalculate all used amounts
UPDATE bank_credits bc
SET used_amount = COALESCE((
  SELECT SUM(ap.amount)
  FROM accounting_payments ap
  WHERE ap.credit_id = bc.id OR ap.cesija_credit_id = bc.id
), 0);

-- Add comment explaining the columns
COMMENT ON COLUMN bank_credits.amount IS 'Total credit limit or disbursed amount';
COMMENT ON COLUMN bank_credits.used_amount IS 'Amount drawn/spent paying invoices via this credit';
COMMENT ON COLUMN bank_credits.repaid_amount IS 'Amount repaid to the bank';
COMMENT ON COLUMN bank_credits.outstanding_balance IS 'Current debt to bank = amount - repaid_amount';
