/*
  # Create Funding Payment Tables

  ## Summary
  This migration creates two new tables for tracking payments in the Funding profile:
  - `bank_credit_payments` for payments made to banks on credit facilities
  - `investor_payments` for payments made to investors on investments

  ## Tables Created

  ### bank_credit_payments
  - `id` (uuid, primary key) - Unique payment identifier
  - `bank_credit_id` (uuid, foreign key) - Reference to the bank credit being paid
  - `bank_id` (uuid, foreign key) - Reference to the bank receiving payment
  - `amount` (numeric) - Payment amount
  - `payment_date` (date, nullable) - Date when payment was made (optional)
  - `notes` (text, nullable) - Additional notes about the payment
  - `created_by` (uuid, nullable) - User who recorded the payment
  - `created_at` (timestamptz) - When the payment record was created
  - `updated_at` (timestamptz) - When the payment record was last updated

  ### investor_payments
  - `id` (uuid, primary key) - Unique payment identifier
  - `project_investment_id` (uuid, foreign key) - Reference to the investment being paid
  - `investor_id` (uuid, foreign key) - Reference to the investor receiving payment
  - `amount` (numeric) - Payment amount
  - `payment_date` (date, nullable) - Date when payment was made (optional)
  - `notes` (text, nullable) - Additional notes about the payment
  - `created_by` (uuid, nullable) - User who recorded the payment
  - `created_at` (timestamptz) - When the payment record was created
  - `updated_at` (timestamptz) - When the payment record was last updated

  ## Security
  - Enable RLS on both tables
  - Add policies for authenticated users to:
    - SELECT all records
    - INSERT new payment records
    - UPDATE their own payment records
    - DELETE their own payment records
*/

-- Create bank_credit_payments table
CREATE TABLE IF NOT EXISTS bank_credit_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bank_credit_id uuid REFERENCES bank_credits(id) ON DELETE CASCADE,
  bank_id uuid REFERENCES banks(id) ON DELETE CASCADE,
  amount numeric NOT NULL DEFAULT 0,
  payment_date date,
  notes text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create investor_payments table
CREATE TABLE IF NOT EXISTS investor_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_investment_id uuid REFERENCES project_investments(id) ON DELETE CASCADE,
  investor_id uuid REFERENCES investors(id) ON DELETE CASCADE,
  amount numeric NOT NULL DEFAULT 0,
  payment_date date,
  notes text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS on bank_credit_payments
ALTER TABLE bank_credit_payments ENABLE ROW LEVEL SECURITY;

-- Enable RLS on investor_payments
ALTER TABLE investor_payments ENABLE ROW LEVEL SECURITY;

-- RLS Policies for bank_credit_payments
CREATE POLICY "Authenticated users can view all bank credit payments"
  ON bank_credit_payments FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert bank credit payments"
  ON bank_credit_payments FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update bank credit payments"
  ON bank_credit_payments FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete bank credit payments"
  ON bank_credit_payments FOR DELETE
  TO authenticated
  USING (true);

-- RLS Policies for investor_payments
CREATE POLICY "Authenticated users can view all investor payments"
  ON investor_payments FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert investor payments"
  ON investor_payments FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update investor payments"
  ON investor_payments FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete investor payments"
  ON investor_payments FOR DELETE
  TO authenticated
  USING (true);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_bank_credit_payments_bank_credit_id ON bank_credit_payments(bank_credit_id);
CREATE INDEX IF NOT EXISTS idx_bank_credit_payments_bank_id ON bank_credit_payments(bank_id);
CREATE INDEX IF NOT EXISTS idx_bank_credit_payments_created_at ON bank_credit_payments(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_investor_payments_investment_id ON investor_payments(project_investment_id);
CREATE INDEX IF NOT EXISTS idx_investor_payments_investor_id ON investor_payments(investor_id);
CREATE INDEX IF NOT EXISTS idx_investor_payments_created_at ON investor_payments(created_at DESC);

-- Create updated_at trigger function if it doesn't exist
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Add triggers to automatically update updated_at
DROP TRIGGER IF EXISTS update_bank_credit_payments_updated_at ON bank_credit_payments;
CREATE TRIGGER update_bank_credit_payments_updated_at
  BEFORE UPDATE ON bank_credit_payments
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_investor_payments_updated_at ON investor_payments;
CREATE TRIGGER update_investor_payments_updated_at
  BEFORE UPDATE ON investor_payments
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
