/*
  # Create Accounting Payments Table

  1. New Tables
    - `accounting_payments`
      - `id` (uuid, primary key)
      - `invoice_id` (uuid, foreign key to accounting_invoices)
      - `payment_date` (date) - Datum plaćanja
      - `amount` (decimal) - Iznos plaćanja
      - `payment_method` (text) - Način plaćanja (WIRE, CASH, CHECK, CARD)
      - `reference_number` (text) - Poziv na broj / referenca
      - `description` (text) - Opis plaćanja
      - `created_by` (uuid, foreign key to auth.users)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

  2. Security
    - Enable RLS on `accounting_payments` table
    - Add policies for authenticated users to manage payments

  3. Indexes
    - Add index on invoice_id for faster lookups
    - Add index on payment_date for date-based queries

  4. Triggers
    - Add trigger to update invoice paid_amount and status
    - Add trigger to update timestamps
*/

-- Create accounting_payments table
CREATE TABLE IF NOT EXISTS accounting_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL REFERENCES accounting_invoices(id) ON DELETE CASCADE,
  payment_date date NOT NULL DEFAULT CURRENT_DATE,
  amount decimal(15,2) NOT NULL CHECK (amount > 0),
  payment_method text NOT NULL CHECK (payment_method IN ('WIRE', 'CASH', 'CHECK', 'CARD')),
  reference_number text,
  description text DEFAULT '',
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_accounting_payments_invoice_id ON accounting_payments(invoice_id);
CREATE INDEX IF NOT EXISTS idx_accounting_payments_payment_date ON accounting_payments(payment_date);
CREATE INDEX IF NOT EXISTS idx_accounting_payments_created_by ON accounting_payments(created_by);

-- Enable RLS
ALTER TABLE accounting_payments ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Authenticated users can view all payments"
  ON accounting_payments FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert payments"
  ON accounting_payments FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update payments"
  ON accounting_payments FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete payments"
  ON accounting_payments FOR DELETE
  TO authenticated
  USING (true);

-- Function to update invoice payment status
CREATE OR REPLACE FUNCTION update_invoice_payment_status()
RETURNS TRIGGER AS $$
DECLARE
  total_paid decimal(15,2);
  invoice_total decimal(15,2);
  new_status text;
BEGIN
  -- Get total paid amount for the invoice
  SELECT COALESCE(SUM(amount), 0)
  INTO total_paid
  FROM accounting_payments
  WHERE invoice_id = COALESCE(NEW.invoice_id, OLD.invoice_id);

  -- Get invoice total amount
  SELECT total_amount
  INTO invoice_total
  FROM accounting_invoices
  WHERE id = COALESCE(NEW.invoice_id, OLD.invoice_id);

  -- Determine new status
  IF total_paid = 0 THEN
    new_status := 'UNPAID';
  ELSIF total_paid >= invoice_total THEN
    new_status := 'PAID';
  ELSE
    new_status := 'PARTIALLY_PAID';
  END IF;

  -- Update invoice
  UPDATE accounting_invoices
  SET 
    paid_amount = total_paid,
    remaining_amount = total_amount - total_paid,
    status = new_status,
    updated_at = now()
  WHERE id = COALESCE(NEW.invoice_id, OLD.invoice_id);

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to update invoice on payment insert/update/delete
DROP TRIGGER IF EXISTS trg_update_invoice_on_payment_change ON accounting_payments;
CREATE TRIGGER trg_update_invoice_on_payment_change
  AFTER INSERT OR UPDATE OR DELETE ON accounting_payments
  FOR EACH ROW
  EXECUTE FUNCTION update_invoice_payment_status();

-- Trigger to update timestamps
CREATE OR REPLACE FUNCTION update_accounting_payments_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_update_accounting_payments_timestamp ON accounting_payments;
CREATE TRIGGER trg_update_accounting_payments_timestamp
  BEFORE UPDATE ON accounting_payments
  FOR EACH ROW
  EXECUTE FUNCTION update_accounting_payments_updated_at();
