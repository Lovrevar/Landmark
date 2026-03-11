/*
  # Fix Payment Type References in Bank Credit Triggers

  1. Problem
    - Functions `update_bank_credit_used_amount` and `update_bank_credit_repaid_amount` reference `payment_type` field
    - This field does not exist in `accounting_payments` table
    - Causes error: "record \"new\" has no field \"payment_type\""

  2. Solution
    - Drop the problematic functions and their triggers using CASCADE
    - These functions are outdated and conflict with the correct implementation
    - The correct trigger `trg_update_bank_credit_used_amount` from migration 20251209105605 handles credit tracking

  3. Notes
    - The working trigger from 20251209105605 uses `credit_id` and `cesija_credit_id` properly
    - No `payment_type` field is needed for tracking credit usage
*/

-- Drop triggers first
DROP TRIGGER IF EXISTS update_bank_credit_used_amount_trigger ON accounting_payments CASCADE;
DROP TRIGGER IF EXISTS update_bank_credit_repaid_amount_trigger ON accounting_payments CASCADE;

-- Drop the problematic functions with CASCADE
DROP FUNCTION IF EXISTS update_bank_credit_used_amount() CASCADE;
DROP FUNCTION IF EXISTS update_bank_credit_repaid_amount() CASCADE;

-- Verify the correct trigger exists (from migration 20251209105605)
-- If it doesn't exist, recreate it

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger 
    WHERE tgname = 'trg_update_bank_credit_used_amount'
  ) THEN
    -- Recreate the correct function and trigger from 20251209105605
    CREATE OR REPLACE FUNCTION update_bank_credit_used_amount()
    RETURNS TRIGGER AS $func$
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
    $func$ LANGUAGE plpgsql SECURITY DEFINER
    SET search_path = public;

    -- Create trigger to track used amount
    CREATE TRIGGER trg_update_bank_credit_used_amount
      AFTER INSERT OR UPDATE OR DELETE ON accounting_payments
      FOR EACH ROW
      EXECUTE FUNCTION update_bank_credit_used_amount();
  END IF;
END $$;
