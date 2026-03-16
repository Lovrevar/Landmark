/*
  # Create Company Loans Table

  1. New Tables
    - `company_loans`
      - `id` (uuid, primary key)
      - `from_company_id` (uuid, references accounting_companies) - Company giving the loan
      - `from_bank_account_id` (uuid, references company_bank_accounts) - Bank account of lender
      - `to_company_id` (uuid, references accounting_companies) - Company receiving the loan
      - `to_bank_account_id` (uuid, references company_bank_accounts) - Bank account of receiver
      - `amount` (numeric) - Loan amount
      - `loan_date` (date) - Date of loan (optional)
      - `created_at` (timestamptz) - Creation timestamp

  2. Security
    - Enable RLS on `company_loans` table
    - Add policies for authenticated users to manage loans

  3. Triggers
    - Automatically update bank account balances when loan is created
    - Decrease balance of lender's account
    - Increase balance of receiver's account
    - Reverse changes when loan is deleted
*/

-- Create company_loans table
CREATE TABLE IF NOT EXISTS company_loans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  from_company_id uuid NOT NULL REFERENCES accounting_companies(id) ON DELETE CASCADE,
  from_bank_account_id uuid NOT NULL REFERENCES company_bank_accounts(id) ON DELETE CASCADE,
  to_company_id uuid NOT NULL REFERENCES accounting_companies(id) ON DELETE CASCADE,
  to_bank_account_id uuid NOT NULL REFERENCES company_bank_accounts(id) ON DELETE CASCADE,
  amount numeric NOT NULL CHECK (amount > 0),
  loan_date date DEFAULT CURRENT_DATE,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE company_loans ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Authenticated users can view company loans"
  ON company_loans FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can create company loans"
  ON company_loans FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete company loans"
  ON company_loans FOR DELETE
  TO authenticated
  USING (true);

-- Trigger function to update bank account balances when loan is created
CREATE OR REPLACE FUNCTION update_bank_balances_on_loan_insert()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  -- Decrease balance of lender's account
  UPDATE company_bank_accounts
  SET balance = balance - NEW.amount
  WHERE id = NEW.from_bank_account_id;

  -- Increase balance of receiver's account
  UPDATE company_bank_accounts
  SET balance = balance + NEW.amount
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
  -- Increase balance of lender's account (reverse the decrease)
  UPDATE company_bank_accounts
  SET balance = balance + OLD.amount
  WHERE id = OLD.from_bank_account_id;

  -- Decrease balance of receiver's account (reverse the increase)
  UPDATE company_bank_accounts
  SET balance = balance - OLD.amount
  WHERE id = OLD.to_bank_account_id;

  RETURN OLD;
END;
$$;

-- Create triggers
CREATE TRIGGER trigger_update_bank_balances_on_loan_insert
  AFTER INSERT ON company_loans
  FOR EACH ROW
  EXECUTE FUNCTION update_bank_balances_on_loan_insert();

CREATE TRIGGER trigger_update_bank_balances_on_loan_delete
  AFTER DELETE ON company_loans
  FOR EACH ROW
  EXECUTE FUNCTION update_bank_balances_on_loan_delete();