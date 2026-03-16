/*
  # Add approved field to accounting_invoices

  1. Changes
    - Add `approved` boolean field to `accounting_invoices` table
    - Default value is `false`
    - This field will be used in supervision module to track invoice approval status
    - When an invoice is created, it starts as unapproved (false)
    - Supervision users can mark invoices as approved by checking a checkbox
*/

-- Add approved field to accounting_invoices
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'accounting_invoices' AND column_name = 'approved'
  ) THEN
    ALTER TABLE accounting_invoices 
    ADD COLUMN approved boolean DEFAULT false NOT NULL;
  END IF;
END $$;
