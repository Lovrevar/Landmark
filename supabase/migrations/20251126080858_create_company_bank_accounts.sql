/*
  # Create Company Bank Accounts Table

  1. New Tables
    - `company_bank_accounts`
      - `id` (uuid, primary key)
      - `company_id` (uuid, foreign key to accounting_companies)
      - `bank_name` (text, name of the bank)
      - `account_number` (text, optional account number)
      - `initial_balance` (numeric, starting balance)
      - `current_balance` (numeric, current balance - updated by payments)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Changes to accounting_invoices
    - Add `company_bank_account_id` (uuid, foreign key to company_bank_accounts)
    - This links each invoice to a specific bank account

  3. Security
    - Enable RLS on `company_bank_accounts` table
    - Add policies for authenticated users to manage bank accounts
    - Update accounting_invoices RLS to include bank account access

  4. Notes
    - Each company can have multiple bank accounts
    - Invoice payments will update the specific bank account balance
    - The `current_balance` is calculated based on initial_balance + all payments
*/

-- Create company_bank_accounts table
CREATE TABLE IF NOT EXISTS company_bank_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES accounting_companies(id) ON DELETE CASCADE,
  bank_name text NOT NULL,
  account_number text,
  initial_balance numeric NOT NULL DEFAULT 0,
  current_balance numeric NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Add company_bank_account_id to accounting_invoices
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'accounting_invoices' AND column_name = 'company_bank_account_id'
  ) THEN
    ALTER TABLE accounting_invoices ADD COLUMN company_bank_account_id uuid REFERENCES company_bank_accounts(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_company_bank_accounts_company_id ON company_bank_accounts(company_id);
CREATE INDEX IF NOT EXISTS idx_accounting_invoices_company_bank_account_id ON accounting_invoices(company_bank_account_id);

-- Enable RLS
ALTER TABLE company_bank_accounts ENABLE ROW LEVEL SECURITY;

-- RLS Policies for company_bank_accounts
CREATE POLICY "Users can view all bank accounts"
  ON company_bank_accounts FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert bank accounts"
  ON company_bank_accounts FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can update bank accounts"
  ON company_bank_accounts FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Users can delete bank accounts"
  ON company_bank_accounts FOR DELETE
  TO authenticated
  USING (true);

-- Function to update bank account balance when payment is made
CREATE OR REPLACE FUNCTION update_company_bank_account_balance()
RETURNS TRIGGER AS $$
BEGIN
  -- When a payment is inserted or updated, update the bank account balance
  IF (TG_OP = 'INSERT' OR TG_OP = 'UPDATE') AND NEW.company_bank_account_id IS NOT NULL THEN
    -- Recalculate the bank account balance based on all associated payments
    UPDATE company_bank_accounts
    SET current_balance = initial_balance + COALESCE(
      (SELECT SUM(
        CASE 
          WHEN ai.invoice_type IN ('INCOMING_SUPPLIER', 'INCOMING_INVESTMENT', 'INCOMING_OFFICE') THEN ap.amount
          WHEN ai.invoice_type IN ('OUTGOING_SUPPLIER', 'OUTGOING_SALES', 'OUTGOING_OFFICE') THEN -ap.amount
          ELSE 0
        END
      )
      FROM accounting_payments ap
      JOIN accounting_invoices ai ON ap.invoice_id = ai.id
      WHERE ai.company_bank_account_id = NEW.company_bank_account_id
      ), 0
    ),
    updated_at = now()
    WHERE id = NEW.company_bank_account_id;
  END IF;

  -- When a payment is deleted, update the bank account balance
  IF TG_OP = 'DELETE' AND OLD.company_bank_account_id IS NOT NULL THEN
    UPDATE company_bank_accounts
    SET current_balance = initial_balance + COALESCE(
      (SELECT SUM(
        CASE 
          WHEN ai.invoice_type IN ('INCOMING_SUPPLIER', 'INCOMING_INVESTMENT', 'INCOMING_OFFICE') THEN ap.amount
          WHEN ai.invoice_type IN ('OUTGOING_SUPPLIER', 'OUTGOING_SALES', 'OUTGOING_OFFICE') THEN -ap.amount
          ELSE 0
        END
      )
      FROM accounting_payments ap
      JOIN accounting_invoices ai ON ap.invoice_id = ai.id
      WHERE ai.company_bank_account_id = OLD.company_bank_account_id
      ), 0
    ),
    updated_at = now()
    WHERE id = OLD.company_bank_account_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger on accounting_payments to update bank account balance
DROP TRIGGER IF EXISTS update_bank_account_balance_trigger ON accounting_payments;
CREATE TRIGGER update_bank_account_balance_trigger
  AFTER INSERT OR UPDATE OR DELETE ON accounting_payments
  FOR EACH ROW
  EXECUTE FUNCTION update_company_bank_account_balance();