/*
  # Add Milestone ID to Accounting Invoices

  ## Overview
  Add milestone_id column to accounting_invoices table to link invoices with payment milestones.
  When an invoice is paid and linked to a milestone, the milestone status will be updated to 'paid'.

  ## Changes

  1. Add milestone_id column to accounting_invoices
  2. Add foreign key constraint to subcontractor_milestones
  3. Create trigger to update milestone status when invoice is paid

  ## Security
  - Maintains all RLS policies
  - Ensures data integrity through FK constraints
*/

-- Step 1: Add milestone_id column
ALTER TABLE accounting_invoices
ADD COLUMN IF NOT EXISTS milestone_id uuid REFERENCES subcontractor_milestones(id) ON DELETE SET NULL;

-- Step 2: Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_accounting_invoices_milestone_id 
ON accounting_invoices(milestone_id);

-- Step 3: Create function to update milestone status when invoice is paid
CREATE OR REPLACE FUNCTION update_milestone_status_on_payment()
RETURNS TRIGGER AS $$
BEGIN
  -- If invoice has milestone_id and is fully paid, mark milestone as paid
  IF NEW.milestone_id IS NOT NULL AND NEW.status = 'PAID' THEN
    UPDATE subcontractor_milestones
    SET 
      status = 'paid',
      paid_date = NEW.updated_at
    WHERE id = NEW.milestone_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Step 4: Create trigger on accounting_invoices
DROP TRIGGER IF EXISTS trigger_update_milestone_on_invoice_payment ON accounting_invoices;
CREATE TRIGGER trigger_update_milestone_on_invoice_payment
AFTER UPDATE OF status ON accounting_invoices
FOR EACH ROW
WHEN (NEW.status = 'PAID' AND OLD.status != 'PAID')
EXECUTE FUNCTION update_milestone_status_on_payment();

COMMENT ON COLUMN accounting_invoices.milestone_id IS 'Optional link to a subcontractor milestone. When invoice is paid, milestone status is automatically updated to paid.';
