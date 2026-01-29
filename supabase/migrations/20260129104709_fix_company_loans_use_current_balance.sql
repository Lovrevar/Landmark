/*
  # Fix Company Loans Triggers to Use current_balance

  1. Updates
    - Fix trigger function `update_bank_balances_on_loan_insert` to use `current_balance` instead of `balance`
    - Fix trigger function `update_bank_balances_on_loan_delete` to use `current_balance` instead of `balance`
*/

-- Trigger function to update bank account balances when loan is created
CREATE OR REPLACE FUNCTION update_bank_balances_on_loan_insert()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  -- Decrease current_balance of lender's account
  UPDATE company_bank_accounts
  SET current_balance = current_balance - NEW.amount
  WHERE id = NEW.from_bank_account_id;

  -- Increase current_balance of receiver's account
  UPDATE company_bank_accounts
  SET current_balance = current_balance + NEW.amount
  WHERE id = NEW.to_bank_account_id;

  RETURN NEW;
END;
$$;

-- Trigger function to reverse balance changes when loan is deleted
CREATE OR REPLACE FUNCTION update_bank_balances_on_loan_delete()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  -- Increase current_balance of lender's account (reverse the decrease)
  UPDATE company_bank_accounts
  SET current_balance = current_balance + OLD.amount
  WHERE id = OLD.from_bank_account_id;

  -- Decrease current_balance of receiver's account (reverse the increase)
  UPDATE company_bank_accounts
  SET current_balance = current_balance - OLD.amount
  WHERE id = OLD.to_bank_account_id;

  RETURN OLD;
END;
$$;