/*
  # Fix Credit Balance Calculation

  1. Changes
    - Update credit balance trigger to correctly calculate spent amount
    - current_balance should show how much has been spent from the credit
    - Formula: current_balance = SUM(payments made from this credit)
    
  2. Notes
    - When credit is created: initial_amount = credit limit, current_balance = 0
    - When payment is made: current_balance increases (shows how much is spent)
    - Available = initial_amount - current_balance
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

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;