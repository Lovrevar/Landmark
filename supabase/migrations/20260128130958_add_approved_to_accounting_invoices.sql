/*
  # Add approved field to accounting invoices

  1. Changes
    - Add `approved` boolean column to `accounting_invoices` table
    - Default value is `false` (not approved)
    - This field will be used in supervision module to mark invoices as reviewed/approved
  
  2. Purpose
    - Track which invoices have been reviewed and approved by supervision
    - Invoices start as not approved (false) when created
    - Supervision team can mark them as approved (true) by clicking checkbox
*/

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


-- Create index for filtering by approval status
CREATE INDEX IF NOT EXISTS idx_accounting_invoices_approved 
ON accounting_invoices(approved);

;