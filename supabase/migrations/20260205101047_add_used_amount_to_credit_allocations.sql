/*
  # Add Used Amount Tracking to Credit Allocations

  1. Changes
    - Add `used_amount` column to `credit_allocations` table to track how much has been used from each allocation
    - Create trigger to update `used_amount` when payments are made using credit allocations
    - Create trigger to decrease `used_amount` when payments are deleted

  2. Purpose
    - Track credit usage per allocation (per project)
    - Show available amount per project allocation
*/

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'credit_allocations' AND column_name = 'used_amount'
  ) THEN
    ALTER TABLE credit_allocations 
    ADD COLUMN used_amount numeric DEFAULT 0 NOT NULL;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION update_credit_allocation_used_amount()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.credit_allocation_id IS NOT NULL THEN
      UPDATE credit_allocations
      SET used_amount = COALESCE(used_amount, 0) + NEW.amount
      WHERE id = NEW.credit_allocation_id;
    END IF;

    IF NEW.cesija_credit_allocation_id IS NOT NULL THEN
      UPDATE credit_allocations
      SET used_amount = COALESCE(used_amount, 0) - NEW.amount
      WHERE id = NEW.cesija_credit_allocation_id;
    END IF;
    
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    IF OLD.credit_allocation_id IS NOT NULL THEN
      UPDATE credit_allocations
      SET used_amount = COALESCE(used_amount, 0) - OLD.amount
      WHERE id = OLD.credit_allocation_id;
    END IF;

    IF OLD.cesija_credit_allocation_id IS NOT NULL THEN
      UPDATE credit_allocations
      SET used_amount = COALESCE(used_amount, 0) + OLD.amount
      WHERE id = OLD.cesija_credit_allocation_id;
    END IF;
    
    RETURN OLD;
  END IF;
  
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trigger_update_credit_allocation_used_amount ON accounting_payments;
CREATE TRIGGER trigger_update_credit_allocation_used_amount
  AFTER INSERT OR DELETE ON accounting_payments
  FOR EACH ROW
  EXECUTE FUNCTION update_credit_allocation_used_amount();
