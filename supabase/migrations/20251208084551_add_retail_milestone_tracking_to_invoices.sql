/*
  # Add retail milestone tracking to accounting invoices

  1. Changes
    - Add retail_milestone_id column to accounting_invoices
    - Create foreign key to retail_contract_milestones
    - Create trigger to update retail milestone status when invoice is paid
    - Create trigger to reset retail milestone status when invoice is unpaid/deleted
  
  2. Security
    - No RLS changes needed (uses existing policies)
*/

-- Add retail_milestone_id column
ALTER TABLE accounting_invoices
ADD COLUMN IF NOT EXISTS retail_milestone_id uuid REFERENCES retail_contract_milestones(id) ON DELETE SET NULL;

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_accounting_invoices_retail_milestone 
ON accounting_invoices(retail_milestone_id);

-- Trigger function to update retail milestone status when invoice is paid
CREATE OR REPLACE FUNCTION update_retail_milestone_status_on_payment()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- If invoice is paid and has a retail milestone
  IF NEW.status = 'paid' AND NEW.retail_milestone_id IS NOT NULL THEN
    UPDATE retail_contract_milestones
    SET 
      status = 'paid',
      completed_date = CURRENT_DATE,
      updated_at = now()
    WHERE id = NEW.retail_milestone_id;
  END IF;
  
  -- If invoice was paid but is now unpaid/partial
  IF (OLD.status = 'paid' AND NEW.status != 'paid') 
     AND NEW.retail_milestone_id IS NOT NULL THEN
    UPDATE retail_contract_milestones
    SET 
      status = 'pending',
      completed_date = NULL,
      updated_at = now()
    WHERE id = NEW.retail_milestone_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for updates
DROP TRIGGER IF EXISTS trigger_update_retail_milestone_status ON accounting_invoices;
CREATE TRIGGER trigger_update_retail_milestone_status
AFTER UPDATE OF status ON accounting_invoices
FOR EACH ROW
EXECUTE FUNCTION update_retail_milestone_status_on_payment();

-- Trigger function to reset milestone status when invoice is deleted
CREATE OR REPLACE FUNCTION reset_retail_milestone_on_invoice_delete()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Reset milestone to pending if invoice is deleted and it was paid
  IF OLD.retail_milestone_id IS NOT NULL AND OLD.status = 'paid' THEN
    UPDATE retail_contract_milestones
    SET 
      status = 'pending',
      completed_date = NULL,
      updated_at = now()
    WHERE id = OLD.retail_milestone_id;
  END IF;
  
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for deletes
DROP TRIGGER IF EXISTS trigger_reset_retail_milestone_on_delete ON accounting_invoices;
CREATE TRIGGER trigger_reset_retail_milestone_on_delete
BEFORE DELETE ON accounting_invoices
FOR EACH ROW
EXECUTE FUNCTION reset_retail_milestone_on_invoice_delete();
