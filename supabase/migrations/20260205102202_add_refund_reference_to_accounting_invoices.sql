/*
  # Add Refund Reference to Accounting Invoices

  1. Changes
    - Add `refund_id` column to `accounting_invoices` table
    - References `accounting_invoices_refund` table
    - Nullable by default
    
  2. Purpose
    - Link invoices to refund entries when applicable
    - Track which person/entity the refund is for
*/

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'accounting_invoices' AND column_name = 'refund_id'
  ) THEN
    ALTER TABLE accounting_invoices 
    ADD COLUMN refund_id bigint REFERENCES accounting_invoices_refund(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_accounting_invoices_refund_id ON accounting_invoices(refund_id);
