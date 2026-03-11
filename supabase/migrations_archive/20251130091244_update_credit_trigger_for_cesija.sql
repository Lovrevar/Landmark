/*
  # Update credit balance trigger to handle cesija credits

  1. Changes
    - Update trigger to handle both direct credit payments and cesija credit payments
    - When a payment is made from a cesija credit, update that credit's balance
    
  2. Notes
    - Supports both payment_source_type='credit' with credit_id
    - AND cesija payments with cesija_credit_id
*/

-- Function to update credit balance when payment is made
CREATE OR REPLACE FUNCTION update_company_credit_balance()
RETURNS TRIGGER AS $$
BEGIN
  -- When a payment is inserted or updated with credit as source, update credit balance
  IF (TG_OP = 'INSERT' OR TG_OP = 'UPDATE') AND NEW.payment_source_type = 'credit' AND NEW.credit_id IS NOT NULL THEN
    -- For credit payments, current_balance = total amount spent from credit
    UPDATE company_credits
    SET current_balance = COALESCE(
      (SELECT SUM(ap.amount)
       FROM accounting_payments ap
       WHERE ap.credit_id = NEW.credit_id AND ap.payment_source_type = 'credit'
      ), 0
    ),
    updated_at = now()
    WHERE id = NEW.credit_id;
  END IF;

  -- When a payment is made via cesija from a credit, update that cesija credit balance
  IF (TG_OP = 'INSERT' OR TG_OP = 'UPDATE') AND NEW.cesija_credit_id IS NOT NULL THEN
    UPDATE company_credits
    SET current_balance = COALESCE(
      (SELECT SUM(ap.amount)
       FROM accounting_payments ap
       WHERE ap.cesija_credit_id = NEW.cesija_credit_id
      ), 0
    ),
    updated_at = now()
    WHERE id = NEW.cesija_credit_id;
  END IF;

  -- When a payment is deleted, update the credit balance
  IF TG_OP = 'DELETE' AND OLD.payment_source_type = 'credit' AND OLD.credit_id IS NOT NULL THEN
    UPDATE company_credits
    SET current_balance = COALESCE(
      (SELECT SUM(ap.amount)
       FROM accounting_payments ap
       WHERE ap.credit_id = OLD.credit_id AND ap.payment_source_type = 'credit'
      ), 0
    ),
    updated_at = now()
    WHERE id = OLD.credit_id;
  END IF;

  -- When a cesija payment is deleted, update the cesija credit balance
  IF TG_OP = 'DELETE' AND OLD.cesija_credit_id IS NOT NULL THEN
    UPDATE company_credits
    SET current_balance = COALESCE(
      (SELECT SUM(ap.amount)
       FROM accounting_payments ap
       WHERE ap.cesija_credit_id = OLD.cesija_credit_id
      ), 0
    ),
    updated_at = now()
    WHERE id = OLD.cesija_credit_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;