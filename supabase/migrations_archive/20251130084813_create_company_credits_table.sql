/*
  # Create Company Credits Table

  1. New Tables
    - `company_credits`
      - `id` (uuid, primary key)
      - `company_id` (uuid, foreign key to accounting_companies)
      - `credit_name` (text, name/description of the credit)
      - `start_date` (date, when credit starts)
      - `end_date` (date, when credit ends)
      - `grace_period_months` (integer, grace period in months)
      - `interest_rate` (numeric, interest rate percentage)
      - `initial_amount` (numeric, original credit amount)
      - `current_balance` (numeric, current balance - updated by payments)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Changes to accounting_payments
    - Add `payment_source_type` (text, either 'bank_account' or 'credit')
    - Add `credit_id` (uuid, foreign key to company_credits)
    - This allows payments to be made from either bank accounts or credits

  3. Security
    - Enable RLS on `company_credits` table
    - Add policies for authenticated users to manage credits

  4. Notes
    - Each company can have multiple credits
    - Credits can be used as payment sources like bank accounts
    - The `current_balance` is calculated based on initial_amount + all payments
    - When payment is made from credit, it increases the credit balance (negative balance = money owed)
*/

-- Create company_credits table
CREATE TABLE IF NOT EXISTS company_credits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES accounting_companies(id) ON DELETE CASCADE,
  credit_name text NOT NULL,
  start_date date NOT NULL,
  end_date date NOT NULL,
  grace_period_months integer DEFAULT 0,
  interest_rate numeric NOT NULL DEFAULT 0,
  initial_amount numeric NOT NULL DEFAULT 0,
  current_balance numeric NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Add payment_source_type and credit_id to accounting_payments
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'accounting_payments' AND column_name = 'payment_source_type'
  ) THEN
    ALTER TABLE accounting_payments ADD COLUMN payment_source_type text DEFAULT 'bank_account' CHECK (payment_source_type IN ('bank_account', 'credit'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'accounting_payments' AND column_name = 'credit_id'
  ) THEN
    ALTER TABLE accounting_payments ADD COLUMN credit_id uuid REFERENCES company_credits(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_company_credits_company_id ON company_credits(company_id);
CREATE INDEX IF NOT EXISTS idx_accounting_payments_credit_id ON accounting_payments(credit_id);

-- Enable RLS
ALTER TABLE company_credits ENABLE ROW LEVEL SECURITY;

-- RLS Policies for company_credits
CREATE POLICY "Users can view all credits"
  ON company_credits FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert credits"
  ON company_credits FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can update credits"
  ON company_credits FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Users can delete credits"
  ON company_credits FOR DELETE
  TO authenticated
  USING (true);

-- Function to update credit balance when payment is made
CREATE OR REPLACE FUNCTION update_company_credit_balance()
RETURNS TRIGGER AS $$
BEGIN
  -- When a payment is inserted or updated with credit as source, update credit balance
  IF (TG_OP = 'INSERT' OR TG_OP = 'UPDATE') AND NEW.payment_source_type = 'credit' AND NEW.credit_id IS NOT NULL THEN
    -- For credit payments, we add the payment amount to current_balance
    -- (credit balance increases when money is borrowed/used)
    UPDATE company_credits
    SET current_balance = initial_amount + COALESCE(
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
    SET current_balance = initial_amount + COALESCE(
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

-- Create trigger on accounting_payments to update credit balance
DROP TRIGGER IF EXISTS update_credit_balance_trigger ON accounting_payments;
CREATE TRIGGER update_credit_balance_trigger
  AFTER INSERT OR UPDATE OR DELETE ON accounting_payments
  FOR EACH ROW
  EXECUTE FUNCTION update_company_credit_balance();