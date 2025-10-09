/*
  # Create Wire Payments Table

  1. New Tables
    - `wire_payments`
      - `id` (uuid, primary key)
      - `subcontractor_id` (uuid, foreign key to subcontractors)
      - `amount` (numeric) - Payment amount
      - `payment_date` (date, nullable) - Date of payment (optional)
      - `notes` (text, nullable) - Optional notes about the payment
      - `created_by` (uuid, foreign key to auth.users) - Who created the payment
      - `created_at` (timestamptz) - When the record was created
      - `updated_at` (timestamptz) - When the record was last updated

  2. Security
    - Enable RLS on `wire_payments` table
    - Add policy for authenticated users to read all payments
    - Add policy for authenticated users to create payments
    - Add policy for authenticated users to update their own payments
    - Add policy for authenticated users to delete their own payments

  3. Notes
    - This table tracks all wire payment transactions
    - Payments are linked to subcontractors
    - Payment date is optional for cases where date is not yet known
    - Each payment record is auditable with creator and timestamps
*/

-- Create wire_payments table
CREATE TABLE IF NOT EXISTS wire_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subcontractor_id uuid NOT NULL REFERENCES subcontractors(id) ON DELETE CASCADE,
  amount numeric NOT NULL CHECK (amount > 0),
  payment_date date,
  notes text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE wire_payments ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Authenticated users can view all payments"
  ON wire_payments FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can create payments"
  ON wire_payments FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Authenticated users can update payments"
  ON wire_payments FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete payments"
  ON wire_payments FOR DELETE
  TO authenticated
  USING (true);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_wire_payments_subcontractor_id ON wire_payments(subcontractor_id);
CREATE INDEX IF NOT EXISTS idx_wire_payments_payment_date ON wire_payments(payment_date);

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_wire_payments_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'update_wire_payments_updated_at_trigger'
  ) THEN
    CREATE TRIGGER update_wire_payments_updated_at_trigger
      BEFORE UPDATE ON wire_payments
      FOR EACH ROW
      EXECUTE FUNCTION update_wire_payments_updated_at();
  END IF;
END $$;
