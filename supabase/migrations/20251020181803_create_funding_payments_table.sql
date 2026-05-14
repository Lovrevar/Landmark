/*
  # Create Funding Payments Table

  1. New Tables
    - `funding_payments`
      - `id` (uuid, primary key)
      - `investor_id` (uuid, nullable, foreign key to investors)
      - `bank_id` (uuid, nullable, foreign key to banks)
      - `project_investment_id` (uuid, nullable, foreign key to project_investments)
      - `bank_credit_id` (uuid, nullable, foreign key to bank_credits)
      - `amount` (numeric)
      - `payment_date` (date)
      - `payment_type` (text) - 'interest', 'principal', 'dividend', etc.
      - `notes` (text)
      - `created_by` (uuid, foreign key to auth.users)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on `funding_payments` table
    - Add policies for authenticated users to manage funding payments
*/

CREATE TABLE IF NOT EXISTS funding_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  investor_id uuid REFERENCES investors(id) ON DELETE CASCADE,
  bank_id uuid REFERENCES banks(id) ON DELETE CASCADE,
  project_investment_id uuid REFERENCES project_investments(id) ON DELETE SET NULL,
  bank_credit_id uuid REFERENCES bank_credits(id) ON DELETE SET NULL,
  amount numeric NOT NULL DEFAULT 0,
  payment_date date NOT NULL DEFAULT CURRENT_DATE,
  payment_type text NOT NULL DEFAULT 'principal',
  notes text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT funding_payment_recipient CHECK (
    (investor_id IS NOT NULL AND bank_id IS NULL) OR
    (investor_id IS NULL AND bank_id IS NOT NULL)
  )
);


ALTER TABLE funding_payments ENABLE ROW LEVEL SECURITY;


CREATE POLICY "Authenticated users can view funding payments"
  ON funding_payments
  FOR SELECT
  TO authenticated
  USING (true);


CREATE POLICY "Authenticated users can insert funding payments"
  ON funding_payments
  FOR INSERT
  TO authenticated
  WITH CHECK (true);


CREATE POLICY "Authenticated users can update funding payments"
  ON funding_payments
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);


CREATE POLICY "Authenticated users can delete funding payments"
  ON funding_payments
  FOR DELETE
  TO authenticated
  USING (true);


CREATE INDEX IF NOT EXISTS idx_funding_payments_investor ON funding_payments(investor_id);

CREATE INDEX IF NOT EXISTS idx_funding_payments_bank ON funding_payments(bank_id);

CREATE INDEX IF NOT EXISTS idx_funding_payments_date ON funding_payments(payment_date DESC);

;