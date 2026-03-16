/*
  # Add reference_number and iban to accounting_invoices

  1. Changes
    - Add `reference_number` (text, nullable) - Payment reference number (Poziv na broj)
    - Add `iban` (text, nullable) - IBAN bank account number
  
  2. Notes
    - Both fields are optional and can be null
    - No default values needed
    - Fields are used for invoice payment tracking and reference
*/

-- Add reference_number column (Poziv na broj)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'accounting_invoices' AND column_name = 'reference_number'
  ) THEN
    ALTER TABLE accounting_invoices ADD COLUMN reference_number text;
  END IF;
END $$;

-- Add iban column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'accounting_invoices' AND column_name = 'iban'
  ) THEN
    ALTER TABLE accounting_invoices ADD COLUMN iban text;
  END IF;
END $$;
